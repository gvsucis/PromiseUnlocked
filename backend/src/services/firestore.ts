import admin from "firebase-admin";
import type { FirestoreDataConverter } from "firebase-admin/firestore";
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
  toFirestore: ({ id, ...session }) => session,
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
  toFirestore: ({ id, ...interaction }) => interaction,
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

export const usersCollection = db.collection("users").withConverter(userConverter);
export const sessionsCollection = db.collection("sessions").withConverter(sessionConverter);
export const interactionsCollection = db
  .collection("interactions")
  .withConverter(interactionConverter);

export { admin, db };
