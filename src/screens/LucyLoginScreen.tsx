import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../../firebaseConfig";
import { useNavigation } from "@react-navigation/native";
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const LoginScreen = () => {
  const navigation: any = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      return Alert.alert(
        "Email Required",
        "Enter your email above and then tap 'Forgot Password'."
      );
    }

    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        "Password Reset Sent",
        "Check your email for a link to reset your password."
      );
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        Alert.alert("Error", "No account exists with that email.");
      } else {
        Alert.alert("Error", error.message || "Unable to send reset email.");
      }
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert("Missing Information", "Please enter your email and password.");
    }

    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      Alert.alert("Welcome back!", `Logged in as ${user.email}`);
      navigation.navigate("Welcome");
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        Alert.alert("Error", "No account found with that email address.");
      } else if (error.code === "auth/wrong-password") {
        Alert.alert("Error", "Incorrect password. Please try again.");
      } else if (error.code === "auth/invalid-email") {
        Alert.alert("Error", "Please enter a valid email address.");
      } else {
        Alert.alert("Error", error.message || "An unknown error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;
      
      if (!idToken) {
        throw new Error('No ID token found');
      }
      
      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);
      
      Alert.alert("Welcome!", `Signed in as ${userCredential.user.email}`);
      navigation.navigate("Welcome");
    } catch (error: any) {
      if (error.code === 'sign_in_cancelled') {
        Alert.alert("Cancelled", "Google sign-in was cancelled");
      } else {
        Alert.alert("Error", error.message || "Google sign-in failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.headerIcon}>🔐</Text>
        <Text style={styles.headerTitle}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue your journey</Text>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable onPress={handleForgotPassword} style={styles.forgotPasswordButton}>
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </Pressable>

          <Pressable
            style={[styles.loginButton, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Log In</Text>
            )}
          </Pressable>

          <Pressable
            style={[styles.googleButton, loading && { opacity: 0.6 }]}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </Pressable>
        </View>

        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>Don't have an account?</Text>
          <Pressable onPress={() => navigation.navigate("SignUp")}>
            <Text style={styles.signupLink}> Sign Up</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 25,
    paddingVertical: 150,
  },
  headerIcon: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#222",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 40,
  },
  formContainer: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 10,
    backgroundColor: "#FAFAFA",
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginBottom: 15,
  },
  forgotPasswordText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "500",
  },
  loginButton: {
    backgroundColor: "#222",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 5,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  googleButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 15,
  },
  googleButtonText: {
    color: "#222",
    fontSize: 16,
    fontWeight: "600",
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  signupText: {
    fontSize: 14,
    color: "#666",
  },
  signupLink: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
  },
});

export default LoginScreen;