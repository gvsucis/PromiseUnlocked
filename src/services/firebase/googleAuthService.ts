import { GoogleAuthProvider, linkWithCredential, signInWithCredential } from "firebase/auth";
import { auth } from "../../config/firebase";

export async function signInWithGoogleTokens(idToken: string, accessToken?: string) {
  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  const currentUser = auth.currentUser;

  if (currentUser?.isAnonymous) {
    try {
      return await linkWithCredential(currentUser, credential);
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error ? error.code : undefined;

      // This Google account already belongs to an existing Firebase user.
      // Fall back to signing into that account instead of failing the flow.
      if (code === "auth/credential-already-in-use") {
        return signInWithCredential(auth, credential);
      }

      throw error;
    }
  }

  return signInWithCredential(auth, credential);
}
