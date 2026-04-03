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

export type SessionStatus = "active" | "completed" | "cancelled";

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
  completedAt?: number | string | FirebaseFirestore.Timestamp | null;
  lastActiveAt?: number | string | FirebaseFirestore.Timestamp | null;
  weakFitCount?: number;
  totalInteractions?: number;
  interactions?: any[];
}

export interface InteractionRecord {
  id?: string;
  sessionId: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

export type AuthenticatedRequest = Request & {
  user: admin.auth.DecodedIdToken;
};
