import { useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import { discovery as googleDiscovery } from "expo-auth-session/providers/google";
import { AuthRequest, ResponseType } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as Crypto from "expo-crypto";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { CONFIG } from "../config/env";
import { signInWithGoogleTokens } from "../services/firebase/googleAuthService";
import { waitForAuthenticated } from "../services/auth/authSessionService";

WebBrowser.maybeCompleteAuthSession();

interface UseGoogleSignInOptions {
  onSuccess?: () => void | Promise<void>;
}

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const EXPO_PROXY_BASE = "https://auth.expo.io/@rexfordkode/promise-unlock-for-sure";
const EXPO_PROXY_START = `${EXPO_PROXY_BASE}/start`;

const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
];

const GENERIC_ERROR_MESSAGE = "Google sign-in failed.";
const RETRY_ERROR_MESSAGE = "Google sign-in failed. Please try again.";
const UNAVAILABLE_ERROR_MESSAGE =
  "Google sign-in is temporarily unavailable. Please try again later.";
const MISSING_ID_TOKEN_MESSAGE = "Google sign-in did not return an ID token.";

function getNativeGoogleRedirectUri(clientId: string): string {
  const prefix = clientId.replace(".apps.googleusercontent.com", "");
  return `com.googleusercontent.apps.${prefix}:/oauthredirect`;
}

function resolveRedirectUri(): string {
  if (IS_EXPO_GO) return EXPO_PROXY_BASE;
  const platformClientId =
    Platform.OS === "ios" ? CONFIG.GOOGLE_IOS_CLIENT_ID : CONFIG.GOOGLE_ANDROID_CLIENT_ID;
  return getNativeGoogleRedirectUri(platformClientId);
}

async function generateNonceHex(byteLength = 16): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(byteLength);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

type ProxyPromptResult =
  | { type: "success"; idToken?: string; accessToken?: string }
  | { type: "error"; message: string }
  | { type: "cancel" | "dismiss" | "locked" | "opened" };

async function promptGoogleViaExpoProxy(): Promise<ProxyPromptResult> {
  const nonce = await generateNonceHex(16);

  const request = new AuthRequest({
    clientId: CONFIG.GOOGLE_EXPO_CLIENT_ID,
    redirectUri: EXPO_PROXY_BASE,
    responseType: ResponseType.IdToken,
    scopes: GOOGLE_SCOPES,
    usePKCE: false,
    extraParams: { nonce, prompt: "select_account" },
  });

  const authUrl = await request.makeAuthUrlAsync(googleDiscovery);
  const returnUrl = Linking.createURL("/");
  const startUrl = `${EXPO_PROXY_START}?${new URLSearchParams({ authUrl, returnUrl }).toString()}`;

  const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);
  if (result.type !== "success") return { type: result.type };

  const parsed = request.parseReturnUrl(result.url);
  if (parsed.type === "success") {
    return {
      type: "success",
      idToken: parsed.params.id_token,
      accessToken: parsed.params.access_token,
    };
  }
  if (parsed.type === "error") {
    return { type: "error", message: parsed.error?.message ?? GENERIC_ERROR_MESSAGE };
  }
  return { type: parsed.type };
}

function getErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : undefined;
  const message = error instanceof Error ? error.message : "";

  if (
    code === "app/firestore-auth-unavailable" ||
    message.includes("auth/admin-restricted-operation")
  ) {
    return UNAVAILABLE_ERROR_MESSAGE;
  }
  if (error instanceof Error && error.message) return RETRY_ERROR_MESSAGE;
  return GENERIC_ERROR_MESSAGE;
}

export function useGoogleSignIn(options: UseGoogleSignInOptions = {}) {
  const [loading, setLoading] = useState(false);
  const processedResponseUrlRef = useRef<string | null>(null);

  const onSuccessRef = useRef(options.onSuccess);
  useEffect(() => {
    onSuccessRef.current = options.onSuccess;
  });

  const [googleRequest, googleResponse, promptGoogleSignIn] = Google.useIdTokenAuthRequest({
    iosClientId: IS_EXPO_GO ? undefined : CONFIG.GOOGLE_IOS_CLIENT_ID,
    androidClientId: IS_EXPO_GO ? undefined : CONFIG.GOOGLE_ANDROID_CLIENT_ID,
    webClientId: CONFIG.GOOGLE_EXPO_CLIENT_ID,
    clientId: IS_EXPO_GO ? CONFIG.GOOGLE_EXPO_CLIENT_ID : undefined,
    redirectUri: resolveRedirectUri(),
    selectAccount: true,
  });

  const finishSignIn = async (idToken: string, accessToken?: string) => {
    const credential = await signInWithGoogleTokens(idToken, accessToken);
    const username = credential.user.displayName ?? credential.user.email?.split("@")[0] ?? null;
    if (username) console.log("[Auth] Google sign-in user:", username);

    await waitForAuthenticated();
    await onSuccessRef.current?.();
  };

  useEffect(() => {
    if (IS_EXPO_GO) return;
    if (!loading || !googleResponse) return;

    const responseKey =
      "url" in googleResponse ? googleResponse.url : `non-url-response:${googleResponse.type}`;

    if (processedResponseUrlRef.current === responseKey) return;

    if (googleResponse.type !== "success") {
      processedResponseUrlRef.current = responseKey;
      setLoading(false);
      if (googleResponse.type === "error") {
        Alert.alert("Error", googleResponse.error?.message ?? GENERIC_ERROR_MESSAGE);
      }
      return;
    }

    const idToken = googleResponse.params.id_token ?? googleResponse.authentication?.idToken;
    const accessToken =
      googleResponse.params.access_token ?? googleResponse.authentication?.accessToken;

    if (!idToken && googleResponse.params.code && !googleResponse.authentication) return;

    processedResponseUrlRef.current = responseKey;

    if (!idToken) {
      setLoading(false);
      Alert.alert("Error", MISSING_ID_TOKEN_MESSAGE);
      return;
    }

    void (async () => {
      try {
        await finishSignIn(idToken, accessToken);
      } catch (error: unknown) {
        Alert.alert("Error", getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
  }, [googleResponse, loading]);

  const handleExpoGoSignIn = async () => {
    try {
      setLoading(true);
      const result = await promptGoogleViaExpoProxy();

      if (result.type === "error") {
        Alert.alert("Error", result.message);
        return;
      }
      if (result.type !== "success") return;
      if (!result.idToken) {
        Alert.alert("Error", MISSING_ID_TOKEN_MESSAGE);
        return;
      }

      await finishSignIn(result.idToken, result.accessToken);
    } catch (error: unknown) {
      Alert.alert("Error", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleNativeSignIn = async () => {
    if (!googleRequest) {
      Alert.alert("Google Sign-In Unavailable", "Google Sign-In is not ready yet. Try again.");
      return;
    }

    try {
      setLoading(true);
      processedResponseUrlRef.current = null;
      const result = await promptGoogleSignIn();
      if (result.type !== "success") setLoading(false);
    } catch (error: unknown) {
      setLoading(false);
      Alert.alert("Error", getErrorMessage(error));
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;
    if (IS_EXPO_GO) {
      await handleExpoGoSignIn();
      return;
    }
    await handleNativeSignIn();
  };

  return {
    handleGoogleSignIn,
    googleLoading: loading,
    googleReady: IS_EXPO_GO || Boolean(googleRequest),
  };
}
