import React, { useState, useMemo } from "react";
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

type RegisterScreenNavigationProp = StackNavigationProp<RootStackParamList, "Register">;
type Props = Readonly<{
  navigation: RegisterScreenNavigationProp;
}>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ navigation }: Props) {
  const { signUpWithEmail } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { handleGoogleSignIn, googleLoading } = useGoogleSignIn({
    onSuccess: () => navigation.replace("MainTabs" as const, undefined as never),
  });

  const nameValid = fullName.trim().length >= 2;
  const emailValid = useMemo(() => EMAIL_REGEX.test(email.trim()), [email]);
  const passwordLongEnough = useMemo(() => password.length >= 6, [password]);
  const passwordsMatch = useMemo(
    () => password === confirmPassword && password.length > 0,
    [password, confirmPassword]
  );

  const hasNameError = fullName.length > 0 && !nameValid;
  const hasEmailError = email.length > 0 && !emailValid;
  const hasPasswordError = password.length > 0 && !passwordLongEnough;
  const hasConfirmError = confirmPassword.length > 0 && !passwordsMatch;
  const formValid = nameValid && emailValid && passwordLongEnough && passwordsMatch && agreed;
  const isAnyLoading = loading || googleLoading;

  const handleSignUp = async () => {
    if (!agreed) return Alert.alert("Terms Required", "You must agree to the Terms of Service.");
    if (!fullName || !email || !password || !confirmPassword)
      return Alert.alert("Missing Info", "Please fill in all fields.");
    if (!nameValid) return Alert.alert("Invalid Name", "Name must be at least 2 characters.");
    if (!emailValid) return Alert.alert("Invalid Email", "Please enter a valid email address.");
    if (!passwordLongEnough)
      return Alert.alert("Weak Password", "Password must be at least 6 characters.");
    if (!passwordsMatch) return Alert.alert("Mismatch", "Passwords do not match.");

    try {
      setLoading(true);
      await signUpWithEmail(email, password, fullName.trim());
      await waitForAuthenticated();
      navigation.replace("MainTabs" as const, undefined as never);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      let msg = message;

      if (message.includes("auth/email-already-in-use")) {
        msg = "That email is already in use. Please sign in instead.";
      } else if (message.includes("auth/invalid-email")) {
        msg = "That email address is invalid.";
      } else if (message.includes("auth/weak-password")) {
        msg = "Password must be at least 6 characters.";
      }

      Alert.alert("Error", msg);
      setLoading(false);
    }
  };

  const inputTheme = {
    roundness: radius.md,
    colors: { primary: colors.brand.dark, onSurfaceVariant: colors.text.secondary },
  };

  const eyeIcon = (
    <TextInput.Icon
      icon={showPassword ? "eye-off-outline" : "eye-outline"}
      onPress={() => setShowPassword((s) => !s)}
    />
  );

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
                width: width * 0.62,
                height: width * 0.62,
                borderRadius: width * 0.31,
                top: -width * 0.24,
                left: -width * 0.2,
                backgroundColor: colors.accent.coralLighter,
              },
            ]}
          />
          <View
            style={[
              styles.blob,
              {
                width: width * 0.4,
                height: width * 0.4,
                borderRadius: width * 0.2,
                top: -width * 0.08,
                right: -width * 0.14,
                backgroundColor: colors.accent.skyLight,
              },
            ]}
          />
          <View
            style={[
              styles.blob,
              {
                width: width * 0.22,
                height: width * 0.22,
                borderRadius: width * 0.11,
                top: width * 0.42,
                right: -width * 0.06,
                backgroundColor: colors.accent.coralLight,
              },
            ]}
          />
          <View
            style={[
              styles.blob,
              {
                width: width * 0.14,
                height: width * 0.14,
                borderRadius: width * 0.07,
                top: width * 0.62,
                left: -width * 0.04,
                backgroundColor: colors.accent.yellow,
                opacity: 0.3,
              },
            ]}
          />
          <View
            style={[
              styles.blob,
              {
                width: width * 0.1,
                height: width * 0.1,
                borderRadius: width * 0.05,
                bottom: width * 0.3,
                left: width * 0.08,
                backgroundColor: colors.accent.magenta,
                opacity: 0.2,
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
                right: -width * 0.16,
                backgroundColor: colors.accent.teal,
                opacity: 0.2,
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
                <Text style={styles.title}>Create account</Text>
                <Text style={styles.subtitle}>Your future starts here.</Text>
              </View>

              <View style={styles.form}>
                <View>
                  <TextInput
                    mode="outlined"
                    label="Full name"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    left={<TextInput.Icon icon="account-outline" />}
                    style={styles.input}
                    outlineColor={colors.border.subtle}
                    activeOutlineColor={colors.brand.dark}
                    textColor={colors.text.primary}
                    error={hasNameError}
                    theme={inputTheme}
                  />
                  {hasNameError && (
                    <HelperText type="error" style={styles.helper}>
                      Name must be at least 2 characters
                    </HelperText>
                  )}
                </View>

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
                    right={eyeIcon}
                    style={styles.input}
                    outlineColor={colors.border.subtle}
                    activeOutlineColor={colors.brand.dark}
                    textColor={colors.text.primary}
                    error={hasPasswordError}
                    theme={inputTheme}
                  />
                  {hasPasswordError && (
                    <HelperText type="error" style={styles.helper}>
                      Password must be at least 6 characters
                    </HelperText>
                  )}
                </View>

                <View>
                  <TextInput
                    mode="outlined"
                    label="Confirm password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    left={<TextInput.Icon icon="lock-check-outline" />}
                    right={eyeIcon}
                    style={styles.input}
                    outlineColor={colors.border.subtle}
                    activeOutlineColor={colors.brand.dark}
                    textColor={colors.text.primary}
                    error={hasConfirmError}
                    theme={inputTheme}
                  />
                  {hasConfirmError && (
                    <HelperText type="error" style={styles.helper}>
                      Passwords do not match
                    </HelperText>
                  )}
                </View>

                <Pressable
                  style={styles.checkboxRow}
                  onPress={() => setAgreed((a) => !a)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: agreed }}
                >
                  <MaterialIcons
                    name={agreed ? "check-box" : "check-box-outline-blank"}
                    size={22}
                    color={agreed ? colors.brand.dark : colors.text.secondary}
                  />
                  <Text style={styles.termsLabel}>
                    I agree to the <Text style={styles.termsLink}>Terms</Text> &{" "}
                    <Text style={styles.termsLink}>Privacy Policy</Text>
                  </Text>
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
                  onPress={handleSignUp}
                >
                  Create account
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
                  disabled={isAnyLoading}
                  onPress={handleGoogleSignIn}
                >
                  Continue with Google
                </Button>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Pressable onPress={() => navigation.navigate("Login")} hitSlop={8}>
                <Text style={styles.link}>Sign in</Text>
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
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 },
  termsLabel: { flex: 1, color: colors.text.secondary, fontSize: 13, lineHeight: 19 },
  termsLink: { ...typography.link, fontSize: 13, color: colors.text.accent },
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
