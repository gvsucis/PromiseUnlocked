import React, { useState } from "react";
import { View, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Button, Card, Divider, TextInput, HelperText } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";
import { useAuth } from "../context/AuthContext";
import { useAppleSignIn } from "../hooks/useAppleSignIn";
import { useGoogleSignIn } from "../hooks/useGoogleSignIn";

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, "Login">;
interface Props {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({ navigation }: Readonly<Props>) {
  const { signInWithEmail, continueAsGuest, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { handleGoogleSignIn, googleLoading } = useGoogleSignIn({
    onSuccess: () => navigation.replace("DialogueDashboard"),
  });
  const { handleAppleSignIn, appleLoading } = useAppleSignIn({
    onSuccess: () => navigation.replace("DialogueDashboard"),
  });

  const emailValid = /.+@.+\..+/.test(email.trim());
  const passwordValid = password.length >= 6;
  const hasEmailError = email.length > 0 && !emailValid;
  const hasPasswordError = password.length > 0 && !passwordValid;
  const formValid = emailValid && passwordValid;

  const getErrorDetails = (error: unknown) => {
    if (error instanceof Error) {
      return {
        code: (error as Error & { code?: string }).code,
        message: error.message,
      };
    }

    return { code: undefined, message: "Unknown error" };
  };

  const handleForgotPassword = async () => {
    if (!email) return Alert.alert("Email Required", "Enter your email above first.");
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
    if (loading) return;
    if (!email || !password) return Alert.alert("Missing Info", "Please fill in all fields.");
    try {
      setLoading(true);
      await signInWithEmail(email, password);
      navigation.replace("DialogueDashboard");
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
      setLoading(false);
    }
  };

  const handleContinueAsGuest = async () => {
    if (loading) return;
    try {
      setLoading(true);
      await continueAsGuest();
      navigation.replace("DialogueDashboard");
    } catch (error: unknown) {
      const { message } = getErrorDetails(error);
      Alert.alert("Error", message || "Failed to continue as guest.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <MaterialIcons name="psychology" size={36} color="#fff" />
        </View>
        <Card style={styles.card}>
          <Card.Title
            title="Welcome back"
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
                disabled={!formValid || loading}
                onPress={handleLogin}
              >
                {loading ? <ActivityIndicator color="#fff" size="small" /> : "Sign in"}
              </Button>

              <Divider style={styles.divider} />
              <View style={styles.fixToText}>
                <Button
                  mode="outlined"
                  icon="google"
                  style={[styles.outlined, styles.pill]}
                  labelStyle={styles.outlinedLabel}
                  disabled={loading || googleLoading || appleLoading}
                  onPress={handleGoogleSignIn}
                >
                  Sign in with Google
                </Button>
              </View>
              <Divider style={styles.divider} />

              <Button
                mode="contained"
                style={[styles.pill, styles.secondaryContained]}
                contentStyle={styles.primaryContent}
                labelStyle={styles.secondaryLabel}
                onPress={handleContinueAsGuest}
                disabled={loading}
              >
                Continue without signing in
              </Button>

              <Divider style={styles.divider} />

              <Button onPress={() => navigation.navigate("Welcome")} labelStyle={styles.linkLabel}>
                Back to welcome
              </Button>

              <Divider style={styles.divider} />

              <Button onPress={() => navigation.navigate("Register")} labelStyle={styles.linkLabel}>
                Create an account
              </Button>
            </View>
          </Card.Content>
        </Card>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  content: { flex: 1, justifyContent: "center", alignItems: "center" },
  hero: { alignItems: "center", marginBottom: 16 },
  card: {
    width: "90%",
    maxWidth: 420,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.25)",
    borderWidth: 1,
    borderRadius: 16,
  },
  cardContentWrap: { overflow: "hidden", borderRadius: 16 },
  cardTitle: { color: "#fff" },
  cardSubtitle: { color: "rgba(255,255,255,0.85)" },
  input: { backgroundColor: "transparent", marginBottom: 4 },
  helper: { color: "#ffb4b4", marginTop: -8, marginBottom: 8 },
  primary: { marginBottom: 8, backgroundColor: "#6C5CE7" },
  primaryContent: { height: 48 },
  primaryLabel: { color: "#fff", fontWeight: "600" },
  pill: { borderRadius: 28 },
  divider: { marginVertical: 12, backgroundColor: "rgba(255,255,255,0.2)" },
  outlined: { borderColor: "rgba(255,255,255,0.7)", marginBottom: 8 },
  outlinedLabel: { color: "#fff" },
  apple: { marginTop: 0 },
  linkLabel: { color: "#fff" },
  secondaryContained: { backgroundColor: "rgba(255,255,255,0.18)" },
  secondaryLabel: { color: "#fff", fontWeight: "600" },
  fixToText: {
    flexDirection: "row",
    justifyContent: "space-evenly",
  },
});
