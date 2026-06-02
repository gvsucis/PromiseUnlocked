import type admin from "firebase-admin";
import type { Request } from "express";

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}
export interface EmbeddingJob {
  jobId: string;
  attempts?: number;
  storagePath: string;
  fileName: string;
  text?: string | null;
  owner: string;
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
}

export type AuthenticatedRequest = Request & {
  user: admin.auth.DecodedIdToken;
};
