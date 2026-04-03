import React, { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { Provider as PaperProvider } from "react-native-paper";
import { StatusBar } from "expo-status-bar";

import WelcomeScreen from "./src/screens/WelcomeScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ResultScreen from "./src/screens/ResultScreen";
import BlueScreen from "./src/screens/BlueScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import VoiceAnalysisScreen from "./src/screens/VoiceAnalysisScreen";
import TextAnalysisScreen from "./src/screens/TextAnalysisScreen";
import SignUpScreen from "./src/screens/SignUpScreen";
import FollowUpQuestionScreen from "./src/screens/FollowUpQuestionScreen";
import SkillsDashboardScreen from "./src/screens/SkillsDashboardScreen";
import DialogueDashboardScreen from "./src/screens/DialogueDashboardScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import { RootStackParamList } from "./src/types/navigation";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import { Limelight } from "@getlimelight/sdk";
import { flushPendingFirestoreWrites } from "./src/services/firebase/firestoreWriteQueue";
import "./global.css";
import { Text, View } from "react-native";
import { PortalHost } from "@rn-primitives/portal";

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    // Initialize Limelight SDK after component mounts
    Limelight.connect();
  }, []);

  useEffect(() => {
    void flushPendingFirestoreWrites();

    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void flushPendingFirestoreWrites();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <PaperProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator
          initialRouteName="Login"
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
          <Stack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: false }} />

          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: "Activity Analyzer" }}
          />
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
            name="Profile"
            component={ProfileScreen}
            options={{ title: "My Profile" }}
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
      <PortalHost />
    </PaperProvider>
  );
}
