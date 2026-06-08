import React, { useState } from "react";
import { View, StyleSheet, Text, ActivityIndicator } from "react-native";
import { Button } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";
import { useAuth } from "../context/AuthContext";

type WelcomeScreenNavigationProp = StackNavigationProp<RootStackParamList, "Welcome">;

interface Props {
  navigation: WelcomeScreenNavigationProp;
}

export default function WelcomeScreen({ navigation }: Readonly<Props>) {
  const { continueAsGuest, session } = useAuth();
  const [loadingGuest, setLoadingGuest] = useState(false);

  React.useEffect(() => {
    if (session.mode === "authenticated") {
      navigation.replace("MainTabs");
    }
  }, [navigation, session.mode]);

  const handleStartJourney = async () => {
    if (loadingGuest) return;
    try {
      setLoadingGuest(true);
      await continueAsGuest();
      navigation.navigate("MainTabs");
    } finally {
      setLoadingGuest(false);
    }
  };

  const handleSignIn = () => {
    navigation.navigate("Login");
  };

  const handleCreateAccount = () => {
    navigation.navigate("Register");
  };

  return (
    <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.heroBadge}>
          <MaterialIcons name="explore" size={28} color="#fff" />
        </View>
        <Text style={styles.mainText}>What are you doing when you lose track of time?</Text>
        <Text style={styles.subText}>
          Start as a guest right away, or sign in to keep building your passport with an account.
        </Text>
      </View>

      <View style={styles.actionsContainer}>
        <Button
          mode="contained"
          onPress={handleStartJourney}
          style={styles.primaryButton}
          contentStyle={styles.primaryButtonContent}
          labelStyle={styles.primaryButtonLabel}
          disabled={loadingGuest}
          icon="rocket-launch"
        >
          {loadingGuest ? <ActivityIndicator color="#fff" size="small" /> : "Continue as Guest"}
        </Button>

        <Button
          mode="outlined"
          onPress={handleSignIn}
          style={styles.secondaryButton}
          labelStyle={styles.secondaryButtonLabel}
        >
          Sign In
        </Button>

        <Button
          mode="text"
          onPress={handleCreateAccount}
          contentStyle={styles.linkButtonContent}
          labelStyle={styles.linkLabel}
        >
          Create an Account
        </Button>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  heroBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  mainText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    lineHeight: 40,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subText: {
    marginTop: 18,
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  actionsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  primaryButton: {
    borderRadius: 28,
    backgroundColor: "#6C5CE7",
    marginBottom: 12,
  },
  primaryButtonContent: {
    height: 54,
  },
  primaryButtonLabel: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 28,
    borderColor: "rgba(255,255,255,0.7)",
    marginBottom: 8,
  },
  secondaryButtonLabel: {
    color: "#fff",
    fontWeight: "600",
  },
  linkLabel: {
    color: "#fff",
    fontWeight: "600",
  },
  linkButtonContent: {
    minHeight: 44,
  },
});
