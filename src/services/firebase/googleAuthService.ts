import { GoogleAuthProvider, signInWithCredential, type User } from "firebase/auth";
import { getDoc, doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { splitFullName, combineFullName } from "../../utils/format";

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(normalized)));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Best-effort: persist Google's first/last name on the participant doc so
 * self-signups via Google get split names without typing them. Google ID
 * tokens carry given_name/family_name (profile scope is requested); falls back
 * to splitting displayName. Never overwrites names a user has edited.
 */
async function persistParticipantNames(user: User, idToken: string): Promise<void> {
  const userRef = doc(db, "participants", user.uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) {
    const data = existing.data();
    if (data.firstName && data.lastName) return;
  }

  const claims = decodeJwtPayload(idToken);
  const givenName = typeof claims.given_name === "string" ? claims.given_name : undefined;
  const familyName = typeof claims.family_name === "string" ? claims.family_name : undefined;

  let firstName: string | null | undefined = givenName;
  let lastName: string | null | undefined = familyName;
  if (!firstName || !lastName) {
    const split = splitFullName(user.displayName ?? "");
    firstName = firstName ?? (split.firstName || null);
    lastName = lastName ?? (split.lastName || null);
  }
  if (!firstName && !lastName) return;

  const fullName = combineFullName(firstName ?? "", lastName ?? "");
  await setDoc(
    userRef,
    {
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      fullName: fullName || user.displayName || null,
      displayName: user.displayName ?? null,
    },
    { merge: true }
  );
}

export async function signInWithGoogleTokens(idToken: string, accessToken?: string) {
  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  const result = await signInWithCredential(auth, credential);
  void persistParticipantNames(result.user, idToken).catch(() => {});
  return result;
}
