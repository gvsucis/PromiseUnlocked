import axios from "axios";
import * as FileSystem from "expo-file-system/legacy";
import { AnalysisResult } from "../types";
import { CONFIG, getGeminiApiKey } from "../config/env";
import extractJson from "../util/JsonExtract";

export class GeminiService {
  private static readonly MODEL_NAME = CONFIG.TEXT_MODEL;

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
    return (
      bodyText.includes("toomanyrequests") ||
      bodyText.includes("resource_exhausted") ||
      bodyText.includes("quota") ||
      message.includes("toomanyrequests") ||
      message.includes("resource_exhausted")
    );
  }

  /**
   * PUBLIC API: TEST CONNECTION
   */
  public static async testApiConnection(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL_NAME}:generateContent?key=${getGeminiApiKey()}`;
      await axios.post(
        apiUrl,
        {
          contents: [{ parts: [{ text: "Test" }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 10 },
        },
        { timeout: 10000 }
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * PUBLIC API: ANALYZE TRANSCRIPT IMAGE
   */
  public static async analyzeTranscript(imageUri: string): Promise<AnalysisResult> {
    try {
      const base64Image = await this.encodeImageToBase64(imageUri);
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL_NAME}:generateContent?key=${getGeminiApiKey()}`;

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

      const response = await this.retryWithBackoff(() =>
        axios.post(apiUrl, requestBody, {
          timeout: CONFIG.REQUEST_TIMEOUT,
        })
      );
      const text = response.data.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      return {
        success: true,
        data: JSON.parse(jsonMatch ? jsonMatch[0] : text),
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
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL_NAME}:generateContent?key=${getGeminiApiKey()}`;

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

      const response = await this.retryWithBackoff(() =>
        axios.post(apiUrl, requestBody, {
          timeout: CONFIG.REQUEST_TIMEOUT,
        })
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

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
        encoding: "base64" as any,
      });
      const mimeType = audioUri.includes(".m4a") ? "audio/mp4" : "audio/wav";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL_NAME}:generateContent?key=${getGeminiApiKey()}`;

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

      const response = await this.retryWithBackoff(() =>
        axios.post(apiUrl, requestBody, { timeout: CONFIG.REQUEST_TIMEOUT })
      );
      const transcript = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

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
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL_NAME}:generateContent?key=${getGeminiApiKey()}`;
      const response = await this.retryWithBackoff(() =>
        axios.post(
          apiUrl,
          {
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
          },
          { timeout: CONFIG.REQUEST_TIMEOUT }
        )
      );
      return response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } catch (error) {
      if (this.isRateLimitError(error)) {
        throw new Error("Rate limit exceeded. Please wait a moment and try again.");
      }
      if (error instanceof axios.AxiosError) {
        throw new Error(`Gemini API error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * PUBLIC API: MAP ANSWER AND GENERATE NEXT QUESTION
   * Preserves exact prompting logic and NO_MAP_WEAK_FIT rules.
   */
  public static async mapAnswerAndGenerateNextQuestion(
    question: string,
    answer: string,
    isInitial: boolean,
    interactions: any[],
    mappedCategories: any[],
    taxonomyString: string
  ): Promise<any> {
    const history = interactions
      .map((i) => `Q: ${i.question} | A: ${i.answer} | Mapped: ${i.mappedCategory}`)
      .join("\n");

    // Log the actual URL being called for debugging
    console.log("🔵 Using model:", this.MODEL_NAME);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL_NAME}:generateContent?key=${getGeminiApiKey()}`;

    const systemInstruction = `You are a sophisticated trait mapper and question generator.
    1. First determine whether the ANSWER actually responds to the QUESTION.
    2. If the answer is off-topic, unrelated, generic filler, or does not address the question, set category to 'NO_MAP_WEAK_FIT'.
    3. Otherwise map answer to taxonomy. Use 'NO_MAP_WEAK_FIT' if fit is weak/insufficient.
    4. Generate a clear, specific follow-up question that ends with a "?".
    Respond with JSON: {"category": "...", "justification": "...", "nextQuestion": "..."}`;

    const userPrompt = `QUESTION: ${question}\nANSWER: ${answer}\nHISTORY: ${history}\nTAXONOMY: ${taxonomyString}`;

    try {
      const response = await this.retryWithBackoff(() =>
        axios.post(apiUrl, {
          contents: [{ parts: [{ text: systemInstruction + "\n\n" + userPrompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 2048,
            responseMimetype: "application/json",
          },
        })
      );

      const rawText = response.data.candidates[0].content.parts[0].text;

      // Extract JSON from response
      const jsonString = extractJson(rawText);
      if (!jsonString) {
        console.error("❌ Could not extract JSON from response:", rawText);
        throw new Error("Failed to extract JSON from API response");
      }

      const parsed = JSON.parse(jsonString);
      if (parsed?.nextQuestion) {
        parsed.nextQuestion = this.normalizeQuestion(parsed.nextQuestion);
        if (!this.isQuestionStrong(parsed.nextQuestion)) {
          parsed.nextQuestion = await this.synthesizeNextQuestion(
            interactions,
            mappedCategories,
            taxonomyString
          );
        }
      }
      return parsed;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("❌ Gemini API Error Details:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
          url: apiUrl.replace(/key=[^&]*/, "key=***"),
        });

        if (this.isRateLimitError(error)) {
          throw new Error("Rate limit exceeded. Please wait a moment and try again.");
        }
      }
      throw error;
    }
  }

  private static async encodeImageToBase64(imageUri: string): Promise<string> {
    return await FileSystem.readAsStringAsync(imageUri, {
      encoding: "base64" as any,
    });
  }

  private static normalizeQuestion(question: string): string {
    let normalized = String(question).trim();
    normalized = normalized.replaceAll(/^"+|"+$/g, "").trim();
    normalized = normalized.replaceAll(/\s+/g, " ");

    if (!normalized.endsWith("?")) {
      normalized = `${normalized.replaceAll(/[.!]+$/g, "")}?`;
    }

    return normalized;
  }

  private static isQuestionStrong(question: string): boolean {
    const normalized = question.trim();
    if (!normalized.endsWith("?")) return false;
    const words = normalized.replaceAll(/[?!.]/g, "").split(/\s+/).filter(Boolean);
    return words.length >= 6 && normalized.length >= 24;
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
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL_NAME}:generateContent?key=${getGeminiApiKey()}`;

      const history = interactions
        .map((i) => `Q: ${i.question} | A: ${i.answer} | Mapped: ${i.mappedCategory}`)
        .join("\n");

      const mappedCategoriesList = mappedCategories.map((c) => c.category).join(", ");

      const buildPrompt = (
        strict: boolean
      ) => `Based on all our interactions so far, the taxonomy (including the NO_OP category as a mapping option), and the categories mapped to me so far, synthesize a clear, specific new question that might help tease out which additional categories might map to me. The question must end with a "?".${strict ? " The question must be at least 6 words and 24 characters, and ask for concrete details (what, where, how, or why)." : ""} You may (optionally) use what you've learned about me in previous answers as context in the question if it helps.

HISTORY:
${history}

TAXONOMY:
${taxonomyString}

CATEGORIES MAPPED: ${mappedCategoriesList}

RESPOND ONLY with the text of the new question. Do not include any other text, explanation, or formatting.`;

      // log the actual prompt sent to the model for debugging
      console.log("Synthesizing next question with prompt:", prompt);

      const fetchQuestion = async (strict: boolean) => {
        const requestBody = {
          contents: [
            {
              parts: [{ text: buildPrompt(strict) }],
            },
          ],
          generationConfig: {
            temperature: strict ? 0.5 : 0.9,
            maxOutputTokens: 800,
          },
        };

        return await this.retryWithBackoff(async () => {
          return await axios.post(apiUrl, requestBody, {
            headers: { "Content-Type": "application/json" },
            timeout: 40000,
          });
        });
      };

      const response = await fetchQuestion(false);

      // if the model stopped because it hit our maxOutputTokens limit, log a warning
      const finish = response.data?.candidates?.[0]?.finishReason;
      if (finish === "MAX_TOKENS") {
        console.warn("Gemini response finished with MAX_TOKENS – question may be truncated.");
      }

      console.log("this is the response you get: ", response);

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      const finishReason = response.data?.candidates?.[0]?.finishReason;

      if (!text) {
        throw new Error("No question generated from API");
      }

      let question = this.normalizeQuestion(text);

      // Check if response was incomplete or too weak
      const isIncomplete = finishReason === "MAX_TOKENS" || text.length > 250;
      if (!this.isQuestionStrong(question) || isIncomplete) {
        console.log("Question is incomplete or weak, retrying with stricter settings");
        const strictResponse = await fetchQuestion(true);
        const strictText = strictResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (strictText && strictText.length < 250) {
          question = this.normalizeQuestion(strictText);
        }
      }

      console.log("Synthesized question:", question);

      return question;
    } catch (error) {
      console.error("Error synthesizing question:", error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error("Rate limit exceeded. Please wait a moment and try again.");
        } else if (error.response?.status === 403) {
          throw new Error("API key invalid or missing. Check your .env file.");
        } else if (error.response) {
          throw new Error(`API Error: ${error.response.status} - ${error.response.statusText}`);
        } else if (error.request) {
          throw new Error("Network error. Please check your internet connection.");
        }
      }

      throw new Error("Failed to generate next question");
    }
  }
}
