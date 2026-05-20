import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/firestore";
import { v4 as uuidv4 } from "uuid";
import { db } from "../services/firestore";
import { enqueueJob } from "../workers/embeddingWorker";
import Busboy from "busboy";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const CONSTANTS = {
  COLLECTION_JOBS: "profile_embedding_jobs",
  UPLOAD_ROOT: path.resolve(process.cwd(), "uploads", "profile-embeddings"),
  MAX_FILE_SIZE: 20 * 1024 * 1024,
  ALLOWED_MIME_TYPE: "application/pdf",
} as const;

interface FileInfo {
  filename: string;
  encoding: string;
  mimeType: string;
}

interface FileUploadState {
  tmpStoragePath: string | null;
  originalFileName: string | null;
  contentType: string | null;
  errorOccurred: Error | null;
  fileSeen: boolean;
}

export class ProfileEmbeddingsController {
  private static async cleanupTmpFile(path: string | null | undefined): Promise<void> {
    if (!path) return;
    try {
      await fs.unlink(path);
    } catch {
      // Silently ignore cleanup errors
    }
  }

  private static getOwnerFromRequest(req: Request, fields: Record<string, string>): string | null {
    const userId = fields.userId;
    const email = fields.email;
    const authUser = (req as AuthenticatedRequest).user;
    return userId ?? email ?? authUser?.uid ?? authUser?.email ?? null;
  }

  static async uploadPdf(req: Request, res: Response) {
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: CONSTANTS.MAX_FILE_SIZE },
    });
    const tempId = uuidv4();
    const fields: Record<string, string> = {};
    const uploadPromises: Promise<void>[] = [];

    const state: FileUploadState = {
      tmpStoragePath: null,
      originalFileName: null,
      contentType: null,
      errorOccurred: null,
      fileSeen: false,
    };

    bb.on("field", (fieldname: string, val: string) => {
      fields[fieldname] = val;
    });

    bb.on("file", (fieldname: string, fileStream: NodeJS.ReadableStream, info: FileInfo) => {
      if (state.fileSeen) {
        state.errorOccurred = new Error("Multiple files not supported");
        fileStream.resume();
        return;
      }

      state.fileSeen = true;
      const { filename, mimeType } = info;
      const safeFileName = path.basename(filename).replace(/[\\/]/g, "_");

      if (mimeType !== CONSTANTS.ALLOWED_MIME_TYPE) {
        state.errorOccurred = new Error("Only PDF files are accepted");
        fileStream.resume();
        return;
      }

      state.originalFileName = filename;
      state.contentType = mimeType;
      state.tmpStoragePath = path.join(
        CONSTANTS.UPLOAD_ROOT,
        "tmp",
        `${process.env.NODE_ENV || "dev"}-${tempId}-${safeFileName}`
      );

      const uploadPromise = (async () => {
        await fs.mkdir(path.dirname(state.tmpStoragePath as string), { recursive: true });
        await pipeline(fileStream, createWriteStream(state.tmpStoragePath as string));
      })().catch((err) => {
        state.errorOccurred = err instanceof Error ? err : new Error(String(err));
        throw err;
      });

      uploadPromises.push(uploadPromise);
    });

    bb.on("finish", async () => {
      if (state.errorOccurred) {
        console.error("Upload stream error:", state.errorOccurred);
        await ProfileEmbeddingsController.cleanupTmpFile(state.tmpStoragePath);
        return res.status(400).json({ error: state.errorOccurred.message });
      }

      try {
        await Promise.all(uploadPromises);
      } catch (err) {
        console.error("Error finishing upload streams:", err);
        await ProfileEmbeddingsController.cleanupTmpFile(state.tmpStoragePath);
        return res.status(500).json({ error: "Upload failed during write" });
      }

      if (!state.tmpStoragePath || !state.originalFileName || !state.contentType) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const owner = ProfileEmbeddingsController.getOwnerFromRequest(req, fields);
      if (!owner) {
        await ProfileEmbeddingsController.cleanupTmpFile(state.tmpStoragePath);
        return res.status(400).json({ error: "No userId or email provided" });
      }

      // Ensure the owner corresponds to an existing participant
      // (uploads are only allowed for existing participants)
      const authUser = (req as AuthenticatedRequest).user;
      const { findParticipantRef } = await import("@/services/participantService");
      const participantRef = await findParticipantRef(owner, authUser);
      if (!participantRef) {
        await ProfileEmbeddingsController.cleanupTmpFile(state.tmpStoragePath);
        return res.status(404).json({ error: "Participant not found" });
      }

      const timestamp = Date.now();
      const fileName = `${timestamp}-${state.originalFileName}`;
      const finalStoragePath = path.join(CONSTANTS.UPLOAD_ROOT, owner, fileName);

      try {
        await fs.mkdir(path.dirname(finalStoragePath), { recursive: true });
        await fs.rename(state.tmpStoragePath, finalStoragePath);

        const jobId = uuidv4();
        const payload = {
          jobId,
          owner,
          storagePath: finalStoragePath,
          fileName: state.originalFileName,
          text: fields.text ?? null,
        };

        // Enqueue the job payload for local processing (no Firestore job documents).
        enqueueJob(payload).catch((err) => console.error("Enqueue failed:", err));

        console.log(`Upload accepted: job=${jobId} owner=${owner} file=${fileName}`);
        return res.status(202).json({ jobId, message: "Upload accepted" });
      } catch (err) {
        console.error("Error moving file or creating job:", err);
        await this.cleanupTmpFile(state.tmpStoragePath);
        return res.status(500).json({ error: "Upload failed" });
      }
    });

    req.pipe(bb);
  }

  static async getJobStatus(req: Request, res: Response) {
    try {
      const { jobId } = req.params as { jobId?: string };
      if (!jobId) {
        return res.status(400).json({ error: "Missing jobId" });
      }
      const jobDoc = await db.collection(CONSTANTS.COLLECTION_JOBS).doc(jobId).get();

      if (!jobDoc.exists) {
        return res.status(404).json({ error: "Job not found" });
      }

      return res.status(200).json({ job: jobDoc.data() });
    } catch (error) {
      console.error("getJobStatus error:", error);
      return res.status(500).json({ error: "Could not get job status" });
    }
  }
}
