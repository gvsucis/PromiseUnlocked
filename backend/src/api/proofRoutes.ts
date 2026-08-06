import express from "express";
import { ProofController } from "@/controllers/proofController";

const router = express.Router();

/**
 * POST /api/chat/proof/upload
 * Multipart upload: fields (sessionId, interactionId, question, answer) + file (image).
 * Streams the file via Busboy, uploads to Firebase Storage, and creates a
 * proof_verification_jobs Firestore doc that the verifyProof Cloud Function picks up.
 */
router.post("/proof/upload", ProofController.uploadProof);

/**
 * GET /api/chat/proof/:jobId
 * Returns the current proof_verification_jobs/{jobId} document (caller must own it).
 */
router.get("/proof/:jobId", ProofController.getProofStatus);

export default router;
