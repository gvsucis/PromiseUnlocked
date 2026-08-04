import React, { useEffect } from "react";
import { ActivityIndicator, AppState, AppStateStatus, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { getAllPreloadUrls } from "./src/config/stampConstants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { Provider as PaperProvider } from "react-native-paper";
import { StatusBar } from "expo-status-bar";
import WelcomeScreen from "./src/screens/WelcomeScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ResultScreen from "./src/screens/ResultScreen";
import BlueScreen from "./src/screens/BlueScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import VoiceAnalysisScreen from "./src/screens/VoiceAnalysisScreen";
import TextAnalysisScreen from "./src/screens/TextAnalysisScreen";
import FollowUpQuestionScreen from "./src/screens/FollowUpQuestionScreen";
import SkillsDashboardScreen from "./src/screens/SkillsDashboardScreen";
import DialogueDashboardScreen from "./src/screens/DialogueDashboardScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import PassportScreen from "./src/screens/PassportScreen";
import StampScreen from "./src/screens/StampScreen";
import DetailStampScreen from "./src/screens/DetailStampScreen";
import EditProfileScreen from "./src/screens/EditProfileScreen";
import { RootStackParamList } from "./src/types/navigation";
import MainTabNavigator from "./src/navigation/MainTabNavigator";
import { DialogueProvider } from "./src/context/DialogueProvider";
import { DialogueModals } from "./src/components/dialogue/DialogueModals";
import { flushPendingFirestoreWrites } from "./src/services/firebase/firestoreWriteQueue";
import { checkBackendHealth } from "./src/services/backendHealth";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import RootErrorBoundary from "./src/components/RootErrorBoundary";

const Stack = createStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { session } = useAuth();

  // Hoisted before the loading gate so hook call count stays identical on every render.
  const [hasSeenOnboarding, setHasSeenOnboarding] = React.useState<boolean>(false);

  useEffect(() => {
    // Kick off background probes — neither blocks the UI.
    void checkBackendHealth(3000);
    void flushPendingFirestoreWrites();
    // Warm expo-image's cache (StampBadge renders via expo-image, so RN's
    // Image.prefetch would populate a different cache and never be read).
    void ExpoImage.prefetch(getAllPreloadUrls(), { cachePolicy: "memory-disk" });

    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void flushPendingFirestoreWrites();
      }
    });

    AsyncStorage.getItem("hasSeenOnboarding")
      .then((val: string | null) => setHasSeenOnboarding(val === "true"))
      .catch(() => setHasSeenOnboarding(false));

    return () => {
      subscription.remove();
    };
  }, []);

  if (session.mode === "loading") {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#1a1a2e",
        }}
      >
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  const getInitialRoute = () => {
    if (session.mode === "authenticated") return "MainTabs" as const;
    if (!hasSeenOnboarding) return "Onboarding" as const;
    return "Welcome" as const;
  };

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <DialogueModals />
      <Stack.Navigator
        initialRouteName={getInitialRoute()}
        screenOptions={{
          headerStyle: {
            backgroundColor: "#2196F3",
          },
          headerTintColor: "rgb(255, 255, 255)",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      >
        {/* ── Pre-auth screens ── */}
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
          listeners={{
            beforeRemove: () => {
              void AsyncStorage.setItem("hasSeenOnboarding", "false");
            },
          }}
        />
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{ title: "Welcome", headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: "Sign In", headerShown: false }}
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ title: "Create Account", headerShown: false }}
        />

        {/* ── Authenticated shell ── */}
        <Stack.Screen
          name="MainTabs"
          component={MainTabNavigator}
          options={{ headerShown: false }}
        />

        {/* ── Stack screens pushed on top of MainTabs ── */}
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{ title: "Edit Profile", headerShown: false }}
        />
        <Stack.Screen
          name="Passport"
          component={PassportScreen}
          options={{ title: "Skills Passport", headerShown: false }}
        />
        <Stack.Screen
          name="Stamps"
          component={StampScreen}
          options={{ title: "Stamps", animation: "none", headerShown: false }}
        />
        <Stack.Screen
          name="StampDetails"
          component={DetailStampScreen}
          options={{ title: "Detailed Stamp", animation: "none", headerShown: false }}
        />

        {/* ── Legacy screens (kept until formally removed) ── */}
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Activity Analyzer" }} />
        <Stack.Screen
          name="Result"
          component={ResultScreen}
          options={{ title: "Analysis Results" }}
        />
        <Stack.Screen
          name="Blue"
          component={BlueScreen}
          options={{ title: "Voice Transcription" }}
        />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: "Achievement Dashboard" }}
        />
        <Stack.Screen
          name="SkillsDashboard"
          component={SkillsDashboardScreen}
          options={{ title: "Skills Dashboard" }}
        />
        <Stack.Screen
          name="DialogueDashboard"
          component={DialogueDashboardScreen}
          options={{ title: "Skills Passport" }}
        />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
        <Stack.Screen
          name="VoiceAnalysis"
          component={VoiceAnalysisScreen}
          options={{ title: "Voice Analysis" }}
        />
        <Stack.Screen
          name="TextAnalysis"
          component={TextAnalysisScreen}
          options={{ title: "Text Analysis" }}
        />
        <Stack.Screen
          name="FollowUpQuestion"
          component={FollowUpQuestionScreen}
          options={{ title: "Answer Follow-up Question" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <RootErrorBoundary>
      <PaperProvider>
        <AuthProvider>
          <DialogueProvider>
            <AppNavigator />
          </DialogueProvider>
        </AuthProvider>
      </PaperProvider>
    </RootErrorBoundary>
  );
}
