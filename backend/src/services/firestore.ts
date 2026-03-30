import admin from "firebase-admin";
import type { CollectionReference, FirestoreDataConverter } from "firebase-admin/firestore";
import type { ServiceAccount } from "firebase-admin";
import serviceAccount from "../../serviceAccountKey.json";
import type { InteractionRecord, SessionRecord, UserProfile } from "../types/firestore";
const typedServiceAccount = serviceAccount as ServiceAccount;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(typedServiceAccount),
  });
}

const db = admin.firestore();

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
      updatedAt: data.updatedAt,
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

export const participantsCollection = db.collection("participants").withConverter(userConverter);
export const usersCollection = participantsCollection;

export const participantDoc = (uid: string) => participantsCollection.doc(uid);

export const participantSessionsCollection = (uid: string): CollectionReference<SessionRecord> =>
  participantDoc(uid).collection("sessions").withConverter(sessionConverter);

export const participantSessionDoc = (uid: string, sessionId: string) =>
  participantSessionsCollection(uid).doc(sessionId);

export const participantSessionInteractionsCollection = (
  uid: string,
  sessionId: string
): CollectionReference<InteractionRecord> =>
  participantSessionDoc(uid, sessionId).collection("interactions").withConverter(interactionConverter);

export { admin, db };
