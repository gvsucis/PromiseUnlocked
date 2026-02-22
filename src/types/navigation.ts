import { AnalysisResult } from './index';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Welcome: undefined;
  Home: undefined;
  Result: { result: AnalysisResult };
  Blue: undefined;
  Dashboard: undefined;
  SkillsDashboard: undefined;
  DialogueDashboard: undefined;
  VoiceAnalysis: { question?: string; context?: any } | undefined;
  TextAnalysis: undefined;
  FollowUpQuestion: { question: string; context?: any };
};
