import { GoogleGenAI } from "@google/genai";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import path from "node:path";

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

const PDF_STANDARD_FONT_URL =
  path.resolve(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/").replace(/\\/g, "/") + "/";

export async function extractTextFromPdfBuffer(buffer: Uint8Array, maxPages = 12): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({
    data: buffer,
    disableFontFace: true,
    useSystemFonts: false,
    standardFontDataUrl: PDF_STANDARD_FONT_URL,
  });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pages = Math.min(maxPages, totalPages);

  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1);
  const pageTexts = await Promise.all(
    pageNumbers.map(async (i) => {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      return content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    })
  );

  return pageTexts.join("\n\n--- Page ---\n\n");
}

export async function generatePdfEmbedding(
  pdfBytes: Uint8Array,
  fallbackText: string
): Promise<number[]> {
  const embedModel = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-2";

  // RETRIEVAL_DOCUMENT signals to the model that this vector will be indexed
  // and searched against RETRIEVAL_QUERY vectors (used on the search side).
  // outputDimensionality must match the query side (768) for cosine search to work.
  try {
    const response = await getAi().models.embedContent({
      model: embedModel,
      contents: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: Buffer.from(pdfBytes).toString("base64"),
          },
        },
      ],
      config: {
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: EMBEDDING_DIMENSIONALITY,
      },
    });
    const values = response.embeddings?.[0]?.values;
    if (values?.length) {
      return values;
    }
  } catch (error) {
    console.warn("PDF inlineData embedding failed, falling back to text embedding:", error);
  }

  const fallback = await getAi().models.embedContent({
    model: embedModel,
    contents: fallbackText,
    config: {
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: EMBEDDING_DIMENSIONALITY,
    },
  });
  const vector = fallback.embeddings?.[0]?.values ?? null;
  if (!vector) {
    throw new Error("Empty embedding response");
  }
  return vector;
}
