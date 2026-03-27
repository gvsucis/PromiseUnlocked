import { OAuthProvider, linkWithCredential, signInWithCredential, updateProfile } from "firebase/auth";
import { auth } from "../../config/firebase";

interface AppleProfileInput {
  givenName?: string | null;
  familyName?: string | null;
}

function buildDisplayName(profile?: AppleProfileInput): string | null {
  if (!profile) {
    return null;
  }

  const parts = [profile.givenName?.trim(), profile.familyName?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

export async function signInWithAppleToken(
  idToken: string,
  rawNonce: string,
  profile?: AppleProfileInput
) {
  const provider = new OAuthProvider("apple.com");
  const credential = provider.credential({
    idToken,
    rawNonce,
  });

  const currentUser = auth.currentUser;
  const authResult =
    currentUser?.isAnonymous
      ? await linkWithCredential(currentUser, credential)
      : await signInWithCredential(auth, credential);

  const displayName = buildDisplayName(profile);
  if (displayName && !authResult.user.displayName) {
    await updateProfile(authResult.user, { displayName });
  }

  return authResult;
}
