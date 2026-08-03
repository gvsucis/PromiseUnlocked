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
  newTopic?: boolean;
  avoidQuestion?: string;
  exploredStamps?: string[];
}

export interface MappedCategory {
  category: string;
  categoryId?: string;
  timesMapped?: number;
}

export type NoMapReason =
  | ""
  | "weak_fit"
  | "inappropriate_content"
  | "responsive_negative"
  | "same_experience_repeated";

const NO_MAP_PREFIXES: Array<{ prefix: string; reason: NoMapReason }> = [
  { prefix: "INAPPROPRIATE_CONTENT:", reason: "inappropriate_content" },
  { prefix: "RESPONSIVE_NEGATIVE:", reason: "responsive_negative" },
  { prefix: "SAME_EXPERIENCE_REPEATED:", reason: "same_experience_repeated" },
];

export function noMapReasonFromPrefix(justification?: string): NoMapReason {
  if (!justification) return "";
  const hit = NO_MAP_PREFIXES.find((p) => justification.startsWith(p.prefix));
  return hit ? hit.reason : "";
}

export function stripNoMapPrefix(justification?: string): string {
  if (!justification) return "";
  const hit = NO_MAP_PREFIXES.find((p) => justification.startsWith(p.prefix));
  return hit ? justification.slice(hit.prefix.length).trim() : justification.trim();
}

export function normalizeJustification(justification?: string, maxLength = 300): string {
  const text = stripNoMapPrefix(justification);
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

export interface MapAnswerResponse {
  category: string;
  justification?: string;
  noMapReason?: NoMapReason;
  nextQuestion?: string | null;
  suggestArtifactUpload?: boolean;
  artifactUploadReason?: string;
  specificStamp?: string;
  initialTier?: number;
  proofTier?: number;
  [key: string]: unknown;
  distressSignal?: boolean;
  sensitiveExperience?: boolean;
}
