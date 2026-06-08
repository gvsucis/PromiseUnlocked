import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Button, Card, Divider, TextInput, HelperText } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";
import { useAuth } from "../context/AuthContext";
import { useGoogleSignIn } from "../hooks/useGoogleSignIn";
import { getMappingStats } from "../services/categoryStorageService";
import type { GuestUpgradeDecision } from "../services/firebase/googleAuthService";

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, "Login">;
interface Props {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({ navigation }: Readonly<Props>) {
  const { session, signInWithEmail, continueAsGuest, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const getGuestUpgradeDecision = async (): Promise<GuestUpgradeDecision | "cancel"> => {
    if (session.mode !== "guest") return "move";
    const stats = await getMappingStats();
    const hasGuestPassportData = stats.totalMapped > 0 || stats.totalInteractions > 0;
    if (!hasGuestPassportData) return "move";
    return new Promise<GuestUpgradeDecision | "cancel">((resolve) => {
      Alert.alert(
        "Move guest passport?",
        "We found guest passport progress on this device. Move it to your Google account?",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve("cancel") },
          { text: "No", onPress: () => resolve("separate") },
          { text: "Yes", onPress: () => resolve("move") },
        ]
      );
    });
  };
  const { handleGoogleSignIn, googleLoading, googleReady } = useGoogleSignIn({
    onSuccess: () => navigation.replace("DialogueDashboard"),
    getGuestUpgradeDecision,
  });
  const emailValid = /.+@.+\..+/.test(email.trim());
  const passwordValid = password.length >= 6;
  const hasEmailError = email.length > 0 && !emailValid;
  const hasPasswordError = password.length > 0 && !passwordValid;
  const formValid = emailValid && passwordValid;
  const isAnyLoading = emailLoading || guestLoading || googleLoading;

  React.useEffect(() => {
    if (session.mode === "authenticated") {
      navigation.replace("MainTabs");
    }
  }, [navigation, session.mode]);

  const getErrorDetails = (error: unknown) => {
    if (error instanceof Error) {
      return {
        code: (error as Error & { code?: string }).code,
        message: error.message,
      };
    }
    return { code: undefined, message: "Unknown error" };
  };

  const getFriendlyAuthMessage = (code: string | undefined, message: string): string => {
    if (
      code === "app/anonymous-auth-disabled" ||
      code === "app/firestore-auth-unavailable" ||
      message.includes("auth/admin-restricted-operation")
    ) {
      return "Guest mode is currently unavailable on cloud sync. Please sign in or try again later.";
    }

    return message;
  };

  const handleForgotPassword = async () => {
    if (!email || !emailValid)
      return Alert.alert("Email Required", "Enter a valid email address first.");
    try {
      await resetPassword(email);
      Alert.alert("Reset Sent", "Check your email for a reset link.");
    } catch (error: unknown) {
      const { code, message } = getErrorDetails(error);
      Alert.alert(
        "Error",
        code === "auth/user-not-found" ? "No account exists with that email." : message
      );
    }
  };

  const handleLogin = async () => {
    if (emailLoading) return;
    if (!email || !password) return Alert.alert("Missing Info", "Please fill in all fields.");
    try {
      setEmailLoading(true);
      await signInWithEmail(email, password);
      navigation.replace("MainTabs");
    } catch (error: unknown) {
      const { code, message } = getErrorDetails(error);
      let msg = message;

      if (code === "auth/user-not-found") {
        msg = "No account found with that email.";
      } else if (code === "auth/wrong-password") {
        msg = "Incorrect password.";
      } else if (code === "auth/invalid-credential") {
        msg = "Incorrect email or password.";
      } else if (code === "auth/invalid-email") {
        msg = "Invalid email address.";
      } else if (code === "auth/user-disabled") {
        msg = "This account has been disabled. Please contact support.";
      } else if (code === "auth/too-many-requests") {
        msg = "Too many login attempts. Please wait a bit and try again.";
      } else if (code === "auth/network-request-failed") {
        msg = "Network error. Check your connection and try again.";
      }

      Alert.alert("Error", msg);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleContinueAsGuest = async () => {
    if (guestLoading) return;
    try {
      setGuestLoading(true);
      await continueAsGuest();
      navigation.replace("MainTabs");
    } catch (error: unknown) {
      const { code, message } = getErrorDetails(error);
      Alert.alert("Error", getFriendlyAuthMessage(code, message || "Failed to continue as guest."));
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <MaterialIcons name="psychology" size={43} color="#fff" />
          </View>
          <Card style={styles.card}>
            <Card.Title
              title="Welcome back "
              subtitle="Sign in to continue"
              titleStyle={styles.cardTitle}
              subtitleStyle={styles.cardSubtitle}
            />
            <Card.Content>
              <View style={styles.cardContentWrap}>
                <TextInput
                  mode="flat"
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                  error={hasEmailError}
                  theme={{ colors: { onSurfaceVariant: "#fff" } }}
                />
                <HelperText type="error" visible={hasEmailError} style={styles.helper}>
                  Enter a valid email address
                </HelperText>

                <TextInput
                  mode="flat"
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  style={styles.input}
                  error={hasPasswordError}
                  theme={{ colors: { onSurfaceVariant: "#fff" } }}
                />
                <HelperText type="error" visible={hasPasswordError} style={styles.helper}>
                  Minimum 6 characters
                </HelperText>

                <Button
                  onPress={handleForgotPassword}
                  labelStyle={[styles.linkLabel, { fontSize: 13, opacity: 0.85 }]}
                  style={{ alignSelf: "flex-end", marginBottom: 4 }}
                >
                  Forgot password?
                </Button>

                <Button
                  mode="contained"
                  style={[styles.primary, styles.pill]}
                  contentStyle={styles.primaryContent}
                  labelStyle={styles.primaryLabel}
                  disabled={!formValid || isAnyLoading}
                  onPress={handleLogin}
                >
                  {emailLoading ? <ActivityIndicator color="#fff" size="small" /> : "Sign in"}
                </Button>

                <Divider style={styles.divider} />

                <Button
                  mode="outlined"
                  icon="google"
                  style={[styles.outlined, styles.pill]}
                  contentStyle={styles.primaryContent}
                  labelStyle={styles.outlinedLabel}
                  disabled={isAnyLoading || !googleReady}
                  onPress={handleGoogleSignIn}
                >
                  {googleLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    "Sign in with Google"
                  )}
                </Button>

                <Divider style={styles.divider} />

                <Button
                  mode="contained"
                  style={[styles.pill, styles.secondaryContained]}
                  contentStyle={styles.primaryContent}
                  labelStyle={styles.secondaryLabel}
                  onPress={handleContinueAsGuest}
                  disabled={isAnyLoading}
                >
                  {guestLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    "Continue without signing in"
                  )}
                </Button>

                <Divider style={styles.divider} />

                <View style={styles.linkGroup}>
                  <Button
                    onPress={() => navigation.navigate("Welcome")}
                    labelStyle={styles.linkLabel}
                    style={styles.linkButton}
                  >
                    Back to welcome
                  </Button>

                  <Button
                    onPress={() => navigation.navigate("Register")}
                    labelStyle={styles.linkLabel}
                    style={styles.linkButton}
                  >
                    Create an account
                  </Button>
                </View>
              </View>
            </Card.Content>
          </Card>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
  },
  hero: { alignItems: "center", marginBottom: 16 },
  card: {
    width: "90%",
    maxWidth: 420,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.25)",
    borderWidth: 1,
    borderRadius: 16,
    textAlign: "center",
  },
  cardContentWrap: { overflow: "hidden", borderRadius: 16, paddingHorizontal: 12 },
  cardTitle: { color: "#fff", textAlign: "center" },
  cardSubtitle: { color: "rgba(255,255,255,0.85)", textAlign: "center" },
  input: { backgroundColor: "transparent", marginBottom: 4 },
  helper: { color: "#ffb4b4", marginTop: -8, marginBottom: 8 },
  primary: { marginBottom: 8, backgroundColor: "#6C5CE7" },
  primaryContent: { height: 48 },
  primaryLabel: { color: "#fff", fontWeight: "600" },
  pill: { borderRadius: 28 },
  divider: { marginVertical: 12, backgroundColor: "rgba(255,255,255,0.2)" },
  outlined: { borderColor: "rgba(255,255,255,0.7)", marginBottom: 8 },
  outlinedLabel: { color: "#fff", fontWeight: "600" },
  linkLabel: { color: "#fff" },
  secondaryContained: { backgroundColor: "rgba(255,255,255,0.18)" },
  secondaryLabel: { color: "#fff", fontWeight: "600" },
  linkButton: { alignSelf: "center" },
  linkGroup: { alignItems: "center", gap: 4 },
});
