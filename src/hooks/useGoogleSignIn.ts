import { useEffect, useRef, useState } from "react";
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
  const processedResponseUrlRef = useRef<string | null>(null);
  const [googleRequest, googleResponse, promptGoogleSignIn] = Google.useIdTokenAuthRequest({
    iosClientId: CONFIG.GOOGLE_IOS_CLIENT_ID,
    androidClientId: CONFIG.GOOGLE_ANDROID_CLIENT_ID,
    webClientId: CONFIG.GOOGLE_EXPO_CLIENT_ID,
    redirectUri: Platform.OS === "web" ? undefined : getNativeGoogleRedirectUri(),
    selectAccount: true,
  });

  useEffect(() => {
    if (!loading || !googleResponse) {
      return;
    }

    const responseKey =
      "url" in googleResponse ? googleResponse.url : `non-url-response:${googleResponse.type}`;

    if (processedResponseUrlRef.current === responseKey) {
      return;
    }

    if (googleResponse.type !== "success") {
      processedResponseUrlRef.current = responseKey;
      setLoading(false);

      if (googleResponse.type === "error") {
        Alert.alert("Error", googleResponse.error?.message ?? "Google sign-in failed.");
      }

      return;
    }

    const idToken = googleResponse.params.id_token ?? googleResponse.authentication?.idToken;
    const accessToken =
      googleResponse.params.access_token ?? googleResponse.authentication?.accessToken;

    // Native Google auth can resolve twice: first with an authorization code,
    // then again after Expo exchanges that code for tokens.
    if (!idToken && googleResponse.params.code && !googleResponse.authentication) {
      return;
    }

    processedResponseUrlRef.current = responseKey;

    if (!idToken) {
      setLoading(false);
      Alert.alert("Error", "Google sign-in did not return an ID token.");
      return;
    }

    void (async () => {
      try {
        const credential = await signInWithGoogleTokens(idToken, accessToken);
        const username =
          credential.user.displayName ?? credential.user.email?.split("@")[0] ?? null;

        if (username) {
          console.log("[Auth] Google sign-in user:", username);
        }

        await options.onSuccess?.();
      } catch (error: unknown) {
        Alert.alert("Error", getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [googleResponse, loading, options]);

  const handleGoogleSignIn = async () => {
    if (loading) return;

    if (!googleRequest) {
      Alert.alert("Google Sign-In Unavailable", "Google Sign-In is not ready yet. Try again.");
      return;
    }

    try {
      setLoading(true);
      processedResponseUrlRef.current = null;
      const result = await promptGoogleSignIn();

      if (result.type !== "success") {
        setLoading(false);
      }
    } catch (error: unknown) {
      setLoading(false);
      Alert.alert("Error", getErrorMessage(error));
    }
  };

  return {
    handleGoogleSignIn,
    googleLoading: loading,
    googleReady: Boolean(googleRequest),
  };
}
