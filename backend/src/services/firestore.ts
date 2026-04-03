import admin from "firebase-admin";
import type { FirestoreDataConverter } from "firebase-admin/firestore";
import type { ServiceAccount } from "firebase-admin";
import serviceAccount from "../../serviceAccountKey.json";
import type { InteractionRecord, SessionRecord, UserProfile } from "../types/firestore";

// --- Firebase Admin App ---
const typedServiceAccount = serviceAccount as ServiceAccount;
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(typedServiceAccount),
  });
}
const db = admin.firestore();

// --- Timestamp Normalization ---
export function normalizeTimestamps(
  obj: Record<string, any>,
  fields: string[]
): Record<string, any> {
  const toIso = (ts: any) => {
    if (!ts) return null;
    if (typeof ts === "string") return ts;
    if (typeof ts.toDate === "function") return ts.toDate().toISOString();
    if (typeof ts._seconds === "number") return new Date(ts._seconds * 1000).toISOString();
    return null;
  };
  const result: Record<string, any> = {};
  for (const field of fields) {
    result[field] = toIso(obj?.[field]);
  }
  return result;
}

export function normalizeSession(
  doc: FirebaseFirestore.DocumentSnapshot | (SessionRecord & { id?: string })
): unknown {
  const data = "data" in doc ? doc.data() : doc;

  const id = "id" in doc && typeof doc.id === "string" ? doc.id : (doc as any).id;
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
      updatedAt: data.lastActivityAt,
      isAnonymous: data.isAnonymous,
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
      metadata: data.metadata ?? {},
    };
  },
};

const interactionConverter: FirestoreDataConverter<InteractionRecord> = {
  toFirestore: ({ id: _id, ...interaction }) => interaction,
  fromFirestore: (snapshot) => {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      sessionId: data.sessionId,
      userId: data.userId,
      type: data.type,
      payload: data.payload ?? {},
      createdAt: data.createdAt,
    };
  },
};

// --- Collection/Doc Helpers ---
export const participantsCollection = db.collection("participants").withConverter(userConverter);
export const usersCollection = participantsCollection;

export const participantDoc = (uid: string) => participantsCollection.doc(uid);

export const participantSessionsCollection = (uid: string) =>
  participantDoc(uid).collection("sessions").withConverter(sessionConverter);

export const participantSessionDoc = (uid: string, sessionId: string) =>
  participantSessionsCollection(uid).doc(sessionId);

export const participantSessionInteractionsCollection = (uid: string, sessionId: string) =>
  participantSessionDoc(uid, sessionId)
    .collection("interactions")
    .withConverter(interactionConverter);

export { admin, db };
