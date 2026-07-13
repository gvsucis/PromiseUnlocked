import axios from "axios";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { AnalysisResult, TranscriptAnalysis } from "../types";
import { CONFIG, getGeminiApiKey } from "../config/env";
import extractJson from "../utils/JsonExtract";
import {
  DialogueInteraction,
  GeminiApiResponse,
  GeminiError,
  GeminiResult,
  MapAnswerResponse,
  MappedCategory,
  QuestionSynthesisContext,
} from "../types/gemini";
import { Alert } from "react-native";
import { getStampUnlockSummary } from "./categoryStorageService";

export class GeminiService {
  private static readonly MODEL_NAME = CONFIG.TEXT_MODEL;
  // gemini-2.5-flash is a thinking model: for short, deterministic outputs the
  // internal reasoning can consume the whole token budget and truncate the
  // response (finishReason MAX_TOKENS). Disable thinking on those calls. Longer
  // analysis/extraction calls keep thinking, where it can improve quality.
  private static readonly DISABLE_THINKING = { thinkingBudget: 0 } as const;
  private static readonly MAX_VISION_IMAGE_BYTES = 450 * 1024;
  private static readonly VISION_WIDTH_STEPS = [900, 768, 640, 512] as const;
  private static readonly VISION_QUALITY_STEPS = [0.65, 0.55, 0.45, 0.35] as const;

  private static readonly requestQueue: Array<{
    resolve: (value: GeminiResult<GeminiApiResponse>) => void;
    reject: (error: unknown) => void;
    fn: () => Promise<GeminiResult<GeminiApiResponse>>;
  }> = [];
  private static isProcessing = false;

  private static processQueue(): void {
    if (this.isProcessing || this.requestQueue.length === 0) return;
    this.isProcessing = true;
    const { resolve, reject, fn } = this.requestQueue.shift()!;
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.isProcessing = false;
        this.processQueue();
      });
  }

  private static enqueueRequest(
    fn: () => Promise<GeminiResult<GeminiApiResponse>>
  ): Promise<GeminiResult<GeminiApiResponse>> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, fn });
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private static buildApiUrl(): string {
    const baseUrl = CONFIG.GEMINI_API_URL.replaceAll(/\/+$/g, "");
    const apiKey = encodeURIComponent(getGeminiApiKey());
    return `${baseUrl}/${this.MODEL_NAME}:generateContent?key=${apiKey}`;
  }

  private static sanitizeUrl(url: string): string {
    return url.replaceAll(/key=[^&]*/g, "key=***");
  }

  // Shared rate-limit backoff budget, keyed by the AbortSignal that flows
  // through one logical operation (e.g. a single dialogue answer: map ->
  // synthesize -> strict retry). Without this, each chained requestGemini call
  // runs its own multi-attempt backoff, so a sustained 429 could stack ~60s of
  // waiting before failing. The first retry to need it establishes a deadline;
  // every chained call sharing the signal then draws down the same budget.
  private static readonly retryDeadlines = new WeakMap<AbortSignal, number>();
  private static readonly TOTAL_RETRY_BUDGET_MS = 20000;

  private static retryDeadlineFor(signal?: AbortSignal): number {
    if (!signal) return Number.POSITIVE_INFINITY;
    const existing = this.retryDeadlines.get(signal);
    if (existing !== undefined) return existing;
    const deadline = Date.now() + this.TOTAL_RETRY_BUDGET_MS;
    this.retryDeadlines.set(signal, deadline);
    return deadline;
  }

  private static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 2,
    initialDelay: number = 2000,
    signal?: AbortSignal
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (signal?.aborted) {
        throw new Error("Request cancelled");
      }
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (this.isCancellation(error)) throw error;
        const delay = this.computeRetryDelay(error, attempt, initialDelay);
        if (delay < 0) throw error;
        // Stop stacking backoff once this operation's shared budget is spent.
        if (Date.now() + delay > this.retryDeadlineFor(signal)) {
          throw error;
        }
        console.log(
          `Rate limit/service busy. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  private static isCancellation(error: unknown): boolean {
    return (
      axios.isCancel(error) || (error instanceof Error && error.message === "Request cancelled")
    );
  }

  private static computeRetryDelay(error: unknown, attempt: number, initialDelay: number): number {
    if (!axios.isAxiosError(error)) return -1;

    const status = error.response?.status;
    const isRetryable = status === 429 || status === 503;
    if (!isRetryable) return -1;

    const retryAfterHeader = error.response?.headers?.["retry-after"];
    const retryAfterSeconds = Number(retryAfterHeader);
    const baseDelay =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : initialDelay * Math.pow(2, attempt);
    const jitter = Math.floor(Math.random() * 500);
    return baseDelay + jitter;
  }

  private static isRateLimitError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return false;

    const status = error.response?.status;
    if (status === 429) return true;

    const bodyText = JSON.stringify(error.response?.data ?? "").toLowerCase();
    const message = String(error.message ?? "").toLowerCase();
    const tooManyRequestsMarker = ["too", "many", "requests"].join("");

    return (
      bodyText.includes(tooManyRequestsMarker) ||
      bodyText.includes("resource_exhausted") ||
      bodyText.includes("quota") ||
      message.includes(tooManyRequestsMarker) ||
      message.includes("resource_exhausted")
    );
  }

  private static normalizeError(error: unknown): GeminiError {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const retryAfterHeader = error.response?.headers?.["retry-after"];
      const retryAfterSeconds = Number(retryAfterHeader);
      const retryAfterMs =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : undefined;

      if (this.isRateLimitError(error) || status === 429 || status === 503) {
        return {
          code: "RATE_LIMIT",
          message: "System busy at the moment. Please try again later.",
          retryable: true,
          retryAfterMs,
        };
      }

      if (status === 401 || status === 403) {
        return {
          code: "AUTH",
          message: "API key invalid or missing. Check your configuration.",
          retryable: false,
        };
      }

      if (error.request && !error.response) {
        return {
          code: "NETWORK",
          message: "Network error. Please check your internet connection.",
          retryable: true,
        };
      }

      return {
        code: "API",
        message: `API Error: ${status ?? "unknown"}${
          error.response?.data ? ` - ${JSON.stringify(error.response.data)}` : ""
        }`,
        retryable: false,
      };
    }

    return {
      code: "UNKNOWN",
      message: error instanceof Error ? error.message : "Unexpected error",
      retryable: false,
    };
  }

  private static async requestGemini(
    requestBody: Record<string, unknown>,
    timeout: number = CONFIG.REQUEST_TIMEOUT,
    signal?: AbortSignal
  ): Promise<GeminiResult<GeminiApiResponse>> {
    if (signal?.aborted) {
      return {
        ok: false,
        error: { code: "NETWORK", message: "Request cancelled", retryable: false },
      };
    }

    const doRequest = async () => {
      try {
        const apiUrl = this.buildApiUrl();
        const response = await this.retryWithBackoff(
          () =>
            axios.post<GeminiApiResponse>(apiUrl, requestBody, {
              headers: { "Content-Type": "application/json" },
              timeout,
              signal,
            }),
          4,
          3000,
          signal
        );

        return { ok: true, data: response.data };
      } catch (error) {
        return { ok: false, error: this.normalizeError(error) };
      }
    };

    return this.enqueueRequest(doRequest);
  }

  private static extractGeneratedText(
    responseData: GeminiApiResponse | undefined
  ): string | undefined {
    return responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  private static toOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      return undefined;
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private static toRequiredString(value: unknown): string {
    return this.toOptionalString(value) ?? "";
  }

  private static parseJsonFromGeneratedText<T>(text: string): T | null {
    const jsonString = extractJson(text);
    if (!jsonString) return null;

    try {
      return JSON.parse(jsonString) as T;
    } catch {
      return null;
    }
  }

  private static parseTranscriptAnalysisPayload(text: string): TranscriptAnalysis | null {
    const parsed = this.parseJsonFromGeneratedText<Record<string, unknown>>(text);
    if (!parsed || !Array.isArray(parsed.courses)) {
      return null;
    }

    const courses = parsed.courses
      .filter((course): course is Record<string, unknown> => this.isRecord(course))
      .map((course) => ({
        code: this.toRequiredString(course.code),
        name: this.toRequiredString(course.name),
        grade: this.toRequiredString(course.grade),
        credits: this.toRequiredString(course.credits),
        semester: this.toOptionalString(course.semester),
        year: this.toOptionalString(course.year),
      }))
      .filter(
        (course) =>
          course.code.length > 0 &&
          course.name.length > 0 &&
          course.grade.length > 0 &&
          course.credits.length > 0
      );

    if (courses.length === 0) {
      return null;
    }

    return {
      courses,
      gpa: this.toOptionalString(parsed.gpa),
      totalCredits: this.toOptionalString(parsed.totalCredits),
      institution: this.toOptionalString(parsed.institution),
      studentName: this.toOptionalString(parsed.studentName),
      degree: this.toOptionalString(parsed.degree),
      graduationDate: this.toOptionalString(parsed.graduationDate),
    };
  }

  public static async testApiConnection(): Promise<{
    success: boolean;
    error?: string;
  }> {
    const result = await this.requestGemini(
      {
        contents: [{ parts: [{ text: "Test" }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 10,
          thinkingConfig: this.DISABLE_THINKING,
        },
      },
      10000
    );

    if (result.ok) {
      return { success: true };
    }

    return {
      success: false,
      error: result.error?.message ?? "Unknown error",
    };
  }

  public static async analyzeTranscript(imageUri: string): Promise<AnalysisResult> {
    try {
      const base64Image = await this.encodeImageToBase64(imageUri);

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: `Analyze this academic transcript image and extract course information. Return a JSON object with fields: courses, gpa, totalCredits, institution, studentName, degree, graduationDate. Return only valid JSON.`,
              },
              { inline_data: { mime_type: "image/jpeg", data: base64Image } },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      };

      const result = await this.requestGemini(requestBody);
      if (!result.ok) {
        return {
          success: false,
          error: result.error?.message ?? "Analysis failed",
          rawResponse: result.error?.message,
        };
      }

      const text = this.extractGeneratedText(result.data);
      if (!text) {
        return {
          success: false,
          error: "Analysis failed",
          rawResponse: "No analysis generated from Gemini",
        };
      }

      const parsedData = this.parseTranscriptAnalysisPayload(text);
      if (!parsedData) {
        return {
          success: false,
          error: "Could not parse transcript details from model output",
          rawResponse: text,
        };
      }

      return {
        success: true,
        data: parsedData,
        rawResponse: text,
      };
    } catch (error) {
      const errorMessage = this.isRateLimitError(error)
        ? "System busy at the moment. Please try again later."
        : "Analysis failed";

      return {
        success: false,
        error: errorMessage,
        rawResponse: String(error),
      };
    }
  }

  public static async validateImageSize(imageUri: string): Promise<{ valid: boolean }> {
    const size = await this.getFileSizeBytes(imageUri);
    if (size === null) return { valid: true };
    return { valid: size <= this.MAX_VISION_IMAGE_BYTES };
  }

  public static async analyzeActionImage(
    imageUri: string,
    questionContext?: string,
    skipCompression?: boolean
  ): Promise<{
    success: boolean;
    rawResponse?: string;
    error?: string;
    inappropriate?: boolean;
  }> {
    try {
      const optimizedImageUri = skipCompression
        ? imageUri
        : await this.compressImageForVision(imageUri);
      const base64Image = await this.encodeImageToBase64(optimizedImageUri);

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: `You are helping a user answer a reflection question using an uploaded image.

Question to answer: "${questionContext ?? "What are you typically doing when you lose track of time?"}"

Instructions:
1. First, check the image for inappropriate content: nudity, sexual content, graphic violence, gore, drugs/drug paraphernalia, weapons used to threaten or harm, hate symbols, or anything unsafe or inappropriate for a student skill-building app. If ANY of these are present, set "inappropriate" to true and set "answer" to an empty string — do not describe or reference the content further.
2. If the image is appropriate, infer the likely activity shown in the image.
3. Write a concise first-person answer the user can submit (2-3 sentences).
4. Keep it specific, natural, and grounded in what is visible.
5. Mention concrete skills/strengths implied by the activity.
6. Do not include disclaimers, markdown, bullet points, or references to "the image".

Return JSON only, matching this shape: { "inappropriate": boolean, "answer": string }`,
              },
              { inline_data: { mime_type: "image/jpeg", data: base64Image } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 400,
          thinkingConfig: this.DISABLE_THINKING,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              inappropriate: { type: "boolean" },
              answer: { type: "string" },
            },
            required: ["inappropriate", "answer"],
          },
        },
      };

      const result = await this.requestGemini(requestBody);
      if (!result.ok) {
        if (result.error?.code === "AUTH") {
          return {
            success: false,
            error: "API key error. Please check your configuration.",
          };
        }

        return {
          success: false,
          error: result.error?.message ?? "Failed to analyze image",
        };
      }

      const text = this.extractGeneratedText(result.data);
      if (!text) {
        throw new Error("No analysis generated from Gemini");
      }

      const jsonString = extractJson(text);
      const parsed = jsonString
        ? (JSON.parse(jsonString) as { inappropriate?: boolean; answer?: string })
        : null;

      if (!parsed) {
        throw new Error("Failed to parse image analysis response");
      }

      if (parsed.inappropriate) {
        return { success: true, inappropriate: true, rawResponse: "" };
      }

      return {
        success: true,
        inappropriate: false,
        rawResponse: (parsed.answer ?? "").trim(),
      };
    } catch (error) {
      const errorMessage = this.getActionImageErrorMessage(error);
      return { success: false, error: errorMessage };
    }
  }

  public static async transcribeAudio(
    audioUri: string
  ): Promise<{ success: boolean; transcript?: string; error?: string }> {
    try {
      const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const mimeType = audioUri.includes(".m4a") ? "audio/mp4" : "audio/wav";

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: "Please transcribe the following audio file. Return only the transcribed text.",
              },
              { inline_data: { mime_type: mimeType, data: base64Audio } },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      };

      const result = await this.requestGemini(requestBody);
      if (!result.ok) {
        return {
          success: false,
          error: result.error?.message ?? "Transcription failed",
        };
      }

      const transcript = this.extractGeneratedText(result.data);

      return { success: true, transcript: transcript?.trim() };
    } catch (error) {
      const errorMessage = this.isRateLimitError(error)
        ? "System busy at the moment. Please try again later."
        : "Transcription failed";
      return { success: false, error: errorMessage };
    }
  }

  public static async processTranscriptText(transcript: string): Promise<string> {
    const result = await this.requestGemini({
      contents: [
        {
          parts: [
            {
              text: `Provide a concise response to this transcript: """${transcript}"""`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 512,
        thinkingConfig: this.DISABLE_THINKING,
      },
    });

    if (!result.ok) {
      throw new Error(result.error?.message ?? "Gemini API error");
    }

    return this.extractGeneratedText(result.data) ?? "";
  }

  public static async mapAnswerAndGenerateNextQuestion(
    question: string,
    answer: string,
    interactions: DialogueInteraction[],
    mappedCategories: MappedCategory[],
    taxonomyString: string,
    options?: {
      pdfContextText?: string;
      signal?: AbortSignal;
      targetRegion?: string;
      currentTier?: number;
      timesUnlocked?: number;
      hasArtifact?: boolean;
    }
  ): Promise<MapAnswerResponse> {
    // Cap history at 5 turns to keep the prompt under the token limit.
    const recentInteractions = interactions.slice(-5);

    const history = recentInteractions
      .map((i) => `Q: ${i.question} | A: ${i.answer} | Mapped: ${i.mappedCategory}`)
      .join("\n");
    const mappedCategoriesList = mappedCategories
      .map((c) => c.category + (c.timesMapped ? " (count: " + c.timesMapped + ")" : ""))
      .join(", ");

    const contextBlock = options?.pdfContextText
      ? `\n\n=== USER PERSONALITY PROFILE ===\n${options.pdfContextText}\n\nUse this only to make questions and follow-ups more engaging — match their communication style, lead with topics tied to their interests and motivators, and steer toward areas where they can show evidence. It must NOT change how strictly you map answers to categories. Never mention it or imply you have access to a profile.`
      : "";

    const regionHint = options?.targetRegion
      ? `\n13. The user is exploring the "${options.targetRegion}" region. If the answer fits this category, prefer mapping to "${options.targetRegion}" over other categories.`
      : "";
    // geminiService.ts — replace the targetCategoryId/stampUnlockSummary block

    const categoriesWithIds = mappedCategories.filter(
      (c): c is MappedCategory & { categoryId: string } => !!c.categoryId
    );
    const stampSummaries = await Promise.all(
      categoriesWithIds.map(async (c) => {
        const summary = await getStampUnlockSummary(c.categoryId);
        return summary ? `- ${c.category}: ${summary}` : null;
      })
    );
    const progressionSummaryText = stampSummaries.filter(Boolean).join("\n  ");

    const progressionContext = `
      CURRENT STAMP PROGRESSION (check this for the specific stamp's prior tier before setting initialTier — see rule 13):
      ${progressionSummaryText || "  none yet"}
      - Artifact Attached: ${options?.hasArtifact ? "Yes" : "No"}
      `;
    const systemInstruction = `You are a sophisticated trait mapper and question generator.
Your task is to map the answer to exactly one skill stamp taxonomy category, or to 'NO_MAP_WEAK_FIT' when the fit is weak, uncertain, generic, off-topic, or does not clearly respond to the question.
Rules:
1. Choose the single most applicable skill stamp category from the taxonomybased on what the answer itself describes, not on whether it directly responds to the question asked. A tangential or off-topic answer that clearly demonstrates a real skill/experience should still be mapped.
2. Only map to a real category if the fit is obvious and rigorous. When genuinely uncertain, prefer NO_MAP_WEAK_FIT rather than forcing a category.
3. Prefer unmapped categories, but if the answer genuinely matches an already-mapped category, you may still select it (its counter will increment). Never force a weak match just because it's unmapped.
4. Use 'NO_MAP_WEAK_FIT' only when the answer itself is generic filler, too vague to point to any category, gibberish, or spam — not merely because it didn't address the question. A detailed, substantive answer about something real should be mapped even if it ignores the question entirely.
5. If the answer contains abusive, offensive, or inappropriate language, or is gibberish/spam/unrelated to any category, you MUST use 'NO_MAP_WEAK_FIT' with justification EXACTLY starting with 'INAPPROPRIATE_CONTENT:'. Set nextQuestion to null. Do NOT use the answer text in follow-up questions. See rule 17 if distressSignal also applies — only one of these should govern the turn.
6. If a category appears multiple times in the mapped category list, treat that repeat count as supporting evidence of strength, but do not override a weak or unrelated answer.
7. Keep the justification short and factual, with at most 40 words.
8. Generate a thoughtful follow-up question that directly follows from the user's answer and helps identify other unmapped categories, or set nextQuestion to null if no useful follow-up exists. Keep the question in the register of activities, projects, responsibilities, and choices. Never ask the user to locate feelings or sensations in their body, rate distress/pain, describe physical or emotional symptoms, or do body-scanning/mindfulness-style reflection. Do not introduce mental health, trauma, family conflict, finances, romantic relationships, religion, or immigration status as topics — only engage with those if the user's own answer already raised them, and even then stay on the skill/experience angle rather than the personal one.
9. Evaluate if the user's answer is detailed, rich, and more than a single sentence. If it is a "great response" that could be strengthened with visual proof (like an image artifact), set suggestArtifactUpload to true and provide a brief artifactUploadReason (e.g., "A photo of your project would strengthen this claim"). Otherwise, set suggestArtifactUpload to false.
10. Pick the single most specific stamp name from the category's "Available Stamps" list. Set specificStamp only if the answer clearly and directly indicates that exact stamp. If no specific stamp is evident, set specificStamp to null — do not guess or default.
10b. If the answer maps to an ALREADY-MAPPED category (see rule 3), you must still identify which specific stamp within that category this answer best supports, using the same "Available Stamps" list — even though the category itself was mapped before. Do not leave specificStamp null just because the category is already mapped; only leave it null if the answer genuinely doesn't point to any specific stamp. Never show the user this thinking in the question.
11. Before mapping, consider the three strongest candidate categories. Only select a category if it is clearly a better fit than the others. If two or more categories seem equally plausible, use the QUESTION'S intent to break the tie. Only return NO_MAP_WEAK_FIT if none of the candidates are a strong fit. Ask yourself: "Would an impartial observer clearly agree this answer belongs in this category?" If the connection requires more than one logical step, use NO_MAP_WEAK_FIT.
12. Consider the QUESTION's intent alongside the answer. The question is designed to probe specific categories. If the question targets a particular type of experience and the answer aligns with it, treat that as supporting evidence for that category.
13. Set initialTier to the tier THIS submission should result in — not just the starting tier. Judge holistically on specificity and substance, not length.
- If this stamp has never been unlocked before: initialTier = 1, regardless of how strong the answer is. (Richness still matters — see below.)
- If this stamp was already unlocked: start from its highest previously earned tier (see CURRENT STAMP PROGRESSION). Evaluate whether THIS answer, combined with prior submissions to this same stamp, now clears the bar for the next tier up. If yes, set initialTier = previousTier + 1. If not, set initialTier = previousTier (unchanged — this is the normal, expected outcome for most repeat submissions).
- At most one tier gained per submission. Never skip a tier except for truly exceptional, unambiguous depth.
- Repeat count is a real but partial signal: several genuinely detailed, substantive answers about the same stamp (not just repeated mentions) can satisfy Tier 3's "sustained engagement over time" criterion on their own, even without a single standout answer or an attached artifact. Count alone without substance does not earn an upgrade — three one-line answers stay at tier 1.
Tier rubric:
- Tier 1: The claim alone, or not yet enough combined evidence for tier 2.
- Tier 2: The claim plus concrete elaboration — a specific instance, anecdote, or "why/how" reflection.
- Tier 3: EITHER (a) sustained engagement over time (can be shown across multiple submissions to this stamp) combined with reflection on what it taught them or how it shaped them, OR (b) direct supporting evidence is attached that verifies the claim.
- Tier 4: Exceptionally rare, verifiable-caliber achievement — competitive results, awards, leadership, founding something, professional/high-level involvement.
14. The goal is accurate mapping, not maximizing the number of badges earned. Avoid assigning a badge unless there is clear supporting evidence in the user's answer.
15. Independently of category mapping, set distressSignal to true if the answer expresses or strongly implies self-harm, suicidal ideation, or an acute personal crisis warranting support resources. Evaluate this even if the answer would otherwise map to a category, be weak fit, or be flagged inappropriate — but see rule 17: distressSignal takes precedence and suppresses those other flags for this turn. Default to false — do not flag general sadness, stress, or difficult-but-non-crisis topics.
16. Independently of category mapping, set sensitiveExperience to true if the answer describes the death or serious illness of a loved one, or another significant grief/loss experience. Default to false. If distressSignal is also true, set sensitiveExperience to false — an acute crisis takes precedence over the grief-support flow for this turn.
17. PRIORITY WHEN MULTIPLE SIGNALS COULD APPLY: Only one support-flow signal should govern a single turn, in this order: (a) distressSignal — if true, do NOT also use the INAPPROPRIATE_CONTENT justification (rule 5) or set sensitiveExperience to true; still attempt a genuine category mapping if the answer clearly supports one, otherwise use NO_MAP_WEAK_FIT with a neutral (non-INAPPROPRIATE_CONTENT) justification. (b) INAPPROPRIATE_CONTENT — if distressSignal is false but the content is genuinely abusive or policy-violating, flag it per rule 5. (c) NO_MAP_WEAK_FIT for vague, generic, or insufficiently detailed answers — only applies if neither (a) nor (b) does.
${contextBlock}${regionHint}${progressionContext}`;

    const userPrompt = `QUESTION: ${question}\nANSWER: ${answer}\nLATEST_CONTEXT: Use the answer above as the primary anchor for the next question.\nRECENT_HISTORY: ${history}\nMAPPED_CATEGORIES_WITH_COUNTS: ${mappedCategoriesList}\nTAXONOMY:\n${taxonomyString}`;

    try {
      const result = await this.requestGemini(
        {
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                category: { type: "string" },
                justification: { type: "string" },
                nextQuestion: { type: "string" },
                suggestArtifactUpload: { type: "boolean" },
                artifactUploadReason: { type: "string" },
                specificStamp: { type: "string" },
                initialTier: { type: "number" },
                proofTier: { type: "number" },
                distressSignal: { type: "boolean" },
                sensitiveExperience: { type: "boolean" },
              },
              required: [
                "category",
                "justification",
                "suggestArtifactUpload",
                "initialTier",
                "specificStamp",
              ],
            },
          },
        },
        undefined,
        options?.signal
      );

      if (!result.ok) {
        throw new Error(result.error?.message ?? "Failed to generate response");
      }

      const rawText = this.extractGeneratedText(result.data);
      if (!rawText) {
        throw new Error("Failed to extract text from API response");
      }

      const finishReason = result.data?.candidates?.[0]?.finishReason;
      if (finishReason === "MAX_TOKENS") {
        console.warn("⚠️ Gemini response finished with MAX_TOKENS – JSON may be truncated.");
      }

      // Extract JSON from response (handles incomplete/truncated JSON)
      const jsonString = extractJson(rawText);
      if (!jsonString) {
        const salvaged = this.salvageTruncatedMapAnswerResponse(rawText);
        if (salvaged) {
          return salvaged;
        }

        console.error("❌ Could not extract JSON from response:", rawText);
        throw new Error("Failed to extract JSON from API response");
      }

      const parsed = await this.parseAndFinalizeMapAnswerResponse(
        rawText,
        jsonString,
        interactions,
        mappedCategories,
        taxonomyString,
        {
          latestQuestion: question,
          latestAnswer: answer,
          embeddingHistorySummary: options?.pdfContextText,
        },
        options?.signal
      );
      return parsed;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("❌ Gemini API Error Details:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
          url: this.sanitizeUrl(this.buildApiUrl()),
        });

        if (this.isRateLimitError(error)) {
          throw new Error("System busy at the moment. Please try again later.");
        }
      }
      throw error;
    }
  }

  private static async parseAndFinalizeMapAnswerResponse(
    rawText: string,
    jsonString: string,
    interactions: DialogueInteraction[],
    mappedCategories: MappedCategory[],
    taxonomyString: string,
    context?: QuestionSynthesisContext,
    signal?: AbortSignal
  ): Promise<MapAnswerResponse> {
    let parsed: MapAnswerResponse;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      const salvaged = this.salvageTruncatedMapAnswerResponse(rawText);
      if (salvaged) {
        return salvaged;
      }

      console.error("❌ JSON parse error. Raw:", rawText.substring(0, 200));
      throw new Error(
        `JSON parse failed: ${parseError instanceof Error ? parseError.message : "unknown"}`
      );
    }

    if (!parsed.category || typeof parsed.category !== "string") {
      console.error("❌ Invalid response: missing or invalid 'category'", parsed);
      throw new Error("Invalid response: missing category field");
    }

    if (!parsed.nextQuestion) {
      return parsed;
    }

    parsed.nextQuestion = this.normalizeQuestion(parsed.nextQuestion);
    if (this.isQuestionStrong(parsed.nextQuestion)) {
      return parsed;
    }

    parsed.nextQuestion = await this.synthesizeNextQuestion(
      interactions,
      mappedCategories,
      taxonomyString,
      context,
      signal
    );
    return parsed;
  }

  private static salvageTruncatedMapAnswerResponse(rawText: string): MapAnswerResponse | null {
    const categoryMatch = /"category"\s*:\s*"([^"]+)"/.exec(rawText);
    const justificationMatch = /"justification"\s*:\s*"([^"]+)"/.exec(rawText);

    const category = categoryMatch?.[1]?.trim();
    const justification = justificationMatch?.[1]?.trim();

    if (!category || !justification) {
      return null;
    }

    return {
      category,
      justification,
      nextQuestion: null,
      specificStamp: category,
    };
  }

  private static async encodeImageToBase64(imageUri: string): Promise<string> {
    return await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  private static async getFileSizeBytes(imageUri: string): Promise<number | null> {
    try {
      const info = await FileSystem.getInfoAsync(imageUri);
      if (!info.exists) {
        return null;
      }

      return "size" in info && typeof info.size === "number" ? info.size : null;
    } catch {
      return null;
    }
  }

  private static async compressImageForVision(imageUri: string): Promise<string> {
    const originalSize = await this.getFileSizeBytes(imageUri);
    if (originalSize !== null && originalSize <= this.MAX_VISION_IMAGE_BYTES) {
      return imageUri;
    }

    let smallestCandidateUri = imageUri;
    let smallestCandidateSize = Number.MAX_SAFE_INTEGER;

    for (let index = 0; index < this.VISION_WIDTH_STEPS.length; index += 1) {
      const width = this.VISION_WIDTH_STEPS[index];
      const quality = this.VISION_QUALITY_STEPS[index];

      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width } }],
          {
            compress: quality,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

        const size = await this.getFileSizeBytes(manipulated.uri);
        if (size !== null && size < smallestCandidateSize) {
          smallestCandidateUri = manipulated.uri;
          smallestCandidateSize = size;
        }

        if (size !== null && size <= this.MAX_VISION_IMAGE_BYTES) {
          return manipulated.uri;
        }
      } catch {
        // Continue trying smaller variants.
      }
    }

    if (smallestCandidateSize <= this.MAX_VISION_IMAGE_BYTES) {
      return smallestCandidateUri;
    }

    throw new Error("IMAGE_TOO_LARGE_FOR_VISION");
  }

  private static getActionImageErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message === "IMAGE_TOO_LARGE_FOR_VISION") {
      return "Image is too large to analyze. Please choose a smaller image or use the Small size option.";
    }

    if (this.isRateLimitError(error)) {
      return "System busy at the moment. Please try again later.";
    }

    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        return "System busy at the moment. Please try again later.";
      }
      if (error.response?.status === 413) {
        return "Image is too large. Please try with a smaller image.";
      }
      if (error.response?.status === 401 || error.response?.status === 403) {
        return "API key error. Please check your configuration.";
      }
    }

    return "Failed to analyze image";
  }

  private static normalizeQuestion(question: string): string {
    let normalized = String(question).trim();
    normalized = normalized.replaceAll(/(?:^"+|"+$)/g, "").trim();
    normalized = normalized.replaceAll(/\s+/g, " ");

    if (!normalized.endsWith("?")) {
      normalized = `${normalized.replaceAll(/[.!]+$/g, "")}?`;
    }

    return normalized;
  }

  private static isQuestionStrong(question: string): boolean {
    const normalized = question.trim();
    if (!normalized.endsWith("?")) return false;
    const words = normalized
      .replaceAll(/[?!.,]/g, "")
      .split(/\s+/)
      .filter(Boolean);
    if (words.length < 8) return false;
    return /\b(what|how|why|where|when|who|which)\b/i.test(normalized);
  }

  private static buildSynthesisPrompt(
    history: string,
    taxonomyString: string,
    mappedCategoriesList: string,
    strict: boolean,
    context?: QuestionSynthesisContext,
    targetRegion?: string
  ): string {
    // In "New Topic" mode we deliberately drop the latest turn so the question
    // pivots to a new dimension instead of continuing the current thread.
    const isRegionExplore = !!targetRegion && !context?.newTopic;

    const latestTurnBlock =
      !context?.newTopic && !isRegionExplore && (context?.latestQuestion || context?.latestAnswer)
        ? `\nLATEST_TURN:\nQ: ${context.latestQuestion ?? ""}\nA: ${context.latestAnswer ?? ""}\n`
        : "\n";
    const embeddingHistoryBlock = context?.embeddingHistorySummary
      ? `\nUSER_PERSONALITY_PROFILE (for engagement only — tailor tone/topics, never reveal, never affects scoring):\n${context.embeddingHistorySummary}\n`
      : "";
    const regionBlock = targetRegion
      ? `\nTARGET REGION: ${targetRegion} — focus the question on this specific area.\n`
      : "";
    // The user rejected this question via "Skip". Tell the model explicitly so
    // it regenerates something genuinely different instead of returning a
    // near-identical phrasing.
    const avoidQuestionBlock = context?.avoidQuestion
      ? `\nAVOID: The user just skipped this question — do NOT repeat it or merely rephrase it. Ask about a clearly different angle:\n"${context.avoidQuestion}"\n`
      : "";

    const exploredStampsBlock = context?.exploredStamps?.length
      ? `\nSTAMPS ALREADY EXPLORED IN THIS REGION (choose a different stamp from the taxonomy — do not target these again):\n${context.exploredStamps.join(", ")}\n`
      : "";

    const strictClause = strict
      ? " The question must be at least 8 words and 24 characters, and ask for concrete details (what, where, how, or why)."
      : "";
    const userCenterClause = ` CRITICAL: Always center the question on the user — ask about their actions, choices, feelings, or role. You may reference other people (teammates, coaches, teachers), but the question's subject must remain the user's own experience. Never ask about someone else's isolated actions or strategies. Never repeat or quote offensive, profane, or inappropriate language from the user's answer — paraphrase in general terms if needed. Keep questions grounded in activities, projects, and choices — never ask the user to locate a feeling or sensation in their body, rate distress or pain, or do body-scanning/mindfulness-style reflection. Do not introduce mental health, trauma, family conflict, finances, romance, religion, or immigration status unprompted; only touch a topic like that if the user's answer already raised it, and keep the follow-up on the skill/experience angle.`;
    let leadInstruction: string;
    if (context?.newTopic) {
      leadInstruction = `Based on the taxonomy (including the NO_OP category as a mapping option) and the categories already mapped to me, synthesize a clear, specific new question that DELIBERATELY CHANGES THE TOPIC to a fresh dimension. Do NOT build on, reference, or continue the most recent answer or the current thread — start a genuinely new line of conversation. Choose a dimension likely to surface one of the categories NOT yet mapped to me. The question must end with a "?".${strictClause} Use any embedding/background context about me to pick a new dimension that fits my experience.${userCenterClause}`;
    } else if (isRegionExplore) {
      leadInstruction = `You are exploring the "${targetRegion}" region to uncover NEW evidence for stamps within it, not to continue a prior conversation thread. Review the "Available Stamps" listed for this region in the taxonomy and select ONE stamp that is not already mapped and is not in STAMPS ALREADY EXPLORED below. Prefer moving to a different stamp rather than continuing whatever topic came up most recently, even if it seemed related — only continue a prior topic if the user's own last answer explicitly asked to keep going with it. If my known interests or personality profile suggest a natural bridge into the new stamp (e.g. "you mentioned coding — have you ever done a hackathon?"), use that bridge, but never name the stamp itself or say you're trying to unlock it. The question must end with a "?".${strictClause}${userCenterClause}`;
    } else {
      leadInstruction = `Based on all our interactions so far, the taxonomy (including the NO_OP category as a mapping option), and the categories mapped to me so far, synthesize a clear, specific new question that follows naturally from the latest answer and might help tease out which additional categories might map to me. The question must end with a "?".${strictClause} Prioritize the latest answer and recent conversation history. If embedding response history is present, use it only as secondary background context and do not let it override the latest answer or introduce a new unrelated topic.${userCenterClause}`;
    }

    // "New Topic" mode deliberately pivots away from the existing thread, so we
    // withhold the full Q/A HISTORY (which would anchor the model back to it)
    // and steer purely from the mapped categories + embedding background.
    const historyBlock = context?.newTopic || isRegionExplore ? "" : `HISTORY:\n${history}\n\n`;

    return `${leadInstruction}
${historyBlock}${latestTurnBlock}TAXONOMY:
${taxonomyString}

CATEGORIES MAPPED: ${mappedCategoriesList}
${regionBlock}${avoidQuestionBlock}${exploredStampsBlock}
${embeddingHistoryBlock}
RESPOND ONLY with the text of the new question. Do not include any other text, explanation, or formatting.`;
  }

  private static async fetchSynthesizedQuestion(
    prompt: string,
    strict: boolean,
    signal?: AbortSignal
  ): Promise<GeminiResult<GeminiApiResponse>> {
    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: strict ? 0.5 : 0.9,
        maxOutputTokens: 800,
        thinkingConfig: this.DISABLE_THINKING,
      },
    };

    return await this.requestGemini(requestBody, 15000, signal);
  }

  private static readQuestionResponse(response: GeminiResult<GeminiApiResponse>): {
    text: string;
    finishReason?: string;
  } {
    if (!response.ok) {
      throw new Error(response.error?.message ?? "No question generated from API");
    }

    const text = this.extractGeneratedText(response.data);
    if (!text) {
      throw new Error("No question generated from API");
    }

    const finishReason = response.data?.candidates?.[0]?.finishReason;

    return { text, finishReason };
  }

  private static shouldRetryQuestionStrict(
    question: string,
    _text: string,
    finishReason?: string
  ): boolean {
    // Retry only when the question is weak or the response was truncated
    // (MAX_TOKENS); a long-but-complete question is fine as-is.
    const isIncomplete = finishReason === "MAX_TOKENS";
    return !this.isQuestionStrong(question) || isIncomplete;
  }

  private static throwSynthesisError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        Alert.alert("System busy", "System busy at the moment. Please try again later.");
        console.warn("System busy at the moment. Please try again later.");
      }
      if (error.response?.status === 403) {
        Alert.alert("Invalid Key", "API key invalid or missing. Check your .env file.");
        console.warn("API key invalid or missing. Check your .env file.");
      }
      if (error.response) {
        throw new Error(`API Error: ${error.response.status} - ${error.response.statusText}`);
      }
      if (error.request) {
        Alert.alert("Network Error", "Network error. Please check your internet connection.");
        console.warn("Network error. Please check your internet connection.");
      }
    }

    throw new Error("Failed to generate next question");
  }

  public static async synthesizeNextQuestion(
    interactions: Array<{
      question: string;
      answer: string;
      mappedCategory: string;
    }>,
    mappedCategories: Array<{ category: string }>,
    taxonomyString: string,
    context?: QuestionSynthesisContext,
    signal?: AbortSignal,
    targetRegion?: string
  ): Promise<string> {
    try {
      const history = interactions
        .slice(-5)
        .map((i) => `Q: ${i.question} | A: ${i.answer} | Mapped: ${i.mappedCategory}`)
        .join("\n");

      const mappedCategoriesList = mappedCategories.map((c) => c.category).join(", ");

      const prompt = this.buildSynthesisPrompt(
        history,
        taxonomyString,
        mappedCategoriesList,
        false,
        context,
        targetRegion
      );

      const response = await this.fetchSynthesizedQuestion(prompt, false, signal);
      const { text, finishReason } = this.readQuestionResponse(response);

      if (finishReason === "MAX_TOKENS") {
        console.warn("Gemini response finished with MAX_TOKENS – question may be truncated.");
      }

      let question = this.normalizeQuestion(text);

      if (this.shouldRetryQuestionStrict(question, text, finishReason)) {
        console.log("Question is incomplete or weak, retrying with stricter settings");

        const strictPrompt = this.buildSynthesisPrompt(
          history,
          taxonomyString,
          mappedCategoriesList,
          true,
          context,
          targetRegion
        );
        const strictResponse = await this.fetchSynthesizedQuestion(strictPrompt, true, signal);
        const { text: strictText } = this.readQuestionResponse(strictResponse);

        if (strictText && strictText.length < 250) {
          question = this.normalizeQuestion(strictText);
        }
      }

      return question;
    } catch (error) {
      this.throwSynthesisError(error);
    }
  }
}
