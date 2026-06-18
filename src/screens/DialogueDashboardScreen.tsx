import React, { useRef, useState } from "react";
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Alert } from "react-native";
import { Text, Card, ActivityIndicator, Snackbar } from "react-native-paper";

import { MaterialIcons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigation";
import {
  CATEGORY_TAXONOMY,
  TOTAL_CATEGORIES,
  MappedCategory,
  ConversationInteraction,
} from "../services/categoryTaxonomyService";
import { GeminiService } from "../services/geminiService";
import { useImagePicker } from "../hooks/useImagePicker";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import ZoomableImageView from "../components/ZoomableImageView";
import ImageEditor from "../components/ImageEditor";
import { LoadingModal } from "../components/dialogue/LoadingModal";
import { CompletionModal } from "../components/dialogue/CompletionModal";
import { WeakFitModal } from "../components/dialogue/WeakFitModal";
import { QuestionInputModal } from "../components/dialogue/QuestionInputModal";
import { StampUnlockModal } from "../components/dialogue/StampUnlockModal";
import { AnswerModal } from "../components/dialogue/AnswerModal";
import { VoiceRecordingModal } from "../components/dialogue/VoiceRecordingModal";
import { CategoryCard } from "../components/dialogue/CategoryCard";
import { useDialogueState } from "../hooks/useDialogueState";
import { useAuth } from "../context/AuthContext";
import { dialogueResetTarget } from "../context/DialogueContext";
import { useLogout } from "../hooks/useLogout";
import { fetchProofStatus, uploadProofImage } from "../services/proofService";
import { upgradeStampTier } from "../services/categoryStorageService";
import { getOrStartSession } from "../services/sessionManager";
import { colors } from "../styles/global";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// FIXME: POC cross-hierarchy bridge — move to DialogueContext when refactoring
export const dialogueBridgeRef = {
  current: null as null | {
    handleStartButtonPress: () => void;
    handleForceNewQuestion: () => void;
    handleReset: () => void;
    handleNewTopic: (region?: string) => void;
    handleRegionAnswer: (question: string, answer: string, region?: string) => Promise<void> | void;
    interactions: ConversationInteraction[];
    mappedCategories: MappedCategory[];
    pdfContextText: string;
  },
};

const { width } = Dimensions.get("window");

export default function DialogueDashboardScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, "DialogueDashboard">>();
  const isFocused = useIsFocused();
  const { session } = useAuth();
  const {
    mappedCategories,
    interactions,
    pdfContextText,
    uiState,
    currentPrompt,
    userAnswer,
    loadingMessage,
    error,
    weakFitJustification,
    contentWarning,
    showConfetti,
    newStampUnlock,
    loading,
    prefetchedQuestion,
    pendingProofRequest,
    pendingProofNotification,
    setUserAnswer,
    setUiState,
    setCurrentPrompt,
    resetData,
    mapAnswerToCategory,
    handleStartButtonPress,
    handleForceNewQuestion,
    handleVoiceInputPress,
    prepareImageQuestion,
    handleSubmitAnswer,
    handleWeakFitTryAgain,
    handleWeakFitNewQuestion,
    handleNewTopic,
    dismissAnswerModal,
    clearPendingProofRequest,
    clearStampUnlock,
    continueAfterStampUnlock,
    clearProofNotification,
    activateProofFromNotification,
    clearDeferredState,
    setLoadingMessage,
    setError,
    loadData,
  } = useDialogueState();

  const [showQuestionInputModal, setShowQuestionInputModal] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const suppressModalReopenRef = useRef(false);
  const modalDismissedByBackdropRef = useRef(false);
  const modalIntentionallyOpenedRef = useRef(false);
  const isCombinedImageRef = useRef(false);
  const suppressSignUpPromptRef = useRef(false);

  const insets = useSafeAreaInsets();

  // Voice recording state
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingDuration, setRecordingDuration] = React.useState(0);
  const [recordingUri, setRecordingUri] = React.useState<string | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = React.useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Image state
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = React.useState(false);
  const [tempImageUri, setTempImageUri] = React.useState<string | null>(null);
  const [zoomViewerVisible, setZoomViewerVisible] = React.useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = React.useState(false);
  const [isAnswerFromVoice, setIsAnswerFromVoice] = React.useState(false);
  const [showProofImageEditor, setShowProofImageEditor] = React.useState(false);
  const [tempProofImageUri, setTempProofImageUri] = React.useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = React.useState(false);
  const [combinedImageUri, setCombinedImageUri] = React.useState<string | null>(null);
  const [proofSnackbarVisible, setProofSnackbarVisible] = React.useState(false);
  const continueAfterStampUnlockRef = useRef(continueAfterStampUnlock);
  continueAfterStampUnlockRef.current = continueAfterStampUnlock;

  const { pickImage } = useImagePicker();
  const { logout } = useLogout();

  React.useLayoutEffect(() => {
    navigation.getParent()?.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={session.mode === "authenticated" ? handleLogout : handleAccountPress}
            style={styles.headerActionButton}
          >
            <MaterialIcons
              name={session.mode === "authenticated" ? "logout" : "person"}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleReset}
            style={styles.headerActionButton}
            disabled={uiState !== "idle" && uiState !== "complete"}
          >
            <MaterialIcons
              name="refresh"
              size={24}
              color={uiState !== "idle" && uiState !== "complete" ? "#ccc" : "#fff"}
            />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, session.mode, uiState]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener("blur", () => {
      setShowProofImageEditor(false);
      setTempProofImageUri(null);
      setIsUploadingProof(false);
      clearPendingProofRequest();
      clearProofNotification();
    });

    return unsubscribe;
  }, [navigation, clearPendingProofRequest, clearProofNotification]);

  // Reload mapped data when auth session changes (e.g. guest→authenticated after login)
  React.useEffect(() => {
    loadData();
  }, [session.uid]);

  const handleAccountPress = () => {
    navigation.navigate("Login");
  };

  const handleLogout = () => {
    suppressSignUpPromptRef.current = true;
    Alert.alert(
      "Logoutt",
      "You will keep this account's saved progress, and the app will continue in guest mode.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            suppressSignUpPromptRef.current = false;
          },
        },
        {
          text: "Continue",
          onPress: () => void logout(() => navigation.replace("Welcome")),
        },
      ]
    );
  };

  const handleReset = () => {
    Alert.alert("Reset Dashboard", "Are you sure you want to reset? All progress will be lost.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => {
          resetData().catch(() => {
            Alert.alert("Error", "Failed to reset dashboard");
          });
        },
      },
    ]);
  };

  const handleSubmitTextFromModal = (text: string) => {
    if (!text.trim()) return;
    suppressModalReopenRef.current = true;
    setShowQuestionInputModal(false);
    const q = pendingQuestion || currentPrompt;
    setPendingQuestion(null);
    setCurrentPrompt("");
    suppressModalReopenRef.current = false;
    void mapAnswerToCategory(q, text);
  };

  const handleInputTypeSelect = async (method: "voice" | "image" | "refresh") => {
    suppressModalReopenRef.current = true;
    setShowQuestionInputModal(false);
    setPendingQuestion(null);
    await new Promise((resolve) => setTimeout(resolve, 150));
    suppressModalReopenRef.current = false;
    if (method === "voice") {
      handleVoiceInputPress();
    } else if (method === "image") {
      const ready = prepareImageQuestion();
      if (ready) showImageSourceDialog();
    } else if (method === "refresh") {
      handleWeakFitNewQuestion();
    }
  };

  // --- Combined image+text ---

  const handleAttachImage = () => {
    Alert.alert(
      "Choose Image Source",
      "Select an image to attach for your answer.",
      [
        { text: "Take Photo", onPress: () => handleCombinedImageSelection(true) },
        { text: "Choose from Gallery", onPress: () => handleCombinedImageSelection(false) },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const handleCombinedImageSelection = async (useCamera: boolean) => {
    const imageUri = await pickImage(useCamera);
    if (!imageUri) return;
    isCombinedImageRef.current = true;
    setTempImageUri(imageUri);
    setShowImageEditor(true);
  };

  const handleSubmitTextAndImage = async (text: string, imageUri: string) => {
    if (!text.trim() && !imageUri) return;
    suppressModalReopenRef.current = true;
    setShowQuestionInputModal(false);
    const q = pendingQuestion || currentPrompt;
    setPendingQuestion(null);
    setCurrentPrompt("");
    setCombinedImageUri(null);
    suppressModalReopenRef.current = false;

    setIsAnalyzingImage(true);
    setUiState("loading");
    setLoadingMessage("Analyzing your response...");

    try {
      const sizeCheck = await GeminiService.validateImageSize(imageUri);
      const skipCompression = sizeCheck.valid;
      const analysisResult = await GeminiService.analyzeActionImage(imageUri, q, skipCompression);
      const imageContext =
        analysisResult.success && analysisResult.rawResponse ? analysisResult.rawResponse : "";

      const mergedAnswer = text + (imageContext ? `\n\n[Image context: ${imageContext}]` : "");
      setIsAnalyzingImage(false);
      await mapAnswerToCategory(q, mergedAnswer);
    } catch (err) {
      console.error("Error processing combined submission:", err);
      setIsAnalyzingImage(false);
      setUiState("idle");
      Alert.alert("Error", "Failed to process your answer. Please try again.");
    }
  };

  // --- Voice recording ---

  const startRecording = async () => {
    try {
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please grant microphone permission to continue.");
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording", err);
      Alert.alert("Error", "Failed to start recording. Please check your microphone permissions.");
    }
  };

  const stopRecording = async () => {
    if (!recorder.isRecording) return;

    try {
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      const uri = recorder.uri;
      if (uri) setRecordingUri(uri);
    } catch (err) {
      console.error("Error stopping recording:", err);
      Alert.alert("Error", "Failed to stop recording");
    }
  };

  const handleVoiceSubmit = async () => {
    if (!recordingUri || !currentPrompt) {
      Alert.alert("Error", "No recording available");
      return;
    }

    setIsProcessingAudio(true);

    try {
      const transcriptionResult = await GeminiService.transcribeAudio(recordingUri);

      if (
        !transcriptionResult.success ||
        !transcriptionResult.transcript ||
        transcriptionResult.transcript.trim().length === 0
      ) {
        Alert.alert(
          "Transcription Error",
          transcriptionResult.error ||
            "Could not transcribe your audio. Please try recording again."
        );
        return;
      }

      const question = currentPrompt;
      const answer = transcriptionResult.transcript.trim();

      setRecordingUri(null);
      setRecordingDuration(0);
      setCurrentPrompt("");

      await mapAnswerToCategory(question, answer);
      setIsAnswerFromVoice(false);
    } catch (err) {
      console.error("Error processing voice answer:", err);
      let errorMessage = "Failed to process your voice response. Please try again.";

      if (err instanceof Error) {
        if (err.message.includes("Rate limit")) {
          errorMessage = "System busy at the moment. Please try again later.";
        } else if (err.message.includes("API key")) {
          errorMessage = "API key issue. Please check your configuration.";
        }
      }

      Alert.alert("Processing Error", errorMessage);
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const handleVoiceCancel = async () => {
    if (isRecording && recorder.isRecording) {
      try {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
      } catch (err) {
        console.error("Error stopping recording on cancel:", err);
      }
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setUiState("idle");
    setIsRecording(false);
    setRecordingUri(null);
    setRecordingDuration(0);
  };

  // --- Image handling ---

  const showImageSourceDialog = () => {
    Alert.alert(
      "Choose Image Source",
      "How would you like to add your image?",
      [
        { text: "Take Photo", onPress: () => handleImageSelection(true) },
        { text: "Choose from Gallery", onPress: () => handleImageSelection(false) },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const handleImageSelection = async (useCamera: boolean) => {
    const imageUri = await pickImage(useCamera);
    if (!imageUri) return;
    setTempImageUri(imageUri);
    setShowImageEditor(true);
  };

  const handleImageEditorSave = (editedImageUri: string) => {
    if (isCombinedImageRef.current) {
      setCombinedImageUri(editedImageUri);
      setShowImageEditor(false);
      setTempImageUri(null);
      isCombinedImageRef.current = false;
      return;
    }
    setSelectedImage(editedImageUri);
    setShowImageEditor(false);
    setTempImageUri(null);
    setUiState("answering");
  };

  const handleImageEditorCancel = () => {
    setShowImageEditor(false);
    setTempImageUri(null);
    if (isCombinedImageRef.current) {
      isCombinedImageRef.current = false;
      return;
    }
    const shouldReturnToAnswering = Boolean(currentPrompt || selectedImage);
    setUiState(shouldReturnToAnswering ? "answering" : "idle");
  };

  const handleSubmitImage = async () => {
    if (!selectedImage || !currentPrompt) {
      Alert.alert("Error", "Missing image or question");
      return;
    }

    // Check if compression can be skipped (image already small enough)
    const sizeCheck = await GeminiService.validateImageSize(selectedImage);
    const skipCompression = sizeCheck.valid;

    setIsAnalyzingImage(true);
    setUiState("loading");
    setLoadingMessage("Preparing image for analysis...");

    // Small delay so the loading message renders before compression kicks in
    await new Promise((r) => setTimeout(r, 100));

    try {
      const analysisResult = await GeminiService.analyzeActionImage(
        selectedImage,
        currentPrompt,
        skipCompression
      );

      if (!analysisResult.success || !analysisResult.rawResponse) {
        throw new Error(analysisResult.error || "Failed to analyze image");
      }

      const answer = analysisResult.rawResponse;
      setSelectedImage(null);

      await mapAnswerToCategory(currentPrompt, answer);
    } catch (err) {
      console.error("Error processing image:", err);
      Alert.alert(
        "Analysis Failed",
        "The image could not be analyzed. You can try again or choose a different image.",
        [
          { text: "Cancel", style: "cancel", onPress: () => setSelectedImage(null) },
          { text: "Try Again", onPress: () => handleSubmitImage() },
        ]
      );
      setUiState("answering");
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleProofImageSelection = async (useCamera: boolean) => {
    const imageUri = await pickImage(useCamera);
    if (!imageUri) {
      clearPendingProofRequest();
      return;
    }
    setTempProofImageUri(imageUri);
    setShowProofImageEditor(true);
  };

  const submitProofImage = async (imageUri: string) => {
    if (!session.uid || !pendingProofRequest) {
      Alert.alert("Error", "Missing proof context.");
      return;
    }

    setIsUploadingProof(true);

    try {
      const sessionId = await getOrStartSession();
      const uploadResult = await uploadProofImage({
        userId: session.uid,
        sessionId,
        interactionId: pendingProofRequest.interactionId,
        question: pendingProofRequest.question,
        answer: pendingProofRequest.answer,
        imageUri,
      });

      let latestStatus = await fetchProofStatus(uploadResult.jobId);
      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (latestStatus.status === "completed" || latestStatus.status === "failed") {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
        latestStatus = await fetchProofStatus(uploadResult.jobId);
      }

      const proofStatus = latestStatus.proofStatus ?? latestStatus.status ?? "pending";
      const feedback = latestStatus.userFeedbackMessage ?? "Proof uploaded and queued for review.";

      if (
        proofStatus === "approved" &&
        pendingProofRequest.stampName &&
        pendingProofRequest.category
      ) {
        const targetTier =
          pendingProofRequest.proofTier ??
          Math.min(Number.parseInt(latestStatus.proofTier ?? "2", 10) || 2, 4);
        await upgradeStampTier(
          pendingProofRequest.categoryId ?? pendingProofRequest.category,
          pendingProofRequest.stampName,
          targetTier
        );
      }

      Alert.alert(proofStatus === "approved" ? "Proof approved" : "Proof submitted", feedback);
    } catch (error) {
      console.error("Error uploading proof image:", error);
      Alert.alert("Error", "Failed to upload proof image. Please try again.");
    } finally {
      setIsUploadingProof(false);
      setShowProofImageEditor(false);
      setTempProofImageUri(null);
      clearPendingProofRequest();
    }
  };

  const handleProofImageEditorSave = (editedImageUri: string) => {
    setShowProofImageEditor(false);
    setTempProofImageUri(null);
    void submitProofImage(editedImageUri);
  };

  const handleProofImageEditorCancel = () => {
    setShowProofImageEditor(false);
    setTempProofImageUri(null);
    clearPendingProofRequest();
  };

  const handleContinueAfterStampUnlock = () => {
    modalIntentionallyOpenedRef.current = true;
    clearStampUnlock();
    continueAfterStampUnlockRef.current();
  };

  // --- UI helpers ---

  const handleCardClick = (categoryName: string) => {
    const mapped = mappedCategories.find((c) => c.category === categoryName);
    if (mapped) {
      Alert.alert(categoryName, `Why you have this trait:\n"${mapped.justification}"`, [
        { text: "OK" },
      ]);
    } else if (mappedCategories.length === 0) {
      Alert.alert(
        "Not Yet Mapped",
        "This trait is not yet mapped to you. Click the 'Start' button to discover new traits!",
        [{ text: "OK" }]
      );
    } else {
      Alert.alert(
        "Not Yet Mapped",
        "This trait is not yet mapped to you. Click the 'Continue' button to discover new traits!",
        [{ text: "OK" }]
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
          example: "",
          icon: (item.icon ?? "category") as keyof typeof MaterialIcons.glyphMap,
        }}
        isMapped={mappedNames.has(item.category)}
        mappedData={mappedNames.get(item.category)}
        onPress={() => handleCardClick(item.category)}
      />
    ));
  };

  const completionPercentage = Math.round((mappedCategories.length / TOTAL_CATEGORIES) * 100);

  React.useEffect(() => {
    dialogueResetTarget.current = handleReset;
    dialogueBridgeRef.current = {
      handleStartButtonPress: () => {
        modalIntentionallyOpenedRef.current = true;
        if (currentPrompt && !showQuestionInputModal && modalDismissedByBackdropRef.current) {
          modalDismissedByBackdropRef.current = false;
          setShowQuestionInputModal(true);
        } else {
          void handleStartButtonPress();
        }
      },
      handleForceNewQuestion: () => {
        modalIntentionallyOpenedRef.current = true;
        modalDismissedByBackdropRef.current = false;
        suppressModalReopenRef.current = false;
        void handleForceNewQuestion();
      },
      handleReset: handleReset,
      handleNewTopic: (region?: string) => {
        handleNewTopic(region);
      },
      handleRegionAnswer: async (question: string, answer: string, region?: string) => {
        await mapAnswerToCategory(question, answer, region);
        clearStampUnlock();
        clearDeferredState();
        clearPendingProofRequest();
      },
      interactions,
      mappedCategories,
      pdfContextText,
    };
    return () => {
      dialogueBridgeRef.current = null;
      dialogueResetTarget.current = null;
    };
  }, [
    handleStartButtonPress,
    handleForceNewQuestion,
    handleReset,
    handleNewTopic,
    mapAnswerToCategory,
    currentPrompt,
    showQuestionInputModal,
    interactions,
    mappedCategories,
    pdfContextText,
  ]);

  // ── Guest: force sign-in after first mapped category ──
  // Uses useIsFocused so it fires on both focus changes AND dep changes
  // (e.g. when loadData finishes and mappedCategories flips from 0 to 1).
  React.useEffect(() => {
    if (
      !isFocused ||
      session.mode !== "guest" ||
      mappedCategories.length < 1 ||
      suppressSignUpPromptRef.current
    ) {
      return;
    }
    const timer = setTimeout(() => {
      Alert.alert(
        "Great start!",
        "Sign in to save your progress and keep building your skills passport.",
        [
          {
            text: "Sign In",
            onPress: () => {
              setPendingQuestion(null);
              setShowQuestionInputModal(false);
              clearPendingProofRequest();
              navigation.navigate("Login");
            },
          },
          {
            text: "Create Account",
            onPress: () => {
              setPendingQuestion(null);
              setShowQuestionInputModal(false);
              clearPendingProofRequest();
              navigation.navigate("Register");
            },
          },
        ]
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [isFocused, session.mode, mappedCategories.length, navigation]);

  React.useEffect(() => {
    if (
      uiState === "idle" &&
      currentPrompt &&
      !showQuestionInputModal &&
      !suppressModalReopenRef.current &&
      !modalDismissedByBackdropRef.current &&
      modalIntentionallyOpenedRef.current &&
      !(session.mode === "guest" && mappedCategories.length >= 1)
    ) {
      setPendingQuestion(currentPrompt);
      setShowQuestionInputModal(true);
    }
    // `userAnswer` is no longer a dependency: the modal seeds its own input
    // from `seedText`, so this effect should not re-run on every keystroke.
  }, [uiState, currentPrompt, showQuestionInputModal]);

  React.useEffect(() => {
    if (
      prefetchedQuestion &&
      uiState === "idle" &&
      !pendingProofRequest &&
      modalIntentionallyOpenedRef.current &&
      !(session.mode === "guest" && mappedCategories.length >= 1)
    ) {
      setPendingQuestion(prefetchedQuestion);
      setShowQuestionInputModal(true);
    }
  }, [prefetchedQuestion, uiState, pendingProofRequest]);

  React.useEffect(() => {
    if (!pendingProofRequest) {
      return;
    }

    // Guest users can't upload artifacts — silently skip.
    if (session.mode === "guest") {
      clearPendingProofRequest();
      return;
    }

    const promptTitle =
      pendingProofRequest.artifactUploadReason ?? "Select the image you'd like to share.";

    Alert.alert("Share an image", promptTitle, [
      { text: "Take Photo", onPress: () => void handleProofImageSelection(true) },
      { text: "Choose from Gallery", onPress: () => void handleProofImageSelection(false) },
      {
        text: "Not now",
        style: "cancel",
        onPress: () => clearPendingProofRequest(),
      },
    ]);
  }, [pendingProofRequest]);

  React.useEffect(() => {
    if (!pendingProofNotification) {
      setProofSnackbarVisible(false);
      return;
    }
    if (session.mode === "guest") {
      clearProofNotification();
      return;
    }
    if (showQuestionInputModal) return;
    const timer = setTimeout(() => {
      setProofSnackbarVisible(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [pendingProofNotification, showQuestionInputModal, session.mode]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent.sky} />
        <Text style={styles.loadingText}>Loading your journey...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.floatingButtons} pointerEvents="box-none">
          <TouchableOpacity
            onPress={session.mode === "authenticated" ? handleLogout : handleAccountPress}
            style={styles.floatingButton}
          >
            <MaterialIcons
              name={session.mode === "authenticated" ? "logout" : "person"}
              size={24}
              color={colors.status.error}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleReset}
            style={styles.floatingButton}
            disabled={uiState !== "idle" && uiState !== "complete"}
          >
            <MaterialIcons name="refresh" size={24} color={colors.status.error} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <MaterialIcons name="explore" size={40} color={colors.accent.sky} />
          <Text style={styles.title}>My Dashboard</Text>
          <Text style={styles.subtitle}>
            {mappedCategories.length}/{TOTAL_CATEGORIES} categories discovered
          </Text>
        </View>

        <Card style={styles.progressCard}>
          <Card.Content>
            <View style={styles.progressHeader}>
              <MaterialIcons name="trending-up" size={24} color={colors.accent.sky} />
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

            {mappedCategories.length < TOTAL_CATEGORIES && (
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => {
                  if (currentPrompt && !showQuestionInputModal) {
                    modalIntentionallyOpenedRef.current = true;
                    setPendingQuestion(currentPrompt);
                    setShowQuestionInputModal(true);
                  } else {
                    modalIntentionallyOpenedRef.current = true;
                    handleStartButtonPress();
                  }
                }}
                disabled={
                  uiState !== "idle" || (session.mode === "guest" && mappedCategories.length >= 1)
                }
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="play-arrow"
                  size={28}
                  color="white"
                  style={styles.startButtonIcon}
                />
                <Text style={styles.startButtonText}>
                  {mappedCategories.length === 0 ? "Start" : "Continue"}
                </Text>
              </TouchableOpacity>
            )}
          </Card.Content>
        </Card>

        <View style={styles.categoryGrid}>{renderCategoryCards()}</View>
      </ScrollView>

      <Snackbar
        visible={!!error}
        onDismiss={() => setError("")}
        duration={3000}
        style={styles.snackbar}
      >
        {error}
      </Snackbar>

      <LoadingModal visible={isFocused && uiState === "loading"} message={loadingMessage} />

      <CompletionModal
        visible={isFocused && uiState === "complete"}
        onDismiss={() => setUiState("idle")}
      />

      <WeakFitModal
        visible={isFocused && uiState === "weak-fit"}
        justification={weakFitJustification}
        isContentWarning={contentWarning}
        onTryAgain={handleWeakFitTryAgain}
        onNewQuestion={handleWeakFitNewQuestion}
      />

      <AnswerModal
        visible={isFocused && uiState === "answering"}
        currentPrompt={currentPrompt}
        userAnswer={userAnswer}
        selectedImage={selectedImage}
        isAnswerFromVoice={isAnswerFromVoice}
        isAnalyzingImage={isAnalyzingImage}
        onDismiss={dismissAnswerModal}
        onZoomImage={() => setZoomViewerVisible(true)}
        onChangeImage={() => {
          showImageSourceDialog();
        }}
        onSubmitImage={handleSubmitImage}
        onAnswerChange={setUserAnswer}
        onRecordAgain={() => {
          setUiState("voice-recording");
          setUserAnswer("");
          setIsAnswerFromVoice(false);
        }}
        onSubmit={handleSubmitAnswer}
      />

      <VoiceRecordingModal
        visible={isFocused && uiState === "voice-recording"}
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
        onCancel={handleVoiceCancel}
      />

      <StampUnlockModal
        visible={isFocused && !!newStampUnlock}
        stampName={newStampUnlock?.stamp ?? ""}
        tier={newStampUnlock?.tier ?? 1}
        region={newStampUnlock?.category ?? ""}
        onContinue={handleContinueAfterStampUnlock}
        onViewStamp={() => {
          if (newStampUnlock) {
            setShowQuestionInputModal(false);
            clearDeferredState();
            navigation.navigate("StampDetails", {
              stamp: newStampUnlock.stamp,
              region: newStampUnlock.category,
              categoryId: newStampUnlock.categoryId,
            });
          }
        }}
      />

      <QuestionInputModal
        visible={isFocused && showQuestionInputModal && !!pendingQuestion}
        question={pendingQuestion || ""}
        seedText={userAnswer}
        onSelectInputType={handleInputTypeSelect}
        onSubmitText={handleSubmitTextFromModal}
        onSubmitTextAndImage={handleSubmitTextAndImage}
        attachedImageUri={combinedImageUri}
        onAttachImage={handleAttachImage}
        onRemoveAttachedImage={() => setCombinedImageUri(null)}
        onClose={() => {
          setShowQuestionInputModal(false);
          setPendingQuestion(null);
          setCurrentPrompt("");
          setCombinedImageUri(null);
        }}
        onBackdropDismiss={() => {
          modalDismissedByBackdropRef.current = true;
          setShowQuestionInputModal(false);
        }}
        onNewQuestion={() => {
          handleWeakFitNewQuestion();
        }}
        onNewTopic={() => {
          handleNewTopic();
        }}
      />

      {pendingProofNotification && (
        <View style={styles.proofSnackbarContainer}>
          <Snackbar
            visible={proofSnackbarVisible}
            onDismiss={() => {
              setProofSnackbarVisible(false);
              clearProofNotification();
            }}
            duration={6000}
            action={{
              label: "Share",
              onPress: () => {
                setProofSnackbarVisible(false);
                activateProofFromNotification();
              },
            }}
          >
            {pendingProofNotification.artifactUploadReason}
          </Snackbar>
        </View>
      )}

      {showImageEditor && tempImageUri && (
        <ImageEditor
          imageUri={tempImageUri}
          onSave={handleImageEditorSave}
          onCancel={handleImageEditorCancel}
        />
      )}

      {showProofImageEditor && tempProofImageUri && (
        <ImageEditor
          imageUri={tempProofImageUri}
          onSave={handleProofImageEditorSave}
          onCancel={handleProofImageEditorCancel}
        />
      )}

      {zoomViewerVisible && selectedImage && (
        <ZoomableImageView
          imageUri={selectedImage}
          visible={zoomViewerVisible}
          onClose={() => setZoomViewerVisible(false)}
        />
      )}

      {isUploadingProof && (
        <View style={styles.proofUploadOverlay} pointerEvents="none">
          <Text style={styles.proofUploadText}>Uploading proof...</Text>
        </View>
      )}

      {isFocused && showConfetti && (
        <ConfettiCannon
          count={200}
          origin={{ x: width / 2, y: 0 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={3000}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  proofUploadOverlay: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    alignItems: "center",
  },
  proofUploadText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  proofSnackbarContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    zIndex: 9999,
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  headerActionButton: {
    marginLeft: 12,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.tinted,
    paddingTop: 52,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.tinted,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: colors.text.accent,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 110,
    paddingTop: 80,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.text.primary,
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 5,
  },
  progressCard: {
    marginBottom: 20,
    elevation: 4,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  statBox: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.brand.primary,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
  },
  progressBar: {
    height: 10,
    backgroundColor: "#E0E0E0",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.brand.primary,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent.teal,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  startButtonIcon: {
    marginRight: 8,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  snackbar: {
    marginBottom: 80,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  floatingButtons: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    gap: 8,
    zIndex: 10,
  },
  floatingButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
