import { GoogleAuthProvider, linkWithCredential, signInWithCredential } from "firebase/auth";
import { auth } from "../../config/firebase";

function getFirebaseAuthErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

export async function signInWithGoogleTokens(idToken: string, accessToken?: string) {
  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  const currentUser = auth.currentUser;

  if (currentUser?.isAnonymous) {
    try {
      return await linkWithCredential(currentUser, credential);
    } catch (error) {
      const code = getFirebaseAuthErrorCode(error);

      // If the credential/email is already in use, fall back to signing into the existing account.
      if (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use") {
        return signInWithCredential(auth, credential);
      }

      throw error;
    }
  }

  return signInWithCredential(auth, credential);
}
