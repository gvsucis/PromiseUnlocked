import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { waitForAuthReady } from "../services/auth/authSessionService";
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
import { noMapReasonFromPrefix, normalizeJustification } from "../types/gemini";
import { STAMPS_LIST } from "../config/stampConstants";
import { TOTAL_STAMPS } from "../config/skillsTaxonomy";
import { getPvaContext } from "../services/profileEmbeddingService";
import { getArtifactBrief } from "../services/artifactService";
import { endSession, getUserId, getActiveSessionId } from "../services/sessionManager";
import { savePassportMapping } from "../services/firebase/firestoreService";
import { containsInappropriateLanguage } from "../utils/contentModeration";
import { getCachedJustifications, cacheJustifications } from "../services/passportSyncService";
import {
  saveDialogueState,
  loadDialogueState,
  clearDialogueState,
} from "../services/dialogueStateStorage";
import { useProofWorkflow } from "./useProofWorkflow";
import type {
  UIState,
  DialogueState,
  DialogueMapResult,
  StampUnlockInfo,
  StampTierUpgrade,
} from "../types/hooks";

export type { UIState, DialogueState, DialogueMapResult } from "../types/hooks";

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
  const [newStampUnlock, setNewStampUnlock] = useState<StampUnlockInfo | null>(null);
  const [showCrisisSupport, setShowCrisisSupport] = useState(false);
  const [showSensitiveIntro, setShowSensitiveIntro] = useState(false);
  const [deferredNextQuestion, setDeferredNextQuestion] = useState<string | null>(null);
  const [deferredCheckCompletion, setDeferredCheckCompletion] = useState(false);
  const [stampTierUpgrade, setStampTierUpgrade] = useState<StampTierUpgrade | null>(null);
  const [addDetailReview, setAddDetailReview] = useState<{ justification: string } | null>(null);

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

      // Fetch the personality profile + artifact brief in the background, ready for the first answer.
      if (pdfContextRef.current === undefined && !pdfContextFetchRef.current) {
        pdfContextFetchRef.current = Promise.all([getPvaContext(), getArtifactBrief()])
          .then(([pvaCtx, artifactBrief]) => {
            const parts: string[] = [];
            if (pvaCtx) parts.push(pvaCtx);
            if (artifactBrief) parts.push("EXPERIENCE BRIEF:\n" + artifactBrief);
            pdfContextRef.current = parts.join("\n\n");
            return pdfContextRef.current;
          })
          .catch(() => {
            pdfContextRef.current = "";
            return "";
          });
      }

      await syncFromFirestore();

      const mapped = await getMappedCategories();
      const history = await getConversationHistory();
      const persisted = await loadDialogueState();
      setMappedCategories(mapped);
      setInteractions(history);

      if (persisted && mapped.length < TOTAL_CATEGORIES) {
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
  ): Promise<{ previousTier: number; newTier: number } | null> => {
    if (!stamp) {
      if (__DEV__) {
        console.warn(
          `maybeUnlockStamp: no specificStamp returned for category "${categoryId}" — skipping unlock/upgrade`
        );
      }
      return null;
    }
    if (stamp in STAMPS_LIST) {
      return await addStampUnlock(categoryId, stamp, tier);
    }
    if (__DEV__) {
      console.warn(
        `Invalid stamp name "${stamp}" for category "${categoryId}" — not in STAMPS_LIST, skipping unlock`
      );
    }
    return null;
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

  // Ends an addDetail turn without advancing: no new question is generated and
  // the flow lands on a "Detail recorded" review modal instead.
  const finishAddDetailTurn = (justification: string) => {
    setCurrentPrompt("");
    setUserAnswer("");
    setPrefetchedQuestion(null);
    setIsPrefetching(false);
    setAddDetailReview({ justification });
    setUiState("idle");
  };

  const mapAnswerToCategory = async (
    question: string,
    answer: string,
    targetRegion?: string,
    checkSensitive: boolean = false,
    // Set (3-4) when the answer is backed by a Gemini-verified supporting image;
    // lifts the unlocked stamp straight to that evidence tier and skips the
    // (now-redundant) proof-upload prompt.
    evidenceTier?: number,
    isAddDetail: boolean = false
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
      const result = await GeminiService.mapAnswerAndGenerateNextQuestion(
        question,
        answer,
        interactions,
        mappedCategories,
        taxonomyString,
        { signal: controller.signal, targetRegion }
      );

      const {
        category: rawCategory,
        justification,
        nextQuestion,
        specificStamp,
        initialTier,
      } = result;
      const noMapReason = result.noMapReason || noMapReasonFromPrefix(justification) || "";
      const strippedJustification = normalizeJustification(justification);

      const validCategory = findValidCategory(rawCategory);

      if (__DEV__) {
        console.log("[MapAnswer] raw decision:", {
          rawCategory,
          resolvedCategory: validCategory?.category ?? null,
          noMapReason,
          specificStamp: result.specificStamp ?? null,
          initialTier: result.initialTier ?? null,
        });
      }

      // A verified supporting image lifts the stamp straight to its evidence tier
      // (never below what the answer itself earned, capped at 4).
      const effectiveInitialTier =
        evidenceTier != null
          ? Math.min(Math.max(initialTier ?? 1, evidenceTier), 4)
          : (initialTier ?? 1);

      const distressSignal = checkSensitive && !!result.distressSignal;
      if (distressSignal) {
        setShowCrisisSupport(true);
        setSavedQuestion("");
        setSavedAnswer("");
        setCurrentPrompt("");
        setUserAnswer("");
        setUiState("idle");
        return { mapped: false as const, category: null, interactionId: "", distressSignal };
      }

      const categoryNameToCheck = validCategory ? validCategory.category : rawCategory;
      const categoryIdToCheck = validCategory ? validCategory.id : rawCategory;

      if (categoryNameToCheck === NO_OP_CATEGORY) {
        const reason = noMapReason || "weak_fit";

        if (reason === "inappropriate_content") {
          // Sanitized audit record: the user's offensive text is never persisted.
          const interaction: ConversationInteraction = {
            question,
            answer: "[Content omitted]",
            mappedCategory: "NO MAP (INAPPROPRIATE)",
            timestamp: new Date().toISOString(),
            mappingOutcome: "invalid",
            noMapReason: reason,
            matchedToCategory: null,
            matchedToSequenceIndex: null,
          };
          const interactionId = await saveConversationInteraction(
            interaction,
            "Answer flagged as inappropriate; original content not stored."
          );
          setInteractions((prev) => [...prev, interaction]);
          setWeakFitJustification(
            strippedJustification || "This response was flagged as inappropriate."
          );
          setContentWarning(true);
          setUiState("weak-fit");
          return { mapped: false as const, category: null, interactionId, distressSignal };
        }

        if (reason === "responsive_negative") {
          const interaction: ConversationInteraction = {
            question,
            answer,
            mappedCategory: "NO MAP (RESPONSIVE NEGATIVE)",
            timestamp: new Date().toISOString(),
            mappingOutcome: "invalid",
            noMapReason: reason,
            matchedToCategory: null,
            matchedToSequenceIndex: null,
          };
          const interactionId = await saveConversationInteraction(
            interaction,
            strippedJustification
          );
          setInteractions((prev) => [...prev, interaction]);
          if (isAddDetail) {
            finishAddDetailTurn(strippedJustification || "Detail recorded.");
            return { mapped: false as const, category: null, interactionId, distressSignal };
          }
          await advanceToNextQuestion(nextQuestion, advanceOpts);
          return { mapped: false as const, category: null, interactionId, distressSignal };
        }

        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: "NO-OP (WEAK FIT)",
          timestamp: new Date().toISOString(),
          mappingOutcome: "weak_fit",
          noMapReason: reason,
          matchedToCategory: null,
          matchedToSequenceIndex: null,
        };
        const interactionId = await saveConversationInteraction(interaction, strippedJustification);
        setInteractions((prev) => [...prev, interaction]);
        setWeakFitJustification(strippedJustification);
        setUiState("weak-fit");
        return { mapped: false as const, category: null, interactionId, distressSignal };
      }

      const isSensitive = !distressSignal && checkSensitive && !!result.sensitiveExperience;

      if (validCategory && !(await isCategoryMapped(categoryIdToCheck))) {
        // An unlocking stamp must carry a justification; fall back to a bounded,
        // stamp-linked note when the model returns none so the detail screen
        // isn't left blank (never dump the full raw answer).
        const effectiveJustification =
          strippedJustification ||
          (specificStamp
            ? `Detailed experience matching the "${specificStamp}" stamp.`
            : "Detailed experience matching this skill category.");
        const newMappedCategory: MappedCategory = {
          category: categoryNameToCheck,
          categoryId: categoryIdToCheck,
          justification: effectiveJustification,
          dateIdentified: new Date().toISOString(),
          timesMapped: 1,
        };
        await saveMappedCategory(newMappedCategory);
        await maybeUnlockStamp(categoryIdToCheck, specificStamp, effectiveInitialTier);
        // Re-read after the unlock so state reflects the persisted unlockedStamps.
        const freshCategories = await getMappedCategories();
        setMappedCategories(freshCategories);

        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: categoryNameToCheck,
          categoryId: categoryIdToCheck,
          timestamp: new Date().toISOString(),
          mappingOutcome: "mapped",
          noMapReason: "",
          matchedToCategory: null,
          matchedToSequenceIndex: null,
          specificStamp: specificStamp ?? undefined,
        };
        const interactionId = await saveConversationInteraction(
          interaction,
          effectiveJustification
        );
        if (effectiveJustification) {
          savePassportMappingToFirestore(
            interactionId,
            categoryNameToCheck,
            categoryIdToCheck,
            effectiveJustification,
            specificStamp ?? undefined
          );
          if (specificStamp) {
            const existing = await getCachedJustifications(categoryIdToCheck, specificStamp);
            const justificationsToCache = existing.includes(effectiveJustification)
              ? existing
              : [...existing, effectiveJustification];
            cacheJustifications(categoryIdToCheck, specificStamp, justificationsToCache);
          }
        }
        setInteractions((prev) => [...prev, interaction]);
        if (distressSignal) {
          // No-op: crisis support modal is already triggered above via setShowCrisisSupport.
        } else if (isSensitive) {
          setShowSensitiveIntro(true);
        } else {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        }

        if (specificStamp) {
          setNewStampUnlock({
            stamp: specificStamp,
            category: categoryNameToCheck,
            categoryId: categoryIdToCheck,
            tier: effectiveInitialTier,
            sensitive: isSensitive,
          });

          setCurrentPrompt("");
          if (isAddDetail) {
            setDeferredNextQuestion(null);
            setDeferredCheckCompletion(false);
            setUiState("idle");
          } else {
            setDeferredNextQuestion(nextQuestion ?? null);
            setDeferredCheckCompletion(countUnlockedStamps(freshCategories) >= TOTAL_STAMPS);
            setUiState("idle");
          }
          if (result.suggestArtifactUpload && evidenceTier == null && !isAddDetail) {
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
              tier: effectiveInitialTier,
            },
            distressSignal,
            sensitiveExperience: isSensitive,
          };
        }

        if (countUnlockedStamps(freshCategories) >= TOTAL_STAMPS) {
          completionHandledRef.current = true;
          void endSession("completed");
          setUserAnswer("");
          setUiState("complete");
          return { mapped: true as const, category: categoryNameToCheck, interactionId };
        }
        if (result.suggestArtifactUpload && evidenceTier == null && !isAddDetail) {
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

        if (isAddDetail) {
          finishAddDetailTurn(effectiveJustification);
          return {
            mapped: false as const,
            category: categoryNameToCheck,
            interactionId,
            distressSignal,
          };
        }

        await advanceToNextQuestion(nextQuestion, advanceOpts);

        return {
          mapped: false as const,
          category: categoryNameToCheck,
          interactionId,
          distressSignal,
        };
      }

      if (await isCategoryMapped(categoryIdToCheck)) {
        const mappedCategory = await getMappedCategory(categoryIdToCheck);
        const turnJustification = strippedJustification || mappedCategory.justification;
        await updateMappedCategoryCounter({
          ...mappedCategory,
          justification: turnJustification,
        });
        const tierChange = await maybeUnlockStamp(
          categoryIdToCheck,
          specificStamp,
          effectiveInitialTier
        );
        const freshCategories = await getMappedCategories();
        setMappedCategories(freshCategories);
        const interaction: ConversationInteraction = {
          question,
          answer,
          mappedCategory: categoryNameToCheck,
          categoryId: categoryIdToCheck,
          timestamp: new Date().toISOString(),
          mappingOutcome: "already_mapped",
          noMapReason: "",
          matchedToCategory: categoryNameToCheck,
          matchedToSequenceIndex: null,
          specificStamp: specificStamp ?? undefined,
        };
        const interactionId = await saveConversationInteraction(interaction, turnJustification);
        savePassportMappingToFirestore(
          interactionId,
          categoryNameToCheck,
          categoryIdToCheck,
          turnJustification,
          specificStamp ?? undefined
        );
        if (specificStamp && turnJustification) {
          const existing = await getCachedJustifications(categoryIdToCheck, specificStamp);
          const justificationsToCache = existing.includes(turnJustification)
            ? existing
            : [...existing, turnJustification];
          cacheJustifications(categoryIdToCheck, specificStamp, justificationsToCache);
        }
        setInteractions((prev) => [...prev, interaction]);

        if (tierChange && specificStamp) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
          setStampTierUpgrade({
            stamp: specificStamp,
            category: categoryNameToCheck,
            categoryId: categoryIdToCheck,
            previousTier: tierChange.previousTier,
            newTier: tierChange.newTier,
          });
          setDeferredNextQuestion(isAddDetail ? null : (nextQuestion ?? null));
          setDeferredCheckCompletion(false);
          setUiState("idle");

          if (result.suggestArtifactUpload && evidenceTier == null && !isAddDetail) {
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
            mapped: false as const,
            category: categoryNameToCheck,
            interactionId,
            distressSignal,
            stampTierUpgrade: {
              stamp: specificStamp,
              category: categoryNameToCheck,
              categoryId: categoryIdToCheck,
              previousTier: tierChange.previousTier,
              newTier: tierChange.newTier,
            },
          };
        }

        if (specificStamp) {
          if (!isSensitive) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
          }
          setNewStampUnlock({
            stamp: specificStamp,
            category: categoryNameToCheck,
            categoryId: categoryIdToCheck,
            tier: effectiveInitialTier,
            sensitive: isSensitive,
          });
          setCurrentPrompt("");
          if (isAddDetail) {
            setDeferredNextQuestion(null);
            setDeferredCheckCompletion(false);
            setUiState("idle");
          } else {
            setDeferredNextQuestion(nextQuestion ?? null);
            setDeferredCheckCompletion(countUnlockedStamps(freshCategories) >= TOTAL_STAMPS);
            setUiState("idle");
          }

          if (result.suggestArtifactUpload && evidenceTier == null && !isAddDetail) {
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
            mapped: false as const,
            category: categoryNameToCheck,
            interactionId,
            distressSignal,
          };
        }

        if (result.suggestArtifactUpload && evidenceTier == null && !isAddDetail) {
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
        if (isAddDetail) {
          finishAddDetailTurn(turnJustification);
          return {
            mapped: false as const,
            category: categoryNameToCheck,
            interactionId,
            distressSignal,
          };
        }
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
        noMapReason: "weak_fit",
        matchedToCategory: null,
        matchedToSequenceIndex: null,
      };
      const interactionId = await saveConversationInteraction(interaction, strippedJustification);
      setInteractions((prev) => [...prev, interaction]);
      if (isAddDetail) {
        finishAddDetailTurn(strippedJustification || "Detail recorded.");
        return { mapped: false as const, category: null, interactionId, distressSignal };
      }
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
      setUserAnswer("");
      return;
    }

    if (prefetchedQuestion) {
      setCurrentPrompt(prefetchedQuestion);
      setPrefetchedQuestion(null);
      setUserAnswer("");
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
      setUserAnswer("");
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

  const handleInputPress = (targetUI: UIState) => {
    setError("");
    if (currentPrompt) {
      setTimeout(() => setUiState(targetUI), 100);
      return;
    }
    if (mappedCategories.length === 0) {
      setCurrentPrompt(INITIAL_PROMPT);
      setTimeout(() => setUiState(targetUI), 100);
    } else if (prefetchedQuestion) {
      setCurrentPrompt(prefetchedQuestion);
      setPrefetchedQuestion(null);
      setTimeout(() => setUiState(targetUI), 100);
    } else {
      setError("No question available. Please try again.");
    }
  };

  const handleTextInputPress = () => handleInputPress("answering");
  const handleVoiceInputPress = () => handleInputPress("voice-recording");

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

  const handleSubmitAnswer = () => {
    if (!userAnswer.trim()) {
      Alert.alert(
        "Empty Text Error",
        "Cannot evaluate an empty text field. Please provide a valid response."
      );
      setError("Answer cannot be empty. Please provide a substantive response.");
      return;
    }

    if (containsInappropriateLanguage(userAnswer)) {
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
    setUiState("answering");
  };

  const triggerContentWarning = (message?: string) => {
    setWeakFitJustification(
      message ?? "That image couldn't be used because it contains inappropriate content."
    );
    setContentWarning(true);
    setUiState("weak-fit");
  };

  // Regenerate and prefetch the next question (abortable); `region` scopes the taxonomy.
  const synthesizeAndPrefetch = async (
    context?: Parameters<typeof GeminiService.synthesizeNextQuestion>[3],
    region?: string
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
        region ? getFilteredTaxonomyString(region) : getTaxonomyString(),
        context,
        controller.signal,
        region
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

  const handleWeakFitNewQuestion = async (region?: string) => {
    setWeakFitJustification("");
    setContentWarning(false);
    setSavedAnswer("");
    setSavedQuestion("");
    await synthesizeAndPrefetch(
      {
        embeddingHistorySummary: pdfContextRef.current,
        avoidQuestion: currentPrompt || undefined,
      },
      region
    );
  };

  // Skip: re-roll with an "avoid this" signal; `region` keeps it scoped to the active flow.
  const handleSkipQuestion = async (region?: string) => {
    await synthesizeAndPrefetch(
      {
        avoidQuestion: currentPrompt || undefined,
        embeddingHistorySummary: pdfContextRef.current,
      },
      region
    );
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

  const clearStampTierUpgrade = () => {
    setStampTierUpgrade(null);
  };

  const clearAddDetailReview = () => {
    setAddDetailReview(null);
  };

  const dismissCrisisSupport = () => {
    setShowCrisisSupport(false);
  };

  const dismissSensitiveIntro = () => {
    setShowSensitiveIntro(false);
  };

  const continueAfterDeferredModal = () => {
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

  const continueAfterStampUnlock = () => continueAfterDeferredModal();
  const continueAfterStampTierUpgrade = () => {
    clearStampTierUpgrade();
    continueAfterDeferredModal();
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
    stampTierUpgrade,
    clearStampTierUpgrade,
    continueAfterStampTierUpgrade,
    addDetailReview,
    clearAddDetailReview,
  };
}
