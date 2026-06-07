import type { ProofStatus, ProofTier } from "@/types/firestore";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export function normalizeProofMimeType(mimeType: string): string {
  const lowered = mimeType.trim().toLowerCase();
  if (lowered === "image/jpg") return "image/jpeg";
  return lowered;
}

export function isProofMimeTypeAllowed(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(normalizeProofMimeType(mimeType));
}

export function normalizeProofStatus(status: unknown): ProofStatus {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  if (normalized === "needs_more_evidence") return "needs_more_evidence";
  if (normalized === "processing") return "processing";
  if (normalized === "pending") return "pending";
  return "error";
}

export function clampConfidence(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
}

export function resolveProofTier(status: ProofStatus, confidence: number): ProofTier {
  if (status !== "approved") return "t2";
  if (confidence >= 0.9) return "t4";
  if (confidence >= 0.7) return "t3";
  return "t2";
}
