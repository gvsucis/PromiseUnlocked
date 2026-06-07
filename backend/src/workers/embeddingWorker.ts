import { GoogleGenAI } from "@google/genai";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import path from "node:path";

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
  const texts: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    texts.push(pageText);
  }
  return texts.join("\n\n--- Page ---\n\n");
}

export async function generatePdfEmbedding(pdfBytes: Uint8Array, fallbackText: string): Promise<number[]> {
  const embedModel = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-2";
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
  });
  const vector = fallback.embeddings?.[0]?.values ?? null;
  if (!vector) {
    throw new Error("Empty embedding response");
  }
  return vector;
}
