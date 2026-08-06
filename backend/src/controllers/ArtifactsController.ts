import type { Request, Response } from "express";
import type { AuthenticatedRequest, UserArtifact } from "@/types/firestore";
import Busboy from "busboy";
import { admin, db } from "@/services/firestore";
import { feedBusboy } from "@/utils/multipart";
import {
  isAllowedMimeType,
  uploadArtifact,
  deleteArtifactFile,
  getArtifactSignedUrl,
} from "@/services/artifactStorageService";
import { randomUUID } from "node:crypto";
import { isFailedOrStale, discardArtifact } from "@/utils/artifactUtils";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function artifactsSubcollection(userId: string) {
  return db.collection("users").doc(userId).collection("artifacts");
}

const VALID_KINDS = new Set(["essay", "citation", "transcript", "other"]);

function normalizeKind(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "other";
  return VALID_KINDS.has(raw) ? raw : "other";
}

export class ArtifactsController {
  static async upload(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) {
      return res.status(401).json({ success: false, data: null, error: "Authentication required" });
    }

    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return res.status(400).json({
        success: false,
        data: null,
        error: "Use multipart/form-data with 'file' field.",
      });
    }

    const fields: Record<string, string> = {};
    const state: {
      chunks: Buffer[];
      filename: string;
      mimeType: string;
      totalSize: number;
      error: Error | null;
    } = {
      chunks: [],
      filename: "",
      mimeType: "",
      totalSize: 0,
      error: null,
    };

    const bb = Busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_SIZE } });

    bb.on("field", (name: string, val: string) => {
      fields[name] = val;
    });

    bb.on("file", (_field, fileStream, info) => {
      state.filename = info.filename;
      state.mimeType = info.mimeType;

      if (!isAllowedMimeType(info.mimeType)) {
        state.error = new Error("Only PDF, DOCX, and TXT files are accepted (5MB max).");
        fileStream.resume();
        return;
      }

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
    });

    bb.on("finish", async () => {
      if (state.error) {
        return res.status(400).json({ success: false, data: null, error: state.error.message });
      }
      if (!state.chunks.length) {
        return res.status(400).json({ success: false, data: null, error: "No file uploaded" });
      }

      const kind = normalizeKind(fields.kind);
      const fileBuffer = Buffer.concat(state.chunks);

      let stored;
      try {
        stored = await uploadArtifact({
          userId: authUser.uid,
          fileName: state.filename,
          fileBuffer,
          contentType: state.mimeType,
        });
      } catch (err) {
        console.error("[Artifacts] Storage upload failed:", err);
        return res.status(500).json({ success: false, data: null, error: "File storage failed" });
      }

      const artifactId = randomUUID();
      const docRef = artifactsSubcollection(authUser.uid).doc(artifactId);

      const entry: Omit<UserArtifact, "createdAt"> = {
        id: artifactId,
        userId: authUser.uid,
        fileName: state.filename,
        storagePath: stored.storagePath,
        bucket: stored.bucket,
        fileSizeBytes: fileBuffer.length,
        contentType: state.mimeType,
        checksum: stored.checksum,
        extractedText: "",
        embedding: null,
        embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-2",
        embeddingsStatus: "processing",
        kind: kind as "essay" | "citation" | "transcript" | "other",
      };

      try {
        await docRef.set({
          ...entry,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(201).json({
          success: true,
          data: {
            id: artifactId,
            fileName: state.filename,
            fileSizeBytes: fileBuffer.length,
            contentType: state.mimeType,
            kind,
            embeddingsStatus: entry.embeddingsStatus,
          },
          error: null,
        });
      } catch (err) {
        console.error("[Artifacts] Firestore write failed:", err);
        return res
          .status(500)
          .json({ success: false, data: null, error: "Failed to save artifact" });
      }
    });

    bb.on("error", (err: Error) => {
      if (!res.headersSent) {
        res
          .status(400)
          .json({ success: false, data: null, error: err.message || "Upload parsing failed" });
      }
    });

    feedBusboy(req, bb);
  }

  static async list(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) {
      return res.status(401).json({ success: false, data: null, error: "Authentication required" });
    }

    try {
      const snapshot = await artifactsSubcollection(authUser.uid)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();

      const artifacts = [];
      const cleanupTasks: Promise<void>[] = [];

      for (const doc of snapshot.docs) {
        const data = doc.data() as UserArtifact;
        const raw = data as unknown as Record<string, unknown>;

        if (isFailedOrStale(raw)) {
          cleanupTasks.push(discardArtifact(doc.ref, data.storagePath));
          continue;
        }

        let previewUrl = "";
        try {
          previewUrl = await getArtifactSignedUrl(data.storagePath);
        } catch {
          // best-effort
        }

        artifacts.push({
          id: doc.id,
          fileName: data.fileName,
          fileSizeBytes: data.fileSizeBytes,
          contentType: data.contentType,
          kind: data.kind ?? "other",
          embeddingsStatus: data.embeddingsStatus ?? "failed",
          createdAt: data.createdAt,
          previewUrl,
        });
      }

      if (cleanupTasks.length > 0) {
        Promise.all(cleanupTasks).catch((err) => console.error("[Artifacts] Cleanup failed:", err));
      }

      return res.json({ success: true, data: artifacts, error: null });
    } catch (err) {
      console.error("[Artifacts] List failed:", err);
      return res
        .status(500)
        .json({ success: false, data: null, error: "Failed to list artifacts" });
    }
  }

  static async getById(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) {
      return res.status(401).json({ success: false, data: null, error: "Authentication required" });
    }

    const id = req.params.id as string | undefined;
    if (!id) {
      return res.status(400).json({ success: false, data: null, error: "Missing artifact id" });
    }

    try {
      const docRef = artifactsSubcollection(authUser.uid).doc(id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ success: false, data: null, error: "Artifact not found" });
      }

      const data = doc.data() as UserArtifact;
      const raw = data as unknown as Record<string, unknown>;

      if (isFailedOrStale(raw)) {
        await discardArtifact(docRef, data.storagePath);
        return res.status(404).json({
          success: false,
          data: null,
          error: "Artifact discarded — embedding failed or timed out",
        });
      }

      const previewUrl = await getArtifactSignedUrl(data.storagePath).catch(() => "");

      return res.json({
        success: true,
        data: {
          id: doc.id,
          fileName: data.fileName,
          fileSizeBytes: data.fileSizeBytes,
          contentType: data.contentType,
          kind: data.kind ?? "other",
          embeddingsStatus: data.embeddingsStatus ?? "failed",
          createdAt: data.createdAt,
          previewUrl,
        },
        error: null,
      });
    } catch (err) {
      console.error("[Artifacts] Get failed:", err);
      return res.status(500).json({ success: false, data: null, error: "Failed to get artifact" });
    }
  }

  static async delete(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) {
      return res.status(401).json({ success: false, data: null, error: "Authentication required" });
    }

    const id = req.params.id as string | undefined;
    if (!id) {
      return res.status(400).json({ success: false, data: null, error: "Missing artifact id" });
    }

    try {
      const docRef = artifactsSubcollection(authUser.uid).doc(id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ success: false, data: null, error: "Artifact not found" });
      }

      const data = doc.data() as UserArtifact;
      await deleteArtifactFile(data.storagePath);
      await docRef.delete();

      import("@/services/artifactBriefService").then(({ regenerateArtifactBrief }) => {
        regenerateArtifactBrief(authUser.uid).catch((err) =>
          console.warn("[Artifacts] Brief regeneration after delete failed:", err)
        );
      });

      return res.json({ success: true, data: null, error: null });
    } catch (err) {
      console.error("[Artifacts] Delete failed:", err);
      return res
        .status(500)
        .json({ success: false, data: null, error: "Failed to delete artifact" });
    }
  }

  static async getBrief(req: Request, res: Response) {
    const authUser = (req as AuthenticatedRequest).user;
    if (!authUser) {
      return res.status(401).json({ success: false, data: null, error: "Authentication required" });
    }

    try {
      const { getArtifactBrief, regenerateArtifactBrief } =
        await import("@/services/artifactBriefService");
      let brief = await getArtifactBrief(authUser.uid);
      if (!brief) {
        brief = await regenerateArtifactBrief(authUser.uid);
      }
      return res.json({ success: true, data: { brief }, error: null });
    } catch (err) {
      console.error("[Artifacts] Get brief failed:", err);
      return res.status(500).json({ success: false, data: null, error: "Failed to get brief" });
    }
  }
}
