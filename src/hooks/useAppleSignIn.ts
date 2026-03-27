import { useState } from "react";
import { Alert, Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { signInWithAppleToken } from "../services/firebase/appleAuthService";

interface UseAppleSignInOptions {
  onSuccess?: () => void | Promise<void>;
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ERR_REQUEST_CANCELED"
  ) {
    return "";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Apple sign-in failed.";
}

export function useAppleSignIn(options: UseAppleSignInOptions = {}) {
  const [loading, setLoading] = useState(false);

  const handleAppleSignIn = async () => {
    if (loading) {
      return;
    }

    if (Platform.OS !== "ios") {
      Alert.alert("Apple Sign-In Unavailable", "Apple Sign-In is only available on iOS.");
      return;
    }

    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(
          "Apple Sign-In Unavailable",
          "This device does not currently support Apple Sign-In."
        );
        return;
      }

      setLoading(true);
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error("Apple sign-in did not return an identity token.");
      }

      await signInWithAppleToken(credential.identityToken, rawNonce, {
        givenName: credential.fullName?.givenName,
        familyName: credential.fullName?.familyName,
      });

      await options.onSuccess?.();
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      if (message) {
        Alert.alert("Error", message);
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    appleLoading: loading,
    handleAppleSignIn,
  };
}
