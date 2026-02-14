import axios from "axios";
import * as FileSystem from "expo-file-system/legacy";
import { AnalysisResult, TranscriptAnalysis } from "../types";
import { CONFIG, getGeminiApiKey } from "../config/env";

export class GeminiService {
  private static readonly MODEL_NAME = CONFIG.TEXT_MODEL;

  /**
   * Helper: Retry with exponential backoff for rate limits
   */
  private static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 4,
    initialDelay: number = 2000,
  ): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          const delay = initialDelay * Math.pow(2, attempt);
          console.log(
            `Rate limit hit. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
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
      const response = await axios.post(
        apiUrl,
        {
          contents: [{ parts: [{ text: "Test" }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 10 },
        },
        { timeout: 10000 },
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
  public static async analyzeTranscript(
    imageUri: string,
  ): Promise<AnalysisResult> {
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

      const response = await axios.post(apiUrl, requestBody, {
        timeout: CONFIG.REQUEST_TIMEOUT,
      });
      const text = response.data.candidates[0].content.parts[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      return {
        success: true,
        data: JSON.parse(jsonMatch ? jsonMatch[0] : text),
        rawResponse: text,
      };
    } catch (error) {
      return {
        success: false,
        error: "Analysis failed",
        rawResponse: String(error),
      };
    }
  }

  /**
   * PUBLIC API: TRANSCRIBE AUDIO
   */
  public static async transcribeAudio(
    audioUri: string,
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
        axios.post(apiUrl, requestBody),
      );
      const transcript =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

      return { success: true, transcript: transcript?.trim() };
    } catch (error) {
      return { success: false, error: "Transcription failed" };
    }
  }

  /**
   * PUBLIC API: PROCESS TRANSCRIPT TEXT
   */
  public static async processTranscriptText(
    transcript: string,
  ): Promise<string> {
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL_NAME}:generateContent?key=${getGeminiApiKey()}`;
      const response = await axios.post(apiUrl, {
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
      return response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } catch (error) {
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
    taxonomyString: string,
  ): Promise<any> {
    const history = interactions
      .map(
        (i) =>
          `Q: ${i.question} | A: ${i.answer} | Mapped: ${i.mappedCategory}`,
      )
      .join("\n");
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL_NAME}:generateContent?key=${getGeminiApiKey()}`;

    const systemInstruction = `You are a sophisticated trait mapper and question generator.
    1. Map answer to taxonomy. Use 'NO_MAP_WEAK_FIT' if fit is weak.
    2. Generate follow-up question.
    Respond with JSON: {"category": "...", "justification": "...", "nextQuestion": "..."}`;

    const userPrompt = `QUESTION: ${question}\nANSWER: ${answer}\nHISTORY: ${history}\nTAXONOMY: ${taxonomyString}`;

    const response = await this.retryWithBackoff(() =>
      axios.post(apiUrl, {
        contents: [
          { parts: [{ text: systemInstruction + "\n\n" + userPrompt }] },
        ],
        generationConfig: {
          temperature: 0.5,
          responseMimeType: "application/json",
        },
      }),
    );

    return JSON.parse(response.data.candidates[0].content.parts[0].text);
  }

  private static async encodeImageToBase64(imageUri: string): Promise<string> {
    return await FileSystem.readAsStringAsync(imageUri, {
      encoding: "base64" as any,
    });
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
    taxonomyString: string,
  ): Promise<string> {
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL_NAME}:generateContent?key=${getGeminiApiKey()}`;

      const history = interactions
        .map(
          (i) =>
            `Q: ${i.question} | A: ${i.answer} | Mapped: ${i.mappedCategory}`,
        )
        .join("\n");

      const mappedCategoriesList = mappedCategories
        .map((c) => c.category)
        .join(", ");

      const prompt = `Based on all our interactions so far, the taxonomy (including the NO_OP category as a mapping option), and the categories mapped to me so far, synthesize a new question that might help tease out which additional categories might map to me. You may (optionally) use what you've learned about me in previous answers as context in the question if it helps.

HISTORY:
${history}

TAXONOMY:
${taxonomyString}

CATEGORIES MAPPED: ${mappedCategoriesList}

RESPOND ONLY with the text of the new question. Do not include any other text, explanation, or formatting.`;

      console.log("Synthesizing next question...");

      const requestBody = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 200,
        },
      };

      // Use retry logic with exponential backoff
      const response = await this.retryWithBackoff(async () => {
        return await axios.post(apiUrl, requestBody, {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        });
      });

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error("No question generated from API");
      }

      const question = text.trim();
      console.log("Synthesized question:", question);

      return question;
    } catch (error) {
      console.error("Error synthesizing question:", error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error(
            "Rate limit exceeded. Please wait a moment and try again.",
          );
        } else if (error.response?.status === 403) {
          throw new Error("API key invalid or missing. Check your .env file.");
        } else if (error.response) {
          throw new Error(
            `API Error: ${error.response.status} - ${error.response.statusText}`,
          );
        } else if (error.request) {
          throw new Error(
            "Network error. Please check your internet connection.",
          );
        }
      }

      throw new Error("Failed to generate next question");
    }
  }
}
