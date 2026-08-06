import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { admin, db } from "@/services/firestore";
import { downloadProofImageFromStorage } from "@/services/proofStorageService";
import {
  encodeProofImageBuffer,
  verifyProofImage,
  type ProofVerificationResult,
} from "@/services/proofVerificationService";
import type { ProofVerificationJob } from "@/types/firestore";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

const PROOF_JOBS_COLLECTION = "proof_verification_jobs";

function getJobsCollection() {
  return db.collection(PROOF_JOBS_COLLECTION);
}

async function updateJob(jobId: string, patch: Record<string, unknown>) {
  await getJobsCollection().doc(jobId).set(patch, { merge: true });
}

function getInteractionRef(job: ProofVerificationJob) {
  return db
    .collection("participants")
    .doc(job.userId)
    .collection("sessions")
    .doc(job.sessionId)
    .collection("interactions")
    .doc(job.interactionId);
}

function buildInteractionPatch(job: ProofVerificationJob, verification?: ProofVerificationResult) {
  return {
    proofJobId: job.id ?? null,
    proofStatus: verification?.proofStatus ?? "error",
    proofStoragePath: job.storagePath,
    proofUploadedAt: admin.firestore.FieldValue.serverTimestamp(),
    proofAnalyzedAt: admin.firestore.FieldValue.serverTimestamp(),
    proofTier: verification?.proofTier ?? null,
    proofConfidence: verification?.verificationConfidence ?? null,
    proofFeedbackMessage:
      verification?.userFeedbackMessage ?? "Verification failed. Please try again.",
    proofRequiredAction:
      verification?.requiredAction ?? "Try uploading a clearer supporting image.",
  };
}

/**
 * Firestore Trigger: Automatically processes proof verification jobs.
 * This replaces the in-memory queue, providing infinite scalability and zero job loss.
 */
export const verifyProof = onDocumentCreated(
  { document: "proof_verification_jobs/{jobId}", secrets: [geminiApiKey] },
  async (event) => {
  const job = event.data?.data() as ProofVerificationJob | undefined;
  const jobId = event.params.jobId;

  if (job?.status !== "queued") {
    return;
  }

  console.log(`[ProofWorker] Starting verification for job: ${jobId}`);

  const interactionRef = getInteractionRef(job);
  const startedAt = admin.firestore.FieldValue.serverTimestamp();

  // Mark as processing in parallel with the GCS download so the network round-trip
  // doesn't add latency to the critical path.
  await Promise.all([
    updateJob(jobId, {
      status: "processing",
      proofStatus: "processing",
      startedAt,
    }),
    interactionRef.set({ proofStatus: "processing", proofJobId: jobId }, { merge: true }),
    downloadProofImageFromStorage(job.storagePath),
  ])
    .then(async ([, , imageBuffer]) => {
      const verification = await verifyProofImage({
        question: job.question,
        answer: job.answer,
        mimeType: job.mimeType,
        imageBase64: encodeProofImageBuffer(imageBuffer),
      });

      console.log(
        `[ProofWorker] Verification complete for job: ${jobId}, tier: ${verification.proofTier}`
      );

      const finishedAt = admin.firestore.FieldValue.serverTimestamp();
      const interactionPatch = buildInteractionPatch(job, verification);

      await Promise.all([
        updateJob(jobId, {
          status: "completed",
          proofStatus: verification.proofStatus,
          proofTier: verification.proofTier,
          verificationConfidence: verification.verificationConfidence,
          userFeedbackMessage: verification.userFeedbackMessage,
          requiredAction: verification.requiredAction,
          analyzedAt: finishedAt,
          finishedAt,
        }),
        interactionRef.set(interactionPatch, { merge: true }),
      ]);
    })
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ProofWorker] Failed job ${jobId}:`, message);

      const finishedAt = admin.firestore.FieldValue.serverTimestamp();
      const interactionPatch = buildInteractionPatch(job);

      await Promise.all([
        updateJob(jobId, {
          status: "failed",
          proofStatus: "error",
          errorMessage: message,
          finishedAt,
        }),
        interactionRef.set(interactionPatch, { merge: true }),
      ]);
    });
});
