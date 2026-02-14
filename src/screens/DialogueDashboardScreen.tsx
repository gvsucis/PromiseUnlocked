import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Alert,
  Keyboard,
  Animated,
} from 'react-native';
import { Text, Card, ActivityIndicator, FAB } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { RootStackParamList } from '../types/navigation';
import {
  CATEGORY_TAXONOMY,
  TOTAL_CATEGORIES,
  INITIAL_PROMPT,
  NO_OP_CATEGORY,
  getTaxonomyString,
  getCompletionPercentage,
  findValidCategory,
  MappedCategory,
  ConversationInteraction,
} from '../services/categoryTaxonomyService';
import {
  getMappedCategories,
  saveMappedCategory,
  getConversationHistory,
  addConversationInteraction,
  clearAllData,
  isCategoryMapped,
} from '../services/categoryStorageService';
import { GeminiService } from '../services/geminiService';
import { ImagePickerService } from '../services/imagePickerService';
import { Audio } from 'expo-av';
import ZoomableImageView from '../components/ZoomableImageView';
import ImageEditor from '../components/ImageEditor';
import { LoadingModal } from '../components/dialogue/LoadingModal';
import { CompletionModal } from '../components/dialogue/CompletionModal';
import { WeakFitModal } from '../components/dialogue/WeakFitModal';
import { InputMethodModal } from '../components/dialogue/InputMethodModal';
import { AnswerModal } from '../components/dialogue/AnswerModal';
import { VoiceRecordingModal } from '../components/dialogue/VoiceRecordingModal';
import { CategoryCard } from '../components/dialogue/CategoryCard';

const { width } = Dimensions.get('window');

type DialogueDashboardNavigationProp = StackNavigationProp<RootStackParamList, 'DialogueDashboard'>;
type DialogueDashboardRouteProp = RouteProp<RootStackParamList, 'DialogueDashboard'>;

interface Props {
  readonly navigation: DialogueDashboardNavigationProp;
  readonly route: DialogueDashboardRouteProp;
}

type UIState = 'idle' | 'answering' | 'loading' | 'complete' | 'weak-fit' | 'voice-recording';

export default function DialogueDashboardScreen({ navigation }: Props) {
  const [mappedCategories, setMappedCategories] = useState<MappedCategory[]>([]);
  const [interactions, setInteractions] = useState<ConversationInteraction[]>([]);
  const [uiState, setUiState] = useState<UIState>('idle');
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [prefetchedQuestion, setPrefetchedQuestion] = useState<string | null>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weakFitJustification, setWeakFitJustification] = useState('');
  const [savedQuestion, setSavedQuestion] = useState(''); // Store question for weak-fit retry

  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = React.useRef<any>(null);

  // Image handling state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [tempImageUri, setTempImageUri] = useState<string | null>(null);
  const [zoomViewerVisible, setZoomViewerVisible] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  // Input method modal state
  const [showInputMethodModal, setShowInputMethodModal] = useState(false);

  // Debug useEffect to monitor showInputMethodModal changes
  useEffect(() => {
    console.log('showInputMethodModal changed to:', showInputMethodModal);
  }, [showInputMethodModal]);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [pendingVoiceRecording, setPendingVoiceRecording] = useState(false);
  const [isAnswerFromVoice, setIsAnswerFromVoice] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // FAB animation state
  const [isFabOpen, setIsFabOpen] = useState(false);
  const fabAnimation = useRef(new Animated.Value(0)).current;
  const button1Animation = useRef(new Animated.Value(0)).current;
  const button2Animation = useRef(new Animated.Value(0)).current;
  const button3Animation = useRef(new Animated.Value(0)).current;
  const rotateAnimation = useRef(new Animated.Value(0)).current;

  // Configure navigation header with reset button
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleReset}
          style={{ marginRight: 15 }}
          disabled={uiState !== 'idle' && uiState !== 'complete'}
        >
          <MaterialIcons
            name="refresh"
            size={24}
            color={uiState !== 'idle' && uiState !== 'complete' ? '#ccc' : '#fff'}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, uiState]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Check completion
  useEffect(() => {
    if (mappedCategories.length === TOTAL_CATEGORIES) {
      setUiState('complete');
      setPrefetchedQuestion(null);
      setIsPrefetching(false);
    }
  }, [mappedCategories.length]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('State changed:', {
      uiState,
      currentPrompt: currentPrompt.substring(0, 50) + '...',
      hasPrompt: !!currentPrompt,
    });
  }, [uiState, currentPrompt]);

  // Debug: Specifically track Answer modal visibility
  useEffect(() => {
    const shouldShowAnswerModal = uiState === 'answering';
    console.log('🔴 Answer Modal should be visible:', shouldShowAnswerModal, {
      uiState,
      hasCurrentPrompt: !!currentPrompt,
      promptLength: currentPrompt.length,
      showInputMethodModal,
    });
  }, [uiState, currentPrompt, showInputMethodModal]);

  // FAB animation functions
  const toggleFabMenu = () => {
    const toValue = isFabOpen ? 0 : 1;

    Animated.parallel([
      Animated.spring(fabAnimation, {
        toValue,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(rotateAnimation, {
        toValue,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.stagger(50, [
        Animated.spring(button1Animation, {
          toValue,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.spring(button2Animation, {
          toValue,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.spring(button3Animation, {
          toValue,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]),
    ]).start();

    setIsFabOpen(!isFabOpen);
  };

  const rotation = rotateAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const button1Style = {
    transform: [
      {
        translateX: button1Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -96],
        }),
      },
      {
        scale: button1Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
      },
    ],
  };

  const button2Style = {
    transform: [
      {
        translateX: button2Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -68],
        }),
      },
      {
        translateY: button2Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -68],
        }),
      },
      {
        scale: button2Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
      },
    ],
  };

  const button3Style = {
    transform: [
      {
        translateY: button3Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -96],
        }),
      },
      {
        scale: button3Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
      },
    ],
  };

  const loadData = async () => {
    try {
      const [mapped, history] = await Promise.all([
        getMappedCategories(),
        getConversationHistory(),
      ]);
      setMappedCategories(mapped);
      setInteractions(history);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load your progress');
    } finally {
      setLoading(false);
    }
  };

  const getNextQuestion = useCallback(
    async (isPrefetch = false) => {
      setError('');

      if (mappedCategories.length === TOTAL_CATEGORIES) {
        setUiState('complete');
        return;
      }

      if (!isPrefetch) {
        setUiState('loading');
        setLoadingMessage('Synthesizing a new question...');
      }

      try {
        const taxonomyString = getTaxonomyString();
        const newQuestion = await GeminiService.synthesizeNextQuestion(
          interactions,
          mappedCategories,
          taxonomyString
        );

        if (isPrefetch) {
          console.log('Setting prefetched question:', newQuestion);
          setPrefetchedQuestion(newQuestion);
          setIsPrefetching(false);

          // If user is waiting, show question immediately
          setUiState((currentUiState) => {
            if (currentUiState === 'loading' && loadingMessage.includes('Wait while')) {
              console.log('User was waiting, showing question immediately');
              setCurrentPrompt(newQuestion);
              if (pendingVoiceRecording) {
                setPendingVoiceRecording(false);
                return 'voice-recording';
              }
              return 'answering';
            }
            return currentUiState === 'loading' ? 'idle' : currentUiState;
          });

          setLoadingMessage('');
        } else {
          console.log('Setting current prompt (non-prefetch):', newQuestion);
          setCurrentPrompt(newQuestion);
          setLoadingMessage('');

          // Small delay to ensure loading modal closes before answer modal opens
          setTimeout(() => {
            if (pendingVoiceRecording) {
              console.log('Setting uiState to voice-recording');
              setPendingVoiceRecording(false);
              setUiState('voice-recording');
            } else {
              console.log('Setting uiState to answering');
              setUiState('answering');
            }
            console.log('UI state should now be set, modal should appear');
          }, 100);
        }
      } catch (err) {
        console.error('Error getting next question:', err);
        setError('Failed to generate question. Please try again.');
        setIsPrefetching(false);
        setPendingVoiceRecording(false);
        setLoadingMessage('');
        setUiState('idle');
      }
    },
    [interactions, mappedCategories, pendingVoiceRecording]
  );

  const mapAnswerToCategory = async (question: string, answer: string) => {
    setUiState('loading');
    setLoadingMessage('Analyzing your response...');
    setError('');

    setPrefetchedQuestion(null);
    setIsPrefetching(false);

    try {
      const isInitial = mappedCategories.length === 0;
      const taxonomyString = getTaxonomyString();

      // Use combined API call to map answer AND generate next question in one request
      const result = await GeminiService.mapAnswerAndGenerateNextQuestion(
        question,
        answer,
        isInitial,
        interactions,
        mappedCategories,
        taxonomyString
      );

      const { category: rawCategory, justification, nextQuestion } = result;

      // Validate category
      const validCategory = findValidCategory(rawCategory);
      const categoryNameToCheck = validCategory ? validCategory.category : rawCategory;

      let mappingResult = 'NO_CHANGE';

      if (categoryNameToCheck === NO_OP_CATEGORY) {
        // NO-OP: weak fit - ask follow-up question
        console.log('NO-OP Mapping: weak fit. Justification:', justification);
        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: 'NO-OP (WEAK FIT)',
          timestamp: new Date().toISOString(),
        };
        await addConversationInteraction(interaction);
        setInteractions((prev) => [...prev, interaction]);

        // Show weak fit modal with follow-up prompt
        setWeakFitJustification(justification);
        setUiState('weak-fit');
        return; // Don't prefetch or continue
      } else if (validCategory && !(await isCategoryMapped(categoryNameToCheck))) {
        // Successful mapping
        mappingResult = 'SUCCESS';

        const newMappedCategory: MappedCategory = {
          category: categoryNameToCheck,
          justification,
          dateIdentified: new Date().toISOString(),
        };

        await saveMappedCategory(newMappedCategory);
        const newMappedCategories = [...mappedCategories, newMappedCategory];
        setMappedCategories(newMappedCategories);

        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: categoryNameToCheck,
          timestamp: new Date().toISOString(),
        };
        await addConversationInteraction(interaction);
        setInteractions((prev) => [...prev, interaction]);

        // Trigger confetti animation for successful mapping!
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);

        if (newMappedCategories.length === TOTAL_CATEGORIES) {
          mappingResult = 'COMPLETE';
        }
      } else if (await isCategoryMapped(categoryNameToCheck)) {
        setError(`"${categoryNameToCheck}" is already mapped. Trying next question.`);
        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: 'ALREADY MAPPED (IGNORED)',
          timestamp: new Date().toISOString(),
        };
        await addConversationInteraction(interaction);
        setInteractions((prev) => [...prev, interaction]);
      } else {
        setError(`Unexpected category: "${rawCategory}". Please try again.`);
        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: 'MAPPING FAILED',
          timestamp: new Date().toISOString(),
        };
        await addConversationInteraction(interaction);
        setInteractions((prev) => [...prev, interaction]);
      }

      setUserAnswer('');
      setIsAnswerFromVoice(false);

      // Use the next question that was generated in the same API call
      // No need to prefetch separately - we already have it!
      if (mappingResult !== 'COMPLETE' && mappingResult !== 'MAPPING_FAILED' && nextQuestion) {
        console.log('Using next question from combined API response:', nextQuestion);
        setPrefetchedQuestion(nextQuestion);
        setIsPrefetching(false);
      } else if (mappingResult !== 'COMPLETE' && mappingResult !== 'MAPPING_FAILED') {
        // Fallback: only prefetch if the combined call didn't return a question
        console.log('Next question not returned, falling back to separate prefetch');
        setIsPrefetching(true);
        setTimeout(() => {
          getNextQuestion(true);
        }, 2000);
      }

      if (mappingResult === 'COMPLETE') {
        setUiState('complete');
      } else {
        setUiState('idle');
      }
    } catch (err) {
      console.error('Error mapping answer:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to process your answer. Please try again.';
      setError(errorMessage);
      setUserAnswer('');
      setIsAnswerFromVoice(false);
      setCurrentPrompt('');
      setUiState('idle');
    }
  };

  const handleStartButtonPress = async () => {
    if (uiState !== 'idle') return;
    setError(''); // Clear any previous errors

    // If we need a question and don't have one, synthesize it first
    if (mappedCategories.length > 0 && !prefetchedQuestion && !isPrefetching) {
      console.log('Need to synthesize question before showing input method modal');
      setUiState('loading');
      setLoadingMessage('Synthesizing a new question...');

      try {
        const taxonomyString = getTaxonomyString();
        const newQuestion = await GeminiService.synthesizeNextQuestion(
          interactions,
          mappedCategories,
          taxonomyString
        );

        console.log('Question synthesized, storing as prefetched:', newQuestion);
        setPrefetchedQuestion(newQuestion);
        setUiState('idle');
        setLoadingMessage('');

        // Small delay before showing input method modal
        setTimeout(() => {
          setShowInputMethodModal(true);
        }, 100);
      } catch (err) {
        console.error('Error synthesizing question:', err);
        setError('Failed to generate question. Please try again.');
        setUiState('idle');
        setLoadingMessage('');
      }
    } else {
      // Question ready or it's first question (INITIAL_PROMPT)
      setShowInputMethodModal(true);
    }
  };

  const handleInputMethodSelect = async (method: 'text' | 'voice' | 'image') => {
    console.log('handleInputMethodSelect called with method:', method);
    setShowInputMethodModal(false);

    // Wait for state to update and next frame to render
    await new Promise((resolve) => setTimeout(resolve, 150));

    console.log('Executing input method handler after delay');
    if (method === 'text') {
      handleTextInputPress();
    } else if (method === 'voice') {
      handleVoiceInputPress();
    } else if (method === 'image') {
      handleImageInputPress();
    }
  };

  const handleFabClick = () => {
    if (uiState !== 'idle') return;
    toggleFabMenu();
  };

  const handleTextInputPress = () => {
    setError(''); // Clear any previous errors
    console.log('Text input selected. State:', {
      mappedCount: mappedCategories.length,
      hasPrefetched: !!prefetchedQuestion,
      prefetchedQuestion,
    });

    if (mappedCategories.length === 0) {
      // Start with initial prompt
      console.log('Using initial prompt');
      setCurrentPrompt(INITIAL_PROMPT);
      setTimeout(() => setUiState('answering'), 100);
    } else if (prefetchedQuestion) {
      // Use prefetched question (should always be available now)
      console.log('Using prefetched question:', prefetchedQuestion);
      setCurrentPrompt(prefetchedQuestion);
      setPrefetchedQuestion(null);
      setTimeout(() => setUiState('answering'), 100);
    } else {
      // This shouldn't happen now, but fallback to error
      console.error('No question available when text input was selected');
      setError('No question available. Please try again.');
    }
  };

  const handleVoiceInputPress = () => {
    setError(''); // Clear any previous errors
    console.log('Voice input selected. State:', {
      mappedCount: mappedCategories.length,
      hasPrefetched: !!prefetchedQuestion,
      prefetchedQuestion,
    });

    if (mappedCategories.length === 0) {
      // Start with initial prompt
      console.log('Using initial prompt');
      setCurrentPrompt(INITIAL_PROMPT);
      setTimeout(() => setUiState('voice-recording'), 100);
    } else if (prefetchedQuestion) {
      // Use prefetched question (should always be available now)
      console.log('Using prefetched question:', prefetchedQuestion);
      setCurrentPrompt(prefetchedQuestion);
      setPrefetchedQuestion(null);
      setTimeout(() => setUiState('voice-recording'), 100);
    } else {
      // This shouldn't happen now, but fallback to error
      console.error('No question available when voice input was selected');
      setError('No question available. Please try again.');
    }
  };

  const showImageSourceDialog = () => {
    Alert.alert(
      'Choose Image Source',
      'How would you like to add your image?',
      [
        {
          text: 'Take Photo',
          onPress: () => handleImageSelection(true),
        },
        {
          text: 'Choose from Gallery',
          onPress: () => handleImageSelection(false),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleImageInputPress = async () => {
    setError(''); // Clear any previous errors

    // Get the question
    if (mappedCategories.length === 0) {
      setCurrentPrompt(INITIAL_PROMPT);
      setSavedQuestion(INITIAL_PROMPT);
    } else if (prefetchedQuestion) {
      setCurrentPrompt(prefetchedQuestion);
      setSavedQuestion(prefetchedQuestion);
      setPrefetchedQuestion(null);
    } else {
      console.error('No question available when image input was selected');
      setError('No question available. Please try again.');
      return;
    }

    showImageSourceDialog();
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

  const handleImageSelection = async (useCamera: boolean) => {
    try {
      const hasPermissions = await ImagePickerService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert(
          'Permissions Required',
          'Camera and photo library permissions are required to use this feature.'
        );
        return;
      }

      let result;
      if (useCamera) {
        result = await ImagePickerService.takePhotoWithCamera();
      } else {
        result = await ImagePickerService.pickImageFromGalleryWithOptions(false);
      }

      if (result.success && result.imageUri) {
        setTempImageUri(result.imageUri);
        setShowImageEditor(true);
      } else if (result.error) {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'An error occurred while selecting image');
    }
  };

  const handleImageEditorSave = (editedImageUri: string) => {
    setSelectedImage(editedImageUri);
    setShowImageEditor(false);
    setTempImageUri(null);
    setUiState('answering'); // Show the answer modal with image preview
  };

  const handleImageEditorCancel = () => {
    setShowImageEditor(false);
    setTempImageUri(null);
    setUiState('idle');
  };

  const handleSubmitImage = async () => {
    if (!selectedImage || !currentPrompt) {
      Alert.alert('Error', 'Missing image or question');
      return;
    }

    setIsAnalyzingImage(true);
    setUiState('loading');
    setLoadingMessage('Analyzing your image response...');

    try {
      // Analyze the image with Gemini
      const analysisResult = await GeminiService.analyzeActionImage(selectedImage);

      if (!analysisResult.success || !analysisResult.rawResponse) {
        throw new Error(analysisResult.error || 'Failed to analyze image');
      }

      // Use the image analysis description as the answer
      const answer = analysisResult.rawResponse;

      // Clear image state
      setSelectedImage(null);

      // Map the answer to a category
      await mapAnswerToCategory(currentPrompt, answer);
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'Failed to process image. Please try again.');
      setUiState('idle');
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleSubmitAnswer = () => {
    if (!userAnswer.trim()) {
      setError('Answer cannot be empty. Please provide a substantive response.');
      return;
    }

    const q = currentPrompt;
    const a = userAnswer;
    setSavedQuestion(q); // Save for potential weak-fit retry
    setCurrentPrompt('');
    setUserAnswer('');

    mapAnswerToCategory(q, a);
  };

  const handleWeakFitTryAgain = () => {
    // Re-open the answer modal with the same question
    setCurrentPrompt(savedQuestion); // Restore the original question
    setError(''); // Clear any previous errors
    setUiState('answering');
    setWeakFitJustification('');
  };

  const handleDismissAnswerModal = () => {
    // Close the answer modal and return to idle
    Keyboard.dismiss();
    setCurrentPrompt('');
    setUserAnswer('');
    setError('');
    setIsAnswerFromVoice(false);
    setUiState('idle');
  };

  const handleWeakFitNewQuestion = async () => {
    // After a weak fit, synthesize a new question then show input method modal
    setWeakFitJustification('');
    setError('');

    // Close weak-fit modal first
    setUiState('idle');

    // Wait for weak-fit modal to close before opening loading modal
    await new Promise((resolve) => setTimeout(resolve, 150));

    setUiState('loading');
    setLoadingMessage('Synthesizing a new question...');

    try {
      const taxonomyString = getTaxonomyString();
      const newQuestion = await GeminiService.synthesizeNextQuestion(
        interactions,
        mappedCategories,
        taxonomyString
      );

      console.log('Weak-fit: Question synthesized, storing as prefetched:', newQuestion);
      setPrefetchedQuestion(newQuestion);
      setLoadingMessage('');

      // Wait for loading modal to close before showing input method modal
      await new Promise((resolve) => setTimeout(resolve, 100));

      setUiState('idle');

      setTimeout(() => {
        setShowInputMethodModal(true);
      }, 100);
    } catch (err) {
      console.error('Error synthesizing question after weak-fit:', err);
      setError('Failed to generate question. Please try again.');
      setUiState('idle');
      setLoadingMessage('');
    }
  };

  const handleReset = () => {
    Alert.alert('Reset Dashboard', 'Are you sure you want to reset? All progress will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearAllData();
            setMappedCategories([]);
            setInteractions([]);
            setCurrentPrompt('');
            setUserAnswer('');
            setUiState('idle');
            setError('');
            setLoadingMessage('');
            setPrefetchedQuestion(null);
            setIsPrefetching(false);
          } catch (error) {
            Alert.alert('Error', 'Failed to reset dashboard');
          }
        },
      },
    ]);
  };

  const handleCardClick = (categoryName: string) => {
    const mapped = mappedCategories.find((c) => c.category === categoryName);
    if (mapped) {
      Alert.alert(categoryName, `Why you have this trait:\n\n"${mapped.justification}"`, [
        { text: 'OK' },
      ]);
    } else {
      Alert.alert(
        'Not Yet Mapped',
        'This trait is not yet mapped to you. Click the + button to discover new traits!',
        [{ text: 'OK' }]
      );
    }
  };

  const renderCategoryCards = () => {
    const mappedNames = new Map(mappedCategories.map((c) => [c.category, c]));

    return CATEGORY_TAXONOMY.map((item) => (
      <CategoryCard
        key={item.category}
        category={{
          ...item,
          example: '',
          icon: item.icon || 'category',
        }}
        isMapped={mappedNames.has(item.category)}
        mappedData={mappedNames.get(item.category)}
        onPress={() => handleCardClick(item.category)}
      />
    ));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading your journey...</Text>
      </View>
    );
  }

  const completionPercentage = getCompletionPercentage(mappedCategories.length);

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <MaterialIcons name="explore" size={40} color="#fff" />
          <Text style={styles.title}>My Skills Passport</Text>
          <Text style={styles.subtitle}>
            {mappedCategories.length}/{TOTAL_CATEGORIES} categories discovered
          </Text>
        </View>

        {/* Progress Card */}
        <Card style={styles.progressCard}>
          <Card.Content>
            <View style={styles.progressHeader}>
              <MaterialIcons name="trending-up" size={24} color="#667eea" />
              <Text style={styles.progressTitle}>Your Progress</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{mappedCategories.length}</Text>
                <Text style={styles.statLabel}>Mapped</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{TOTAL_CATEGORIES}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{completionPercentage}%</Text>
                <Text style={styles.statLabel}>Complete</Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${completionPercentage}%` }]} />
            </View>

            {/* Large Green Start/Continue Button */}
            {mappedCategories.length < TOTAL_CATEGORIES && (
              <TouchableOpacity
                style={styles.startButton}
                onPress={handleStartButtonPress}
                disabled={uiState !== 'idle'}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="play-arrow"
                  size={28}
                  color="white"
                  style={styles.startButtonIcon}
                />
                <Text style={styles.startButtonText}>
                  {mappedCategories.length === 0 ? 'Start' : 'Continue'}
                </Text>
              </TouchableOpacity>
            )}
          </Card.Content>
        </Card>

        {error ? (
          <Card style={styles.errorCard}>
            <Card.Content>
              <Text style={styles.errorText}>🚨 {error}</Text>
            </Card.Content>
          </Card>
        ) : null}

        {/* Category Grid */}
        <View style={styles.categoryGrid}>{renderCategoryCards()}</View>
      </ScrollView>

      {/* Loading Modal */}
      <LoadingModal visible={uiState === 'loading'} message={loadingMessage} />

      {/* Completion Modal */}
      <CompletionModal visible={uiState === 'complete'} onDismiss={() => setUiState('idle')} />

      {/* Weak Fit Modal */}
      <WeakFitModal
        visible={uiState === 'weak-fit'}
        justification={weakFitJustification}
        onTryAgain={handleWeakFitTryAgain}
        onNewQuestion={handleWeakFitNewQuestion}
      />

      {/* Answer Modal */}
      <AnswerModal
        visible={uiState === 'answering'}
        currentPrompt={currentPrompt}
        userAnswer={userAnswer}
        setUserAnswer={setUserAnswer}
        selectedImage={selectedImage}
        isAnswerFromVoice={isAnswerFromVoice}
        isAnalyzingImage={isAnalyzingImage}
        onDismiss={handleDismissAnswerModal}
        onZoomImage={() => setZoomViewerVisible(true)}
        onChangeImage={() => {
          setSelectedImage(null);
          showImageSourceDialog();
        }}
        onSubmitImage={handleSubmitImage}
        onAnswerChange={setUserAnswer}
        onRecordAgain={() => {
          setUiState('voice-recording');
          setUserAnswer('');
          setIsAnswerFromVoice(false);
        }}
        onSubmit={handleSubmitAnswer}
      />

      {/* Voice Recording Modal */}
      <VoiceRecordingModal
        visible={uiState === 'voice-recording'}
        currentPrompt={currentPrompt}
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        recordingUri={recordingUri}
        isProcessingAudio={isProcessingAudio}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onRecordAgain={() => {
          setRecordingUri(null);
          setRecordingDuration(0);
        }}
        onSubmit={handleVoiceSubmit}
        onCancel={async () => {
          if (isRecording && recordingRef.current) {
            try {
              await recordingRef.current.stopAndUnloadAsync();
              recordingRef.current = null;
            } catch (error) {
              console.error('Error stopping recording on dismiss:', error);
            }
          }
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setUiState('idle');
          setIsRecording(false);
          setRecordingUri(null);
          setRecordingDuration(0);
        }}
      />

      {/* Animated FAB Buttons - Hidden */}
      <View style={[styles.fabContainer, { display: 'none' }]}>
        <View style={styles.fabInner}>
          {/* Action Button 1 - Text Input (Left) */}
          <Animated.View style={[styles.actionButton, button1Style]} pointerEvents="auto">
            <FAB
              icon={() => (
                <View style={styles.iconContainer}>
                  <MaterialIcons name="chat-bubble" size={24} color="white" />
                </View>
              )}
              onPress={handleTextInputPress}
              style={[styles.fab, { backgroundColor: '#45B7D1' }]}
              size="small"
            />
          </Animated.View>

          {/* Action Button 2 - Voice Input (Diagonal) */}
          <Animated.View style={[styles.actionButton, button2Style]} pointerEvents="auto">
            <FAB
              icon={() => (
                <View style={styles.iconContainer}>
                  <MaterialIcons name="mic" size={24} color="white" />
                </View>
              )}
              onPress={handleVoiceInputPress}
              style={[styles.fab, { backgroundColor: '#4ECDC4' }]}
              size="small"
            />
          </Animated.View>

          {/* Action Button 3 - Image Input (Top) */}
          <Animated.View style={[styles.actionButton, button3Style]} pointerEvents="auto">
            <FAB
              icon={() => (
                <View style={styles.iconContainer}>
                  <MaterialIcons name="image" size={24} color="white" />
                </View>
              )}
              onPress={handleImageInputPress}
              style={[styles.fab, { backgroundColor: '#FF6B6B' }]}
              size="small"
            />
          </Animated.View>

          {/* Main FAB */}
          <Animated.View style={[styles.mainFabWrapper, { transform: [{ rotate: rotation }] }]}>
            <FAB
              icon={() => (
                <View style={styles.iconContainer}>
                  <MaterialIcons name="add" size={28} color="white" />
                </View>
              )}
              onPress={handleFabClick}
              disabled={uiState !== 'idle' || mappedCategories.length === TOTAL_CATEGORIES}
              style={[styles.mainFab, { backgroundColor: '#667eea' }]}
            />
          </Animated.View>
        </View>
      </View>

      {/* Image Editor Modal */}
      {showImageEditor && tempImageUri && (
        <ImageEditor
          imageUri={tempImageUri}
          onSave={handleImageEditorSave}
          onCancel={handleImageEditorCancel}
        />
      )}

      {/* Zoom Viewer Modal */}
      {zoomViewerVisible && selectedImage && (
        <ZoomableImageView
          imageUri={selectedImage}
          visible={zoomViewerVisible}
          onClose={() => setZoomViewerVisible(false)}
        />
      )}

      {/* Input Method Selection Modal */}
      <InputMethodModal
        visible={showInputMethodModal}
        onSelect={handleInputMethodSelect}
        onClose={() => setShowInputMethodModal(false)}
      />

      {/* Confetti Animation */}
      {showConfetti && (
        <ConfettiCannon
          count={200}
          origin={{ x: width / 2, y: 0 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={3000}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#667eea',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 5,
  },
  progressCard: {
    marginBottom: 20,
    elevation: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#667eea',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  progressBar: {
    height: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  startButtonIcon: {
    marginRight: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  errorCard: {
    marginBottom: 20,
    backgroundColor: '#ffebee',
    elevation: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabInner: {
    position: 'relative',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainFab: {
    position: 'absolute',
    margin: 0,
    elevation: 6,
  },
  mainFabWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    elevation: 6,
  },
  fabAdd: {
    backgroundColor: '#667eea',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
