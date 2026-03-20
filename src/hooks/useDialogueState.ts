import { useState, useEffect } from "react";
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
  addConversationInteraction,
  addConversationInteractionWithMapping,
  clearAllData,
  isCategoryMapped,
  getMappedCategory,
  updateMappedCategoryCounter,
} from "../services/categoryStorageService";
import { GeminiService } from "../services/geminiService";
import { Alert } from "react-native";
import { endSession } from "../services/sessionManager";

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
  savedQuestion: string;
  savedAnswer: string;
  showConfetti: boolean;
  showInputMethodModal: boolean;

  // Setters needed by screen for controlled inputs and UI transitions
  setUserAnswer: React.Dispatch<React.SetStateAction<string>>;
  setUiState: React.Dispatch<React.SetStateAction<UIState>>;
  setCurrentPrompt: React.Dispatch<React.SetStateAction<string>>;
  setShowInputMethodModal: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string>>;

  // Business logic
  loadData: () => Promise<void>;
  resetData: () => Promise<void>;
  mapAnswerToCategory: (question: string, answer: string) => Promise<void>;
  handleStartButtonPress: () => Promise<void>;
  handleTextInputPress: () => void;
  handleVoiceInputPress: () => void;
  prepareImageQuestion: () => boolean;
  handleSubmitAnswer: () => void;
  handleWeakFitTryAgain: () => void;
  handleWeakFitNewQuestion: () => Promise<void>;
  dismissAnswerModal: () => void;
}

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
  const [savedQuestion, setSavedQuestion] = useState("");
  const [savedAnswer, setSavedAnswer] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [showInputMethodModal, setShowInputMethodModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

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
      const [mapped, history] = await Promise.all([
        getMappedCategories(),
        getConversationHistory(),
      ]);
      setMappedCategories(mapped);
      setInteractions(history);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load your progress. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetData = async () => {
    await clearAllData();
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

  const mapAnswerToCategory = async (question: string, answer: string) => {
    setUiState("loading");
    setLoadingMessage("Analyzing your response...");
    setError("");
    setSavedQuestion(question);
    setSavedAnswer(answer);
    setPrefetchedQuestion(null);
    setIsPrefetching(false);

    try {
      const isInitial = mappedCategories.length === 0;
      const taxonomyString = getTaxonomyString();

      const result = await GeminiService.mapAnswerAndGenerateNextQuestion(
        question,
        answer,
        isInitial,
        interactions,
        mappedCategories,
        taxonomyString
      );

      const { category: rawCategory, justification, nextQuestion } = result;
      const validCategory = findValidCategory(rawCategory);
      const categoryNameToCheck = validCategory ? validCategory.category : rawCategory;

      let shouldProceedToNextQuestion = false;

      if (categoryNameToCheck === NO_OP_CATEGORY) {
        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: "NO-OP (WEAK FIT)",
          timestamp: new Date().toISOString(),
          mappingOutcome: "weak_fit",
          matchedToCategory: null,
          matchedToSequenceIndex: null,
        };
        await addConversationInteraction(interaction);
        setInteractions((prev) => [...prev, interaction]);
        setWeakFitJustification(justification ?? "");
        setUiState("weak-fit");
        return;
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

        console.log(
          `NEW ${categoryNameToCheck} category added: counter = ${newMappedCategory.timesMapped}`
        );

        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: categoryNameToCheck,
          timestamp: new Date().toISOString(),
          mappingOutcome: "mapped",
          matchedToCategory: null,
          matchedToSequenceIndex: null,
        };
        await addConversationInteractionWithMapping(interaction, justification ?? "");
        setInteractions((prev) => [...prev, interaction]);

        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);

        if (newMappedCategories.length === TOTAL_CATEGORIES) {
          await endSession("completed");
          setUserAnswer("");
          setUiState("complete");
          return;
        }

        shouldProceedToNextQuestion = true;
      } else if (await isCategoryMapped(categoryNameToCheck)) {
        console.log(`Category "${categoryNameToCheck}" already mapped, generating new question`);
        const mappedCategory = await getMappedCategory(categoryNameToCheck);
        const updatedMappedCategory = await updateMappedCategoryCounter(mappedCategory);

        // ensures no duplicate categories are added to array of mapped categories
        const dedupedMappedCategories = mappedCategories.map((c) =>
          c.category === updatedMappedCategory.category ? updatedMappedCategory : c
        );

        setMappedCategories(dedupedMappedCategories);

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
        await addConversationInteraction(interaction);
        setInteractions((prev) => [...prev, interaction]);
        shouldProceedToNextQuestion = true;
      } else {
        console.log(`Unexpected category "${rawCategory}", generating new question`);
        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: "INVALID CATEGORY (RETRY)",
          timestamp: new Date().toISOString(),
          mappingOutcome: "invalid",
          matchedToCategory: null,
          matchedToSequenceIndex: null,
        };
        await addConversationInteraction(interaction);
        setInteractions((prev) => [...prev, interaction]);
        shouldProceedToNextQuestion = true;
      }

      setUserAnswer("");

      if (shouldProceedToNextQuestion) {
        setLoadingMessage("Generating next question...");

        try {
          const newQuestion =
            nextQuestion ||
            (await GeminiService.synthesizeNextQuestion(
              interactions,
              mappedCategories,
              getTaxonomyString()
            ));

          setPrefetchedQuestion(newQuestion);
          setIsPrefetching(false);
          setLoadingMessage("");

          await new Promise((resolve) => setTimeout(resolve, 100));
          setUiState("idle");

          setTimeout(() => {
            setShowInputMethodModal(true);
          }, 100);
          return;
        } catch (err) {
          console.error("Error generating next question:", err);
          setError("Failed to generate next question. Please try again.");
          setUiState("idle");
          return;
        }
      }

      setUiState("idle");
    } catch (err) {
      console.error("Error mapping answer:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to process your answer. Please try again.";
      setError(errorMessage);
      setUserAnswer("");
      setCurrentPrompt("");
      setUiState("idle");
    }
  };

  const handleStartButtonPress = async () => {
    if (uiState !== "idle") return;
    setError("");

    if (mappedCategories.length > 0 && !prefetchedQuestion && !isPrefetching) {
      setUiState("loading");
      setLoadingMessage("Synthesizing a new question...");

      try {
        const newQuestion = await GeminiService.synthesizeNextQuestion(
          interactions,
          mappedCategories,
          getTaxonomyString()
        );

        setPrefetchedQuestion(newQuestion);
        setUiState("idle");
        setLoadingMessage("");

        setTimeout(() => {
          setShowInputMethodModal(true);
        }, 100);
      } catch (err) {
        console.error("Error synthesizing question:", err);
        setError("Failed to generate question. Please try again.");
        setUiState("idle");
        setLoadingMessage("");
      }
    } else {
      setShowInputMethodModal(true);
    }
  };

  const handleTextInputPress = () => {
    setError("");
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

  const handleSubmitAnswer = () => {
    if (!userAnswer.trim()) {
      Alert.alert(
        "Empty Text Error",
        "Cannot evaluate an empty text field. Please provide a valid response.",
        [
          {
            text: "OK",
            onPress: () => console.log("Empty Text Error - OK pressed"),
          },
        ]
      );
      setError("Answer cannot be empty. Please provide a substantive response.");
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
    setUiState("answering");
  };

  const handleWeakFitNewQuestion = async () => {
    setWeakFitJustification("");
    setSavedAnswer("");
    setSavedQuestion("");
    setError("");
    setUiState("idle");

    await new Promise((resolve) => setTimeout(resolve, 150));

    setUiState("loading");
    setLoadingMessage("Synthesizing a new question...");

    try {
      const newQuestion = await GeminiService.synthesizeNextQuestion(
        interactions,
        mappedCategories,
        getTaxonomyString()
      );

      setPrefetchedQuestion(newQuestion);
      setLoadingMessage("");

      await new Promise((resolve) => setTimeout(resolve, 100));
      setUiState("idle");

      setTimeout(() => {
        setShowInputMethodModal(true);
      }, 100);
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
    savedQuestion,
    savedAnswer,
    showConfetti,
    showInputMethodModal,
    setUserAnswer,
    setUiState,
    setCurrentPrompt,
    setShowInputMethodModal,
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
  };
}
