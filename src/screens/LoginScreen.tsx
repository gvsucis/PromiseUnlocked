import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Button, TextInput, HelperText, Text } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";
import { useAuth } from "../context/AuthContext";
import { useGoogleSignIn } from "../hooks/useGoogleSignIn";
import { waitForAuthenticated } from "../services/auth/authSessionService";
import { colors, typography, spacing, radius } from "../styles/global";

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, "Login">;
interface Props {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({ navigation }: Readonly<Props>) {
  const { signInWithEmail, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { handleGoogleSignIn, googleLoading, googleReady } = useGoogleSignIn({
    onSuccess: () => navigation.replace("MainTabs" as const, undefined as never),
  });

  const emailValid = /.+@.+\..+/.test(email.trim());
  const passwordValid = password.length >= 6;
  const hasEmailError = email.length > 0 && !emailValid;
  const hasPasswordError = password.length > 0 && !passwordValid;
  const formValid = emailValid && passwordValid;
  const isAnyLoading = loading || googleLoading;

  const handleForgotPassword = async () => {
    if (!email || !emailValid)
      return Alert.alert("Email Required", "Enter a valid email address first.");
    try {
      await resetPassword(email);
      Alert.alert("Reset Sent", "Check your email for a reset link.");
    } catch {
      Alert.alert("Error", "No account exists with that email.");
    }
  };

  const handleLogin = async () => {
    if (loading) return;
    if (!email || !password) return Alert.alert("Missing Info", "Please fill in all fields.");
    try {
      setLoading(true);
      await signInWithEmail(email, password);
      await waitForAuthenticated();
      navigation.replace("MainTabs" as const, undefined as never);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      let msg = message;

      if (message.includes("auth/user-not-found")) {
        msg = "No account found with that email.";
      } else if (
        message.includes("auth/wrong-password") ||
        message.includes("auth/invalid-credential")
      ) {
        msg = "Incorrect email or password.";
      } else if (message.includes("auth/invalid-email")) {
        msg = "Invalid email address.";
      } else if (message.includes("auth/user-disabled")) {
        msg = "This account has been disabled. Please contact support.";
      } else if (message.includes("auth/too-many-requests")) {
        msg = "Too many login attempts. Please wait a bit and try again.";
      } else if (message.includes("auth/network-request-failed")) {
        msg = "Network error. Check your connection and try again.";
      }

      Alert.alert("Error", msg);
      setLoading(false);
    }
  };

  const inputTheme = {
    roundness: radius.md,
    colors: { primary: colors.brand.dark, onSurfaceVariant: colors.text.secondary },
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.screen}>
        {/* Decorative color blobs (sized relative to screen width) */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View
            style={[
              styles.blob,
              {
                width: width * 0.7,
                height: width * 0.7,
                borderRadius: width * 0.35,
                top: -width * 0.28,
                right: -width * 0.2,
                backgroundColor: colors.accent.skyLight,
              },
            ]}
          />
          <View
            style={[
              styles.blob,
              {
                width: width * 0.26,
                height: width * 0.26,
                borderRadius: width * 0.13,
                top: width * 0.3,
                left: -width * 0.08,
                backgroundColor: colors.accent.yellow,
                opacity: 0.3,
              },
            ]}
          />
          <View
            style={[
              styles.blob,
              {
                width: width * 0.5,
                height: width * 0.5,
                borderRadius: width * 0.25,
                bottom: -width * 0.22,
                left: -width * 0.16,
                backgroundColor: colors.accent.teal,
                opacity: 0.2,
              },
            ]}
          />
          <View
            style={[
              styles.blob,
              {
                width: width * 0.2,
                height: width * 0.2,
                borderRadius: width * 0.1,
                bottom: width * 0.18,
                right: -width * 0.05,
                backgroundColor: colors.accent.coralLight,
              },
            ]}
          />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Pressable
              onPress={() => navigation.navigate("Welcome")}
              style={styles.backButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialIcons name="arrow-back" size={22} color={colors.text.primary} />
            </Pressable>

            <View style={styles.main}>
              <View style={styles.header}>
                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>Sign in to pick up where you left off.</Text>
              </View>

              <View style={styles.form}>
                <View>
                  <TextInput
                    mode="outlined"
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    left={<TextInput.Icon icon="email-outline" />}
                    style={styles.input}
                    outlineColor={colors.border.subtle}
                    activeOutlineColor={colors.brand.dark}
                    textColor={colors.text.primary}
                    error={hasEmailError}
                    theme={inputTheme}
                  />
                  {hasEmailError && (
                    <HelperText type="error" style={styles.helper}>
                      Enter a valid email address
                    </HelperText>
                  )}
                </View>

                <View>
                  <TextInput
                    mode="outlined"
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    left={<TextInput.Icon icon="lock-outline" />}
                    right={
                      <TextInput.Icon
                        icon={showPassword ? "eye-off-outline" : "eye-outline"}
                        onPress={() => setShowPassword((s) => !s)}
                      />
                    }
                    style={styles.input}
                    outlineColor={colors.border.subtle}
                    activeOutlineColor={colors.brand.dark}
                    textColor={colors.text.primary}
                    error={hasPasswordError}
                    theme={inputTheme}
                  />
                  {hasPasswordError && (
                    <HelperText type="error" style={styles.helper}>
                      Minimum 6 characters
                    </HelperText>
                  )}
                </View>

                <Pressable onPress={handleForgotPassword} style={styles.forgot} hitSlop={8}>
                  <Text style={styles.link}>Forgot password?</Text>
                </Pressable>

                <Button
                  mode="contained"
                  buttonColor={colors.brand.dark}
                  textColor="#fff"
                  style={styles.pill}
                  contentStyle={styles.buttonContent}
                  labelStyle={styles.buttonLabel}
                  loading={loading}
                  disabled={!formValid || isAnyLoading}
                  onPress={handleLogin}
                >
                  Sign in
                </Button>

                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or</Text>
                  <View style={styles.orLine} />
                </View>

                <Button
                  mode="outlined"
                  icon="google"
                  textColor={colors.text.primary}
                  style={[styles.pill, styles.outlined]}
                  contentStyle={styles.buttonContent}
                  labelStyle={styles.buttonLabel}
                  loading={googleLoading}
                  disabled={isAnyLoading || !googleReady}
                  onPress={handleGoogleSignIn}
                >
                  Continue with Google
                </Button>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>New here?</Text>
              <Pressable onPress={() => navigation.navigate("Register")} hitSlop={8}>
                <Text style={styles.link}>Create an account</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background.base },
  blob: { position: "absolute" },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  content: { width: "100%", maxWidth: 440, flexGrow: 1 },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  main: { flex: 1, justifyContent: "center", paddingVertical: spacing.lg },
  header: { marginBottom: spacing.lg },
  title: { ...typography.screenTitle },
  subtitle: { fontSize: 15, color: colors.text.secondary, marginTop: 6, lineHeight: 22 },
  form: { gap: spacing.md },
  input: { backgroundColor: colors.background.base },
  helper: { color: colors.status.error, paddingHorizontal: 4, marginTop: 2 },
  forgot: { alignSelf: "flex-end", marginTop: -4 },
  link: { ...typography.link, color: colors.text.accent },
  pill: { borderRadius: radius.full },
  buttonContent: { height: 52 },
  buttonLabel: { fontSize: 16, fontWeight: "700" },
  outlined: { borderColor: colors.border.subtle, backgroundColor: colors.background.base },
  orRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border.subtle },
  orText: { color: colors.text.secondary, fontSize: 13 },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingTop: spacing.md,
  },
  footerText: { color: colors.text.secondary, fontSize: 14 },
});
