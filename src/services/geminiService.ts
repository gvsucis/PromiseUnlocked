import axios from "axios";
import * as FileSystem from "expo-file-system/legacy";
import { AnalysisResult, TranscriptAnalysis } from "../types";
import { CONFIG, getGeminiApiKey } from "../config/env";
import extractJson from "../utils/JsonExtract";

type GeminiErrorCode = "RATE_LIMIT" | "AUTH" | "NETWORK" | "API" | "UNKNOWN";

interface GeminiError {
  code: GeminiErrorCode;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

interface GeminiResult<T> {
  ok: boolean;
  data?: T;
  error?: GeminiError;
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
}

interface DialogueInteraction {
  question: string;
  answer: string;
  mappedCategory: string;
}

interface MappedCategory {
  category: string;
  timesMapped?: number;
}

interface MapAnswerResponse {
  category: string;
  justification?: string;
  nextQuestion?: string | null;
  [key: string]: unknown;
}

export class GeminiService {
  private static readonly MODEL_NAME = CONFIG.TEXT_MODEL;

  private static buildApiUrl(): string {
    const baseUrl = CONFIG.GEMINI_API_URL.replaceAll(/\/+$/g, "");
    const apiKey = encodeURIComponent(getGeminiApiKey());
    return `${baseUrl}/${this.MODEL_NAME}:generateContent?key=${apiKey}`;
  }

  private static sanitizeUrl(url: string): string {
    return url.replaceAll(/key=[^&]*/g, "key=***");
  }

  /**
   * Helper: Retry with exponential backoff for rate limits
   */
  private static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 4,
    initialDelay: number = 2000
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (
          axios.isAxiosError(error) &&
          (error.response?.status === 429 || error.response?.status === 503)
        ) {
          const retryAfterHeader = error.response?.headers?.["retry-after"];
          const retryAfterSeconds = Number(retryAfterHeader);
          const baseDelay =
            Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
              ? retryAfterSeconds * 1000
              : initialDelay * Math.pow(2, attempt);
          const jitter = Math.floor(Math.random() * 500);
          const delay = baseDelay + jitter;
          console.log(
            `Rate limit/service busy. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
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
          message: "Rate limit exceeded. Please wait a moment and try again.",
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
    timeout: number = CONFIG.REQUEST_TIMEOUT
  ): Promise<GeminiResult<GeminiApiResponse>> {
    try {
      const apiUrl = this.buildApiUrl();
      const response = await this.retryWithBackoff(() =>
        axios.post<GeminiApiResponse>(apiUrl, requestBody, {
          headers: { "Content-Type": "application/json" },
          timeout,
        })
      );

      return { ok: true, data: response.data };
    } catch (error) {
      return { ok: false, error: this.normalizeError(error) };
    }
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

  /**
   * PUBLIC API: TEST CONNECTION
   */
  public static async testApiConnection(): Promise<{
    success: boolean;
    error?: string;
  }> {
    const result = await this.requestGemini(
      {
        contents: [{ parts: [{ text: "Test" }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 10 },
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

  /**
   * PUBLIC API: ANALYZE TRANSCRIPT IMAGE
   */
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
        ? "Rate limit exceeded. Please wait a moment and try again."
        : "Analysis failed";

      return {
        success: false,
        error: errorMessage,
        rawResponse: String(error),
      };
    }
  }

  /**
   * PUBLIC API: ANALYZE ACTION IMAGE
   * Analyzes an image of an activity/action and returns a description
   */
  public static async analyzeActionImage(
    imageUri: string
  ): Promise<{ success: boolean; rawResponse?: string; error?: string }> {
    try {
      const base64Image = await this.encodeImageToBase64(imageUri);

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: `Analyze this image and describe what activity or action is being shown. Focus on:
1. What specific activity or action is depicted
2. What skills or competencies are being demonstrated
3. Why this activity might help someone lose track of time
4. What this reveals about their interests and strengths

Provide a thoughtful, specific description (2-3 sentences) that could serve as a response to the question: "What are you typically doing when you lose track of time?"`,
              },
              { inline_data: { mime_type: "image/jpeg", data: base64Image } },
            ],
          },
        ],
        generationConfig: { temperature: 0.5, maxOutputTokens: 512 },
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

      return {
        success: true,
        rawResponse: text.trim(),
      };
    } catch (error) {
      let errorMessage = "Failed to analyze image";

      if (this.isRateLimitError(error)) {
        errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
      } else if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
        } else if (error.response?.status === 413) {
          errorMessage = "Image is too large. Please try with a smaller image.";
        } else if (error.response?.status === 401 || error.response?.status === 403) {
          errorMessage = "API key error. Please check your configuration.";
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * PUBLIC API: TRANSCRIBE AUDIO
   */
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
        ? "Rate limit exceeded. Please wait a moment and try again."
        : "Transcription failed";
      return { success: false, error: errorMessage };
    }
  }

  /**
   * PUBLIC API: PROCESS TRANSCRIPT TEXT
   */
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
      generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
    });

    if (!result.ok) {
      throw new Error(result.error?.message ?? "Gemini API error");
    }

    return this.extractGeneratedText(result.data) ?? "";
  }

  /**
   * PUBLIC API: MAP ANSWER AND GENERATE NEXT QUESTION
   * Optimized for reliability: reduced tokens, limited history, improved validation.
   */
  public static async mapAnswerAndGenerateNextQuestion(
    question: string,
    answer: string,
    interactions: DialogueInteraction[],
    mappedCategories: MappedCategory[],
    taxonomyString: string
  ): Promise<MapAnswerResponse> {
    // Limit history to last 5 interactions to reduce prompt size and prevent token overflow
    const recentInteractions = interactions.slice(-5);
    const history = recentInteractions
      .map((i) => `Q: ${i.question} | A: ${i.answer} | Mapped: ${i.mappedCategory}`)
      .join("\n");
    const mappedCategoriesList = mappedCategories
      .map((c) => c.category + (c.timesMapped ? " (count: " + c.timesMapped + ")" : ""))
      .join(", ");

    console.log("🔵 Using model:", this.MODEL_NAME);

    const systemInstruction = `You are a sophisticated trait mapper and question generator.
Your task is to map the answer to exactly one taxonomy category, or to 'NO_MAP_WEAK_FIT' when the fit is weak, uncertain, generic, off-topic, or does not clearly respond to the question.
Rules:
1. Choose the single most applicable category from the taxonomy.
2. Only map to a real category if the fit is obvious and rigorous.
3. Do not choose a category that is already mapped in the recent history; use only unmapped categories.
4. If the answer is generic filler, unrelated, or only partially addresses the question, use 'NO_MAP_WEAK_FIT'.
5. If a category appears multiple times in the mapped category list, treat that repeat count as supporting evidence of strength, but do not override a weak or unrelated answer.
6. Keep the justification short and factual, with at most 30 words.
7. Generate a thoughtful follow-up question to help identify other unmapped categories, or set nextQuestion to null if no useful follow-up exists.`;

    const userPrompt = `QUESTION: ${question}\nANSWER: ${answer}\nRECENT_HISTORY: ${history}\nMAPPED_CATEGORIES_WITH_COUNTS: ${mappedCategoriesList}\nTAXONOMY:\n${taxonomyString}`;

    try {
      const result = await this.requestGemini({
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
            },
            required: ["category", "justification"],
          },
        },
      });

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
        console.error("❌ Could not extract JSON from response:", rawText);
        throw new Error("Failed to extract JSON from API response");
      }

      const parsed = await this.parseAndFinalizeMapAnswerResponse(
        rawText,
        jsonString,
        interactions,
        mappedCategories,
        taxonomyString
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
          throw new Error("Rate limit exceeded. Please wait a moment and try again.");
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
    taxonomyString: string
  ): Promise<MapAnswerResponse> {
    let parsed: MapAnswerResponse;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
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
      taxonomyString
    );
    return parsed;
  }

  private static async encodeImageToBase64(imageUri: string): Promise<string> {
    return await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
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
    strict: boolean
  ): string {
    return `Based on all our interactions so far, the taxonomy (including the NO_OP category as a mapping option), and the categories mapped to me so far, synthesize a clear, specific new question that might help tease out which additional categories might map to me. The question must end with a "?".${strict ? " The question must be at least 6 words and 24 characters, and ask for concrete details (what, where, how, or why)." : ""} You may (optionally) use what you've learned about me in previous answers as context in the question if it helps.
HISTORY:
${history}

TAXONOMY:
${taxonomyString}

CATEGORIES MAPPED: ${mappedCategoriesList}

RESPOND ONLY with the text of the new question. Do not include any other text, explanation, or formatting.`;
  }

  private static async fetchSynthesizedQuestion(
    prompt: string,
    strict: boolean
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
      },
    };

    return await this.requestGemini(requestBody, 40000);
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
    text: string,
    finishReason?: string
  ): boolean {
    const isIncomplete = finishReason === "MAX_TOKENS" || text.length > 250;
    return !this.isQuestionStrong(question) || isIncomplete;
  }

  private static throwSynthesisError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        throw new Error("Rate limit exceeded. Please wait a moment and try again.");
      }
      if (error.response?.status === 403) {
        throw new Error("API key invalid or missing. Check your .env file.");
      }
      if (error.response) {
        throw new Error(`API Error: ${error.response.status} - ${error.response.statusText}`);
      }
      if (error.request) {
        throw new Error("Network error. Please check your internet connection.");
      }
    }

    throw new Error("Failed to generate next question");
  }

  /**
   * SYNTHESIZE NEXT QUESTION
   */
  public static async synthesizeNextQuestion(
    interactions: Array<{
      question: string;
      answer: string;
      mappedCategory: string;
    }>,
    mappedCategories: Array<{ category: string }>,
    taxonomyString: string
  ): Promise<string> {
    try {
      const history = interactions
        .map((i) => `Q: ${i.question} | A: ${i.answer} | Mapped: ${i.mappedCategory}`)
        .join("\n");

      const mappedCategoriesList = mappedCategories.map((c) => c.category).join(", ");

      const prompt = this.buildSynthesisPrompt(
        history,
        taxonomyString,
        mappedCategoriesList,
        false
      );

      // log the actual prompt sent to the model for debugging
      console.log("Synthesizing next question with prompt:");

      const response = await this.fetchSynthesizedQuestion(prompt, false);
      const { text, finishReason } = this.readQuestionResponse(response);

      // if the model stopped because it hit our maxOutputTokens limit, log a warning
      if (finishReason === "MAX_TOKENS") {
        console.warn("Gemini response finished with MAX_TOKENS – question may be truncated.");
      }

      console.log("this is the response you get: ", response);

      let question = this.normalizeQuestion(text);

      // Check if response was incomplete or too weak
      if (this.shouldRetryQuestionStrict(question, text, finishReason)) {
        console.log("Question is incomplete or weak, retrying with stricter settings");

        const strictPrompt = this.buildSynthesisPrompt(
          history,
          taxonomyString,
          mappedCategoriesList,
          true
        );
        const strictResponse = await this.fetchSynthesizedQuestion(strictPrompt, true);
        const { text: strictText } = this.readQuestionResponse(strictResponse);

        if (strictText && strictText.length < 250) {
          question = this.normalizeQuestion(strictText);
        }
      }

      console.log("Synthesized question:", question);

      return question;
    } catch (error) {
      this.throwSynthesisError(error);
    }
  }
}
