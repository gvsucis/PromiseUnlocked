import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { FAB } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';

type WelcomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Welcome'>;

interface Props {
  navigation: WelcomeScreenNavigationProp;
}

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }: Props) {
  const handleStartJourney = () => {
    console.log('Starting Skills Passport journey');
    navigation.navigate('DialogueDashboard');
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.mainText}>What are you doing when you lose track of time?</Text>
      </View>

      <View style={styles.fabContainer}>
        <FAB
          icon={() => (
            <View style={styles.iconContainer}>
              <MaterialIcons name="public" size={24} color="white" />
            </View>
          )}
          onPress={handleStartJourney}
          style={[styles.mainFab, { backgroundColor: '#6C5CE7' }]}
          label="Start Journey"
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  mainText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    lineHeight: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 10,
  },
  mainFab: {
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
});
