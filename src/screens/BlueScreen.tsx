import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Alert,
  ScrollView,
  Clipboard,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Button, ActivityIndicator, Snackbar } from 'react-native-paper';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { GeminiService } from '../services/geminiService';

const { width } = Dimensions.get('window');

export default function BlueScreen() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [permissionResponse, requestPermission] = Audio.usePermissions();

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, [recording]);

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const startRecording = async () => {
    try {
      if (permissionResponse?.status !== 'granted') {
        console.log('Requesting permission..');
        await requestPermission();
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording..');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      showSnackbar('Recording started...');
      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      showSnackbar('Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    console.log('Stopping recording..');
    setIsRecording(false);
    setIsTranscribing(true);

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();
      console.log('Recording stopped and stored at', uri);

      if (uri) {
        showSnackbar('Processing audio...');

        // Send to Gemini for transcription
        const result = await GeminiService.transcribeAudio(uri);

        if (result.success && result.transcript) {
          setTranscript(result.transcript);
          setTranscriptHistory((prev) => [result.transcript!, ...prev.slice(0, 9)]);
          showSnackbar('Transcription completed!');
        } else {
          showSnackbar(`Transcription failed: ${result.error || 'Unknown error'}`);
        }

        // Clean up the temporary file
        try {
          await FileSystem.deleteAsync(uri);
        } catch (cleanupError) {
          console.log('Could not delete temporary file:', cleanupError);
        }
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      showSnackbar('Error processing recording');
    } finally {
      setRecording(null);
      setIsTranscribing(false);
    }
  };

  const clearTranscript = () => {
    setTranscript('');
    showSnackbar('Transcript cleared');
  };

  const copyToClipboard = async () => {
    if (transcript) {
      await Clipboard.setString(transcript);
      showSnackbar('Text copied to clipboard!');
    }
  };

  const selectHistoryItem = (item: string) => {
    setTranscript(item);
    showSnackbar('Previous transcript selected');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>🎤 Voice Transcription</Text>
        <Text style={styles.subtitle}>
          Record your voice and get AI-powered transcription via Gemini
        </Text>

        {/* Status Indicator */}
        <View style={styles.statusContainer}>
          {isRecording ? (
            <View style={styles.listeningIndicator}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.statusText}>Recording...</Text>
            </View>
          ) : isTranscribing ? (
            <View style={styles.listeningIndicator}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.statusText}>Transcribing...</Text>
            </View>
          ) : (
            <Text style={styles.statusText}>Ready to record</Text>
          )}
        </View>

        {/* Main Control Button */}
        <Button
          mode="contained"
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing}
          style={[styles.button, isRecording ? styles.stopButton : styles.startButton]}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
        >
          {isRecording
            ? '⏹️ Stop Recording'
            : isTranscribing
              ? '🔄 Processing...'
              : '🎤 Start Recording'}
        </Button>

        {/* Permission Status */}
        {permissionResponse?.status !== 'granted' && (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>🎤 Microphone permission required</Text>
            <Button
              mode="outlined"
              onPress={requestPermission}
              style={styles.permissionButton}
              labelStyle={styles.permissionButtonText}
            >
              Grant Permission
            </Button>
          </View>
        )}

        {/* Final Transcript */}
        {transcript && (
          <View style={styles.transcriptContainer}>
            <View style={styles.transcriptHeader}>
              <Text style={styles.label}>📝 Your Speech:</Text>
              <View style={styles.transcriptActions}>
                <TouchableOpacity onPress={copyToClipboard} style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>📋 Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={clearTranscript} style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>🗑️ Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.transcriptScrollView} nestedScrollEnabled>
              <Text style={styles.transcriptText}>{transcript}</Text>
            </ScrollView>
          </View>
        )}

        {/* Transcript History */}
        {transcriptHistory.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.label}>📚 Recent Transcripts:</Text>
            {transcriptHistory.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.historyItem}
                onPress={() => selectHistoryItem(item)}
              >
                <Text style={styles.historyText} numberOfLines={2}>
                  {item}
                </Text>
                <Text style={styles.historyIndex}>#{index + 1}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>💡 How to use:</Text>
          <Text style={styles.instructionsText}>
            1. Grant microphone permission if prompted{'\n'}
            2. Tap "Start Recording" and begin speaking{'\n'}
            3. Tap "Stop Recording" when finished{'\n'}
            4. Wait for AI transcription via Gemini{'\n'}
            5. Copy or clear text as needed{'\n'}
            6. Access recent transcripts from history
          </Text>
        </View>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2196F3',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 20,
    paddingTop: 40,
  },
  header: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#bbdefb',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 20,
    minHeight: 60,
    justifyContent: 'center',
  },
  listeningIndicator: {
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 10,
  },
  button: {
    marginVertical: 10,
    minWidth: width * 0.7,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },

  transcriptContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 20,
    borderRadius: 15,
    marginVertical: 20,
    width: width * 0.9,
    maxHeight: 300,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  transcriptActions: {
    flexDirection: 'row',
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginLeft: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  transcriptScrollView: {
    maxHeight: 200,
  },
  transcriptText: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'left',
  },
  historyContainer: {
    width: width * 0.9,
    marginVertical: 20,
  },
  historyItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  historyText: {
    color: '#e3f2fd',
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  historyIndex: {
    color: '#bbdefb',
    fontSize: 12,
    fontWeight: '500',
  },
  instructionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 15,
    marginTop: 20,
    width: width * 0.9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  instructionsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  instructionsText: {
    color: '#e3f2fd',
    fontSize: 14,
    lineHeight: 22,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  snackbar: {
    backgroundColor: '#4CAF50',
  },
  permissionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 15,
    marginVertical: 20,
    width: width * 0.9,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
  },
  permissionButton: {
    borderColor: '#fff',
  },
  permissionButtonText: {
    color: '#fff',
  },
});
