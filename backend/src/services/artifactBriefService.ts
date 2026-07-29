import { GoogleGenAI } from "@google/genai";
import { admin, db } from "@/services/firestore";
import type { UserArtifact } from "@/types/firestore";

const BRIEF_MODEL = process.env.GEMINI_PERSONA_MODEL ?? "gemini-2.5-flash-lite";
const MAX_SOURCE_CHARS = 15000;

let sharedGenAiClient: GoogleGenAI | null = null;

function getGenAiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  sharedGenAiClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return sharedGenAiClient;
}

async function collectReadyArtifactTexts(userId: string): Promise<string[]> {
  const snapshot = await db
    .collection("users")
    .doc(userId)
    .collection("artifacts")
    .where("embeddingsStatus", "==", "ready")
    .select("extractedText", "fileName", "kind")
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as Pick<UserArtifact, "extractedText" | "fileName" | "kind">;
      const header = `--- ${data.fileName}${data.kind ? ` (${data.kind})` : ""} ---`;
      return `${header}\n${(data.extractedText ?? "").trim()}`;
    })
    .filter((block) => block.length > headerLength(block));
}

function headerLength(block: string): number {
  const newlineIdx = block.indexOf("\n");
  return newlineIdx > 0 ? newlineIdx + 1 : 0;
}

export async function regenerateArtifactBrief(userId: string): Promise<string | null> {
  const textBlocks = await collectReadyArtifactTexts(userId);
  if (textBlocks.length === 0) {
    await db.collection("users").doc(userId).set(
      {
        artifactBrief: null,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    return null;
  }

  const combined = textBlocks.join("\n\n");
  const source = combined.slice(0, MAX_SOURCE_CHARS);

  const ai = getGenAiClient();
  const prompt = [
    "You are summarizing a student's uploaded documents (essays, citations, transcripts, etc.)",
    "into a compact experience brief that will guide how a conversational agent for college admissions",
    "understands the student's background, skills, achievements, and experiences.",
    "",
    "Write at most ~200 words as short labeled lines covering:",
    "- AcademicInterests: subjects or fields the student cares about",
    "- Skills: concrete skills demonstrated (leadership, research, writing, etc.)",
    "- ExperienceAreas: specific activities, projects, roles, or contexts",
    "- Achievements: awards, recognitions, notable outcomes",
    "- Background: relevant context about their journey or motivation",
    "",
    "Do NOT include demographic or protected attributes (age, gender, race/ethnicity, religion, disability, nationality).",
    "Do not invent details not supported by the documents. Be specific and grounded.",
    "If a section has nothing to report, omit it entirely rather than writing generic filler.",
    "Plain text only, no markdown headers.",
    "",
    "STUDENT DOCUMENTS:",
    source,
  ].join("\n");

  try {
    const response = await ai.models.generateContent({
      model: BRIEF_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.2 },
    });

    const brief = (response.text ?? "").trim();
    if (!brief) {
      console.warn(`[ArtifactBrief] Generation returned empty for user ${userId}`);
      return null;
    }

    await db.collection("users").doc(userId).set(
      {
        artifactBrief: brief,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    console.log(`[ArtifactBrief] Regenerated for user ${userId} (${textBlocks.length} artifacts)`);
    return brief;
  } catch (err) {
    console.error(`[ArtifactBrief] Generation failed for user ${userId}:`, err);
    return null;
  }
}

export async function getArtifactBrief(userId: string): Promise<string | null> {
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) return null;
  const data = snap.data() as { artifactBrief?: string | null } | undefined;
  return data?.artifactBrief ?? null;
}
