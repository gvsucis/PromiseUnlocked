import { useCallback } from "react";
import { Alert } from "react-native";
import { useAuth } from "../context/AuthContext";

export function useLogout() {
  const { logoutToGuest } = useAuth();

  const logout = useCallback(
    async (onSuccess?: () => void) => {
      try {
        await logoutToGuest();
        onSuccess?.();
      } catch {
        Alert.alert("Error", "Failed to switch to guest mode.");
      }
    },
    [logoutToGuest]
  );

  const confirmAndLogout = useCallback(
    (onSuccess?: () => void, confirmText?: string) => {
      Alert.alert(
        "Switch to Guest",
        "You will keep this account's saved progress, and the app will continue in guest mode.",
        [
          { text: "Cancel", style: "cancel" },
          { text: confirmText ?? "Continue", onPress: () => void logout(onSuccess) },
        ]
      );
    },
    [logout]
  );

  return { confirmAndLogout, logout };
}
