import axios from "axios";
import * as FileSystem from "expo-file-system/legacy";
import { AnalysisResult, TranscriptAnalysis } from "../types";
import { CONFIG, getGeminiApiKey } from "../config/env";
import {
  normalizeSkills,
  mapSkillToTaxonomy,
  findSkillCategory,
} from "./skillTaxonomyService";
import { saveIdentifiedSkills } from "./userSkillsService";

export class GeminiService {
  // Test method to validate API connection
  public static async testApiConnection(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const apiUrl = `${CONFIG.GEMINI_API_URL}?key=${getGeminiApiKey()}`;
      console.log("Testing API connection to:", apiUrl);

      const testRequestBody = {
        contents: [
          {
            parts: [
              {
                text: "Hello, this is a test message.",
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 100,
        },
      };

      const response = await axios.post(apiUrl, testRequestBody, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000, // Timeout for test
      });

      console.log("Test API Response:", response.status);
      return { success: true };
    } catch (error) {
      console.error("API Connection Test Failed:", error);

      if (axios.isAxiosError(error)) {
        if (error.response) {
          return {
            success: false,
            error: `API Error: ${error.response.status} - ${error.response.statusText}`,
          };
        } else if (error.request) {
          return {
            success: false,
            error: "Network Error: No response from server",
          };
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
  private static async encodeImageToBase64(imageUri: string): Promise<string> {
    try {
      console.log("Encoding image from URI:", imageUri);

      // Get file info to check size
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      const fileSize = (fileInfo as any)?.size as number | undefined;
      if (fileSize != null) {
        console.log(
          "Image file size:",
          fileSize,
          "bytes",
          "(" + (fileSize / 1024 / 1024).toFixed(2) + " MB)",
        );
      }

      // Check if file is too large (max 4MB for API)
      if (fileSize && fileSize > CONFIG.MAX_IMAGE_SIZE) {
        throw new Error(
          `Image is too large (${(fileSize / 1024 / 1024).toFixed(2)} MB). Maximum size is ${CONFIG.MAX_IMAGE_SIZE / 1024 / 1024} MB.`,
        );
      }

      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        // EncodingType enum moved; string literal is supported in SDK 54
        encoding: "base64" as any,
      });

      console.log(
        "Base64 encoded image size:",
        base64.length,
        "characters",
        "(" + (base64.length / 1024 / 1024).toFixed(2) + " MB)",
      );

      // Check if base64 is too large (API limit is around 20MB)
      if (base64.length > 20 * 1024 * 1024) {
        throw new Error(
          "Image is too large after encoding. Please use a smaller image.",
        );
      }

      return base64;
    } catch (error) {
      console.error("Error encoding image:", error);
      throw new Error(
        "Failed to encode image to base64: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    }
  }

  //written from claude.
  private static createPrompt(): string {
    return `Analyze this academic transcript image and extract course information. Return a JSON object with this structure:

{
  "courses": [
    {
      "code": "Course code",
      "name": "Course name",
      "grade": "Grade received",
      "credits": "Credit hours",
      "semester": "Semester if available",
      "year": "Year if available"
    }
  ],
  "gpa": "Overall GPA if visible",
  "totalCredits": "Total credit hours if visible",
  "institution": "Institution name if visible",
  "studentName": "Student name if visible",
  "degree": "Degree program if visible",
  "graduationDate": "Graduation date if visible"
}

Extract all visible course information accurately. If information is not clear, use null or omit the field. Return only valid JSON.`;
  }

  public static async analyzeTranscript(
    imageUri: string,
  ): Promise<AnalysisResult> {
    try {
      const base64Image = await this.encodeImageToBase64(imageUri);

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: this.createPrompt(),
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 2048,
        },
      };

      // Try the primary model first
      let apiUrl = `${CONFIG.GEMINI_API_URL}?key=${getGeminiApiKey()}`;
      console.log("Making API request to:", apiUrl);
      console.log(
        "Request body size:",
        JSON.stringify(requestBody).length,
        "characters",
      );

      let response;
      try {
        response = await axios.post(apiUrl, requestBody, {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: CONFIG.REQUEST_TIMEOUT,
        });
      } catch (error) {
        // If first model fails, try the 1.5 flash model as fallback
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          console.log("Primary model failed, trying fallback model...");
          const fallbackUrl =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
          apiUrl = `${fallbackUrl}?key=${getGeminiApiKey()}`;

          response = await axios.post(apiUrl, requestBody, {
            headers: {
              "Content-Type": "application/json",
            },
            timeout: CONFIG.REQUEST_TIMEOUT,
          });
        } else {
          throw error;
        }
      }

      console.log("API Response received:", response.status);

      const responseText = response.data.candidates[0].content.parts[0].text;

      // Try to extract JSON from the response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          success: false,
          error: "Could not parse JSON response from Gemini",
          rawResponse: responseText,
        };
      }

      const parsedData: TranscriptAnalysis = JSON.parse(jsonMatch[0]);

      return {
        success: true,
        data: parsedData,
        rawResponse: responseText,
      };
    } catch (error) {
      console.error("Error analyzing transcript:", error);

      // Enhanced error handling for different types of errors
      let errorMessage = "Unknown error occurred";
      let errorDetails = "";

      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Server responded with error status
          errorMessage = `API Error: ${error.response.status} - ${error.response.statusText}`;
          errorDetails = `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`;
          console.error("API Response Error:", error.response.data);
        } else if (error.request) {
          // Request was made but no response received
          errorMessage = "Network Error: No response from server";
          errorDetails = "Check your internet connection and try again";
        } else {
          // Something else happened
          errorMessage = `Request Error: ${error.message}`;
          errorDetails = error.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = error.stack || error.message;
      }

      return {
        success: false,
        error: errorMessage,
        rawResponse: errorDetails,
      };
    }
  }

  // Send audio file to Gemini API for transcription
  public static async transcribeAudio(
    audioUri: string,
  ): Promise<{ success: boolean; transcript?: string; error?: string }> {
    try {
      console.log("Starting audio transcription for:", audioUri);

      // Add a mandatory delay to prevent rate limiting (15 RPM limit = 4 seconds between requests)
      console.log("Waiting 4.5 seconds before audio transcription request...");
      await new Promise((resolve) => setTimeout(resolve, 4500));

      // Determine MIME type based on file extension
      let mimeType = "audio/wav";
      if (audioUri.includes(".m4a")) {
        mimeType = "audio/mp4";
      } else if (audioUri.includes(".mp3")) {
        mimeType = "audio/mpeg";
      } else if (audioUri.includes(".aac")) {
        mimeType = "audio/aac";
      }

      console.log("Detected audio format:", mimeType);

      // Encode audio to base64
      // Get audio file info first
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      const fileSizeMB =
        fileInfo.exists && "size" in fileInfo
          ? (fileInfo.size / (1024 * 1024)).toFixed(2)
          : "unknown";
      console.log(`Audio file size: ${fileSizeMB} MB`);

      const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
        encoding: "base64" as any,
      });

      const base64SizeMB = (base64Audio.length / (1024 * 1024)).toFixed(2);
      console.log(
        `Audio encoded to base64, size: ${base64Audio.length} characters (${base64SizeMB} MB)`,
      );

      // Use the same API URL as image parsing (gemini-2.0-flash) which supports audio
      const apiUrl = `${CONFIG.GEMINI_API_URL}?key=${getGeminiApiKey()}`;

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: "Please transcribe the following audio file. Return only the transcribed text, no additional formatting or commentary.",
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Audio,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      };

      // Use retry logic for rate limiting
      const makeTranscriptionRequest = async () => {
        const response = await axios.post(apiUrl, requestBody, {
          headers: { "Content-Type": "application/json" },
          timeout: CONFIG.REQUEST_TIMEOUT,
        });
        return response;
      };

      const response = await GeminiService.retryWithBackoff(
        makeTranscriptionRequest,
      );

      const transcript =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!transcript) {
        return {
          success: false,
          error: "No transcription received from API",
        };
      }

      console.log("Transcription successful:", transcript.length, "characters");
      return {
        success: true,
        transcript: transcript.trim(),
      };
    } catch (error) {
      console.error("Error transcribing audio:", error);

      let errorMessage = "Audio transcription failed";
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Log the full error response for debugging
          console.error(
            "API Error Response:",
            JSON.stringify(error.response.data, null, 2),
          );
          errorMessage = `API Error: ${error.response.status} - ${error.response.statusText}`;

          // Add more specific error details if available
          if (error.response.data?.error?.message) {
            errorMessage += ` - ${error.response.data.error.message}`;
          }
        } else if (error.request) {
          errorMessage = "Network Error: No response from server";
        } else {
          errorMessage = `Request Error: ${error.message}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Send plain text (e.g., on-device STT transcript) to Gemini and get a response string
  public static async processTranscriptText(
    transcript: string,
  ): Promise<string> {
    try {
      const apiUrl = `${CONFIG.GEMINI_API_URL}?key=${getGeminiApiKey()}`;
      const requestBody = {
        contents: [
          {
            parts: [
              {
                text:
                  `You will receive a transcript captured via on-device speech recognition.\n` +
                  `Transcript:\n"""${transcript}"""\n` +
                  `Provide a concise response or summary. If a task is requested, perform it.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
        },
      };

      const response = await axios.post(apiUrl, requestBody, {
        headers: { "Content-Type": "application/json" },
        timeout: CONFIG.REQUEST_TIMEOUT,
      });

      return response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } catch (error) {
      console.error("Error processing transcript text:", error);
      return "";
    }
  }

  // Analyze actions in images using skills taxonomy
  public static async analyzeActionImage(
    imageUri: string,
  ): Promise<AnalysisResult> {
    try {
      const base64Image = await this.encodeImageToBase64(imageUri);

      const taxonomyPrompt = `
Analyze this image and identify what action or activity is being performed. Based on what you see, analyze the activity using this skills taxonomy framework:

SKILLS TAXONOMY:
1. Human Skills: Communication, Collaboration, Leadership, Empathy, Active Listening, Conflict Resolution, Networking, Public Speaking, Team Management
2. Meta-Learning: Critical Thinking, Research Skills, Self-Reflection, Learning Strategies, Information Synthesis, Knowledge Transfer, Continuous Learning, Adaptability
3. Maker & Builder: Prototyping, Design Thinking, Craftsmanship, Innovation, Technical Skills, Project Management, Problem Solving, Creative Construction, Engineering
4. Civic Impact: Community Engagement, Social Responsibility, Advocacy, Volunteer Work, Policy Understanding, Cultural Awareness, Environmental Stewardship, Civic Participation
5. Creative Expression: Artistic Creation, Storytelling, Music, Writing, Visual Arts, Performance, Creative Problem Solving, Imagination, Aesthetic Appreciation
6. Problem-Solving: Analytical Thinking, Strategic Planning, Troubleshooting, Decision Making, Systems Thinking, Root Cause Analysis, Innovation, Logic, Pattern Recognition
7. Work Experience: Professional Skills, Industry Knowledge, Workplace Etiquette, Time Management, Client Relations, Business Acumen, Career Development, Mentorship
8. Future Self: Goal Setting, Vision Creation, Personal Growth, Skill Development, Career Planning, Life Balance, Self-Improvement, Aspiration Mapping

Return a JSON object with this structure:
{
  "activity_description": "Brief description of what activity/action is shown in the image",
  "primary_skills": ["List of 3-5 most relevant skills from the taxonomy"],
  "taxonomy_categories": ["List of 2-3 most relevant category names"],
  "skill_development_insights": "Analysis of how this activity develops skills and what it reveals about interests",
  "flow_state_potential": "Explanation of why this activity might cause someone to lose track of time",
  "growth_opportunities": "Suggestions for related skills or activities to explore",
  "confidence_level": "High/Medium/Low - how confident the analysis is based on image clarity"
}

Analyze the image carefully and provide thoughtful insights about the skills being demonstrated or developed through the observed activity.`;

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: taxonomyPrompt,
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 32,
          topP: 1,
          maxOutputTokens: 2048,
        },
      };

      // Try the primary model first
      let apiUrl = `${CONFIG.GEMINI_API_URL}?key=${getGeminiApiKey()}`;
      console.log("Making action analysis API request to:", apiUrl);

      let response;
      try {
        response = await axios.post(apiUrl, requestBody, {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: CONFIG.REQUEST_TIMEOUT,
        });
      } catch (error) {
        // If first model fails, try the 1.5 flash model as fallback
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          console.log("Primary model failed, trying fallback model...");
          const fallbackUrl =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
          apiUrl = `${fallbackUrl}?key=${getGeminiApiKey()}`;

          response = await axios.post(apiUrl, requestBody, {
            headers: {
              "Content-Type": "application/json",
            },
            timeout: CONFIG.REQUEST_TIMEOUT,
          });
        } else {
          throw error;
        }
      }

      console.log("Action analysis API Response received:", response.status);

      const responseText = response.data.candidates[0].content.parts[0].text;

      // Try to extract JSON from the response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          success: false,
          error: "Could not parse JSON response from Gemini",
          rawResponse: responseText,
        };
      }

      const parsedData = JSON.parse(jsonMatch[0]);

      // Normalize skills to match taxonomy exactly
      if (
        parsedData.primary_skills &&
        Array.isArray(parsedData.primary_skills)
      ) {
        const normalizedSkills = normalizeSkills(parsedData.primary_skills);

        // Log the mapping for debugging
        console.log("Original skills:", parsedData.primary_skills);
        console.log("Normalized skills:", normalizedSkills);

        // Replace with normalized skills
        parsedData.primary_skills = normalizedSkills;

        // Save identified skills to AsyncStorage
        try {
          const categories = normalizedSkills.map(
            (skill) => findSkillCategory(skill) || "Unknown",
          );
          await saveIdentifiedSkills(normalizedSkills, categories, "image");
          console.log("Skills saved to storage");
        } catch (error) {
          console.error("Error saving skills to storage:", error);
          // Don't fail the whole operation if storage fails
        }
      }

      return {
        success: true,
        data: parsedData,
        rawResponse: responseText,
      };
    } catch (error) {
      console.error("Error analyzing action image:", error);

      // Enhanced error handling
      let errorMessage = "Unknown error occurred";
      let errorDetails = "";

      if (axios.isAxiosError(error)) {
        if (error.response) {
          errorMessage = `API Error: ${error.response.status} - ${error.response.statusText}`;
          errorDetails = `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`;
          console.error("API Response Error:", error.response.data);
        } else if (error.request) {
          errorMessage = "Network Error: No response from server";
          errorDetails = "Check your internet connection and try again";
        } else {
          errorMessage = `Request Error: ${error.message}`;
          errorDetails = error.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = error.stack || error.message;
      }

      return {
        success: false,
        error: errorMessage,
        rawResponse: errorDetails,
      };
    }
  }

  /**
   * Dialogue-based Category Mapping Functions
   * Matching web app implementation
   */

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

        // Check if it's a rate limit error (429)
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          const delay = initialDelay * Math.pow(2, attempt);
          console.log(
            `Rate limit hit. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // For other errors, throw immediately
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Synthesize next question based on conversation history
   */

  public static async mapAnswerAndGenerateNextQuestion(
    question: string,
    answer: string,
    isInitial: boolean,
    interactions: Array<{
      question: string;
      answer: string;
      mappedCategory: string;
    }>,
    mappedCategories: Array<{ category: string }>,
    taxonomyString: string,
  ): Promise<{
    category: string;
    justification: string;
    nextQuestion: string | null;
  }> {
    try {
      // Add mandatory delay to avoid hitting rate limits (15 RPM limit = 4 seconds between requests)
      console.log("Waiting 4.5 seconds before combined API call...");
      await new Promise((resolve) => setTimeout(resolve, 4500));

      const apiUrl = `${CONFIG.GEMINI_API_URL}?key=${getGeminiApiKey()}`;

      const mappedCategoryNames = mappedCategories.map((c) => c.category);
      const mappedCategoriesList = mappedCategoryNames.join(", ");

      const history = interactions
        .map(
          (i) =>
            `Q: ${i.question} | A: ${i.answer} | Mapped: ${i.mappedCategory}`,
        )
        .join("\n");

      let systemInstruction: string;
      let userPrompt: string;

      if (isInitial) {
        systemInstruction = `You are a sophisticated trait mapper and question generator. Your task is to:
1. Analyze the user's answer and map it to the single most applicable category from the provided taxonomy. **Crucially, you must only map to a real category if the answer obviously and rigorously fits. If the fit is weak, uncertain, or the answer is generic, you MUST choose the 'NO_MAP_WEAK_FIT' category.**
2. Generate a thoughtful follow-up question that might help identify additional categories.

You MUST respond with a valid JSON object with these fields:
- "category": the exact category name from the taxonomy
- "justification": a short, two-sentence summary (max 30 words) explaining why this user's answer maps to the chosen category
- "nextQuestion": a new question to help identify more categories (or null if all categories are mapped)`;

        userPrompt = `I have been asked "${question}". My answer is "${answer}".

TAXONOMY:
${taxonomyString}

Analyze my answer, map it to the most appropriate category, and generate a follow-up question to explore other potential categories.`;
      } else {
        systemInstruction = `You are a sophisticated trait mapper and question generator. Your task is to:
1. Analyze the user's answer and map it to the single most applicable category from the provided taxonomy that is STILL NOT MAPPED. **Crucially, you must only map to a real category if the answer obviously and rigorously fits. If the fit is weak, uncertain, or the answer is generic, you MUST choose the 'NO_MAP_WEAK_FIT' category.**
2. Generate a thoughtful follow-up question based on conversation history that might help identify additional unmapped categories.

You MUST respond with a valid JSON object with these fields:
- "category": the exact category name from the taxonomy (must not be in already-mapped list)
- "justification": a short, two-sentence summary (max 30 words) explaining why this user's answer maps to the chosen category
- "nextQuestion": a new question to help identify more categories (or null if all categories are mapped)`;

        userPrompt = `I have been asked "${question}". My answer is "${answer}".

CONVERSATION HISTORY:
${history}

TAXONOMY:
${taxonomyString}

CATEGORIES ALREADY MAPPED: ${mappedCategoriesList}

Analyze my answer, map it to an unmapped category (or NO_MAP_WEAK_FIT), and generate a follow-up question that uses context from our conversation.`;
      }

      console.log(
        "Combined API call: mapping answer + generating next question...",
      );

      const requestBody = {
        contents: [
          {
            parts: [{ text: systemInstruction + "\n\n" + userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.5, // Balanced between mapping (0.3) and question generation (0.9)
          maxOutputTokens: 500, // Enough for both tasks
          responseMimeType: "application/json",
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
        throw new Error("No response from API");
      }

      console.log("Raw combined response:", text);

      // Parse JSON response
      const jsonResponse = JSON.parse(text);

      if (!jsonResponse.category || !jsonResponse.justification) {
        throw new Error("Invalid response format from API");
      }

      console.log("Mapped to category:", jsonResponse.category);
      console.log("Justification:", jsonResponse.justification);
      console.log("Next question:", jsonResponse.nextQuestion);

      return {
        category: jsonResponse.category,
        justification: jsonResponse.justification,
        nextQuestion: jsonResponse.nextQuestion || null,
      };
    } catch (error) {
      console.error("Error in combined mapping + question generation:", error);

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

      if (error instanceof Error && error.message.includes("JSON")) {
        throw new Error("Failed to parse API response. Please try again.");
      }

      throw new Error("Failed to process answer and generate question");
    }
  }

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
      const apiUrl = `${CONFIG.GEMINI_API_URL}?key=${getGeminiApiKey()}`;

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

  /**
   * Map user answer to category with NO_OP support
   */
  public static async mapAnswerToCategory(
    question: string,
    answer: string,
    isInitial: boolean,
    taxonomyString: string,
    mappedCategories: Array<{ category: string }>,
  ): Promise<{
    category: string;
    justification: string;
  }> {
    try {
      // Add mandatory delay to avoid hitting rate limits (15 RPM limit = 4 seconds between requests)
      console.log("Waiting 4.5 seconds before mapping to avoid rate limits...");
      await new Promise((resolve) => setTimeout(resolve, 4500));

      const apiUrl = `${CONFIG.GEMINI_API_URL}?key=${getGeminiApiKey()}`;

      const systemInstruction = `You are a sophisticated trait mapper. Your task is to analyze user input and map it to the single most applicable category from the provided taxonomy. **Crucially, you must only map to a real category if the answer obviously and rigorously fits. If the fit is weak, uncertain, or the answer is generic, you MUST choose the 'NO_MAP_WEAK_FIT' category.** The taxonomy includes descriptions and sample experience stamps to guide your decision. You MUST respond with a valid JSON object with fields: "category" (the exact category name) and "justification" (a short, two-sentence summary, max 30 words, explaining why this user's answer maps to the chosen category).`;

      let userPrompt: string;

      if (isInitial) {
        userPrompt = `I have been asked "${question}". My answer to the question is "${answer}".
Take this information along with the full taxonomy below, and decide which category in the taxonomy is most likely applicable to me.

TAXONOMY:
${taxonomyString}`;
      } else {
        const mappedCategoryNames = mappedCategories.map((c) => c.category);
        const mappedCategoriesList = mappedCategoryNames.join(", ");

        userPrompt = `I have been asked "${question}". My answer to the question is "${answer}".
Take this information along with the full taxonomy, the list of categories already mapped to me, and decide which category in the taxonomy that is STILL NOT MAPPED TO ME is most likely applicable to me based on the last question/answer, or choose 'NO_MAP_WEAK_FIT' if the mapping is not rigorous.

TAXONOMY:
${taxonomyString}

CATEGORIES ALREADY MAPPED: ${mappedCategoriesList}`;
      }

      console.log("Mapping answer to category...");

      const requestBody = {
        contents: [
          {
            parts: [{ text: systemInstruction + "\n\n" + userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 300,
          responseMimeType: "application/json",
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
        throw new Error("No mapping response from API");
      }

      console.log("Raw mapping response:", text);

      // Parse JSON response
      const jsonResponse = JSON.parse(text);

      if (!jsonResponse.category || !jsonResponse.justification) {
        throw new Error("Invalid response format from API");
      }

      console.log("Mapped to category:", jsonResponse.category);
      console.log("Justification:", jsonResponse.justification);

      return {
        category: jsonResponse.category,
        justification: jsonResponse.justification,
      };
    } catch (error) {
      console.error("Error mapping answer to category:", error);

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

      if (error instanceof Error && error.message.includes("JSON")) {
        throw new Error("Failed to parse API response. Please try again.");
      }

      throw new Error("Failed to map answer to category");
    }
  }
}
