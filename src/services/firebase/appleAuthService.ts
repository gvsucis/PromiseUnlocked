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
  let authResult;

  if (currentUser?.isAnonymous) {
    try {
      authResult = await linkWithCredential(currentUser, credential);
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error ? error.code : undefined;

      // This Apple credential is already linked to an existing Firebase user.
      // Recover by signing into that account.
      if (code === "auth/credential-already-in-use") {
        authResult = await signInWithCredential(auth, credential);
      } else {
        throw error;
      }
    }
  } else {
    authResult = await signInWithCredential(auth, credential);
  }

  const displayName = buildDisplayName(profile);
  if (displayName && !authResult.user.displayName) {
    await updateProfile(authResult.user, { displayName });
  }

  return authResult;
}
