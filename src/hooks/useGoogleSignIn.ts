import { useState } from "react";
import { Platform } from "react-native";
import { Alert } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { CONFIG } from "../config/env";
import { signInWithGoogleTokens } from "../services/firebase/googleAuthService";

WebBrowser.maybeCompleteAuthSession();

interface UseGoogleSignInOptions {
  onSuccess?: () => void | Promise<void>;
}

function getNativeGoogleRedirectUri(): string | undefined {
  const nativeClientId =
    Platform.OS === "ios" ? CONFIG.GOOGLE_IOS_CLIENT_ID : CONFIG.GOOGLE_ANDROID_CLIENT_ID;

  const clientIdPrefix = nativeClientId?.replace(".apps.googleusercontent.com", "");
  if (!clientIdPrefix || clientIdPrefix === nativeClientId) {
    return undefined;
  }

  return `com.googleusercontent.apps.${clientIdPrefix}:/oauthredirect`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Google sign-in failed.";
}

export function useGoogleSignIn(options: UseGoogleSignInOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [googleRequest, , promptGoogleSignIn] = Google.useIdTokenAuthRequest({
    iosClientId: CONFIG.GOOGLE_IOS_CLIENT_ID,
    androidClientId: CONFIG.GOOGLE_ANDROID_CLIENT_ID,
    webClientId: CONFIG.GOOGLE_EXPO_CLIENT_ID,
    redirectUri: Platform.OS === "web" ? undefined : getNativeGoogleRedirectUri(),
    selectAccount: true,
  });

  const handleGoogleSignIn = async () => {
    if (loading) return;

    if (!googleRequest) {
      Alert.alert("Google Sign-In Unavailable", "Google Sign-In is not ready yet. Try again.");
      return;
    }

    try {
      setLoading(true);
      const result = await promptGoogleSignIn();

      if (result.type !== "success") {
        return;
      }

      const idToken = result.params.id_token;
      if (!idToken) {
        throw new Error("Google sign-in did not return an ID token.");
      }

      const credential = await signInWithGoogleTokens(idToken);
      const username = credential.user.displayName ?? credential.user.email?.split("@")[0] ?? null;

      if (username) {
        console.log("[Auth] Google sign-in user:", username);
      }

      await options.onSuccess?.();
    } catch (error: unknown) {
      Alert.alert("Error", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return {
    handleGoogleSignIn,
    googleLoading: loading,
    googleReady: Boolean(googleRequest),
  };
}
