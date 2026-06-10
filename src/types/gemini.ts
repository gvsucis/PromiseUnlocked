type GeminiErrorCode = "RATE_LIMIT" | "AUTH" | "NETWORK" | "API" | "UNKNOWN";

export interface GeminiError {
  code: GeminiErrorCode;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

export interface GeminiResult<T> {
  ok: boolean;
  data?: T;
  error?: GeminiError;
}

export interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
}

export interface DialogueInteraction {
  question: string;
  answer: string;
  mappedCategory: string;
}

export interface QuestionSynthesisContext {
  latestQuestion?: string;
  latestAnswer?: string;
  embeddingHistorySummary?: string;
}

export interface MappedCategory {
  category: string;
  timesMapped?: number;
}

export interface MapAnswerResponse {
  category: string;
  justification?: string;
  nextQuestion?: string | null;
  suggestArtifactUpload?: boolean;
  artifactUploadReason?: string;
  specificStamp?: string;
  [key: string]: unknown;
}
