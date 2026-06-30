import { GoogleGenAI } from "@google/genai";

const BRIEF_MODEL = process.env.GEMINI_PERSONA_MODEL ?? "gemini-2.5-flash-lite";
const MAX_SOURCE_CHARS = 12000;

let sharedGenAiClient: GoogleGenAI | null = null;

function getGenAiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  sharedGenAiClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return sharedGenAiClient;
}

// Compact persona brief for steering question phrasing only (never scoring);
// excludes protected attributes to avoid biasing evaluation.
export async function distillPersonaBrief(extractedText: string): Promise<string> {
  const source = extractedText.trim();
  if (!source) throw new Error("Cannot distill persona brief from empty text.");

  const ai = getGenAiClient();
  const prompt = [
    "You are summarizing a personality analysis into a compact brief that will guide how a",
    "conversational agent phrases its questions (tone, topics, motivators) — NOT how it scores answers.",
    "Write at most ~120 words as short labeled lines. Do not invent details not supported by the text.",
    "Cover: Traits, Interests, CommunicationStyle, Motivators, StrengthAreas.",
    "Exclude any demographic or protected attributes (age, gender, race/ethnicity, religion, disability, nationality).",
    "Plain text only, no markdown headers.",
    "",
    "PERSONALITY ANALYSIS:",
    source.slice(0, MAX_SOURCE_CHARS),
  ].join("\n");

  const response = await ai.models.generateContent({
    model: BRIEF_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { temperature: 0.2 },
  });

  const brief = (response.text ?? "").trim();
  if (!brief) throw new Error("Persona brief generation returned empty text.");
  return brief;
}
