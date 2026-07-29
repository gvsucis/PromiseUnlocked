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
  address?: Address | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  ethnicity?: string | null;
  pageUrl?: string | null;
  phone?: string | null;
  role?: string | null;
  /** Id of the shared PVA catalog entry the user selected to personalize dialogue. */
  selectedPvaId?: string | null;
  metadata: Record<string, unknown>;
  selectedPvaName?: string | null;
  artifactBrief?: string | null;
}

export interface ParticipantProfile extends UserProfile {
  schoolName?: string | null;
  schoolAddress?: string | null;
}
export type ProofStatus =
  | "pending"
  | "processing"
  | "approved"
  | "rejected"
  | "needs_more_evidence"
  | "error";

export type ProofTier = "t1" | "t2" | "t3" | "t4";
export type EmbeddingStatus = "processing" | "ready" | "failed";

export interface UserFileEmbedding {
  id?: string;
  userId: string;
  fileName: string;
  storagePath: string;
  bucket: string;
  fileSizeBytes: number;
  contentType: string;
  extractedText: string;
  embedding: number[] | null;
  embeddingModel: string;
  checksum: string;
  kind?: string;
  createdAt: FirebaseFirestore.FieldValue;
  embeddingStatus?: EmbeddingStatus;
  embeddingAttempts?: number;
  embeddingError?: string | null;
  embeddingStartedAt?: FirebaseFirestore.FieldValue;
  embeddingFinishedAt?: FirebaseFirestore.FieldValue;
}

/** Shared, selectable PVA. Embedded once on create; reuses the embedding fields. */
export interface PvaCatalogEntry {
  id?: string;
  name: string;
  fileName: string;
  storagePath: string;
  bucket: string;
  fileSizeBytes: number;
  contentType: string;
  checksum: string;
  extractedText: string;
  embedding: number[] | null;
  embeddingModel: string;
  embeddingStatus?: EmbeddingStatus;
  embeddingAttempts?: number;
  embeddingError?: string | null;
  personaBrief?: string | null;
  createdAt: FirebaseFirestore.FieldValue;
  embeddingStartedAt?: FirebaseFirestore.FieldValue;
  embeddingFinishedAt?: FirebaseFirestore.FieldValue;
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
export type SessionStatus = "in_progress" | "completed" | "abandoned";

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
  specificStamp?: string | null;
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

export interface UserArtifact {
  id?: string;
  userId: string;
  fileName: string;
  storagePath: string;
  bucket: string;
  fileSizeBytes: number;
  contentType: string;
  checksum: string;
  kind?: "essay" | "citation" | "transcript" | "other";
  extractedText: string;
  embedding: number[] | null;
  embeddingModel: string;
  embeddingsStatus?: "processing" | "ready" | "failed";
  embeddingAttempts?: number;
  embeddingError?: string | null;
  embeddingStartedAt?: FirebaseFirestore.FieldValue;
  embeddingFinishedAt?: FirebaseFirestore.FieldValue;
  createdAt: FirebaseFirestore.FieldValue;
}
