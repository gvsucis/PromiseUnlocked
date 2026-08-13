import type { MappedCategory, ConversationInteraction } from "../services/categoryTaxonomyService";

export interface UserFact {
  id: string;
  factType: string;
  factValue: string;
  factStatement: string;
  category?: string;
  confidence: "high" | "medium" | "low";
  status: "verified" | "pending" | "conflicting" | "corrected";
  extractedAt: number;
  verificationCount: number;
}

export interface FactConflict {
  id: string;
  existingFactStatement: string;
  existingFactValue: string;
  newValue: string;
  conflictType: "contradiction" | "refinement" | "clarification";
  severity: "high" | "medium" | "low";
  status: "pending" | "resolved" | "ignored";
}

export interface SkillsGap {
  category: string;
  skill: string;
  importance: "required" | "recommended" | "optional";
  isVerified: boolean;
  suggestedQuestions: string[];
  priority: number;
}

export interface MemoryContext {
  relevantFacts: UserFact[];
  recentFacts: UserFact[];
  hasConflicts: boolean;
  categoriesMapped: string[];
  categoriesRemaining: string[];
  skillGapsCount: number;
}

export interface ConversationTurnResult {
  action: "ask_question" | "clarify_conflict" | "complete";
  nextQuestion?: string;
  targetCategory?: string;
  targetSkill?: string;
  clarificationPrompt?: string;
  conflicts?: FactConflict[];
  memoryContext: MemoryContext;
  reasoning: string;
}

export interface ProcessTurnParams {
  sessionId: string;
  interactionId: string;
  currentQuestion: string;
  userResponse: string;
  inputMethod?: "text" | "voice" | "image";
  categoriesMapped: string[];
}

export interface ResolveConflictParams {
  conflictId: string;
  resolution: "update" | "reject" | "merge";
  correctedValue?: string;
  note?: string;
}

export interface UseMemoryConversationReturn {
  isProcessing: boolean;
  error: string | null;
  memoryContext: MemoryContext | null;
  pendingConflicts: FactConflict[];

  processTurn: (params: ProcessTurnParams) => Promise<ConversationTurnResult>;

  resolveConflict: (params: ResolveConflictParams) => Promise<boolean>;

  fetchPendingConflicts: () => Promise<FactConflict[]>;
  fetchMemoryContext: (sessionId: string) => Promise<MemoryContext | null>;

  clearError: () => void;
  resetMemory: () => void;
}

export type UIState =
  | "idle"
  | "answering"
  | "loading"
  | "complete"
  | "weak-fit"
  | "voice-recording";

export interface StampUnlockInfo {
  stamp: string;
  category: string;
  categoryId: string;
  tier: number;
  sensitive: boolean;
}

export interface StampTierUpgrade {
  stamp: string;
  category: string;
  categoryId: string;
  previousTier: number;
  newTier: number;
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
      stampTierUpgrade?: StampTierUpgrade;
    };

export interface DialogueState {
  // State
  continueAfterStampTierUpgrade: () => void;
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
  newStampUnlock: StampUnlockInfo | null;
  stampTierUpgrade: StampTierUpgrade | null;
  clearStampTierUpgrade: () => void;
  addDetailReview: { justification: string } | null;
  clearAddDetailReview: () => void;
  showCrisisSupport: boolean;
  dismissCrisisSupport: () => void;
  showSensitiveIntro: boolean;
  dismissSensitiveIntro: () => void;
  pendingProofRequest: ProofRequest | null;
  pendingProofNotification: ProofNotification | null;

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
    evidenceTier?: number,
    isAddDetail?: boolean
  ) => Promise<DialogueMapResult>;
  handleStartButtonPress: () => Promise<void>;
  handleForceNewQuestion: () => Promise<void>;
  handleTextInputPress: () => void;
  handleVoiceInputPress: () => void;
  prepareImageQuestion: () => boolean;
  handleSubmitAnswer: () => void;
  handleWeakFitTryAgain: () => void;
  handleWeakFitNewQuestion: (region?: string) => Promise<void>;
  handleSkipQuestion: (region?: string) => Promise<void>;
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

/**
 * A proof request raised when an answer is strong enough that an uploaded
 * artifact (photo, document) would upgrade the unlocked stamp's tier.
 */
export interface ProofRequest {
  question: string;
  answer: string;
  interactionId: string;
  category: string;
  categoryId?: string;
  stampName?: string;
  artifactUploadReason?: string;
  proofTier?: number;
}

/**
 * The dismissible banner shown after a stamp-unlock modal, inviting the user
 * to act on a deferred {@link ProofRequest}.
 */
export interface ProofNotification {
  artifactUploadReason: string;
  stampName: string;
  proofTier: number;
  category: string;
  categoryId?: string;
}

/**
 * Owns the proof-request workflow that previously lived as four atoms inside
 * useDialogueState. The interface is small; the deferral bookkeeping — holding
 * a request behind a stamp-unlock modal, surfacing it as a notification, and
 * promoting it to an active request — is hidden behind it.
 *
 * Lifecycle:
 *   requestNow(r)                      → active request (immediate path)
 *   deferAfterUnlock(r) → surfaceDeferred() → notification → activateFromNotification() → active request
 */
export interface ProofWorkflow {
  /** Active request — drives the proof-upload modal. */
  proofRequest: ProofRequest | null;
  /** Pending banner — drives the proof notification. */
  proofNotification: ProofNotification | null;
  /** Raise a proof request immediately (no stamp-unlock modal in the way). */
  requestNow: (request: ProofRequest) => void;
  /** Hold a proof request behind an in-progress stamp-unlock modal. */
  deferAfterUnlock: (request: ProofRequest) => void;
  /** Promote any held request into a notification. No-op when nothing is held. */
  surfaceDeferred: () => void;
  /** Drop a held request without surfacing it (e.g. on dialogue completion). */
  clearDeferred: () => void;
  /** Turn the current notification into an active request. */
  activateFromNotification: () => void;
  /** Dismiss the active request. */
  clearRequest: () => void;
  /** Dismiss the notification. */
  clearNotification: () => void;
}
