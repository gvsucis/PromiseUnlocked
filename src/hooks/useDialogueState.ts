import { useState, useEffect, useRef, useCallback } from "react";
import { waitForAuthReady } from "../services/auth/authSessionService";
import { Alert } from "react-native";
import {
  MappedCategory,
  ConversationInteraction,
  TOTAL_CATEGORIES,
  INITIAL_PROMPT,
  NO_OP_CATEGORY,
  getTaxonomyString,
  findValidCategory,
} from "../services/categoryTaxonomyService";
import {
  getMappedCategories,
  saveMappedCategory,
  getConversationHistory,
  saveConversationInteraction,
  syncFromFirestore,
  clearAllData,
  isCategoryMapped,
  getMappedCategory,
  updateMappedCategoryCounter,
  addStampUnlock,
} from "../services/categoryStorageService";
import { GeminiService } from "../services/geminiService";
import { STAMPS_LIST } from "../config/stampConstants";
import { searchPdfContext } from "../services/profileEmbeddingService";
import { endSession } from "../services/sessionManager";
import { RegExpMatcher, englishDataset } from "obscenity";
import {
  saveDialogueState,
  loadDialogueState,
  clearDialogueState,
} from "../services/dialogueStateStorage";

export type UIState =
  | "idle"
  | "answering"
  | "loading"
  | "complete"
  | "weak-fit"
  | "voice-recording";

export interface DialogueState {
  // State
  mappedCategories: MappedCategory[];
  interactions: ConversationInteraction[];
  uiState: UIState;
  currentPrompt: string;
  userAnswer: string;
  loadingMessage: string;
  error: string;
  prefetchedQuestion: string | null;
  isPrefetching: boolean;
  loading: boolean;
  weakFitJustification: string;
  contentWarning: boolean;
  savedQuestion: string;
  savedAnswer: string;
  showConfetti: boolean;
  pendingProofRequest: {
    question: string;
    answer: string;
    interactionId: string;
    category: string;
    stampName?: string;
    artifactUploadReason?: string;
  } | null;

  // Setters needed by screen for controlled inputs and UI transitions
  setUserAnswer: React.Dispatch<React.SetStateAction<string>>;
  setUiState: React.Dispatch<React.SetStateAction<UIState>>;
  setCurrentPrompt: React.Dispatch<React.SetStateAction<string>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setLoadingMessage: React.Dispatch<React.SetStateAction<string>>;

  // Business logic
  loadData: () => Promise<void>;
  resetData: () => Promise<void>;
  mapAnswerToCategory: (question: string, answer: string) => Promise<DialogueMapResult>;
  handleStartButtonPress: () => Promise<void>;
  handleTextInputPress: () => void;
  handleVoiceInputPress: () => void;
  prepareImageQuestion: () => boolean;
  handleSubmitAnswer: () => void;
  handleWeakFitTryAgain: () => void;
  handleWeakFitNewQuestion: () => Promise<void>;
  dismissAnswerModal: () => void;
  clearPendingProofRequest: () => void;
}

export type DialogueMapResult =
  | { mapped: true; category: string; interactionId: string }
  | { mapped: false; category: string | null; interactionId: string };

export function useDialogueState(): DialogueState {
  const [mappedCategories, setMappedCategories] = useState<MappedCategory[]>([]);
  const [interactions, setInteractions] = useState<ConversationInteraction[]>([]);
  const [uiState, setUiState] = useState<UIState>("idle");
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");
  const [prefetchedQuestion, setPrefetchedQuestion] = useState<string | null>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weakFitJustification, setWeakFitJustification] = useState("");
  const [contentWarning, setContentWarning] = useState(false);
  const [savedQuestion, setSavedQuestion] = useState("");
  const [savedAnswer, setSavedAnswer] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [pendingProofRequest, setPendingProofRequest] =
    useState<DialogueState["pendingProofRequest"]>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelPendingOperation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistState = useCallback(
    async (prompt: string, savedQ: string, answer: string, savedA: string, state: UIState) => {
      if (state === "complete") {
        await clearDialogueState();
        return;
      }
      if (state === "idle" && !prompt) {
        await clearDialogueState();
        return;
      }
      await saveDialogueState({
        currentPrompt: prompt,
        savedQuestion: savedQ,
        userAnswer: answer,
        savedAnswer: savedA,
        uiState: state,
      });
    },
    []
  );

  useEffect(() => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      void persistState(currentPrompt, savedQuestion, userAnswer, savedAnswer, uiState);
    }, 500);
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [currentPrompt, savedQuestion, userAnswer, savedAnswer, uiState]);

  useEffect(() => {
    loadData();
  }, []);

  const getFriendlyDialogueErrorMessage = (error: unknown): string => {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : undefined;
    const message = error instanceof Error ? error.message : "";

    if (
      code === "app/anonymous-auth-disabled" ||
      code === "app/firestore-auth-unavailable" ||
      message.includes("auth/admin-restricted-operation") ||
      message.includes("No Firebase auth user is available for Firestore writes")
    ) {
      return "Your response was saved on this device. Cloud sync is temporarily unavailable.";
    }

    if (
      message.includes("System busy at the moment") ||
      message.includes("Failed to generate next question")
    ) {
      return "System busy. Please try again.";
    }

    return "Failed to process your answer. Please try again.";
  };

  useEffect(() => {
    if (mappedCategories.length === TOTAL_CATEGORIES) {
      void endSession("completed");
      setUiState("complete");
      setPrefetchedQuestion(null);
      setIsPrefetching(false);
    }
  }, [mappedCategories.length]);

  const loadData = async () => {
    try {
      // Resolve auth once so the three storage reads below don't each
      // independently trip through waitForAuthReady() → AsyncStorage.
      await waitForAuthReady();
      await syncFromFirestore();
      const [mapped, history, persisted] = await Promise.all([
        getMappedCategories(),
        getConversationHistory(),
        loadDialogueState(),
      ]);
      setMappedCategories(mapped);
      setInteractions(history);

      if (persisted && mapped.length < TOTAL_CATEGORIES) {
        setCurrentPrompt(persisted.currentPrompt);
        setSavedQuestion(persisted.savedQuestion);
        setUserAnswer(persisted.userAnswer);
        setSavedAnswer(persisted.savedAnswer);

        if (
          persisted.uiState === "answering" ||
          persisted.uiState === "loading" ||
          persisted.uiState === "voice-recording"
        ) {
          setUiState("idle");
        }
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load your progress. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetData = async () => {
    cancelPendingOperation();
    await Promise.all([clearAllData(), clearDialogueState()]);
    setMappedCategories([]);
    setInteractions([]);
    setCurrentPrompt("");
    setUserAnswer("");
    setSavedQuestion("");
    setSavedAnswer("");
    setPrefetchedQuestion(null);
    setIsPrefetching(false);
    setWeakFitJustification("");
    setError("");
    setShowConfetti(false);
    setUiState("idle");
  };

  const mapAnswerToCategory = async (
    question: string,
    answer: string
  ): Promise<DialogueMapResult> => {
    setUiState("loading");
    setLoadingMessage("Analyzing your response...");
    setError("");
    setSavedQuestion(question);
    setSavedAnswer(answer);
    setPrefetchedQuestion(null);
    setIsPrefetching(false);

    cancelPendingOperation();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const advanceToNextQuestion = async (presetQuestion?: string | null) => {
      setUserAnswer("");
      setLoadingMessage("Generating next question...");
      try {
        const newQuestion =
          presetQuestion ||
          (await GeminiService.synthesizeNextQuestion(
            interactions,
            mappedCategories,
            getTaxonomyString(),
            { latestQuestion: question, latestAnswer: answer },
            controller.signal
          ));

        setPrefetchedQuestion(newQuestion);
        setIsPrefetching(false);
        setLoadingMessage("");

        await new Promise((resolve) => setTimeout(resolve, 100));
        setUiState("idle");
      } catch (err) {
        console.error("Error generating next question:", err);
        setError(getFriendlyDialogueErrorMessage(err));
        setUiState("idle");
      }
    };

    try {
      const taxonomyString = getTaxonomyString();

      let pdfContextText = "";
      try {
        pdfContextText = await searchPdfContext(`${question} ${answer}`);
      } catch {
        pdfContextText = "";
      }

      const result = await GeminiService.mapAnswerAndGenerateNextQuestion(
        question,
        answer,
        interactions,
        mappedCategories,
        taxonomyString,
        pdfContextText,
        controller.signal
      );

      const { category: rawCategory, justification, nextQuestion, specificStamp } = result;
      const validCategory = findValidCategory(rawCategory);
      const categoryNameToCheck = validCategory ? validCategory.category : rawCategory;

      if (categoryNameToCheck === NO_OP_CATEGORY) {
        const isInappropriate = justification?.startsWith("INAPPROPRIATE_CONTENT:");
        if (isInappropriate) {
          setWeakFitJustification(
            justification?.replace("INAPPROPRIATE_CONTENT:", "").trim() ?? ""
          );
          setContentWarning(true);
          setUiState("weak-fit");
          return { mapped: false as const, category: null, interactionId: "" };
        }

        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: "NO-OP (WEAK FIT)",
          timestamp: new Date().toISOString(),
          mappingOutcome: "weak_fit",
          matchedToCategory: null,
          matchedToSequenceIndex: null,
        };
        const interactionId = await saveConversationInteraction(interaction);
        setInteractions((prev) => [...prev, interaction]);
        setWeakFitJustification(justification ?? "");
        setUiState("weak-fit");
        return { mapped: false as const, category: null, interactionId };
      } else if (validCategory && !(await isCategoryMapped(categoryNameToCheck))) {
        const newMappedCategory: MappedCategory = {
          category: categoryNameToCheck,
          justification: justification ?? "",
          dateIdentified: new Date().toISOString(),
          timesMapped: 1,
        };

        await saveMappedCategory(newMappedCategory);
        const newMappedCategories = [...mappedCategories, newMappedCategory];
        setMappedCategories(newMappedCategories);

        if (__DEV__)
          console.log(
            `NEW ${categoryNameToCheck} category added: counter = ${newMappedCategory.timesMapped}`
          );

        if (specificStamp) {
          if (specificStamp in STAMPS_LIST) {
            await addStampUnlock(categoryNameToCheck, specificStamp, 2);
          } else if (__DEV__) {
            console.warn(
              `Invalid stamp name "${specificStamp}" for category "${categoryNameToCheck}" — not in STAMPS_LIST, skipping unlock`
            );
          }
        }

        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: categoryNameToCheck,
          timestamp: new Date().toISOString(),
          mappingOutcome: "mapped",
          matchedToCategory: null,
          matchedToSequenceIndex: null,
        };
        const interactionId = await saveConversationInteraction(interaction, justification ?? "");
        setInteractions((prev) => [...prev, interaction]);

        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);

        if (newMappedCategories.length === TOTAL_CATEGORIES) {
          await endSession("completed");
          setUserAnswer("");
          setUiState("complete");
          return { mapped: true as const, category: categoryNameToCheck, interactionId };
        }

        if (result.suggestArtifactUpload) {
          setPendingProofRequest({
            question,
            answer,
            interactionId,
            category: categoryNameToCheck,
            stampName: specificStamp ?? undefined,
            artifactUploadReason: result.artifactUploadReason,
          });
        }
        await advanceToNextQuestion(nextQuestion);

        return { mapped: true as const, category: categoryNameToCheck, interactionId };
      } else if (await isCategoryMapped(categoryNameToCheck)) {
        if (__DEV__)
          console.log(`Category "${categoryNameToCheck}" already mapped, generating new question`);
        const mappedCategory = await getMappedCategory(categoryNameToCheck);
        const updatedMappedCategory = await updateMappedCategoryCounter({
          ...mappedCategory,
          justification: justification || mappedCategory.justification,
        });

        if (specificStamp) {
          if (specificStamp in STAMPS_LIST) {
            await addStampUnlock(categoryNameToCheck, specificStamp, 2);
          } else if (__DEV__) {
            console.warn(
              `Invalid stamp name "${specificStamp}" for category "${categoryNameToCheck}" — not in STAMPS_LIST, skipping unlock`
            );
          }
        }

        // ensures no duplicate categories are added to array of mapped categories
        const dedupedMappedCategories = mappedCategories.map((c) =>
          c.category === updatedMappedCategory.category ? updatedMappedCategory : c
        );

        setMappedCategories(dedupedMappedCategories);

        if (__DEV__)
          console.log(
            `${updatedMappedCategory.category} category counter updated: counter = ${updatedMappedCategory.timesMapped}`
          );

        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: categoryNameToCheck,
          timestamp: new Date().toISOString(),
          mappingOutcome: "already_mapped",
          matchedToCategory: categoryNameToCheck,
          matchedToSequenceIndex: null,
        };
        const interactionId = await saveConversationInteraction(interaction);
        setInteractions((prev) => [...prev, interaction]);
        await advanceToNextQuestion(nextQuestion);
        return { mapped: false as const, category: categoryNameToCheck, interactionId };
      } else {
        if (__DEV__) console.log(`Unexpected category "${rawCategory}", generating new question`);
        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: "INVALID CATEGORY (RETRY)",
          timestamp: new Date().toISOString(),
          mappingOutcome: "invalid",
          matchedToCategory: null,
          matchedToSequenceIndex: null,
        };
        const interactionId = await saveConversationInteraction(interaction);
        setInteractions((prev) => [...prev, interaction]);
        await advanceToNextQuestion(nextQuestion);
        return { mapped: false as const, category: null, interactionId };
      }
    } catch (err) {
      console.error("Error mapping answer:", err);
      const errorMessage = getFriendlyDialogueErrorMessage(err);
      setError(errorMessage);
      setUserAnswer("");
      setCurrentPrompt("");
      setUiState("idle");
      return { mapped: false as const, category: null, interactionId: "" };
    }
  };

  const handleStartButtonPress = async () => {
    if (uiState !== "idle") return;
    setError("");

    if (currentPrompt) {
      return;
    }

    if (mappedCategories.length === 0) {
      setCurrentPrompt(INITIAL_PROMPT);
      return;
    }

    if (prefetchedQuestion) {
      setCurrentPrompt(prefetchedQuestion);
      setPrefetchedQuestion(null);
      return;
    }

    setUiState("loading");
    setLoadingMessage("Synthesizing a new question...");
    cancelPendingOperation();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const newQuestion = await GeminiService.synthesizeNextQuestion(
        interactions,
        mappedCategories,
        getTaxonomyString(),
        { latestQuestion: savedQuestion, latestAnswer: savedAnswer },
        controller.signal
      );
      setCurrentPrompt(newQuestion);
      setUiState("idle");
      setLoadingMessage("");
    } catch (err) {
      console.error("Error synthesizing question:", err);
      setError("Failed to generate question. Please try again.");
      setUiState("idle");
      setLoadingMessage("");
    }
  };

  const handleTextInputPress = () => {
    setError("");
    if (currentPrompt) {
      setTimeout(() => setUiState("answering"), 100);
      return;
    }
    if (mappedCategories.length === 0) {
      setCurrentPrompt(INITIAL_PROMPT);
      setTimeout(() => setUiState("answering"), 100);
    } else if (prefetchedQuestion) {
      setCurrentPrompt(prefetchedQuestion);
      setPrefetchedQuestion(null);
      setTimeout(() => setUiState("answering"), 100);
    } else {
      setError("No question available. Please try again.");
    }
  };

  const handleVoiceInputPress = () => {
    setError("");
    if (currentPrompt) {
      setTimeout(() => setUiState("voice-recording"), 100);
      return;
    }
    if (mappedCategories.length === 0) {
      setCurrentPrompt(INITIAL_PROMPT);
      setTimeout(() => setUiState("voice-recording"), 100);
    } else if (prefetchedQuestion) {
      setCurrentPrompt(prefetchedQuestion);
      setPrefetchedQuestion(null);
      setTimeout(() => setUiState("voice-recording"), 100);
    } else {
      setError("No question available. Please try again.");
    }
  };

  const prepareImageQuestion = (): boolean => {
    setError("");
    if (currentPrompt) {
      setSavedQuestion(currentPrompt);
      return true;
    }
    if (mappedCategories.length === 0) {
      setCurrentPrompt(INITIAL_PROMPT);
      setSavedQuestion(INITIAL_PROMPT);
      return true;
    } else if (prefetchedQuestion) {
      setCurrentPrompt(prefetchedQuestion);
      setSavedQuestion(prefetchedQuestion);
      setPrefetchedQuestion(null);
      return true;
    } else {
      setError("No question available. Please try again.");
      return false;
    }
  };

  const matcherRef = useRef(new RegExpMatcher(englishDataset.build()));

  const REGEX_BYPASS_PATTERNS = [
    /\bf\s*[\W_]*u\s*[\W_]*c\s*[\W_]*k\b/i,
    /\bs\s*[\W_]*h\s*[\W_]*i\s*[\W_]*t\b/i,
    /\bb\s*[\W_]*i\s*[\W_]*t\s*[\W_]*c\s*[\W_]*h\b/i,
  ];

  const handleSubmitAnswer = () => {
    if (!userAnswer.trim()) {
      Alert.alert(
        "Empty Text Error",
        "Cannot evaluate an empty text field. Please provide a valid response."
      );
      setError("Answer cannot be empty. Please provide a substantive response.");
      return;
    }

    const trimmed = userAnswer.trim();
    if (
      matcherRef.current.hasMatch(trimmed) ||
      REGEX_BYPASS_PATTERNS.some((r) => r.test(trimmed))
    ) {
      Alert.alert(
        "Inappropriate Content",
        "Please keep your response respectful and appropriate so I can help you identify your skills."
      );
      setError("Response contained inappropriate language.");
      return;
    }

    const q = currentPrompt;
    const a = userAnswer;
    setSavedQuestion(q);
    setSavedAnswer(a);
    setCurrentPrompt("");
    setUserAnswer("");

    mapAnswerToCategory(q, a);
  };

  const handleWeakFitTryAgain = () => {
    setCurrentPrompt(savedQuestion);
    setUserAnswer(savedAnswer);
    setError("");
    setWeakFitJustification("");
    setContentWarning(false);
    if (contentWarning) {
      setUiState("idle");
    } else {
      setUiState("answering");
    }
  };

  const handleWeakFitNewQuestion = async () => {
    setWeakFitJustification("");
    setContentWarning(false);
    setSavedAnswer("");
    setSavedQuestion("");
    setError("");
    setUiState("idle");

    await new Promise((resolve) => setTimeout(resolve, 150));

    setUiState("loading");
    setLoadingMessage("Synthesizing a new question...");
    cancelPendingOperation();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const newQuestion = await GeminiService.synthesizeNextQuestion(
        interactions,
        mappedCategories,
        getTaxonomyString(),
        undefined,
        controller.signal
      );

      setPrefetchedQuestion(newQuestion);
      setLoadingMessage("");

      await new Promise((resolve) => setTimeout(resolve, 100));
      setUiState("idle");
    } catch (err) {
      console.error("Error synthesizing question after weak-fit:", err);
      setError("Failed to generate question. Please try again.");
      setUiState("idle");
      setLoadingMessage("");
    }
  };

  const dismissAnswerModal = () => {
    setCurrentPrompt("");
    setUserAnswer("");
    setError("");
    setUiState("idle");
  };

  const clearPendingProofRequest = () => {
    setPendingProofRequest(null);
  };

  return {
    mappedCategories,
    interactions,
    uiState,
    currentPrompt,
    userAnswer,
    loadingMessage,
    error,
    prefetchedQuestion,
    isPrefetching,
    loading,
    weakFitJustification,
    contentWarning,
    savedQuestion,
    savedAnswer,
    showConfetti,
    pendingProofRequest,
    setUserAnswer,
    setUiState,
    setLoadingMessage,
    setCurrentPrompt,
    setError,
    loadData,
    resetData,
    mapAnswerToCategory,
    handleStartButtonPress,
    handleTextInputPress,
    handleVoiceInputPress,
    prepareImageQuestion,
    handleSubmitAnswer,
    handleWeakFitTryAgain,
    handleWeakFitNewQuestion,
    dismissAnswerModal,
    clearPendingProofRequest,
  };
}
