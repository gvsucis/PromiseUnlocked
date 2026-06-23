import { GoogleAuthProvider, linkWithCredential, signInWithCredential } from "firebase/auth";
import { auth } from "../../config/firebase";
import { getErrorCode } from "../../utils/errorUtils";

export type GuestUpgradeDecision = "move" | "separate";

export async function signInWithGoogleTokens(
  idToken: string,
  accessToken?: string,
  options?: { guestUpgradeDecision?: GuestUpgradeDecision }
) {
  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  const currentUser = auth.currentUser;

  if (currentUser?.isAnonymous) {
    if (options?.guestUpgradeDecision === "separate") {
      return signInWithCredential(auth, credential);
    }

    try {
      return await linkWithCredential(currentUser, credential);
    } catch (error) {
      const code = getErrorCode(error);
      if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
        return signInWithCredential(auth, credential);
      }

      throw error;
    }
  }

  return signInWithCredential(auth, credential);
}
