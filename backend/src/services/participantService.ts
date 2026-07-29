import {
  participantSessionsCollection,
  participantPassportCollection,
  db,
  normalizePassport,
} from "@/services/firestore";
import { aggregatePassport, type PassportCategory } from "@/utils/passport";

export async function findParticipantRef(
  idOrEmail: string,
  requester?: { uid?: string } | null
): Promise<FirebaseFirestore.DocumentReference | null> {
  const participants = db.collection("participants");
  const isEmail = typeof idOrEmail === "string" && idOrEmail.includes("@");
  let snap = isEmail
    ? await participants.where("email", "==", idOrEmail).limit(1).get()
    : await participants.where("uid", "==", idOrEmail).limit(1).get();

  if (snap.empty && isEmail && requester?.uid) {
    snap = await participants.where("uid", "==", requester.uid).limit(1).get();
  }

  if (!snap.empty) {
    const doc = snap.docs[0];
    if (doc) return doc.ref;
  }
  return null;
}

export interface ParticipantPassportSummary {
  uid: string;
  displayName: string | null;
  email: string | null;
  schoolName: string | null;
  passport: PassportCategory[];
  totalStampsUnlocked: number;
  totalMappings: number;
  sessionStatusCounts: { completed: number; in_progress: number; abandoned: number };
}

export async function fetchParticipantPassportSummary(
  uid: string,
  profile: Record<string, unknown>
): Promise<ParticipantPassportSummary> {
  const displayName = (profile.displayName as string | null) ?? null;
  const email = (profile.email as string | null) ?? null;
  const schoolName = (profile.schoolName as string | null) ?? null;

  const sessionsSnapshot = await participantSessionsCollection(uid).select("status").get();

  const sessionStatusCounts = { completed: 0, in_progress: 0, abandoned: 0 };

  const passportNested = await Promise.all(
    sessionsSnapshot.docs.map(async (sessionDoc) => {
      const status = sessionDoc.get("status") as string;
      if (status === "completed") sessionStatusCounts.completed++;
      else if (status === "in_progress") sessionStatusCounts.in_progress++;
      else if (status === "abandoned") sessionStatusCounts.abandoned++;

      const passportSnapshot = await participantPassportCollection(uid, sessionDoc.id).get();
      return passportSnapshot.docs.map((p) => normalizePassport(p) ?? {});
    })
  );

  const allPassportDocs = passportNested.flat();
  const { passport, totalStampsUnlocked, totalMappings } = aggregatePassport(allPassportDocs);

  return {
    uid,
    displayName,
    email,
    schoolName,
    passport,
    totalStampsUnlocked,
    totalMappings,
    sessionStatusCounts,
  };
}

export default findParticipantRef;
