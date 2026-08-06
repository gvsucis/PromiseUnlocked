import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Button, Card, Divider, TextInput, HelperText, Text } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";
import { useAuth } from "../context/AuthContext";
import { useGoogleSignIn } from "../hooks/useGoogleSignIn";
import { waitForAuthenticated } from "../services/auth/authSessionService";

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
            <MaterialIcons name="person-add" size={36} color="#fff" />
          </View>
          <Card style={styles.card}>
            <Card.Title
              title="Create account"
              subtitle="Your future starts here"
              titleStyle={styles.cardTitle}
              subtitleStyle={styles.cardSubtitle}
            />
            <Card.Content>
              <View style={styles.cardContentWrap}>
                {/* Full Name */}
                <TextInput
                  mode="flat"
                  label="Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  style={styles.input}
                  error={hasNameError}
                  theme={{ colors: { onSurfaceVariant: "#fff" } }}
                />
                <HelperText type="error" visible={hasNameError} style={styles.helper}>
                  Name must be at least 2 characters
                </HelperText>

                {/* Email */}
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

                {/* Password */}
                <TextInput
                  mode="flat"
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  error={hasPasswordError}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? "eye-off" : "eye"}
                      color="rgba(255,255,255,0.7)"
                      onPress={() => setShowPassword((s) => !s)}
                    />
                  }
                  theme={{ colors: { onSurfaceVariant: "#fff" } }}
                />
                <HelperText type="error" visible={hasPasswordError} style={styles.helper}>
                  Password must be at least 6 characters
                </HelperText>

                <TextInput
                  mode="flat"
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  error={hasConfirmError}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? "eye-off" : "eye"}
                      color="rgba(255,255,255,0.7)"
                      onPress={() => setShowPassword((s) => !s)}
                    />
                  }
                  theme={{ colors: { onSurfaceVariant: "#fff" } }}
                />
                <HelperText type="error" visible={hasConfirmError} style={styles.helper}>
                  Passwords do not match
                </HelperText>

                {/* Terms checkbox */}
                <Pressable
                  style={styles.checkboxRow}
                  onPress={() => setAgreed((a) => !a)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: agreed }}
                >
                  <View style={styles.checkboxControl}>
                    <MaterialIcons
                      name={agreed ? "check-box" : "check-box-outline-blank"}
                      size={20}
                      color={agreed ? "#ebe4cf" : "#FFFFFF"}
                    />
                  </View>
                  <View style={styles.termsTextWrap}>
                    <Text style={styles.termsLabel}>
                      I agree to the <Text style={styles.termsLink}>Terms</Text> &{" "}
                      <Text style={styles.termsLink}>Privacy Policy</Text>
                    </Text>
                  </View>
                </Pressable>

                <Divider style={styles.divider} />

                {/* Submit */}
                <Button
                  mode="contained"
                  style={[styles.primary, styles.pill]}
                  contentStyle={styles.primaryContent}
                  labelStyle={styles.primaryLabel}
                  disabled={!formValid || isAnyLoading}
                  onPress={handleSignUp}
                >
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : "Create Account"}
                </Button>

                <Divider style={styles.divider} />

                <Button
                  mode="outlined"
                  icon="google"
                  style={[styles.outlined, styles.pill]}
                  contentStyle={styles.primaryContent}
                  labelStyle={styles.outlinedLabel}
                  disabled={isAnyLoading}
                  onPress={handleGoogleSignIn}
                >
                  {googleLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    "Sign in with Google"
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
                    onPress={() => navigation.navigate("Login")}
                    labelStyle={styles.linkLabel}
                    style={styles.linkButton}
                  >
                    Already have an account? Sign in
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
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 4,
    paddingVertical: 2,
  },
  checkboxControl: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    marginTop: 2,
  },
  termsTextWrap: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
  termsLabel: { color: "rgba(255,255,255,0.92)", fontSize: 12, lineHeight: 18 },
  termsLink: {
    color: "#FFE082",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  primary: { marginBottom: 8, backgroundColor: "#6C5CE7" },
  primaryContent: { height: 48 },
  primaryLabel: { color: "#fff", fontWeight: "600" },
  pill: { borderRadius: 28 },
  divider: { marginVertical: 12, backgroundColor: "rgba(255,255,255,0.2)" },
  outlined: { borderColor: "rgba(255,255,255,0.7)" },
  outlinedLabel: { color: "#fff", fontWeight: "600" },
  linkLabel: { color: "#fff", fontSize: 14 },
  linkButton: { alignSelf: "center" },
  linkGroup: { alignItems: "center", gap: 4 },
});
