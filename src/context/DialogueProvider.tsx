import React, { createContext, useContext, useMemo, useRef, useState, useCallback } from "react";
import { Alert } from "react-native";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";

import { useDialogueState, DialogueMapResult } from "../hooks/useDialogueState";
import { useImagePicker } from "../hooks/useImagePicker";
import { useAuth } from "../context/AuthContext";
import { GeminiService } from "../services/geminiService";
import { fetchProofStatus, uploadProofImage } from "../services/proofService";
import { upgradeStampTier, syncFromFirestore } from "../services/categoryStorageService";
import { notifyDashboardRefresh } from "../services/dashboardRefreshService";
import { getOrStartSession } from "../services/sessionManager";
import {
  CATEGORY_TAXONOMY,
  ConversationInteraction,
  MappedCategory,
  getFilteredTaxonomyString,
} from "../services/categoryTaxonomyService";
import { containsInappropriateLanguage } from "../utils/contentModeration";

export const dialogueResetTarget = { current: null as null | (() => void) };

const VOICE_RECORDING_MAX_SECONDS = 120;
const MIN_VOICE_RECORDING_SECONDS = 2;

const frameImageEvidence = (description: string) =>
  `[Image evidence — attached image shows: ${description}]`;

type StampUpgradeInfo = {
  stamp: string;
  category: string;
  categoryId: string;
  previousTier: number;
  newTier: number;
};

// The single source of truth for "which of the 4 entry flows is active":
// home Start (A), navbar + (C) -> default; StampScreen "Explore region" (B) -> region;
// StampDetails "Add detail" (D) -> addDetail. Set ONLY by those 4 entry points.
// Every other interaction (skip, continue, submit, reopen-on-idle) only reads it.
type FlowContext =
  | { mode: "default" }
  | { mode: "region"; region: string }
  | { mode: "addDetail"; region: string; stamp: string };

interface DialogueContextValue {
  dismissAnswerModal: ReturnType<typeof useDialogueState>["dismissAnswerModal"];
  setIsAnswerFromVoice: React.Dispatch<React.SetStateAction<boolean>>;
  generateQuestionForRegion: (region: string) => Promise<void>;
  mappedCategories: MappedCategory[];
  interactions: ConversationInteraction[];
  pdfContextText: string;
  uiState: ReturnType<typeof useDialogueState>["uiState"];
  currentPrompt: string;
  userAnswer: string;
  loadingMessage: string;
  error: string;
  weakFitJustification: string;
  contentWarning: boolean;
  showConfetti: boolean;
  newStampUnlock: ReturnType<typeof useDialogueState>["newStampUnlock"];
  showCrisisSupport: boolean;
  showSensitiveIntro: boolean;
  loading: boolean;
  prefetchedQuestion: string | null;

  showQuestionInputModal: boolean;
  pendingQuestion: string | null;
  combinedImageUri: string | null;

  isRecording: boolean;
  recordingDuration: number;
  recordingUri: string | null;
  isProcessingAudio: boolean;

  selectedImage: string | null;
  showImageEditor: boolean;
  tempImageUri: string | null;
  isAnalyzingImage: boolean;
  isAnswerFromVoice: boolean;

  showProofImageEditor: boolean;
  tempProofImageUri: string | null;
  isUploadingProof: boolean;
  pendingProofRequest: ReturnType<typeof useDialogueState>["pendingProofRequest"];
  pendingProofNotification: ReturnType<typeof useDialogueState>["pendingProofNotification"];

  activeStampUpgrade: StampUpgradeInfo | null;
  addDetailReview: { justification: string } | null;

  setUserAnswer: (v: string) => void;
  setUiState: ReturnType<typeof useDialogueState>["setUiState"];
  setCurrentPrompt: (v: string) => void;
  setError: (v: string) => void;

  startNewQuestion: () => Promise<void>;
  forceNewQuestion: () => Promise<void>;
  reopenPendingQuestion: () => void;

  handleSubmitTextFromModal: (text: string) => void;
  handleSubmitTextAndImage: (text: string, imageUri: string) => Promise<void>;
  handleInputTypeSelect: (method: "voice" | "image" | "refresh") => Promise<void>;
  handleAttachImage: () => void;
  removeAttachedImage: () => void;
  closeQuestionInputModal: () => void;
  dismissQuestionInputModalToBackdrop: () => void;
  handleSkipQuestion: () => Promise<void>;
  handleNewTopic: () => Promise<void>;
  questionInputMode: "default" | "region" | "addDetail";
  startAddDetailQuestion: (stamp: string, region: string) => void;
  handleWeakFitTryAgain: ReturnType<typeof useDialogueState>["handleWeakFitTryAgain"];
  handleWeakFitNewQuestion: () => Promise<void>;

  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  handleVoiceSubmit: () => Promise<void>;
  handleVoiceCancel: () => Promise<void>;
  handleVoiceRecordAgain: () => void;

  showImageSourceDialog: () => void;
  handleImageEditorSave: (uri: string) => void;
  handleImageEditorCancel: () => void;
  handleSubmitImage: () => Promise<void>;

  showProofImageSourceDialog: () => void;
  handleProofImageEditorSave: (uri: string) => void;
  handleProofImageEditorCancel: () => void;

  handleContinueAfterStampUnlock: () => void;
  clearStampUnlock: ReturnType<typeof useDialogueState>["clearStampUnlock"];
  handleContinueAfterStampUpgrade: () => void;
  clearActiveStampUpgrade: () => void;
  finishAddDetail: () => void;

  dismissCrisisSupport: ReturnType<typeof useDialogueState>["dismissCrisisSupport"];
  dismissSensitiveIntro: ReturnType<typeof useDialogueState>["dismissSensitiveIntro"];

  activateProofFromNotification: ReturnType<
    typeof useDialogueState
  >["activateProofFromNotification"];
  clearProofNotification: ReturnType<typeof useDialogueState>["clearProofNotification"];

  resetDashboard: () => void;
  refreshData: () => Promise<void>;

  submitRegionAnswer: (
    question: string,
    answer: string,
    region?: string
  ) => Promise<DialogueMapResult>;
}

// Volatile render state on the context — everything that legitimately changes
// between renders. The complement (below) is the set of stable action handlers.
type DialogueStateKey =
  | "mappedCategories"
  | "interactions"
  | "pdfContextText"
  | "uiState"
  | "currentPrompt"
  | "userAnswer"
  | "loadingMessage"
  | "error"
  | "weakFitJustification"
  | "contentWarning"
  | "showConfetti"
  | "newStampUnlock"
  | "showCrisisSupport"
  | "showSensitiveIntro"
  | "loading"
  | "prefetchedQuestion"
  | "showQuestionInputModal"
  | "pendingQuestion"
  | "combinedImageUri"
  | "isRecording"
  | "recordingDuration"
  | "recordingUri"
  | "isProcessingAudio"
  | "selectedImage"
  | "showImageEditor"
  | "tempImageUri"
  | "isAnalyzingImage"
  | "isAnswerFromVoice"
  | "showProofImageEditor"
  | "tempProofImageUri"
  | "isUploadingProof"
  | "pendingProofRequest"
  | "pendingProofNotification"
  | "activeStampUpgrade"
  | "addDetailReview"
  | "questionInputMode";

// The function half of the context: stabilized once and never re-created.
type DialogueActions = Omit<DialogueContextValue, DialogueStateKey>;

const DialogueContext = createContext<DialogueContextValue | null>(null);

export function useDialogue() {
  const ctx = useContext(DialogueContext);
  if (!ctx) {
    throw new Error("useDialogue must be used within a DialogueProvider");
  }
  return ctx;
}

export function DialogueProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { session } = useAuth();
  const dialogueState = useDialogueState();
  const {
    uiState,
    currentPrompt,
    userAnswer,
    error,
    newStampUnlock,
    pendingProofRequest,
    pendingProofNotification,
    prefetchedQuestion,
    setUserAnswer,
    setUiState,
    setCurrentPrompt,
    resetData,
    mapAnswerToCategory,
    handleStartButtonPress,
    handleForceNewQuestion,
    handleVoiceInputPress,
    prepareImageQuestion,
    handleSkipQuestion: handleSkipQuestionBase,
    handleWeakFitNewQuestion: handleWeakFitNewQuestionBase,
    handleWeakFitTryAgain,
    handleNewTopic: handleNewTopicBase,
    clearPendingProofRequest,
    clearStampUnlock,
    continueAfterStampUnlock,
    clearProofNotification,
    activateProofFromNotification,
    clearDeferredState,
    setLoadingMessage,
    setError,
    loadData,
    triggerContentWarning,
    stampTierUpgrade,
    clearStampTierUpgrade,
    continueAfterStampTierUpgrade,
    clearAddDetailReview,
    dismissCrisisSupport,
    dismissSensitiveIntro,
    dismissAnswerModal,
  } = dialogueState;

  // The one source of truth for "which of the 4 entry flows is active."
  // Written ONLY by startNewQuestion / forceNewQuestion (A/C), generateQuestionForRegion (B),
  // and startAddDetailQuestion (D). Every other handler (skip, continue, reopen effects)
  // only reads it, so it can never be silently clobbered by an unrelated interaction.
  const [flowContext, setFlowContext] = useState<FlowContext>({ mode: "default" });
  const flowRegion = flowContext.mode !== "default" ? flowContext.region : undefined;

  const [showQuestionInputModal, setShowQuestionInputModal] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const suppressModalReopenRef = useRef(false);
  const modalDismissedByBackdropRef = useRef(false);
  const modalIntentionallyOpenedRef = useRef(false);
  const isCombinedImageRef = useRef(false);
  const autoProofImageRef = useRef<string | null>(null);
  // Always points at the latest action closures so the stable wrappers in
  // `actions` (below) can delegate without a dependency array.
  const actionsRef = useRef<DialogueActions>(null as unknown as DialogueActions);

  const askedQuestionsByRegionRef = useRef<Record<string, string[]>>({});
  const lastNewRegionRef = useRef<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const voiceSubmitCancelledRef = useRef(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [tempImageUri, setTempImageUri] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isAnswerFromVoice, setIsAnswerFromVoice] = useState(false);
  const [showProofImageEditor, setShowProofImageEditor] = useState(false);
  const [tempProofImageUri, setTempProofImageUri] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [combinedImageUri, setCombinedImageUri] = useState<string | null>(null);
  const [stampUpgrade, setStampUpgrade] = useState<StampUpgradeInfo | null>(null);

  const { pickImage } = useImagePicker();

  const continueAfterStampUnlockRef = useRef(continueAfterStampUnlock);
  continueAfterStampUnlockRef.current = continueAfterStampUnlock;

  const activeStampUpgrade = stampUpgrade ?? stampTierUpgrade;

  React.useEffect(() => {
    loadData();
  }, [session.uid]);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const prevStampUnlockRef = useRef(newStampUnlock);
  React.useEffect(() => {
    const wasUnlocked = prevStampUnlockRef.current !== null;
    prevStampUnlockRef.current = newStampUnlock;
    if (wasUnlocked && !newStampUnlock) {
      const timer = setTimeout(() => {
        void syncFromFirestore();
        notifyDashboardRefresh();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [newStampUnlock]);

  const clearAutoProof = () => {
    autoProofImageRef.current = null;
  };

  // --- Entry point A (home Start button) ---
  const startNewQuestion = useCallback(async () => {
    console.log("startNewQuestion");
    setFlowContext({ mode: "default" });
    modalIntentionallyOpenedRef.current = true;
    if (currentPrompt && !showQuestionInputModal && modalDismissedByBackdropRef.current) {
      modalDismissedByBackdropRef.current = false;
      console.log("Opening question modal");
      setShowQuestionInputModal(true);
    } else {
      await handleStartButtonPress();
    }
  }, [currentPrompt, showQuestionInputModal, handleStartButtonPress]);

  const reopenPendingQuestion = useCallback(() => {
    if (currentPrompt && !showQuestionInputModal) {
      modalIntentionallyOpenedRef.current = true;
      setPendingQuestion(currentPrompt);
      setShowQuestionInputModal(true);
    }
  }, [currentPrompt, showQuestionInputModal]);

  // --- Entry point C (navbar + button) ---
  const forceNewQuestion = useCallback(async () => {
    setFlowContext({ mode: "default" });
    modalIntentionallyOpenedRef.current = true;
    modalDismissedByBackdropRef.current = false;
    suppressModalReopenRef.current = false;
    if (currentPrompt && !showQuestionInputModal) {
      reopenPendingQuestion();
    } else {
      await handleForceNewQuestion();
    }
  }, [currentPrompt, showQuestionInputModal, reopenPendingQuestion, handleForceNewQuestion]);

  // Just presents a question in the modal — no longer owns any flow-context
  // decisions. Callers set flowContext themselves before calling this.
  const presentQuestion = useCallback(
    (question: string) => {
      modalIntentionallyOpenedRef.current = true;
      suppressModalReopenRef.current = false;
      modalDismissedByBackdropRef.current = false;
      setCurrentPrompt(question);
      setPendingQuestion(question);
      setUserAnswer("");
      setUiState("idle");
      setShowQuestionInputModal(true);
    },
    [setCurrentPrompt, setUiState]
  );

  // --- Entry point D (StampDetails "Add detail") ---
  const startAddDetailQuestion = useCallback(
    (stamp: string, region: string) => {
      setFlowContext({ mode: "addDetail", region, stamp });
      presentQuestion(`What detail would you like to add to your ${stamp} experience?`);
    },
    [presentQuestion]
  );

  // Synthesizes a holistic question for a specific region without touching
  // flowContext — shared by the StampScreen "Explore region" button and the
  // modal's "New Region" flow. Tracks asked questions per region so repeats are
  // avoided, and targets only stamps not already explored.
  const exploreRegion = useCallback(
    async (region: string) => {
      if (uiState !== "idle") return;
      setError("");
      setUiState("loading");
      setLoadingMessage("Exploring this region...");
      try {
        const filteredTaxonomy = getFilteredTaxonomyString(region);
        const exploredStamps = dialogueState.mappedCategories
          .filter((mc) => mc.category === region)
          .flatMap((mc) => (mc.unlockedStamps ?? []).map((s) => s.name));
        const question = await GeminiService.synthesizeNextQuestion(
          dialogueState.interactions,
          dialogueState.mappedCategories,
          filteredTaxonomy,
          {
            embeddingHistorySummary: dialogueState.pdfContextText || undefined,
            avoidQuestion:
              (askedQuestionsByRegionRef.current[region] ?? []).slice(-5).join("\n") || undefined,
            exploredStamps,
          },
          undefined,
          region
        );
        askedQuestionsByRegionRef.current[region] = [
          ...(askedQuestionsByRegionRef.current[region] ?? []).slice(-9),
          question,
        ];
        presentQuestion(question);
      } catch (err) {
        console.error("Failed to generate region question:", err);
        setUiState("idle");
        Alert.alert(
          "Couldn't generate a question",
          "Something went wrong while exploring this region. Please try again."
        );
      }
    },
    [
      dialogueState.mappedCategories,
      dialogueState.interactions,
      dialogueState.pdfContextText,
      presentQuestion,
      setUiState,
      setError,
      setLoadingMessage,
      uiState,
    ]
  );

  // --- Entry point B (StampScreen "Explore region") ---
  const generateQuestionForRegion = useCallback(
    async (region: string) => {
      setFlowContext({ mode: "region", region });
      await exploreRegion(region);
    },
    [exploreRegion]
  );

  // Same message the typed-answer path uses; keeps the modal open so the user can edit.
  const warnInappropriateLanguage = () => {
    Alert.alert(
      "Inappropriate Content",
      "Please keep your response respectful and appropriate so I can help you identify your skills."
    );
  };

  const handleSubmitTextFromModal = (text: string) => {
    if (!text.trim()) return;
    if (containsInappropriateLanguage(text)) {
      warnInappropriateLanguage();
      return;
    }
    clearAutoProof();
    suppressModalReopenRef.current = true;
    setShowQuestionInputModal(false);
    const q = pendingQuestion || currentPrompt;
    const region = flowRegion;
    const isAddDetail = flowContext.mode === "addDetail";
    setPendingQuestion(null);
    setCurrentPrompt("");
    setUserAnswer("");
    setIsAnswerFromVoice(false);
    suppressModalReopenRef.current = false;
    void mapAnswerToCategory(q, text, region, true, undefined, isAddDetail);
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
      void handleWeakFitNewQuestion();
    }
  };

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
    setCombinedImageUri(imageUri);
  };

  // Submit the typed text without the image (used when analysis failed). No proof
  // is armed — there is no analyzed image to attach.
  const submitCombinedTextOnly = async (q: string, text: string, region?: string) => {
    clearAutoProof();
    await mapAnswerToCategory(q, text, region, false, undefined, flowContext.mode === "addDetail");
  };

  // Return to the editor with the text and image intact so the user can retry or change.
  const reopenCombinedForEdit = (q: string, text: string, imageUri: string) => {
    autoProofImageRef.current = null;
    setUserAnswer(text);
    setCurrentPrompt(q);
    setPendingQuestion(q);
    setCombinedImageUri(imageUri);
    modalIntentionallyOpenedRef.current = true;
    setUiState("idle");
    setShowQuestionInputModal(true);
  };

  // Analyze the attached image and submit the merged answer. Split out so a failed
  // analysis can offer "Try Again" without re-running the modal teardown.
  const runCombinedAnalysis = async (
    q: string,
    text: string,
    imageUri: string,
    region?: string
  ) => {
    setIsAnalyzingImage(true);
    setUiState("loading");
    setLoadingMessage("Analyzing your response...");

    try {
      const sizeCheck = await GeminiService.validateImageSize(imageUri);
      const skipCompression = sizeCheck.valid;
      const analysisResult = await GeminiService.analyzeActionImage(imageUri, q, skipCompression);

      if (analysisResult.inappropriate) {
        setIsAnalyzingImage(false);
        triggerContentWarning();
        return;
      }

      if (!analysisResult.success) {
        setIsAnalyzingImage(false);
        Alert.alert(
          "Couldn't analyze your image",
          analysisResult.error ||
            "The image could not be analyzed. Submit your text without it, or try again.",
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => reopenCombinedForEdit(q, text, imageUri),
            },
            {
              text: "Submit text only",
              onPress: () => {
                if (text.trim()) {
                  void submitCombinedTextOnly(q, text, region);
                } else {
                  reopenCombinedForEdit(q, text, imageUri);
                }
              },
            },
            {
              text: "Try Again",
              onPress: () => void runCombinedAnalysis(q, text, imageUri, region),
            },
          ]
        );
        return;
      }

      const imageContext = analysisResult.rawResponse?.trim() ?? "";
      const mergedAnswer = imageContext
        ? text.trim()
          ? `${text.trim()}\n\n${frameImageEvidence(imageContext)}`
          : frameImageEvidence(imageContext)
        : text.trim();
      setIsAnalyzingImage(false);
      // A verified supporting image IS the evidence: it grants the stamp its tier
      // directly, so we neither arm it for a proof prompt nor ask for a separate one.
      const evidenceTier = analysisResult.supportsClaim ? analysisResult.evidenceTier : undefined;
      if (!evidenceTier) {
        // Not evidence-grade — arm it so a later proof prompt can offer it (user consents first).
        autoProofImageRef.current = imageUri;
      }
      await mapAnswerToCategory(
        q,
        mergedAnswer,
        region,
        false,
        evidenceTier,
        flowContext.mode === "addDetail"
      );
    } catch (err) {
      console.error("Error processing combined submission:", err);
      setIsAnalyzingImage(false);
      setUiState("idle");
      autoProofImageRef.current = null;
      Alert.alert("Error", "Failed to process your answer. Please try again.");
    }
  };

  const handleSubmitTextAndImage = async (text: string, imageUri: string) => {
    if (!text.trim() && !imageUri) return;
    if (text.trim() && containsInappropriateLanguage(text)) {
      warnInappropriateLanguage();
      return;
    }
    suppressModalReopenRef.current = true;
    setShowQuestionInputModal(false);
    const q = pendingQuestion || currentPrompt;
    setPendingQuestion(null);
    setCurrentPrompt("");
    setCombinedImageUri(null);
    suppressModalReopenRef.current = false;
    const region = flowRegion;

    await runCombinedAnalysis(q, text, imageUri, region);
  };

  const closeQuestionInputModal = () => {
    setShowQuestionInputModal(false);
    setPendingQuestion(null);
    setCurrentPrompt("");
    setCombinedImageUri(null);
  };

  const dismissQuestionInputModalToBackdrop = () => {
    modalDismissedByBackdropRef.current = true;
    setShowQuestionInputModal(false);
  };

  const removeAttachedImage = () => setCombinedImageUri(null);

  // Skip / weak-fit-refresh / new-topic all just READ flowContext — they never
  // decide it. This is what fixes "skip on the stamp screen brings the New
  // Topic button back": mode simply isn't touched by these anymore.
  const handleSkipQuestion = useCallback(() => {
    return handleSkipQuestionBase(flowRegion);
  }, [handleSkipQuestionBase, flowRegion]);

  const handleWeakFitNewQuestion = useCallback(() => {
    return handleWeakFitNewQuestionBase(flowRegion);
  }, [handleWeakFitNewQuestionBase, flowRegion]);

  // New Topic is only ever shown when flowContext.mode === "default" (see
  // DialogueModals). When every region is mapped it stays a plain default-flow
  // restart; otherwise it pivots into the next unmapped region, setting the
  // region flow context so the answer is mapped against that region too.
  const handleNewTopic = useCallback(() => {
    const unmappedRegions = CATEGORY_TAXONOMY.filter(
      (c) => !dialogueState.mappedCategories.some((mc) => mc.category === c.category)
    ).map((c) => c.category);
    if (unmappedRegions.length === 0) {
      setFlowContext({ mode: "default" });
      return handleNewTopicBase();
    }
    const next = unmappedRegions.find((r) => r !== lastNewRegionRef.current) ?? unmappedRegions[0];
    lastNewRegionRef.current = next;
    setFlowContext({ mode: "region", region: next });
    return exploreRegion(next);
  }, [dialogueState.mappedCategories, handleNewTopicBase, exploreRegion, setFlowContext]);

  const startRecording = async () => {
    try {
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please grant microphone permission to continue.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
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
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (uri) setRecordingUri(uri);
    } catch (err) {
      console.error("Error stopping recording:", err);
      Alert.alert("Error", "Failed to stop recording");
    }
  };

  // Auto-stop at the max recording duration so the timer can never overrun.
  React.useEffect(() => {
    if (isRecording && recordingDuration >= VOICE_RECORDING_MAX_SECONDS) {
      void stopRecording();
    }
  }, [isRecording, recordingDuration]);

  const handleVoiceSubmit = async () => {
    if (!recordingUri || !currentPrompt) {
      Alert.alert("Error", "No recording available");
      return;
    }
    if (recordingDuration < MIN_VOICE_RECORDING_SECONDS) {
      Alert.alert(
        "Recording too short",
        "Please record at least a couple of seconds of your answer."
      );
      return;
    }
    voiceSubmitCancelledRef.current = false;
    setIsProcessingAudio(true);
    try {
      const transcriptionResult = await GeminiService.transcribeAudio(recordingUri);
      if (voiceSubmitCancelledRef.current) return;
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
      const answer = transcriptionResult.transcript.trim();
      if (voiceSubmitCancelledRef.current) return;
      setRecordingUri(null);
      setRecordingDuration(0);
      setIsAnswerFromVoice(true);
      suppressModalReopenRef.current = true;
      setShowQuestionInputModal(false);
      const q = currentPrompt;
      const region = flowRegion;
      setPendingQuestion(null);
      setCurrentPrompt("");
      setUserAnswer("");
      suppressModalReopenRef.current = false;
      await mapAnswerToCategory(
        q,
        answer,
        region,
        true,
        undefined,
        flowContext.mode === "addDetail"
      );
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
      setIsAnswerFromVoice(false);
      setIsProcessingAudio(false);
    }
  };

  const handleVoiceCancel = async () => {
    voiceSubmitCancelledRef.current = true;
    if (isRecording && recorder.isRecording) {
      try {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
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
    if (currentPrompt) {
      setPendingQuestion(currentPrompt);
      setShowQuestionInputModal(true);
    }
  };

  // Return to the mic screen from the playback view so the user can start fresh.
  const handleVoiceRecordAgain = () => {
    setRecordingUri(null);
    setRecordingDuration(0);
  };

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
    const sizeCheck = await GeminiService.validateImageSize(selectedImage);
    const skipCompression = sizeCheck.valid;

    setIsAnalyzingImage(true);
    setUiState("loading");
    setLoadingMessage("Preparing image for analysis...");
    await new Promise((r) => setTimeout(r, 100));

    try {
      const analysisResult = await GeminiService.analyzeActionImage(
        selectedImage,
        currentPrompt,
        skipCompression
      );
      if (!analysisResult.success) {
        throw new Error(analysisResult.error || "Failed to analyze image");
      }
      if (analysisResult.inappropriate) {
        setSelectedImage(null);
        triggerContentWarning();
        return;
      }
      if (!analysisResult.rawResponse) {
        throw new Error("Failed to analyze image");
      }
      const answer = frameImageEvidence(analysisResult.rawResponse);
      setSelectedImage(null);
      clearAutoProof();
      // A verified image is the evidence itself — grant the stamp its tier directly.
      const evidenceTier = analysisResult.supportsClaim ? analysisResult.evidenceTier : undefined;
      await mapAnswerToCategory(
        currentPrompt,
        answer,
        flowRegion,
        false,
        evidenceTier,
        flowContext.mode === "addDetail"
      );
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

  const showProofImageSourceDialog = () => {
    Alert.alert(
      "Share an image",
      pendingProofRequest?.artifactUploadReason ?? "Select the image you'd like to share.",
      [
        { text: "Take Photo", onPress: () => void handleProofImageSelection(true) },
        { text: "Choose from Gallery", onPress: () => void handleProofImageSelection(false) },
        { text: "Not now", style: "cancel", onPress: () => clearPendingProofRequest() },
      ]
    );
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
        if (latestStatus.status === "completed" || latestStatus.status === "failed") break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        latestStatus = await fetchProofStatus(uploadResult.jobId);
      }

      const proofStatus = latestStatus.proofStatus ?? latestStatus.status ?? "pending";
      const feedback = latestStatus.userFeedbackMessage ?? "Proof uploaded and queued for review.";

      let upgradeResult: { previousTier: number; newTier: number } | null = null;
      if (
        proofStatus === "approved" &&
        pendingProofRequest.stampName &&
        pendingProofRequest.category
      ) {
        const targetTier =
          pendingProofRequest.proofTier ??
          Math.min(Number.parseInt(latestStatus.proofTier ?? "2", 10) || 2, 4);
        upgradeResult = await upgradeStampTier(
          pendingProofRequest.categoryId ?? pendingProofRequest.category,
          pendingProofRequest.stampName,
          targetTier
        );
      }

      if (upgradeResult && pendingProofRequest.stampName && pendingProofRequest.category) {
        setStampUpgrade({
          stamp: pendingProofRequest.stampName,
          category: pendingProofRequest.category,
          categoryId: pendingProofRequest.categoryId ?? pendingProofRequest.category,
          previousTier: upgradeResult.previousTier,
          newTier: upgradeResult.newTier,
        });
      } else {
        Alert.alert(proofStatus === "approved" ? "Proof approved" : "Proof submitted", feedback);
      }
    } catch (err) {
      console.error("Error uploading proof image:", err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Failed to upload proof image. Please try again.";
      Alert.alert("Proof upload failed", message);
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

  React.useEffect(() => {
    if (!pendingProofRequest) return;
    const attached = autoProofImageRef.current;
    if (attached) {
      Alert.alert(
        "Add a photo to this stamp?",
        pendingProofRequest.artifactUploadReason ??
          "Use the photo you just shared as proof, or choose another.",
        [
          {
            text: "Use this photo",
            onPress: () => {
              autoProofImageRef.current = null;
              void submitProofImage(attached);
            },
          },
          { text: "Choose another", onPress: () => showProofImageSourceDialog() },
          {
            text: "Not now",
            style: "cancel",
            onPress: () => {
              autoProofImageRef.current = null;
              clearPendingProofRequest();
            },
          },
        ]
      );
      return;
    }
    showProofImageSourceDialog();
  }, [pendingProofRequest]);

  const handleContinueAfterStampUnlock = () => {
    if (flowContext.mode === "addDetail") {
      finishAddDetail();
      return;
    }
    modalIntentionallyOpenedRef.current = true;
    clearStampUnlock();
    continueAfterStampUnlockRef.current();
  };

  const handleContinueAfterStampUpgrade = () => {
    if (flowContext.mode === "addDetail") {
      finishAddDetail();
      return;
    }
    continueAfterStampTierUpgrade();
  };

  const clearActiveStampUpgrade = () => {
    setStampUpgrade(null);
    clearStampTierUpgrade();
  };

  // Ends an addDetail turn: closes the dialogue and returns the user to the
  // stamp detail screen. No new question is generated or shown.
  const finishAddDetail = useCallback(() => {
    setStampUpgrade(null);
    clearStampTierUpgrade();
    clearStampUnlock();
    clearAddDetailReview();
    clearDeferredState();
    setCombinedImageUri(null);
    setShowQuestionInputModal(false);
    setPendingQuestion(null);
    setCurrentPrompt("");
    setUserAnswer("");
    modalIntentionallyOpenedRef.current = false;
    suppressModalReopenRef.current = false;
    modalDismissedByBackdropRef.current = false;
    setFlowContext({ mode: "default" });
  }, [
    clearStampTierUpgrade,
    clearStampUnlock,
    clearAddDetailReview,
    clearDeferredState,
    setCombinedImageUri,
    setShowQuestionInputModal,
    setPendingQuestion,
    setCurrentPrompt,
    setUserAnswer,
    setStampUpgrade,
  ]);

  const submitRegionAnswer = useCallback(
    async (question: string, answer: string, region?: string) => {
      clearAutoProof();
      const result = await mapAnswerToCategory(question, answer, region, true);
      clearDeferredState();
      return result;
    },
    [mapAnswerToCategory, clearDeferredState]
  );

  const resetDashboard = useCallback(() => {
    Alert.alert("Reset Dashboard", "Are you sure you want to reset? All progress will be lost.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => {
          setFlowContext({ mode: "default" });
          resetData().catch(() => {
            Alert.alert("Error", "Failed to reset dashboard");
          });
        },
      },
    ]);
  }, [resetData]);

  React.useEffect(() => {
    dialogueResetTarget.current = resetDashboard;
    return () => {
      dialogueResetTarget.current = null;
    };
  }, [resetDashboard]);

  // Reopen-on-idle: presents whatever currentPrompt already exists. Note this
  // no longer touches flowContext at all — it only decides visibility.
  React.useEffect(() => {
    if (
      uiState === "idle" &&
      currentPrompt &&
      !showQuestionInputModal &&
      !suppressModalReopenRef.current &&
      !modalDismissedByBackdropRef.current &&
      modalIntentionallyOpenedRef.current
    ) {
      setPendingQuestion(currentPrompt);
      setShowQuestionInputModal(true);
    }
  }, [uiState, currentPrompt, showQuestionInputModal]);

  // Reopen for a freshly-prefetched question (skip / continue-after-unlock /
  // continue-after-upgrade all land here). This is the effect that used to
  // hardcode setQuestionInputMode("default") on every fire — that line is
  // gone, so whatever flowContext was already set to (region/addDetail/default)
  // survives untouched.
  React.useEffect(() => {
    if (
      prefetchedQuestion &&
      uiState === "idle" &&
      !pendingProofRequest &&
      !activeStampUpgrade &&
      modalIntentionallyOpenedRef.current
    ) {
      setCurrentPrompt(prefetchedQuestion);
      setPendingQuestion(prefetchedQuestion);
      setUserAnswer("");
      setShowQuestionInputModal(true);
    }
  }, [prefetchedQuestion, uiState, pendingProofRequest, activeStampUpgrade]);

  // Refresh the latest closures every render; the wrappers in `actions` read
  // through this ref, so they never go stale despite having empty deps.
  actionsRef.current = {
    dismissAnswerModal,
    setIsAnswerFromVoice,
    generateQuestionForRegion,
    setUserAnswer,
    setUiState,
    setCurrentPrompt,
    setError,
    startNewQuestion,
    forceNewQuestion,
    reopenPendingQuestion,
    handleSubmitTextFromModal,
    handleSubmitTextAndImage,
    handleInputTypeSelect,
    handleAttachImage,
    removeAttachedImage,
    closeQuestionInputModal,
    dismissQuestionInputModalToBackdrop,
    handleSkipQuestion,
    handleNewTopic,
    handleWeakFitTryAgain,
    handleWeakFitNewQuestion,
    startAddDetailQuestion,
    startRecording,
    stopRecording,
    handleVoiceSubmit,
    handleVoiceCancel,
    handleVoiceRecordAgain,
    showImageSourceDialog,
    handleImageEditorSave,
    handleImageEditorCancel,
    handleSubmitImage,
    showProofImageSourceDialog,
    handleProofImageEditorSave,
    handleProofImageEditorCancel,
    handleContinueAfterStampUnlock,
    clearStampUnlock,
    handleContinueAfterStampUpgrade,
    clearActiveStampUpgrade,
    finishAddDetail,
    dismissCrisisSupport,
    dismissSensitiveIntro,
    activateProofFromNotification,
    clearProofNotification,
    resetDashboard,
    refreshData,
    submitRegionAnswer,
  };

  // Built once. Each action is a stable wrapper that forwards to the latest
  // closure via actionsRef, so `value` below never changes just because a
  // handler was re-created.
  const actions = useMemo<DialogueActions>(() => {
    const bag = {} as Record<string, (...args: unknown[]) => unknown>;
    for (const key of Object.keys(actionsRef.current) as (keyof DialogueActions)[]) {
      bag[key as string] = (...args: unknown[]) =>
        (actionsRef.current[key] as (...a: unknown[]) => unknown)(...args);
    }
    return bag as unknown as DialogueActions;
  }, []);

  // Now that actions are stable, `value` changes only when actual render state
  // does — no longer on every provider render.
  const value = useMemo<DialogueContextValue>(
    () => ({
      mappedCategories: dialogueState.mappedCategories,
      interactions: dialogueState.interactions,
      pdfContextText: dialogueState.pdfContextText,
      uiState,
      currentPrompt,
      userAnswer,
      loadingMessage: dialogueState.loadingMessage,
      error,
      weakFitJustification: dialogueState.weakFitJustification,
      contentWarning: dialogueState.contentWarning,
      showConfetti: dialogueState.showConfetti,
      newStampUnlock,
      showCrisisSupport: dialogueState.showCrisisSupport,
      showSensitiveIntro: dialogueState.showSensitiveIntro,
      loading: dialogueState.loading,
      prefetchedQuestion,
      showQuestionInputModal,
      pendingQuestion,
      combinedImageUri,
      isRecording,
      recordingDuration,
      recordingUri,
      isProcessingAudio,
      selectedImage,
      showImageEditor,
      tempImageUri,
      isAnalyzingImage,
      isAnswerFromVoice,
      showProofImageEditor,
      tempProofImageUri,
      isUploadingProof,
      pendingProofRequest,
      pendingProofNotification,
      activeStampUpgrade,
      addDetailReview: dialogueState.addDetailReview,
      questionInputMode: flowContext.mode,
      ...actions,
    }),
    [
      dialogueState.mappedCategories,
      dialogueState.interactions,
      dialogueState.pdfContextText,
      uiState,
      currentPrompt,
      userAnswer,
      dialogueState.loadingMessage,
      error,
      dialogueState.weakFitJustification,
      dialogueState.contentWarning,
      dialogueState.showConfetti,
      newStampUnlock,
      dialogueState.showCrisisSupport,
      dialogueState.showSensitiveIntro,
      dialogueState.loading,
      prefetchedQuestion,
      showQuestionInputModal,
      pendingQuestion,
      combinedImageUri,
      isRecording,
      recordingDuration,
      recordingUri,
      isProcessingAudio,
      selectedImage,
      showImageEditor,
      tempImageUri,
      isAnalyzingImage,
      isAnswerFromVoice,
      showProofImageEditor,
      tempProofImageUri,
      isUploadingProof,
      pendingProofRequest,
      pendingProofNotification,
      activeStampUpgrade,
      dialogueState.addDetailReview,
      flowContext.mode,
      actions,
    ]
  );

  return <DialogueContext.Provider value={value}>{children}</DialogueContext.Provider>;
}
