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
import SignUpScreen from './src/screens/SignUpScreen';
import LoginScreen from "./src/screens/LoginScreen";
import { RootStackParamList } from './src/types/navigation';

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <PaperProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator 
          initialRouteName="SignUp"
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
            name="Welcome" 
            component={WelcomeScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="SignUp"
            component={SignUpScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
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
            name="VoiceAnalysis" 
            component={VoiceAnalysisScreen} 
            options={{ title: 'Voice Analysis' }}
          />
          <Stack.Screen 
            name="TextAnalysis" 
            component={TextAnalysisScreen} 
            options={{ title: 'Text Analysis' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
