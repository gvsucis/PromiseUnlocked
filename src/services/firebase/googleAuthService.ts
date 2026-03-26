import { GoogleAuthProvider, linkWithCredential, signInWithCredential } from "firebase/auth";
import { auth } from "../../config/firebase";

export async function signInWithGoogleTokens(idToken: string, accessToken?: string) {
  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  const currentUser = auth.currentUser;

  if (currentUser?.isAnonymous) {
    return linkWithCredential(currentUser, credential);
  }

  return signInWithCredential(auth, credential);
}
