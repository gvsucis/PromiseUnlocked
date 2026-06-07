import { GoogleGenAI } from "@google/genai";
import type { ProofStatus, ProofTier } from "@/types/firestore";
import { clampConfidence, normalizeProofStatus, resolveProofTier } from "@/services/proofUtils";

const PROOF_MODEL = process.env.GEMINI_PROOF_MODEL ?? "gemini-2.5-flash-lite";

type RawProofVerificationPayload = {
  proofStatus?: unknown;
  verificationConfidence?: unknown;
  userFeedbackMessage?: unknown;
  requiredAction?: unknown;
};

export interface ProofVerificationResult {
  proofStatus: ProofStatus;
  verificationConfidence: number;
  userFeedbackMessage: string;
  requiredAction: string;
  proofTier: ProofTier;
}

let sharedGenAiClient: GoogleGenAI | null = null;

function getGenAiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  sharedGenAiClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  return sharedGenAiClient;
}

function extractJsonObject(raw: string): RawProofVerificationPayload {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Gemini response did not include a valid JSON object.");
  }

  return JSON.parse(trimmed.slice(start, end + 1)) as RawProofVerificationPayload;
}

function toSafeString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim();
  return cleaned.length ? cleaned : fallback;
}

export async function verifyProofImage(params: {
  question: string;
  answer: string;
  mimeType: string;
  imageBase64: string;
}): Promise<ProofVerificationResult> {
  const ai = getGenAiClient();

  const prompt = [
    "You are validating whether the provided image is credible supporting proof for a user's answer.",
    "Respond with STRICT JSON only. No markdown and no extra text.",
    'Required JSON shape: {"proofStatus":"approved|rejected|needs_more_evidence","verificationConfidence":0..1,"userFeedbackMessage":"string","requiredAction":"string"}',
    "Use approved only if the image clearly supports the claim.",
    "Use needs_more_evidence if partially relevant or ambiguous.",
    "Use rejected if unrelated or contradictory.",
    `Question: ${params.question}`,
    `Answer: ${params.answer}`,
  ].join("\n");

  const response = await ai.models.generateContent({
    model: PROOF_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: params.mimeType,
              data: params.imageBase64,
            },
          },
        ],
      },
    ],
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const rawText = response.text ?? "";
  const parsed = extractJsonObject(rawText);

  const proofStatus = normalizeProofStatus(parsed.proofStatus);
  const verificationConfidence = clampConfidence(parsed.verificationConfidence);
  const proofTier = resolveProofTier(proofStatus, verificationConfidence);

  return {
    proofStatus,
    verificationConfidence,
    userFeedbackMessage: toSafeString(
      parsed.userFeedbackMessage,
      proofStatus === "approved"
        ? "Proof accepted. Great evidence."
        : "Proof needs improvement. Please upload clearer supporting evidence."
    ),
    requiredAction: toSafeString(
      parsed.requiredAction,
      proofStatus === "approved"
        ? "No further action required."
        : "Upload clearer or more specific proof."
    ),
    proofTier,
  };
}

export function encodeProofImageBuffer(buffer: Buffer): string {
  return buffer.toString("base64");
}
