import { useState, useCallback, useRef, useEffect } from "react";
import { auth } from "../config/firebase";
import { CONFIG } from "../config/env";
import { useAuth } from "../context/AuthContext";
import type {
  FactConflict,
  MemoryContext,
  ConversationTurnResult,
  UseMemoryConversationReturn,
  ProcessTurnParams,
  ResolveConflictParams,
} from "../types/hooks";

export type {
  UserFact,
  FactConflict,
  SkillsGap,
  MemoryContext,
  ConversationTurnResult,
  UseMemoryConversationReturn,
} from "../types/hooks";

async function getAuthToken(): Promise<string | null> {
  return auth.currentUser?.getIdToken() ?? null;
}

export function useMemoryConversation(): UseMemoryConversationReturn {
  const { session } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoryContext, setMemoryContext] = useState<MemoryContext | null>(null);
  const [pendingConflicts, setPendingConflicts] = useState<FactConflict[]>([]);

  const previousQuestionsRef = useRef<string[]>([]);

  const getAuthHeaders = useCallback(async () => {
    const token = await getAuthToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const isAuthenticated = session.mode === "authenticated";

  const processTurn = useCallback(
    async ({
      sessionId,
      interactionId,
      currentQuestion,
      userResponse,
      inputMethod = "text",
      categoriesMapped,
    }: ProcessTurnParams): Promise<ConversationTurnResult> => {
      if (!isAuthenticated) {
        throw new Error("User not authenticated");
      }

      setIsProcessing(true);
      setError(null);

      try {
        const headers = await getAuthHeaders();

        const response = await fetch(`${CONFIG.API_BASE_URL}/api/memory/conversation-turn`, {
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

        setMemoryContext(result.memoryContext);

        if (result.nextQuestion) {
          previousQuestionsRef.current.push(result.nextQuestion);
        }

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
    [isAuthenticated, getAuthHeaders]
  );

  const resolveConflict = useCallback(
    async ({
      conflictId,
      resolution,
      correctedValue,
      note,
    }: ResolveConflictParams): Promise<boolean> => {
      if (!isAuthenticated) {
        throw new Error("User not authenticated");
      }

      setIsProcessing(true);
      setError(null);

      try {
        const headers = await getAuthHeaders();

        const response = await fetch(
          `${CONFIG.API_BASE_URL}/api/memory/conflicts/${conflictId}/resolve`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              resolution,
              correctedValue,
              note,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to resolve conflict");
        }

        const result = await response.json();

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
    [isAuthenticated, getAuthHeaders]
  );

  const fetchPendingConflicts = useCallback(async (): Promise<FactConflict[]> => {
    if (!isAuthenticated) {
      throw new Error("User not authenticated");
    }

    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${CONFIG.API_BASE_URL}/api/memory/conflicts`, {
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
  }, [isAuthenticated, getAuthHeaders]);

  const fetchMemoryContext = useCallback(
    async (sessionId: string): Promise<MemoryContext | null> => {
      if (!isAuthenticated) {
        throw new Error("User not authenticated");
      }

      try {
        const headers = await getAuthHeaders();

        const response = await fetch(`${CONFIG.API_BASE_URL}/api/memory/context/${sessionId}`, {
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
    [isAuthenticated, getAuthHeaders]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetMemory = useCallback(() => {
    setMemoryContext(null);
    setPendingConflicts([]);
    previousQuestionsRef.current = [];
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPendingConflicts().catch(console.error);
    }
  }, [isAuthenticated, fetchPendingConflicts]);

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
