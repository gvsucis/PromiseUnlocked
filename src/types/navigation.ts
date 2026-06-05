import { AnalysisResult } from "./index";

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  Welcome: undefined;
  MainTabs: undefined;
  EditProfile: undefined;
  Passport: undefined;
  Stamps: { region: string };
  StampDetails: { stamp: string; region: string };
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