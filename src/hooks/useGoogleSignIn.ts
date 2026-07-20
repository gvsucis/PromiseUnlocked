import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as Crypto from "expo-crypto";
import { AuthRequest, ResponseType } from "expo-auth-session";
import { discovery as googleDiscovery } from "expo-auth-session/providers/google";
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

let gsiModule: typeof import("@react-native-google-signin/google-signin") | undefined;
function loadGSI(): typeof import("@react-native-google-signin/google-signin") | undefined {
  if (gsiModule) return gsiModule;
  try {
    gsiModule = require("@react-native-google-signin/google-signin");
  } catch {
    console.warn("[GoogleSignIn] Native module not loaded; will fall back to Expo proxy");
  }
  return gsiModule;
}

let gsiInitialized = false;
function ensureConfigured() {
  if (gsiInitialized) return;
  const gsi = loadGSI();
  if (!gsi) return;
  gsi.GoogleSignin.configure({
    webClientId: CONFIG.GOOGLE_EXPO_CLIENT_ID,
    iosClientId: CONFIG.GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
    scopes: GOOGLE_SCOPES,
  });
  gsiInitialized = true;
}

export function useGoogleSignIn(options: UseGoogleSignInOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const signInInFlightRef = useRef(false);

  const onSuccessRef = useRef(options.onSuccess);
  useEffect(() => {
    onSuccessRef.current = options.onSuccess;
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
    ensureConfigured();
    setReady(Boolean(loadGSI()));
  }, []);

  const handleNativeSignIn = async () => {
    if (signInInFlightRef.current) return;
    signInInFlightRef.current = true;
    setLoading(true);
    try {
      ensureConfigured();
      const gsi = loadGSI();
      if (!gsi) {
        Alert.alert("Error", "Google Sign-In is not available. Please rebuild the app.");
        return;
      }
      await gsi.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      const response = await gsi.GoogleSignin.signIn();

      if (gsi.isCancelledResponse(response)) return;

      if (gsi.isSuccessResponse(response)) {
        const { idToken } = response.data;
        if (!idToken) {
          Alert.alert("Error", MISSING_ID_TOKEN_MESSAGE);
          return;
        }
        await finishSignIn(idToken);
        return;
      }

      // Unrecognized response shape — surface an error instead of a dead button.
      Alert.alert("Error", GENERIC_ERROR_MESSAGE);
    } catch (error: unknown) {
      const gsi = loadGSI();
      if (gsi?.isErrorWithCode(error)) {
        switch (error.code) {
          case gsi.statusCodes.SIGN_IN_CANCELLED:
            return;
          case gsi.statusCodes.IN_PROGRESS:
            console.warn("[GoogleSignIn] Already in progress");
            return;
          case gsi.statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert("Error", "Google Play Services are not available on this device.");
            return;
        }
      }
      Alert.alert("Error", getErrorMessage(error));
    } finally {
      signInInFlightRef.current = false;
      setLoading(false);
    }
  };

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
    googleReady: IS_EXPO_GO || ready,
  };
}
