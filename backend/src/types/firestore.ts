import type admin from "firebase-admin";
import type { Request } from "express";

export type Address = {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt: number;
  updatedAt: number;
  fullName?: string | null;
  schoolName?: string | null;
  schoolAddress?: string | null;
  address?: Address | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  ethnicity?: string | null;
  pageUrl?: string | null;
  phone?: string | null;
  metadata: Record<string, unknown>;
}
export type ProofStatus =
  | "pending"
  | "processing"
  | "approved"
  | "rejected"
  | "needs_more_evidence"
  | "error";

export type ProofTier = "t1" | "t2" | "t3" | "t4";

export interface UserFileEmbedding {
  id?: string;
  userId: string;
  fileName: string;
  storagePath: string;
  bucket: string;
  fileSizeBytes: number;
  contentType: string;
  extractedText: string;
  embedding: number[];
  embeddingModel: string;
  createdAt: FirebaseFirestore.FieldValue;
}

export interface ProofVerificationJob {
  id?: string;
  userId: string;
  sessionId: string;
  interactionId: string;
  question: string;
  answer: string;
  status: "queued" | "processing" | "completed" | "failed";
  proofStatus: ProofStatus;
  storagePath: string;
  mimeType: string;
  checksum: string;
  createdAt?: FirestoreDateValue;
  startedAt?: FirestoreDateValue;
  analyzedAt?: FirestoreDateValue;
  finishedAt?: FirestoreDateValue;
  verificationConfidence?: number | null;
  proofTier?: ProofTier | null;
  userFeedbackMessage?: string | null;
  requiredAction?: string | null;
  errorMessage?: string | null;
}
export type SessionStatus = "active" | "completed" | "cancelled";

export type FirestoreDateValue = number | string | FirebaseFirestore.Timestamp | null;

export interface SessionRecord {
  id?: string;
  userId: string;
  topic: string;
  status: SessionStatus;
  startedAt: number;
  endedAt?: number;

  alreadyMappedCount?: number;
  categoriesMapped?: string[];
  categoriesMappedCount?: number;
  completedAt?: FirestoreDateValue;
  lastActiveAt?: FirestoreDateValue;
  weakFitCount?: number;
  totalInteractions?: number;
  interactions?: InteractionRecord[];
}

export interface InteractionRecord {
  id?: string;
  sequenceIndex: number;
  question: string;
  answer: string;
  inputMethod: "text" | "voice" | "image";
  mappingOutcome: "mapped" | "already_mapped" | "weak_fit" | "invalid";
  mappedCategory: string | null;
  isWeakFit: boolean;
  isAlreadyMapped: boolean;
  justification: string;
  matchedToCategory: string | null;
  matchedToSequenceIndex: number | null;
  timestamp: FirestoreDateValue;
  proofJobId?: string | null;
  proofStatus?: ProofStatus | null;
  proofStoragePath?: string | null;
  proofUploadedAt?: FirestoreDateValue;
  proofAnalyzedAt?: FirestoreDateValue;
  proofTier?: ProofTier | null;
  proofConfidence?: number | null;
  proofFeedbackMessage?: string | null;
  proofRequiredAction?: string | null;
}

export type AuthenticatedRequest = Request & {
  user: admin.auth.DecodedIdToken;
};
