import { useState, useRef } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';
import { GeminiService } from '../services/geminiService';
import { INITIAL_PROMPT } from '../services/categoryTaxonomyService';
import { DialogueState } from './useDialogueState';

interface UseVoiceRecordingProps {
  dialogueState: DialogueState;
  mapAnswerToCategory: (question: string, answer: string) => Promise<void>;
}

export function useVoiceRecording({ dialogueState, mapAnswerToCategory }: UseVoiceRecordingProps) {
  const {
    setCurrentPrompt,
    currentPrompt,
    prefetchedQuestion,
    setPrefetchedQuestion,
    setUiState,
    setError,
    mappedCategories,
  } = dialogueState;

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleVoiceInputPress = () => {
    setError('');
    console.log('Voice input selected. State:', {
      mappedCount: mappedCategories.length,
      hasPrefetched: !!prefetchedQuestion,
      prefetchedQuestion,
    });

    if (mappedCategories.length === 0) {
      console.log('Using initial prompt');
      setCurrentPrompt(INITIAL_PROMPT);
      setTimeout(() => setUiState('voice-recording'), 100);
    } else if (prefetchedQuestion) {
      console.log('Using prefetched question:', prefetchedQuestion);
      setCurrentPrompt(prefetchedQuestion);
      setPrefetchedQuestion(null);
      setTimeout(() => setUiState('voice-recording'), 100);
    } else {
      console.error('No question available when voice input was selected');
      setError('No question available. Please try again.');
    }
  };

  const startRecording = async () => {
    try {
      console.log('Requesting permissions..');
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording..');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording. Please check your microphone permissions.');
    }
  };

  const stopRecording = async () => {
    console.log('Stopping recording..');
    if (!recordingRef.current) return;

    try {
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (uri) {
        setRecordingUri(uri);
        console.log('Recording stopped and stored at', uri);
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const handleVoiceSubmit = async () => {
    if (!recordingUri || !currentPrompt) {
      Alert.alert('Error', 'No recording available');
      return;
    }

    setIsProcessingAudio(true);

    try {
      console.log('Transcribing audio...');

      // Transcribe audio using GeminiService
      const transcriptionResult = await GeminiService.transcribeAudio(recordingUri);

      console.log('Transcription result:', transcriptionResult);

      if (
        !transcriptionResult.success ||
        !transcriptionResult.transcript ||
        transcriptionResult.transcript.trim().length === 0
      ) {
        const errorMsg =
          transcriptionResult.error ||
          'Could not transcribe your audio. Please try recording again.';
        Alert.alert('Transcription Error', errorMsg);
        return;
      }

      const transcribedText = transcriptionResult.transcript.trim();
      console.log('Transcribed text:', transcribedText);

      // Save the question and transcribed answer
      const question = currentPrompt;
      const answer = transcribedText;

      // Close voice recording modal
      setRecordingUri(null);
      setRecordingDuration(0);
      setCurrentPrompt('');

      // Process the voice answer directly
      await mapAnswerToCategory(question, answer);
    } catch (error) {
      console.error('Error processing voice answer:', error);
      let errorMessage = 'Failed to process your voice response. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('Rate limit')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (error.message.includes('API key')) {
          errorMessage = 'API key issue. Please check your configuration.';
        }
      }

      Alert.alert('Processing Error', errorMessage);
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const cancelVoice = () => {
    setRecordingUri(null);
    setRecordingDuration(0);
    setCurrentPrompt('');
    setUiState('idle');
  };

  return {
    isRecording,
    recordingDuration,
    recordingUri,
    isProcessingAudio,
    handleVoiceInputPress,
    startRecording,
    stopRecording,
    handleVoiceSubmit,
    cancelVoice,
    setRecordingUri,
    setRecordingDuration,
  };
}
