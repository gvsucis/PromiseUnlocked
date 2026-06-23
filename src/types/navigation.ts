import { NavigatorScreenParams } from "@react-navigation/native";
import { AnalysisResult } from "./index";

export type MainTabParamList = {
  Dashboard: undefined;
  Profile: undefined;
  Chat: undefined;
  Passport: undefined;
  Help: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  Welcome: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  EditProfile: undefined;
  Passport: undefined;
  Stamps: { region: string; categoryId: string };
  StampDetails: { stamp: string; region: string; categoryId: string };
  Home: undefined;
  Result: { result: AnalysisResult };
  Blue: undefined;
  Dashboard: undefined;
  Profile: undefined;
  SkillsDashboard: undefined;
  DialogueDashboard: undefined;
  VoiceAnalysis: { question?: string; context?: any } | undefined;
  TextAnalysis: undefined;
  FollowUpQuestion: { question: string; context?: any };
};
