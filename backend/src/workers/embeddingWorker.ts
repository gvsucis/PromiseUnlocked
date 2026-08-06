import { GoogleGenAI } from "@google/genai";
import { getDocumentProxy } from "unpdf";

// Must match DEFAULT_OUTPUT_DIMENSIONALITY in embeddingService.ts so that
// document vectors and query vectors occupy the same space for cosine search.
export const EMBEDDING_DIMENSIONALITY = 768;

let ai: GoogleGenAI | undefined;

function getAi(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export async function extractTextFromPdfBuffer(buffer: Uint8Array, maxPages = 12): Promise<string> {
  // unpdf bundles a serverless (canvas-free) pdf.js build, so no font URL or
  // CJS/ESM interop handling is needed.
  const pdf = await getDocumentProxy(buffer);
  const pages = Math.min(maxPages, pdf.numPages);

  const pageTexts: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }

  return pageTexts.join("\n\n--- Page ---\n\n");
}

// One budget for stored + embedded text, so the vector matches what we persist.
export const EMBEDDING_TEXT_MAX_CHARS = 8000;

export function truncateForEmbedding(text: string): string {
  if (text.length <= EMBEDDING_TEXT_MAX_CHARS) return text;
  const cut = text.lastIndexOf(" ", EMBEDDING_TEXT_MAX_CHARS);
  return text.slice(0, cut > 0 ? cut : EMBEDDING_TEXT_MAX_CHARS);
}

export async function generateTextEmbedding(text: string): Promise<number[]> {
  const embedModel = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-2";
  const trimmed = truncateForEmbedding(text);

  if (!trimmed.trim()) {
    throw new Error("Cannot generate embedding — no extractable text content.");
  }

  const response = await getAi().models.embedContent({
    model: embedModel,
    contents: trimmed,
    config: {
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: EMBEDDING_DIMENSIONALITY,
    },
  });
  const vector = response.embeddings?.[0]?.values ?? null;
  if (!vector) {
    throw new Error("Empty embedding response");
  }
  return vector;
}
