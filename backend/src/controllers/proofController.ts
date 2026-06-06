import type { Request, Response } from "express";
import Busboy from "busboy";
import { admin, db } from "@/services/firestore";
import { uploadProofImageToStorage } from "@/services/proofStorageService";
import { randomUUID } from "node:crypto";
import { isProofMimeTypeAllowed, normalizeProofMimeType } from "@/services/proofUtils";
import { createRespondOnce } from "@/utils/respondOnce";
import type { ProofVerificationJob } from "@/types/firestore";

const MAX_FILE_SIZE = Number.parseInt(process.env.PROOF_MAX_FILE_SIZE ?? "5000000", 10);
const PROOF_JOBS_COLLECTION = "proof_verification_jobs";

interface UploadState {
  fileSeen: boolean;
  mimeType: string | null;
  chunks: Buffer[];
  fileSizeBytes: number;
  streamError: Error | null;
}

function sendError(res: Response, status: number, error: string, details?: unknown): Response {
  return res.status(status).json({ success: false, data: null, error, details: details ?? null });
}

function normalizeField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export class ProofController {
  static async uploadProof(
    req: Request & { user?: { uid?: string } | null },
    res: Response
  ): Promise<Response | void> {
    const requesterId = req.user?.uid;
    if (!requesterId) {
      return sendError(res, 401, "Unauthorized");
    }

    const fields: Record<string, string> = {};
    const state: UploadState = {
      fileSeen: false,
      mimeType: null,
      chunks: [],
      fileSizeBytes: 0,
      streamError: null,
    };

    const respond = createRespondOnce(res);

    const bb = Busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: MAX_FILE_SIZE },
    });

    bb.on("field", (name, value) => {
      fields[name] = value;
    });

    bb.on("file", (_name, file, info) => {
      if (state.fileSeen) {
        state.streamError = new Error("Only one image file is allowed");
        file.resume();
        return;
      }

      state.fileSeen = true;
      state.mimeType = normalizeProofMimeType(info.mimeType);

      if (!isProofMimeTypeAllowed(info.mimeType)) {
        state.streamError = new Error("Only image files are supported");
        file.resume();
        return;
      }

      file.on("data", (chunk: Buffer) => {
        state.fileSizeBytes += chunk.byteLength;
        if (state.fileSizeBytes > MAX_FILE_SIZE) {
          state.streamError = new Error(`Image exceeds ${MAX_FILE_SIZE} bytes`);
          file.resume();
          return;
        }
        state.chunks.push(chunk);
      });
    });

    bb.on("error", (error) => {
      let message = "Failed to parse proof upload";
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === "string") {
        message = error;
      }
      state.streamError = new Error(message);
    });

    bb.on("finish", async () => {
      if (respond.hasResponded) return;

      if (state.streamError) {
        return respond.error(400, state.streamError.message);
      }

      if (!state.fileSeen || !state.mimeType || state.chunks.length === 0) {
        return respond.error(400, "Image proof file is required");
      }

      const sessionId = normalizeField(fields.sessionId);
      const interactionId = normalizeField(fields.interactionId);
      const question = normalizeField(fields.question);
      const answer = normalizeField(fields.answer);

      if (!sessionId || !interactionId || !question || !answer) {
        return respond.error(400, "sessionId, interactionId, question, and answer are required");
      }

      const participantRef = db.collection("participants").doc(requesterId);
      const participantSnap = await participantRef.get();
      if (!participantSnap.exists) {
        return respond.error(404, "Participant not found");
      }

      const interactionRef = participantRef
        .collection("sessions")
        .doc(sessionId)
        .collection("interactions")
        .doc(interactionId);
      const interactionSnap = await interactionRef.get();
      if (!interactionSnap.exists) {
        return respond.error(404, "Interaction not found");
      }

      try {
        const imageBuffer = Buffer.concat(state.chunks);
        const stored = await uploadProofImageToStorage({
          userId: requesterId,
          sessionId,
          interactionId,
          buffer: imageBuffer,
          mimeType: state.mimeType,
        });

        const jobId = randomUUID();
        const jobPayload = {
          id: jobId,
          userId: requesterId,
          sessionId,
          interactionId,
          question,
          answer,
          storagePath: stored.storagePath,
          mimeType: stored.mimeType,
          checksum: stored.checksum,
          status: "queued",
          proofStatus: "pending",
        } satisfies Omit<ProofVerificationJob, "createdAt">;

        await db
          .collection(PROOF_JOBS_COLLECTION)
          .doc(jobId)
          .set({
            ...jobPayload,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        await interactionRef.set(
          {
            proofJobId: jobId,
            proofStatus: "pending",
            proofStoragePath: stored.storagePath,
            proofUploadedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // The Firestore document creation automatically triggers the Cloud Function
        // No in-memory queue needed. This ensures infinite scalability and zero job loss.

        return respond.success(202, {
          jobId,
          proofStatus: "pending",
          storagePath: stored.storagePath,
        });
      } catch (error) {
        console.error("Proof upload failed:", error);
        return respond.error(500, "Failed to upload proof image");
      }
    });

    req.pipe(bb);
  }

  static async getProofStatus(
    req: Request & { user?: { uid?: string } | null },
    res: Response
  ): Promise<Response | void> {
    const requesterId = req.user?.uid;
    const jobId = normalizeField(req.params.jobId);

    if (!requesterId) return sendError(res, 401, "Unauthorized");
    if (!jobId) return sendError(res, 400, "jobId is required");

    const jobSnap = await db.collection(PROOF_JOBS_COLLECTION).doc(jobId).get();
    if (!jobSnap.exists) return sendError(res, 404, "Proof job not found");

    const jobData = jobSnap.data();
    if (jobData?.userId !== requesterId) {
      return sendError(res, 403, "Forbidden");
    }

    return res.json({ success: true, data: jobData, error: null });
  }
}
