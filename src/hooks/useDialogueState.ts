import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  waitForAuthReady,
  hydratePassportMappings,
  getCurrentAuthSession,
} from "../services/auth/authSessionService";
import { Alert } from "react-native";
import {
  MappedCategory,
  ConversationInteraction,
  TOTAL_CATEGORIES,
  INITIAL_PROMPT,
  NO_OP_CATEGORY,
  getTaxonomyString,
  getFilteredTaxonomyString,
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
import { TOTAL_STAMPS } from "../config/skillsTaxonomy";
import { getPvaContext } from "../services/profileEmbeddingService";
import { endSession, getUserId, getActiveSessionId } from "../services/sessionManager";
import { savePassportMapping } from "../services/firebase/firestoreService";
import { RegExpMatcher, englishDataset } from "obscenity";
import {
  saveDialogueState,
  loadDialogueState,
  clearDialogueState,
} from "../services/dialogueStateStorage";
import { useProofWorkflow } from "./useProofWorkflow";

// Built once for the app's lifetime — englishDataset.build() is expensive.
const profanityMatcher = new RegExpMatcher(englishDataset.build());

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
  pdfContextText: string;
  showConfetti: boolean;
  newStampUnlock: {
    stamp: string;
    category: string;
    categoryId: string;
    tier: number;
    sensitive: boolean;
  } | null;
  showCrisisSupport: boolean;
  dismissCrisisSupport: () => void;
  showSensitiveIntro: boolean;
  dismissSensitiveIntro: () => void;
  pendingProofRequest: {
    question: string;
    answer: string;
    interactionId: string;
    category: string;
    categoryId?: string;
    stampName?: string;
    artifactUploadReason?: string;
    proofTier?: number;
  } | null;
  pendingProofNotification: {
    artifactUploadReason: string;
    stampName: string;
    proofTier: number;
    category: string;
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
  mapAnswerToCategory: (
    question: string,
    answer: string,
    targetRegion?: string,
    checkSensitive?: boolean,
    imageContext?: string
  ) => Promise<DialogueMapResult>;
  handleStartButtonPress: () => Promise<void>;
  handleForceNewQuestion: () => Promise<void>;
  handleTextInputPress: () => void;
  handleVoiceInputPress: () => void;
  prepareImageQuestion: () => boolean;
  handleSubmitAnswer: () => void;
  handleWeakFitTryAgain: () => void;
  handleWeakFitNewQuestion: () => Promise<void>;
  handleSkipQuestion: () => Promise<void>;
  handleNewTopic: (region?: string) => Promise<void>;
  dismissAnswerModal: () => void;
  clearPendingProofRequest: () => void;
  clearStampUnlock: () => void;
  continueAfterStampUnlock: () => void;
  clearProofNotification: () => void;
  activateProofFromNotification: () => void;
  clearDeferredState: () => void;
  triggerContentWarning: (message?: string) => void;
}

export type DialogueMapResult =
  | {
      mapped: true;
      category: string;
      interactionId: string;
      stampUnlock?: {
        stamp: string;
        category: string;
        categoryId: string;
        tier: number;
      };
      distressSignal?: boolean;
      sensitiveExperience?: boolean;
    }
  | {
      mapped: false;
      category: string | null;
      interactionId: string;
      distressSignal?: boolean;
    };

/** Total unique stamps unlocked across all mapped categories. */
function countUnlockedStamps(categories: MappedCategory[]): number {
  return categories.reduce(
    (sum, mc) => sum + (Array.isArray(mc.unlockedStamps) ? mc.unlockedStamps.length : 0),
    0
  );
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
  const [contentWarning, setContentWarning] = useState(false);
  const [savedQuestion, setSavedQuestion] = useState("");
  const [savedAnswer, setSavedAnswer] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [newStampUnlock, setNewStampUnlock] = useState<{
    stamp: string;
    category: string;
    categoryId: string;
    tier: number;
    sensitive: boolean;
  } | null>(null);
  const [showCrisisSupport, setShowCrisisSupport] = useState(false);
  const [showSensitiveIntro, setShowSensitiveIntro] = useState(false);
  const [deferredNextQuestion, setDeferredNextQuestion] = useState<string | null>(null);
  const [deferredCheckCompletion, setDeferredCheckCompletion] = useState(false);

  const totalUniqueStamps = useMemo(
    () => countUnlockedStamps(mappedCategories),
    [mappedCategories]
  );

  // Proof-request workflow.
  const proof = useProofWorkflow();

  // Ensures the session is marked completed at most once, whether completion is
  // reached via the effect below or via continueAfterStampUnlock.
  const completionHandledRef = useRef(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const deferredAdvanceOptsRef = useRef<{
    interactions: ConversationInteraction[];
    mappedCategories: Array<{ category: string }>;
    taxonomyString: string;
    latestQuestion: string;
    latestAnswer: string;
    targetRegion?: string;
  } | null>(null);

  // Personality profile context — fetched once per session, reused for every question.
  const pdfContextRef = useRef<string | undefined>(undefined);
  const pdfContextFetchRef = useRef<Promise<string> | null>(null);

  const cancelPendingOperation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistState = useCallback(
    async (
      prompt: string,
      savedQ: string,
      answer: string,
      savedA: string,
      state: UIState,
      prefetched: string | null
    ) => {
      if (state === "complete") {
        await clearDialogueState();
        return;
      }
      // Clear only when idle with no pending question (shown or prefetched).
      if (state === "idle" && !prompt && !prefetched) {
        await clearDialogueState();
        return;
      }
      await saveDialogueState({
        currentPrompt: prompt,
        savedQuestion: savedQ,
        userAnswer: answer,
        savedAnswer: savedA,
        uiState: state,
        prefetchedQuestion: prefetched,
      });
    },
    []
  );

  useEffect(() => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      void persistState(
        currentPrompt,
        savedQuestion,
        userAnswer,
        savedAnswer,
        uiState,
        prefetchedQuestion
      );
    }, 500);
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [currentPrompt, savedQuestion, userAnswer, savedAnswer, uiState, prefetchedQuestion]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (
      totalUniqueStamps >= TOTAL_STAMPS &&
      !deferredCheckCompletion &&
      !completionHandledRef.current
    ) {
      completionHandledRef.current = true;
      void endSession("completed");
      setUiState("complete");
      setPrefetchedQuestion(null);
      setIsPrefetching(false);
    }
  }, [totalUniqueStamps, deferredCheckCompletion]);

  const getFriendlyDialogueErrorMessage = (error: unknown): string => {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : undefined;
    const message = error instanceof Error ? error.message : "";

    if (
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

  const loadData = async () => {
    try {
      // Resolve auth once so the storage reads below don't each re-check it.
      await waitForAuthReady();

      // Fetch the personality profile in the background, ready for the first answer.
      if (pdfContextRef.current === undefined && !pdfContextFetchRef.current) {
        pdfContextFetchRef.current = getPvaContext()
          .then((ctx) => {
            pdfContextRef.current = ctx;
            return ctx;
          })
          .catch(() => {
            pdfContextRef.current = "";
            return "";
          });
      }

      await syncFromFirestore();

      // Sync passport data from Firestore for authenticated users
      const currentSession = getCurrentAuthSession();
      if (currentSession.mode === "authenticated" && currentSession.uid) {
        await hydratePassportMappings(currentSession.uid);
      }

      const mapped = await getMappedCategories();
      const history = await getConversationHistory();
      const persisted = await loadDialogueState();
      setMappedCategories(mapped);
      setInteractions(history);

      if (persisted && mapped.length < TOTAL_CATEGORIES) {
        setCurrentPrompt(persisted.currentPrompt);
        setSavedQuestion(persisted.savedQuestion);
        setUserAnswer(persisted.userAnswer);
        setSavedAnswer(persisted.savedAnswer);
        setPrefetchedQuestion(persisted.prefetchedQuestion ?? null);

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

  const maybeUnlockStamp = async (
    categoryId: string,
    stamp: string | null | undefined,
    tier: number = 1
  ) => {
    if (!stamp) return;
    if (stamp in STAMPS_LIST) {
      await addStampUnlock(categoryId, stamp, tier);
    } else if (__DEV__) {
      console.warn(
        `Invalid stamp name "${stamp}" for category "${categoryId}" — not in STAMPS_LIST, skipping unlock`
      );
    }
  };

  const advanceToNextQuestion = async (
    presetQuestion: string | null | undefined,
    opts: {
      interactions: ConversationInteraction[];
      mappedCategories: Array<{ category: string }>;
      taxonomyString: string;
      latestQuestion: string;
      latestAnswer: string;
      targetRegion?: string;
      signal: AbortSignal;
    }
  ) => {
    setUiState("loading");
    setUserAnswer("");
    setLoadingMessage("Generating next question...");
    try {
      const newQuestion =
        presetQuestion ||
        (await GeminiService.synthesizeNextQuestion(
          opts.interactions,
          opts.mappedCategories,
          opts.taxonomyString,
          {
            latestQuestion: opts.latestQuestion,
            latestAnswer: opts.latestAnswer,
            embeddingHistorySummary: pdfContextRef.current,
          },
          opts.signal,
          opts.targetRegion
        ));
      setPrefetchedQuestion(newQuestion);
      setIsPrefetching(false);
      setLoadingMessage("");
      setUiState("idle");
    } catch (err) {
      console.error("Error generating next question:", err);
      setError(getFriendlyDialogueErrorMessage(err));
      setUiState("idle");
    }
  };

  const mapAnswerToCategory = async (
    question: string,
    answer: string,
    targetRegion?: string,
    checkSensitive: boolean = false,
    imageContext?: string
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

    const taxonomyString = targetRegion
      ? getFilteredTaxonomyString(targetRegion)
      : getTaxonomyString();
    const advanceOpts = {
      interactions,
      mappedCategories,
      taxonomyString,
      latestQuestion: question,
      latestAnswer: answer,
      targetRegion,
      signal: controller.signal,
    };
    deferredAdvanceOptsRef.current = {
      interactions,
      mappedCategories,
      taxonomyString,
      latestQuestion: question,
      latestAnswer: answer,
      targetRegion,
    };

    try {
      let pdfContextText = "";
      if (pdfContextRef.current !== undefined) {
        pdfContextText = pdfContextRef.current;
      } else if (pdfContextFetchRef.current) {
        // Wait up to 15s for the PVA personality context, then proceed without it.
        // The prefetch resolves to "" on any failure, so generation never blocks
        // or breaks when no PVA is set / the request errors.
        pdfContextText = await Promise.race([
          pdfContextFetchRef.current,
          new Promise<string>((resolve) => setTimeout(() => resolve(""), 15000)),
        ]);
      }

      const result = await GeminiService.mapAnswerAndGenerateNextQuestion(
        question,
        answer,
        interactions,
        mappedCategories,
        taxonomyString,
        { pdfContextText, signal: controller.signal, targetRegion, imageContext }
      );

      const {
        category: rawCategory,
        justification,
        nextQuestion,
        specificStamp,
        initialTier,
      } = result;

      const distressSignal = checkSensitive && !!result.distressSignal;
      if (distressSignal) {
        setShowCrisisSupport(true);
      }

      const validCategory = findValidCategory(rawCategory);
      const categoryNameToCheck = validCategory ? validCategory.category : rawCategory;
      const categoryIdToCheck = validCategory ? validCategory.id : rawCategory;

      if (categoryNameToCheck === NO_OP_CATEGORY) {
        // Crisis takes precedence over weak-fit/content-warning for this turn:
        // the crisis modal was already triggered above via setShowCrisisSupport,
        // so we must not also push uiState into "weak-fit" or the WeakFitModal
        // will render on top of it.
        if (distressSignal) {
          const interaction: ConversationInteraction = {
            question,
            answer,
            mappedCategory: "NO-OP (WEAK FIT)",
            timestamp: new Date().toISOString(),
            mappingOutcome: "weak_fit",
            matchedToCategory: null,
            matchedToSequenceIndex: null,
          };
          const interactionId = await saveConversationInteraction(interaction, justification ?? "");
          setInteractions((prev) => [...prev, interaction]);
          setUiState("idle");
          return { mapped: false as const, category: null, interactionId, distressSignal };
        }

        if (justification?.startsWith("INAPPROPRIATE_CONTENT:")) {
          setWeakFitJustification(justification.replace("INAPPROPRIATE_CONTENT:", "").trim());
          setContentWarning(true);
          setUiState("weak-fit");
          return { mapped: false as const, category: null, interactionId: "", distressSignal };
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
        const interactionId = await saveConversationInteraction(interaction, justification ?? "");
        setInteractions((prev) => [...prev, interaction]);
        setWeakFitJustification(justification ?? "");
        setUiState("weak-fit");
        return { mapped: false as const, category: null, interactionId, distressSignal };
      }

      if (validCategory && !(await isCategoryMapped(categoryIdToCheck))) {
        const effectiveJustification =
          justification?.trim() ||
          (specificStamp
            ? `Demonstrated through your response: "${answer.trim()}"`
            : `Mapped to "${categoryNameToCheck}" based on your response.`);
        const newMappedCategory: MappedCategory = {
          category: categoryNameToCheck,
          categoryId: categoryIdToCheck,
          justification: effectiveJustification,
          dateIdentified: new Date().toISOString(),
          timesMapped: 1,
        };
        await saveMappedCategory(newMappedCategory);
        await maybeUnlockStamp(categoryIdToCheck, specificStamp, initialTier ?? 1);
        // Re-read after the unlock so state reflects the persisted unlockedStamps.
        const freshCategories = await getMappedCategories();
        setMappedCategories(freshCategories);
        advanceOpts.mappedCategories = freshCategories;
        deferredAdvanceOptsRef.current!.mappedCategories = freshCategories;

        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: categoryNameToCheck,
          categoryId: categoryIdToCheck,
          timestamp: new Date().toISOString(),
          mappingOutcome: "mapped",
          matchedToCategory: null,
          matchedToSequenceIndex: null,
          specificStamp: specificStamp ?? undefined,
        };
        const interactionId = await saveConversationInteraction(
          interaction,
          effectiveJustification
        );
        savePassportMappingToFirestore(
          interactionId,
          categoryNameToCheck,
          categoryIdToCheck,
          effectiveJustification,
          specificStamp ?? undefined
        );
        setInteractions((prev) => [...prev, interaction]);
        // Crisis always wins: if distressSignal fired, skip both the confetti
        // celebration and the sensitive-experience modal for this turn — the
        // crisis modal was already triggered above and shouldn't compete with
        // either.
        const isSensitive = !distressSignal && checkSensitive && !!result.sensitiveExperience;
        if (distressSignal) {
          // no-op: crisis modal takes the whole turn
        } else if (isSensitive) {
          setShowSensitiveIntro(true);
        } else {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
        }

        if (specificStamp) {
          setNewStampUnlock({
            stamp: specificStamp,
            category: categoryNameToCheck,
            categoryId: categoryIdToCheck,
            tier: initialTier ?? 1,
            sensitive: isSensitive,
          });

          setDeferredNextQuestion(nextQuestion ?? null);
          setDeferredCheckCompletion(countUnlockedStamps(freshCategories) >= TOTAL_STAMPS);
          setUiState("idle");
          if (result.suggestArtifactUpload) {
            proof.deferAfterUnlock({
              question,
              answer,
              interactionId,
              category: categoryNameToCheck,
              categoryId: categoryIdToCheck,
              stampName: specificStamp ?? undefined,
              artifactUploadReason: result.artifactUploadReason,
              proofTier: result.proofTier ?? 3,
            });
          }
          return {
            mapped: true as const,
            category: categoryNameToCheck,
            interactionId,
            stampUnlock: {
              stamp: specificStamp,
              category: categoryNameToCheck,
              categoryId: categoryIdToCheck,
              tier: initialTier ?? 1,
            },
            distressSignal,
            sensitiveExperience: isSensitive,
          };
        } else {
          if (freshCategories.length === TOTAL_CATEGORIES) {
            await endSession("completed");
            setUserAnswer("");
            setUiState("complete");
            return { mapped: true as const, category: categoryNameToCheck, interactionId };
          }
          if (result.suggestArtifactUpload) {
            proof.requestNow({
              question,
              answer,
              interactionId,
              category: categoryNameToCheck,
              categoryId: categoryIdToCheck,
              stampName: specificStamp ?? undefined,
              artifactUploadReason: result.artifactUploadReason,
              proofTier: result.proofTier ?? 3,
            });
          }
          await advanceToNextQuestion(nextQuestion, advanceOpts);
        }

        return {
          mapped: true as const,
          category: categoryNameToCheck,
          interactionId,
          distressSignal,
          sensitiveExperience: isSensitive,
        };
      }

      if (await isCategoryMapped(categoryNameToCheck)) {
        const mappedCategory = await getMappedCategory(categoryNameToCheck);
        await updateMappedCategoryCounter({
          ...mappedCategory,
          justification: justification || mappedCategory.justification,
        });
        await maybeUnlockStamp(categoryIdToCheck, specificStamp, initialTier ?? 1);
        const freshCategories = await getMappedCategories();
        setMappedCategories(freshCategories);
        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: categoryNameToCheck,
          categoryId: categoryIdToCheck,
          timestamp: new Date().toISOString(),
          mappingOutcome: "already_mapped",
          matchedToCategory: categoryNameToCheck,
          matchedToSequenceIndex: null,
          specificStamp: specificStamp ?? undefined,
        };
        const interactionId = await saveConversationInteraction(interaction, justification ?? "");
        savePassportMappingToFirestore(
          interactionId,
          categoryNameToCheck,
          categoryIdToCheck,
          justification || mappedCategory.justification,
          specificStamp ?? undefined
        );
        setInteractions((prev) => [...prev, interaction]);
        await advanceToNextQuestion(nextQuestion, advanceOpts);
        return {
          mapped: false as const,
          category: categoryNameToCheck,
          interactionId,
          distressSignal,
        };
      }

      const interaction: ConversationInteraction = {
        question,
        answer,
        mappedCategory: "INVALID CATEGORY (RETRY)",
        timestamp: new Date().toISOString(),
        mappingOutcome: "invalid",
        matchedToCategory: null,
        matchedToSequenceIndex: null,
      };
      const interactionId = await saveConversationInteraction(interaction, justification ?? "");
      setInteractions((prev) => [...prev, interaction]);
      await advanceToNextQuestion(nextQuestion, advanceOpts);
      return { mapped: false as const, category: null, interactionId, distressSignal };
    } catch (err) {
      console.error("Error mapping answer:", err);
      setError(getFriendlyDialogueErrorMessage(err));
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
        {
          latestQuestion: savedQuestion,
          latestAnswer: savedAnswer,
          embeddingHistorySummary: pdfContextRef.current,
        },
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

  const handleForceNewQuestion = useCallback(async () => {
    setUiState("idle");
    setError("");
    setLoadingMessage("");
    await new Promise((r) => setTimeout(r, 50));
    await handleStartButtonPress();
  }, [handleStartButtonPress]);

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
    if (profanityMatcher.hasMatch(trimmed) || REGEX_BYPASS_PATTERNS.some((r) => r.test(trimmed))) {
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

    mapAnswerToCategory(q, a, undefined, true);
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

  const triggerContentWarning = (message?: string) => {
    setWeakFitJustification(
      message ?? "That image couldn't be used because it contains inappropriate content."
    );
    setContentWarning(true);
    setUiState("weak-fit");
  };

  // Regenerate the next question: brief idle beat, then an abortable Gemini
  // call whose result is prefetched. Callers reset their own state and pass context.
  const synthesizeAndPrefetch = async (
    context?: Parameters<typeof GeminiService.synthesizeNextQuestion>[3]
  ) => {
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
        context,
        controller.signal
      );

      setPrefetchedQuestion(newQuestion);
      setLoadingMessage("");

      await new Promise((resolve) => setTimeout(resolve, 100));
      setUiState("idle");
    } catch (err) {
      console.error("Error synthesizing question:", err);
      setError("Failed to generate question. Please try again.");
      setUiState("idle");
      setLoadingMessage("");
    }
  };

  const handleWeakFitNewQuestion = async () => {
    setWeakFitJustification("");
    setContentWarning(false);
    setSavedAnswer("");
    setSavedQuestion("");
    await synthesizeAndPrefetch({
      embeddingHistorySummary: pdfContextRef.current,
    });
  };

  // Skip: regenerate with an "avoid this" signal so the model returns something
  // genuinely different rather than a rephrasing.
  const handleSkipQuestion = async () => {
    await synthesizeAndPrefetch({
      avoidQuestion: currentPrompt || undefined,
      embeddingHistorySummary: pdfContextRef.current,
    });
  };

  const handleNewTopic = async (region?: string) => {
    if (uiState !== "idle") return;
    setError("");
    setUiState("loading");
    setLoadingMessage("Synthesizing a new question...");
    cancelPendingOperation();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const question = await GeminiService.synthesizeNextQuestion(
        interactions,
        mappedCategories,
        region ? getFilteredTaxonomyString(region) : getTaxonomyString(),
        { embeddingHistorySummary: pdfContextRef.current, newTopic: true },
        controller.signal,
        region
      );
      setCurrentPrompt(question);
      setUiState("idle");
      setLoadingMessage("");
    } catch (err) {
      console.error("Error synthesizing question for region:", err);
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

  const clearStampUnlock = () => {
    setNewStampUnlock(null);
  };

  const dismissCrisisSupport = () => {
    setShowCrisisSupport(false);
  };

  const dismissSensitiveIntro = () => {
    setShowSensitiveIntro(false);
  };

  const continueAfterStampUnlock = () => {
    const nextQuestion = deferredNextQuestion;
    const isComplete = deferredCheckCompletion;

    setDeferredNextQuestion(null);
    setDeferredCheckCompletion(false);

    if (isComplete) {
      proof.clearDeferred();
      completionHandledRef.current = true;
      void endSession("completed");
      setUserAnswer("");
      setUiState("complete");
      return;
    }

    proof.surfaceDeferred();

    if (nextQuestion) {
      setUiState("loading");
      setLoadingMessage("Preparing your next question...");
      setTimeout(() => {
        setPrefetchedQuestion(nextQuestion);
        setUiState("idle");
      }, 600);
    } else {
      void advanceToNextQuestion(null, {
        ...deferredAdvanceOptsRef.current!,
        signal: abortControllerRef.current?.signal ?? new AbortController().signal,
      });
    }
  };

  const clearDeferredState = () => {
    setDeferredNextQuestion(null);
    setDeferredCheckCompletion(false);
    proof.clearDeferred();
  };

  const savePassportMappingToFirestore = useCallback(
    async (
      interactionId: string,
      category: string,
      categoryId: string,
      justification: string,
      specificStamp?: string
    ) => {
      try {
        const [userId, sessionId] = await Promise.all([getUserId(), getActiveSessionId()]);
        if (userId && sessionId) {
          await savePassportMapping(
            userId,
            sessionId,
            interactionId,
            category,
            categoryId,
            justification,
            specificStamp
          );
        }
      } catch {
        // Best-effort write — transient errors are expected.
      }
    },
    []
  );

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
    pdfContextText: pdfContextRef.current ?? "",
    showConfetti,
    newStampUnlock,
    showCrisisSupport,
    showSensitiveIntro,
    pendingProofRequest: proof.proofRequest,
    pendingProofNotification: proof.proofNotification,
    setUserAnswer,
    setUiState,
    setLoadingMessage,
    setCurrentPrompt,
    setError,
    loadData,
    resetData,
    mapAnswerToCategory,
    handleStartButtonPress,
    handleForceNewQuestion,
    handleTextInputPress,
    handleVoiceInputPress,
    prepareImageQuestion,
    handleSubmitAnswer,
    handleWeakFitTryAgain,
    handleWeakFitNewQuestion,
    handleSkipQuestion,
    handleNewTopic,
    dismissAnswerModal,
    clearPendingProofRequest: proof.clearRequest,
    clearStampUnlock,
    continueAfterStampUnlock,
    dismissCrisisSupport,
    dismissSensitiveIntro,
    clearProofNotification: proof.clearNotification,
    activateProofFromNotification: proof.activateFromNotification,
    clearDeferredState,
    triggerContentWarning,
  };
}
