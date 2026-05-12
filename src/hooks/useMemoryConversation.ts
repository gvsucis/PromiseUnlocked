/**
 * React Native Hook: Memory-Enabled Conversation
 *
 * This hook provides a stateful interface to the RAG-based long-term memory system.
 * It handles:
 * - Fact extraction and storage
 * - Conflict detection and resolution
 * - Taxonomy-driven question generation
 * - Memory context management
 */

import { useState, useCallback, useRef, useEffect } from "react";

type AuthContextValue = {
  user: Record<string, unknown> | null;
  getAuthToken: () => Promise<string | null>;
};

const useAuth = (): AuthContextValue => ({
  user: null,
  getAuthToken: async () => null,
});

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || process.env.REACT_NATIVE_API_BASE_URL || "";

// Types matching the backend API
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

export interface UseMemoryConversationReturn {
  // State
  isProcessing: boolean;
  error: string | null;
  memoryContext: MemoryContext | null;
  pendingConflicts: FactConflict[];

  // Actions
  processTurn: (params: {
    sessionId: string;
    interactionId: string;
    currentQuestion: string;
    userResponse: string;
    inputMethod?: "text" | "voice" | "image";
    categoriesMapped: string[];
  }) => Promise<ConversationTurnResult>;

  resolveConflict: (params: {
    conflictId: string;
    resolution: "update" | "reject" | "merge";
    correctedValue?: string;
    note?: string;
  }) => Promise<boolean>;

  fetchPendingConflicts: () => Promise<FactConflict[]>;
  fetchMemoryContext: (sessionId: string) => Promise<MemoryContext | null>;

  // Helpers
  clearError: () => void;
  resetMemory: () => void;
}

export function useMemoryConversation(): UseMemoryConversationReturn {
  const { user, getAuthToken } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoryContext, setMemoryContext] = useState<MemoryContext | null>(null);
  const [pendingConflicts, setPendingConflicts] = useState<FactConflict[]>([]);

  // Cache for previous questions to avoid repetition
  const previousQuestionsRef = useRef<string[]>([]);

  const getAuthHeaders = useCallback(async () => {
    const token = await getAuthToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, [getAuthToken]);

  /**
   * Process a conversation turn with memory
   */
  const processTurn = useCallback(
    async ({
      sessionId,
      interactionId,
      currentQuestion,
      userResponse,
      inputMethod = "text",
      categoriesMapped,
    }: {
      sessionId: string;
      interactionId: string;
      currentQuestion: string;
      userResponse: string;
      inputMethod?: "text" | "voice" | "image";
      categoriesMapped: string[];
    }): Promise<ConversationTurnResult> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      setIsProcessing(true);
      setError(null);

      try {
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/api/memory/conversation-turn`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            sessionId,
            interactionId,
            currentQuestion,
            userResponse,
            inputMethod,
            categoriesMapped,
            previousQuestions: previousQuestionsRef.current.slice(-10),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to process conversation turn");
        }

        const result: ConversationTurnResult = await response.json();

        // Update memory context
        setMemoryContext(result.memoryContext);

        // Cache the question if it's a new one
        if (result.nextQuestion) {
          previousQuestionsRef.current.push(result.nextQuestion);
        }

        // Update pending conflicts if any
        if (result.conflicts) {
          setPendingConflicts(result.conflicts);
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [user, getAuthHeaders]
  );

  /**
   * Resolve a conflict with user input
   */
  const resolveConflict = useCallback(
    async ({
      conflictId,
      resolution,
      correctedValue,
      note,
    }: {
      conflictId: string;
      resolution: "update" | "reject" | "merge";
      correctedValue?: string;
      note?: string;
    }): Promise<boolean> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      setIsProcessing(true);
      setError(null);

      try {
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/api/memory/conflicts/${conflictId}/resolve`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            resolution,
            correctedValue,
            note,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to resolve conflict");
        }

        const result = await response.json();

        // Remove resolved conflict from pending list
        if (result.success) {
          setPendingConflicts((prev) => prev.filter((c) => c.id !== conflictId));
        }

        return result.success;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [user, getAuthHeaders]
  );

  /**
   * Fetch pending conflicts for the user
   */
  const fetchPendingConflicts = useCallback(async (): Promise<FactConflict[]> => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/api/memory/conflicts`, {
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch conflicts");
      }

      const result = await response.json();
      setPendingConflicts(result.conflicts);
      return result.conflicts;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      throw err;
    }
  }, [user, getAuthHeaders]);

  /**
   * Fetch complete memory context for a session
   */
  const fetchMemoryContext = useCallback(
    async (sessionId: string): Promise<MemoryContext | null> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      try {
        const headers = await getAuthHeaders();

        const response = await fetch(`${API_BASE_URL}/api/memory/context/${sessionId}`, {
          headers,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch memory context");
        }

        const result = await response.json();

        const context: MemoryContext = {
          relevantFacts: result.verifiedFacts || [],
          recentFacts: [],
          hasConflicts: (result.pendingConflicts || []).length > 0,
          categoriesMapped: Object.keys(result.categoryProgress || {}).filter(
            (cat) => result.categoryProgress[cat].verified > 0
          ),
          categoriesRemaining: [],
          skillGapsCount: (result.skillGaps || []).length,
        };

        setMemoryContext(context);
        setPendingConflicts(result.pendingConflicts || []);

        return context;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      }
    },
    [user, getAuthHeaders]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetMemory = useCallback(() => {
    setMemoryContext(null);
    setPendingConflicts([]);
    previousQuestionsRef.current = [];
  }, []);

  // Fetch pending conflicts on mount
  useEffect(() => {
    if (user) {
      fetchPendingConflicts().catch(console.error);
    }
  }, [user, fetchPendingConflicts]);

  return {
    isProcessing,
    error,
    memoryContext,
    pendingConflicts,
    processTurn,
    resolveConflict,
    fetchPendingConflicts,
    fetchMemoryContext,
    clearError,
    resetMemory,
  };
}
