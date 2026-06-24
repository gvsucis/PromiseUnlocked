import admin from "firebase-admin";
import type { FirestoreDataConverter } from "firebase-admin/firestore";
import type { ServiceAccount } from "firebase-admin";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type {
  InteractionRecord,
  ParticipantProfile,
  SessionRecord,
  UserProfile,
} from "../types/firestore";

/**
 * Initialise Firebase Admin.
 *
 * • Cloud Functions / Cloud Run → Application Default Credentials (ADC) are
 *   injected automatically, so we just call `initializeApp()`.
 * • Local development → We fall back to the service-account JSON file checked
 *   into the repo (loaded at runtime with `readFileSync` to avoid ESM
 *   import-attribute issues).
 */
function initFirebase() {
  if (admin.apps.length) return;

  // When running inside Cloud Functions the env var is set automatically.
  if (process.env.FUNCTIONS_EMULATOR || process.env.K_SERVICE || process.env.GCLOUD_PROJECT) {
    admin.initializeApp();
    return;
  }

  // Local dev: load the service-account key file at runtime.
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const keyPath = resolve(
    __dirname,
    "../../promise-unlocked-for-sure-firebase-adminsdk-fbsvc-fb7e582d9b.json"
  );
  const serviceAccount = JSON.parse(readFileSync(keyPath, "utf-8")) as ServiceAccount;
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

initFirebase();
const db = admin.firestore();

function getIdFromDoc(d: unknown): string | undefined {
  if (!d || typeof d !== "object") return undefined;
  const candidate = d as { id?: unknown };
  if (typeof candidate.id === "string") return candidate.id;
  return undefined;
}

export function normalizeTimestamps(
  obj: Record<string, unknown> | FirebaseFirestore.DocumentData,
  fields: string[]
): Record<string, unknown> {
  const toIso = (ts: unknown) => {
    if (!ts) return null;
    if (typeof ts === "string") return ts;
    if (typeof ts === "number") return new Date(ts).toISOString();
    if (ts && typeof ts === "object") {
      const t = ts as { toDate?: unknown; _seconds?: unknown };
      if (typeof t.toDate === "function") return (t.toDate as () => Date)().toISOString();
      if (typeof t._seconds === "number") return new Date(t._seconds * 1000).toISOString();
    }
    return null;
  };
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    result[field] = toIso(obj?.[field]);
  }
  return result;
}

export function normalizeSession(
  doc: FirebaseFirestore.DocumentSnapshot | (SessionRecord & { id?: string })
): unknown {
  const data = "data" in doc ? doc.data() : (doc as unknown as Record<string, unknown>);
  const id = getIdFromDoc(doc) ?? undefined;
  return {
    id: id ?? null,
    alreadyMappedCount: data?.alreadyMappedCount ?? 0,
    categoriesMapped: data?.categoriesMapped ?? [],
    categoriesMappedCount: data?.categoriesMappedCount ?? 0,
    status: data?.status ?? null,
    totalInteractions: data?.totalInteractions ?? 0,
    weakFitCount: data?.weakFitCount ?? 0,
    interactions: data?.interactions ?? [],
    ...normalizeTimestamps(data!, ["completedAt", "lastActiveAt", "startedAt"]),
  };
}

export function normalizeUser(
  doc: FirebaseFirestore.DocumentSnapshot | (UserProfile & { id?: string })
): unknown {
  const data = "data" in doc ? doc.data() : (doc as unknown as Record<string, unknown>);
  const id = getIdFromDoc(doc) ?? undefined;

  return {
    uid: data?.uid ?? id ?? null,
    email: data?.email ?? null,
    displayName: data?.displayName ?? null,
    photoURL: data?.photoURL ?? null,
    fullName: data?.fullName ?? null,
    phone: data?.phone ?? null,
    address: data?.address ?? null,
    dateOfBirth: data?.dateOfBirth ?? null,
    gender: data?.gender ?? null,
    ethnicity: data?.ethnicity ?? null,
    pageUrl: data?.pageUrl ?? null,
    role: data?.role ?? null,
    metadata: data?.metadata ?? {},
    ...normalizeTimestamps(data!, ["createdAt", "updatedAt", "lastActiveAt"]),
  };
}

export function normalizeParticipant(
  doc: FirebaseFirestore.DocumentSnapshot | (ParticipantProfile & { id?: string })
): unknown {
  const user = normalizeUser(doc) as Record<string, unknown>;
  const data = "data" in doc ? doc.data() : (doc as unknown as Record<string, unknown>);
  return {
    ...user,
    schoolName: data?.schoolName ?? null,
    schoolAddress: data?.schoolAddress ?? null,
  };
}

export function normalizeInteraction(
  doc: FirebaseFirestore.DocumentSnapshot | (InteractionRecord & { id?: string })
): unknown {
  const data = "data" in doc ? doc.data() : (doc as unknown as Record<string, unknown>);
  const id = getIdFromDoc(doc) ?? undefined;

  return {
    id: id ?? null,
    sequenceIndex: data?.sequenceIndex ?? null,
    question: data?.question ?? null,
    answer: data?.answer ?? null,
    inputMethod: data?.inputMethod ?? null,
    mappingOutcome: data?.mappingOutcome ?? null,
    mappedCategory: data?.mappedCategory ?? null,
    isWeakFit: data?.isWeakFit ?? false,
    isAlreadyMapped: data?.isAlreadyMapped ?? false,
    justification: data?.justification ?? "",
    specificStamp: data?.specificStamp ?? undefined,
    matchedToCategory: data?.matchedToCategory ?? null,
    matchedToSequenceIndex: data?.matchedToSequenceIndex ?? null,
    ...normalizeTimestamps(data!, ["timestamp"]),
  };
}

const participantConverter: FirestoreDataConverter<ParticipantProfile> = {
  toFirestore: (user) => user,
  fromFirestore: (snapshot) => {
    const data = snapshot.data();
    return {
      uid: snapshot.id,
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt ?? data.lastActivityAt,
      isAnonymous: data.isAnonymous,
      fullName: data.fullName ?? null,
      schoolName: data.schoolName ?? null,
      schoolAddress: data.schoolAddress ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      dateOfBirth: data.dateOfBirth ?? null,
      gender: data.gender ?? null,
      ethnicity: data.ethnicity ?? null,
      pageUrl: data.pageUrl ?? null,
      role: data.role ?? null,
      metadata: data.metadata ?? {},
    };
  },
};

const userConverter: FirestoreDataConverter<UserProfile> = {
  toFirestore: (user) => user,
  fromFirestore: (snapshot) => {
    const data = snapshot.data();
    return {
      uid: snapshot.id,
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt ?? data.lastActivityAt,
      isAnonymous: data.isAnonymous,
      fullName: data.fullName ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      dateOfBirth: data.dateOfBirth ?? null,
      gender: data.gender ?? null,
      ethnicity: data.ethnicity ?? null,
      pageUrl: data.pageUrl ?? null,
      role: data.role ?? null,
      metadata: data.metadata ?? {},
    };
  },
};

const sessionConverter: FirestoreDataConverter<SessionRecord> = {
  toFirestore: ({ id: _id, ...session }) => session,
  fromFirestore: (snapshot) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      userId: data.userId,
      topic: data.topic,
      status: data.status,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      alreadyMappedCount: data.alreadyMappedCount ?? 0,
      categoriesMapped: data.categoriesMapped ?? [],
      categoriesMappedCount: data.categoriesMappedCount ?? 0,
      completedAt: data.completedAt ?? null,
      lastActiveAt: data.lastActiveAt ?? null,
      weakFitCount: data.weakFitCount ?? 0,
      totalInteractions: data.totalInteractions ?? 0,
      interactions: data.interactions ?? [],
    };
  },
};

const interactionConverter: FirestoreDataConverter<InteractionRecord> = {
  toFirestore: ({ id: _id, ...interaction }) => interaction,
  fromFirestore: (snapshot) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      sequenceIndex: data.sequenceIndex,
      question: data.question,
      answer: data.answer,
      inputMethod: data.inputMethod,
      mappingOutcome: data.mappingOutcome,
      mappedCategory: data.mappedCategory ?? null,
      isWeakFit: data.isWeakFit ?? false,
      isAlreadyMapped: data.isAlreadyMapped ?? false,
      justification: data.justification ?? "",
      specificStamp: data.specificStamp ?? undefined,
      matchedToCategory: data.matchedToCategory ?? null,
      matchedToSequenceIndex: data.matchedToSequenceIndex ?? null,
      timestamp: data.timestamp ?? null,
      proofJobId: data.proofJobId ?? null,
      proofStatus: data.proofStatus ?? null,
      proofStoragePath: data.proofStoragePath ?? null,
      proofUploadedAt: data.proofUploadedAt ?? null,
      proofAnalyzedAt: data.proofAnalyzedAt ?? null,
      proofTier: data.proofTier ?? null,
      proofConfidence: data.proofConfidence ?? null,
      proofFeedbackMessage: data.proofFeedbackMessage ?? null,
      proofRequiredAction: data.proofRequiredAction ?? null,
    };
  },
};

// --- Collection/Doc Helpers ---
export const participantsCollection = db
  .collection("participants")
  .withConverter(participantConverter);
export const usersCollection = db.collection("users").withConverter(userConverter);

export const participantDoc = (uid: string) => participantsCollection.doc(uid);

export const participantSessionsCollection = (uid: string) =>
  participantDoc(uid).collection("sessions").withConverter(sessionConverter);

export const participantSessionDoc = (uid: string, sessionId: string) =>
  participantSessionsCollection(uid).doc(sessionId);

export const participantSessionInteractionsCollection = (uid: string, sessionId: string) =>
  participantSessionDoc(uid, sessionId)
    .collection("interactions")
    .withConverter(interactionConverter);

export const participantPassportCollection = (uid: string, sessionId: string) =>
  participantSessionDoc(uid, sessionId).collection("skillPassport");

export const participantPassportDoc = (uid: string, sessionId: string, categoryId: string) =>
  participantPassportCollection(uid, sessionId).doc(categoryId);

export function normalizePassport(
  doc: FirebaseFirestore.DocumentSnapshot
): Record<string, unknown> {
  const data = doc.data();
  if (!data) return {};
  const toIso = (ts: unknown) => {
    if (!ts) return null;
    if (typeof ts === "string") return ts;
    if (typeof ts === "number") return new Date(ts).toISOString();
    if (ts && typeof ts === "object") {
      const t = ts as { toDate?: unknown; _seconds?: unknown };
      if (typeof t.toDate === "function") return (t.toDate as () => Date)().toISOString();
      if (typeof t._seconds === "number") return new Date(t._seconds * 1000).toISOString();
    }
    return null;
  };
  return {
    category: data.category ?? null,
    firstMappedAt: toIso(data.firstMappedAt),
    lastMappedAt: toIso(data.lastMappedAt),
    totalMappings: data.totalMappings ?? 0,
    unlockedStamps: data.unlockedStamps ?? {},
  };
}

export { admin, db };
