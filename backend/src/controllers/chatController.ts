import { FieldValue } from "firebase-admin/firestore";
import { embeddingService } from "@/services/embeddingService";
import { vectorSearchService } from "@/services/vectorSearchService";
import { toIsoTimestamp } from "@/services/profilePdfContextService";
import { db } from "@/services/firestore";
import type { Request, Response } from "express";

// Extend Express Request to include authenticated user info added by middleware
interface AuthenticatedRequest extends Request {
  user?: { uid?: string } | null;
}

// chat-embeddings are stored under each participant's `chat-embeddings` subcollection.

function sendError(res: Response, status: number, error: string, details?: unknown) {
  return res.status(status).json({ success: false, data: null, error, details });
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Creates a controller for saving user responses and generating AI replies.
 */
export function createChatController() {
  return {
    /**
     * Saves a response to Firestore and returns a contextual AI response.
     */
    async saveAndRespond(req: AuthenticatedRequest, res: Response): Promise<Response> {
      const requester = req.user;
      const { userId, skillId, responseText, question } = req.body ?? {};
      const resolvedUserId = normalizeText(userId) || requester?.uid || "";
      const resolvedSkillId = normalizeText(skillId);
      const resolvedResponseText = normalizeText(responseText);
      const resolvedQuestion = normalizeText(question);

      if (!resolvedUserId || !resolvedSkillId || !resolvedResponseText || !resolvedQuestion) {
        return sendError(res, 400, "userId, skillId, responseText, and question are required.");
      }

      if (requester?.uid && resolvedUserId !== requester.uid) {
        return sendError(res, 403, "Forbidden");
      }

      try {
        const embedding = await embeddingService.generateEmbedding(resolvedResponseText);
        const similarResponses = await vectorSearchService.findSimilarResponses(
          resolvedSkillId,
          resolvedResponseText,
          5,
          resolvedUserId,
          embedding
        );
        // Treat `userId` in the request as the participant document ID.
        const participantRef = db.collection("participants").doc(resolvedUserId);
        const participantSnap = await participantRef.get();
        if (!participantSnap.exists) return sendError(res, 404, "Participant not found");

        await participantRef.collection("chat-embeddings").add({
          userId: resolvedUserId,
          skillId: resolvedSkillId,
          responseText: resolvedResponseText,
          question: resolvedQuestion,
          createdAt: FieldValue.serverTimestamp(),
          embedding,
        });
        const transformed = similarResponses.map((m) => ({
          id: m.id,
          userId: m.userId,
          skillId: m.skillId,
          excerpt: (m.responseText ?? "").slice(0, 300),
          createdAt: toIsoTimestamp(m.createdAt),
          distance: m.distance,
        }));
        return res.json({
          success: true,
          data: { similarResponses: transformed },
          error: null,
        });
      } catch (error) {
        console.error("Error saving and responding:", error);
        return sendError(res, 500, "Failed to process chat response");
      }
    },
  };
}

/**
 * Default chat controller instance.
 */
export const chatController = createChatController();
