import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { EMBEDDING_DIMENSIONALITY } from "@/workers/embeddingWorker";

const FALLBACK_MODEL = "gemini-embedding-2";
const DEFAULT_OUTPUT_DIMENSIONALITY = EMBEDDING_DIMENSIONALITY;

export type EmbeddingVector = number[];

export interface EmbeddingServiceOptions {
  apiKey?: string;
  model?: string;
  defaultOutputDimensionality?: number;
}

export interface EmbeddingService {
  generateEmbedding(
    text: string,
    options?: { outputDimensionality?: number }
  ): Promise<EmbeddingVector>;
  getModelName(): string;
}

let sharedClient: GoogleGenAI | undefined;

function getApiKey(providedKey?: string): string {
  const apiKey = providedKey ?? process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  return apiKey;
}

function getClient(apiKey: string): GoogleGenAI {
  if (apiKey !== process.env.GEMINI_API_KEY) {
    return new GoogleGenAI({ apiKey });
  }

  sharedClient ??= new GoogleGenAI({ apiKey });
  return sharedClient;
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function isModelNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("is not found") && error.message.includes("models/");
}

function extractEmbeddingValues(response: unknown): EmbeddingVector {
  const payload = response as {
    embeddings?: Array<{ values?: number[] }>;
    embedding?: { values?: number[] };
  };

  const values = payload.embeddings?.[0]?.values ?? payload.embedding?.values;
  if (!values?.length) {
    throw new Error("Gemini embedding response did not include vector values.");
  }

  return values;
}

/**
 * Creates a Google Gen AI embedding service for user response history.
 */
export function createEmbeddingService(options: EmbeddingServiceOptions = {}): EmbeddingService {
  const model = options.model ?? process.env.GEMINI_EMBEDDING_MODEL ?? FALLBACK_MODEL;
  const defaultDim = options.defaultOutputDimensionality ?? DEFAULT_OUTPUT_DIMENSIONALITY;

  return {
    async generateEmbedding(
      text: string,
      opts?: { outputDimensionality?: number }
    ): Promise<EmbeddingVector> {
      const input = normalizeText(text);
      if (!input) {
        throw new Error("Text is required to generate an embedding.");
      }

      const ai = getClient(getApiKey(options.apiKey));
      const outputDimensionality = opts?.outputDimensionality ?? defaultDim;
      let response;
      try {
        response = await ai.models.embedContent({
          model,
          contents: input,
          config: {
            outputDimensionality,
            taskType: "RETRIEVAL_QUERY",
          },
        });
      } catch (error) {
        if (!isModelNotFoundError(error) || model === FALLBACK_MODEL) {
          throw error;
        }

        console.warn(`Embedding model '${model}' not found. Retrying with '${FALLBACK_MODEL}'.`);
        response = await ai.models.embedContent({
          model: FALLBACK_MODEL,
          contents: input,
          config: {
            outputDimensionality,
            taskType: "RETRIEVAL_QUERY",
          },
        });
      }

      return extractEmbeddingValues(response);
    },
    getModelName(): string {
      return model;
    },
  };
}

export const embeddingService = createEmbeddingService();
