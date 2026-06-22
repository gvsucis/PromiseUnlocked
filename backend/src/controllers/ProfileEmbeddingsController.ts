import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "@/types/firestore";
import Busboy from "busboy";
import crypto from "node:crypto";
import { admin, db } from "@/services/firestore";
import { isAllowedMimeType, uploadMemoryFile } from "@/services/memoryFileStorageService";
import {
  saveEmbedding,
  findEmbeddingByChecksum,
  listEmbeddings as listUserEmbeddings,
  getEmbedding as getUserEmbedding,
  searchEmbeddings as searchUserEmbeddings,
} from "@/services/userFileEmbeddingService";
import { extractTextFromPdfBuffer, generatePdfEmbedding } from "@/workers/embeddingWorker";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface FileBufferState {
  chunks: Buffer[];
  filename: string;
  mimeType: string;
  totalSize: number;
  error: Error | null;
}

export class ProfileEmbeddingsController {
  private static async resolveTargetUid(
    fields: Record<string, string>,
    authUser: admin.auth.DecodedIdToken
  ): Promise<string | null> {
    const explicitUserId = fields.userId?.trim() || fields.uid?.trim();
    const email = fields.email?.trim();

    if (explicitUserId) {
      try {
        const userRecord = await admin.auth().getUser(explicitUserId);
        return userRecord.uid;
      } catch (err) {
        console.error(`[MemoryUpload] User lookup by UID failed: ${explicitUserId}`, err);
        return null;
      }
    }

    if (email) {
      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        return userRecord.uid;
      } catch (err) {
        console.error(`[MemoryUpload] User lookup by email failed: ${email}`, err);
        return null;
      }
    }

    return authUser.uid;
  }

  static async uploadPdf(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (authUser.isAnonymous ?? false) {
      return res.status(403).json({ error: "Guest users cannot upload files." });
    }

    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_FILE_SIZE },
    });

    const fields: Record<string, string> = {};
    const state: FileBufferState = {
      chunks: [],
      filename: "",
      mimeType: "",
      totalSize: 0,
      error: null,
    };

    bb.on("field", (fieldname: string, val: string) => {
      fields[fieldname] = val;
    });

    bb.on(
      "file",
      (
        fieldname: string,
        fileStream: NodeJS.ReadableStream,
        info: { filename: string; encoding: string; mimeType: string }
      ) => {
        state.filename = info.filename;
        state.mimeType = info.mimeType;

        fileStream.on("data", (chunk: Buffer) => {
          state.chunks.push(chunk);
          state.totalSize += chunk.length;
          if (state.totalSize > MAX_FILE_SIZE) {
            state.error = new Error("File exceeds the 5MB maximum size.");
            fileStream.resume();
          }
        });

        fileStream.on("limit", () => {
          state.error = new Error("File exceeds the 5MB maximum size.");
        });

        fileStream.on("error", (err: Error) => {
          state.error = err;
        });
      }
    );

    bb.on("finish", async () => {
      if (state.error) {
        return res.status(400).json({ error: state.error.message });
      }
      if (!state.chunks.length) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      if (!isAllowedMimeType(state.mimeType)) {
        return res.status(400).json({ error: "Only PDF files are accepted (5MB max)." });
      }

      const targetUid = await ProfileEmbeddingsController.resolveTargetUid(fields, authUser);
      if (!targetUid) {
        return res
          .status(404)
          .json({ error: "Target user not found. Provide a valid userId, uid, or email." });
      }

      const fileBuffer = Buffer.concat(state.chunks);
      const checksum = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      // Duplicate detection: return the existing record without re-processing.
      const existing = await findEmbeddingByChecksum(targetUid, checksum);
      if (existing) {
        console.log(
          `[MemoryUpload] Duplicate detected for user ${targetUid}, returning existing ${existing.id}`
        );
        return res.status(200).json({
          embeddingId: existing.id,
          targetUid,
          fileName: existing.fileName,
          fileSizeBytes: existing.fileSizeBytes,
          message: "File already uploaded — returning existing embedding",
          duplicate: true,
        });
      }

      let gcsResult;
      try {
        gcsResult = await uploadMemoryFile({
          userId: targetUid,
          fileName: state.filename,
          fileBuffer,
          contentType: state.mimeType,
        });
      } catch (err) {
        console.error("[MemoryUpload] GCS upload failed:", err);
        return res.status(500).json({ error: "File storage failed" });
      }

      const uint8 = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);
      let extractedText = "";
      let vector: number[] | null = null;
      try {
        extractedText = await extractTextFromPdfBuffer(uint8, 12);
        vector = await generatePdfEmbedding(uint8, extractedText || state.filename);
      } catch (err) {
        console.error("[MemoryUpload] Embedding generation failed:", err);
        return res.status(500).json({ error: "Embedding generation failed" });
      }

      let truncatedText = state.filename;
      if (extractedText) {
        const limit = 12000;
        if (extractedText.length <= limit) {
          truncatedText = extractedText;
        } else {
          const cutAt = extractedText.lastIndexOf(" ", limit);
          truncatedText = extractedText.slice(0, cutAt > 0 ? cutAt : limit);
        }
      }

      try {
        const embeddingId = await saveEmbedding(targetUid, {
          userId: targetUid,
          fileName: state.filename,
          storagePath: gcsResult.storagePath,
          bucket: gcsResult.bucket,
          fileSizeBytes: fileBuffer.length,
          contentType: state.mimeType,
          extractedText: truncatedText,
          embedding: vector,
          embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-2",
          checksum,
        });

        console.log(`[MemoryUpload] Saved embedding ${embeddingId} for user ${targetUid}`);
        return res.status(201).json({
          embeddingId,
          targetUid,
          fileName: state.filename,
          fileSizeBytes: fileBuffer.length,
          message: "Upload successful",
          duplicate: false,
        });
      } catch (err) {
        console.error("[MemoryUpload] Firestore write failed:", err);
        return res.status(500).json({ error: "Failed to save embedding record" });
      }
    });

    bb.on("error", (err: Error) => {
      console.error("[MemoryUpload] Busboy error:", err);
      if (!res.headersSent) {
        res.status(400).json({ error: err.message || "Upload parsing failed" });
      }
    });

    req.pipe(bb);
  }

  static async listEmbeddings(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) return res.status(401).json({ error: "Authentication required" });

    try {
      const items = await listUserEmbeddings(authUser.uid);
      return res.json({ embeddings: items });
    } catch (err) {
      console.error("[MemoryUpload] listEmbeddings error:", err);
      return res.status(500).json({ error: "Failed to list embeddings" });
    }
  }

  static async getEmbeddingContext(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) return res.status(401).json({ error: "Authentication required" });

    const { embeddingId } = req.params as { embeddingId?: string };
    if (!embeddingId) return res.status(400).json({ error: "Missing embeddingId" });

    try {
      const embedding = await getUserEmbedding(authUser.uid, embeddingId);
      if (!embedding) return res.status(404).json({ error: "Embedding not found" });
      return res.json({ embedding });
    } catch (err) {
      console.error("[MemoryUpload] getEmbeddingContext error:", err);
      return res.status(500).json({ error: "Failed to get embedding" });
    }
  }

  static async searchEmbeddingsHandler(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) return res.status(401).json({ error: "Authentication required" });

    const { query } = req.body as { query?: string };
    const rawLimit = typeof req.body.limit === "number" ? req.body.limit : 5;
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 20 ? Math.floor(rawLimit) : 5;

    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ error: "Query string is required" });
    }

    try {
      const results = await searchUserEmbeddings(authUser.uid, query.trim(), limit);

      return res.json({ results });
    } catch (err) {
      console.error("[MemoryUpload] searchEmbeddings error:", err);
      return res.status(500).json({ error: "Search failed" });
    }
  }

  static async getJobStatus(req: Request, res: Response) {
    try {
      const { jobId } = req.params as { jobId?: string };
      if (!jobId) return res.status(400).json({ error: "Missing jobId" });
      const jobDoc = await db.collection("profile_embedding_jobs").doc(jobId).get();
      if (!jobDoc.exists) return res.status(404).json({ error: "Job not found" });
      return res.status(200).json({ job: jobDoc.data() });
    } catch (error) {
      console.error("getJobStatus error:", error);
      return res.status(500).json({ error: "Could not get job status" });
    }
  }
}
