import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';

import WelcomeScreen from './src/screens/WelcomeScreen';
import HomeScreen from './src/screens/HomeScreen';
import ResultScreen from './src/screens/ResultScreen';
import BlueScreen from './src/screens/BlueScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import VoiceAnalysisScreen from './src/screens/VoiceAnalysisScreen';
import TextAnalysisScreen from './src/screens/TextAnalysisScreen';
import FollowUpQuestionScreen from './src/screens/FollowUpQuestionScreen';
import SkillsDashboardScreen from './src/screens/SkillsDashboardScreen';
import DialogueDashboardScreen from './src/screens/DialogueDashboardScreen';
import { RootStackParamList } from './src/types/navigation';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import { Limelight } from '@getlimelight/sdk';

Limelight.connect();

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <PaperProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#2196F3',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'Sign In', headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ title: 'Create Account', headerShown: false }}
          />
          <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'Activity Analyzer' }}
          />
          <Stack.Screen
            name="Result"
            component={ResultScreen}
            options={{ title: 'Analysis Results' }}
          />
          <Stack.Screen
            name="Blue"
            component={BlueScreen}
            options={{ title: 'Voice Transcription' }}
          />
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ title: 'Achievement Dashboard' }}
          />
          <Stack.Screen
            name="SkillsDashboard"
            component={SkillsDashboardScreen}
            options={{ title: 'Skills Dashboard' }}
          />
          <Stack.Screen
            name="DialogueDashboard"
            component={DialogueDashboardScreen}
            options={{ title: 'Skills Passport' }}
          />
          <Stack.Screen
            name="VoiceAnalysis"
            component={VoiceAnalysisScreen}
            options={{ title: 'Voice Analysis' }}
          />
          <Stack.Screen
            name="TextAnalysis"
            component={TextAnalysisScreen}
            options={{ title: 'Text Analysis' }}
          />
          <Stack.Screen
            name="FollowUpQuestion"
            component={FollowUpQuestionScreen}
            options={{ title: 'Answer Follow-up Question' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
