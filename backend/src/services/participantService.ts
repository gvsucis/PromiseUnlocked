import { db } from "@/services/firestore";
// requester accepted as minimal shape to avoid coupling to auth token type

/**
 * Find a participant document reference by uid or email.
 * If an email is provided and not found, but requester uid exists, it will try the uid.
 */
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

export default findParticipantRef;
