import React, { useState, FC, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useNavigation } from "@react-navigation/native";
import { auth } from "../../firebaseConfig";
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Platform, ScrollView } from "react-native";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SignUpScreen: FC = () => {
  const navigation: any = useNavigation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const logoAnim = useState(new Animated.Value(1))[0];

  // inline validation flags
  const emailValid = useMemo(() => EMAIL_REGEX.test(email), [email]);
  const passwordLongEnough = useMemo(() => password.length >= 6, [password]);
  const passwordsMatch = useMemo(() => password === confirmPassword && password.length > 0, [password, confirmPassword]);

  React.useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  React.useEffect(() => {
    Animated.timing(logoAnim, {
      toValue: keyboardVisible ? 0 : 1,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [keyboardVisible]);

  // overall form valid
  const formValid = emailValid && passwordLongEnough && passwordsMatch && agreed;

  const handleSignUp = async () => {
    if (!agreed) {
      return Alert.alert("Terms Required", "You must agree to the Terms of Service.");
    }
    if (!email || !password || !confirmPassword) {
      return Alert.alert("Missing Info", "Please enter email and both password fields.");
    }
    if (!emailValid) {
      return Alert.alert("Invalid Email", "Please enter a valid email address.");
    }
    if (!passwordLongEnough) {
      return Alert.alert("Invalid Password", "Password should be at least 6 characters.");
    }
    if (!passwordsMatch) {
      return Alert.alert("Mismatch", "Passwords do not match.");
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
      Alert.alert("Success", "Account created successfully!");
      navigation.navigate("Welcome");
    } catch (error: any) {
      // Friendly error messages
      if (error.code === "auth/email-already-in-use") {
        Alert.alert("Error", "That email address is already in use.");
      } else if (error.code === "auth/invalid-email") {
        Alert.alert("Error", "That email address is invalid.");
      } else if (error.code === "auth/weak-password") {
        Alert.alert("Error", "Password should be at least 6 characters.");
      } else {
        Alert.alert("Error", error?.message ?? "Unknown error");
      }
    } finally {
      setLoading(false);
    }
  };

  const navigateToLogin = () => {
    navigation.navigate("Login");
  };

  const handleSocialLogin = (provider: string) => {
    Alert.alert("Coming Soon", `${provider} login not yet implemented.`);
  };

  return (
    <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* header */}
          {!keyboardVisible && (
            <Animated.View
              style={[
                styles.header,
                {
                  opacity: logoAnim,
                  transform: [
                    {
                      translateY: logoAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-40, 0], // slide slightly upward when hiding
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.headerIcon}>🔒</Text>
              <Text style={styles.headerTitle}>Promise Unlocked</Text>
            </Animated.View>
          )}

          {/* content - note: transparent contentArea so full-screen white remains */}
          <View style={styles.contentArea}>
            <Text style={styles.title}>Create Your Account</Text>
            <Text style={styles.subtitle}>Your future starts here.</Text>

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            {!emailValid && email.length > 0 && (
              <Text style={styles.inlineError}>Please enter a valid email address.</Text>
            )}

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Create a password"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShowPassword((s) => !s)} style={styles.eyeButton}>
                <Text style={styles.eyeText}>{showPassword ? "👁️‍🗨️" : "👁️"}</Text>
              </Pressable>
            </View>
            {!passwordLongEnough && password.length > 0 && (
              <Text style={styles.inlineError}>Password must be at least 6 characters.</Text>
            )}

            {/* Confirm Password */}
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter your password"
              secureTextEntry={true}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            {!passwordsMatch && confirmPassword.length > 0 && (
              <Text style={styles.inlineError}>Passwords do not match.</Text>
            )}

            {/* Terms */}
            <Pressable onPress={() => setAgreed(!agreed)} style={styles.checkboxContainer}>
              <View style={[styles.checkbox, agreed && styles.checkedCheckbox]}>
                {agreed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.termsText}>I agree to the Terms of Service and Privacy Policy.</Text>
            </Pressable>

            {/* Sign Up */}
            <Pressable
              style={[styles.signUpButton, (!formValid || loading) && { opacity: 0.6 }]}
              onPress={handleSignUp}
              disabled={!formValid || loading}
            >
              {loading ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.signUpButtonText}>Signing up...</Text>
                </View>
              ) : (
                <Text style={styles.signUpButtonText}>Sign Up</Text>
              )}
            </Pressable>

            {/*
            <Text style={styles.separatorText}>Or sign up with</Text>

            <View style={styles.socialButtonsInnerContainer}>
              <Pressable style={styles.socialButton} onPress={() => handleSocialLogin("Google")}>
                <Text style={styles.socialButtonText}>G</Text>
              </Pressable>
              <Pressable style={styles.socialButton} onPress={() => handleSocialLogin("Apple")}>
                <Text style={styles.socialButtonText}></Text>
              </Pressable>
              <Pressable style={styles.socialButton} onPress={() => handleSocialLogin("Facebook")}>
                <Text style={styles.socialButtonText}>f</Text>
              </Pressable>
            </View>
            */}

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account?</Text>
              <Pressable onPress={navigateToLogin}>
                <Text style={styles.loginLink}> Log in</Text>
              </Pressable>
            </View>

            {user && <Text style={{ color: "green", marginTop: 10 }}>Signed in as: {user.email}</Text>}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 125,
    paddingHorizontal: 25,
    justifyContent: "center",
    alignItems: "stretch",
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  headerIcon: { fontSize: 46, marginBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: "700", color: "#222" },
  contentArea: {
    flex: 1,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 5 },
  subtitle: { fontSize: 15, color: "#666", marginBottom: 20 },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 6 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 12,
    backgroundColor: "#FAFAFA",
  },
  passwordRow: { flexDirection: "row", alignItems: "center" },
  eyeButton: { paddingHorizontal: 10, justifyContent: "center" },
  eyeText: { fontSize: 20 },
  checkboxContainer: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#888",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  checkedCheckbox: { backgroundColor: "#222", borderColor: "#222" },
  checkmark: { color: "#fff", fontSize: 14 },
  termsText: { fontSize: 13, color: "#333", flexShrink: 1 },
  signUpButton: {
    backgroundColor: "#222",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 18,
    marginTop: 4,
  },
  signUpButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  inlineError: { color: "#D04545", marginBottom: 8, fontSize: 13 },
  separatorText: { textAlign: "center", color: "#888", marginBottom: 12, fontSize: 14 },
  socialButtonsInnerContainer: { flexDirection: "row", justifyContent: "center", gap: 20, marginBottom: 18 },
  socialButton: { backgroundColor: "#F0F0F0", width: 55, height: 55, borderRadius: 28, justifyContent: "center", alignItems: "center" },
  socialButtonText: { color: "#333", fontSize: 22, fontWeight: "bold" },
  loginContainer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 40 },
  loginText: { fontSize: 14, color: "#666" },
  loginLink: { fontSize: 14, color: "#007AFF", fontWeight: "600" },
});

export default SignUpScreen;