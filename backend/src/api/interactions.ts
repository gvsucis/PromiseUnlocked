import express from "express";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { authenticateToken } from "@/middleware/auth";
import {
  normalizeInteraction,
  participantSessionDoc,
  participantSessionInteractionsCollection,
} from "@/services/firestore";
import type { AuthenticatedRequest, InteractionRecord } from "@/types/firestore";
import { canAccessParticipant } from "@/utils/authz";

const router = express.Router({ mergeParams: true });

const parseLimit = (value?: string | string[]) => {
  const asString = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(asString ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 50;
  }
  return Math.min(parsed, 200);
};

// Utility to resolve participantId and sessionId from params
function resolveParticipantAndSessionId(params: Record<string, any>): {
  participantId?: string;
  sessionId?: string;
} {
  return {
    participantId: params.participantId || params.uid || params.id,
    sessionId: params.sessionId,
  };
}

const ensureSessionOwnership = async (participantId: string, sessionId: string) => {
  const sessionDoc = await participantSessionDoc(participantId, sessionId).get();
  if (!sessionDoc.exists) {
    return { code: 404 as const };
  }
  const session = sessionDoc.data();
  if (!session) {
    return { code: 404 as const };
  }
  return { code: 200 as const };
};

// GET all interactions for a session
router.get("/", authenticateToken, async (req, res) => {
  const { participantId, sessionId } = resolveParticipantAndSessionId(req.params);
  const { limit } = req.query;
  const requester = (req as AuthenticatedRequest).user;
  if (!participantId || !sessionId) {
    return res.status(400).json({ error: "Missing participantId or sessionId in route." });
  }
  try {
    if (!(await canAccessParticipant(requester, participantId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const ownership = await ensureSessionOwnership(participantId, sessionId);
    if (ownership.code === 404) {
      return res.status(404).json({ error: "Session not found" });
    }
    const snapshot = await participantSessionInteractionsCollection(participantId, sessionId)
      .orderBy("timestamp", "asc")
      .limit(parseLimit(limit as string | undefined))
      .get();
    const interactions = snapshot.docs.map((doc: QueryDocumentSnapshot<InteractionRecord>) =>
      normalizeInteraction(doc)
    );
    return res.json({ interactions });
  } catch (error) {
    console.error("Error fetching interactions:", error);
    return res.status(500).json({ error: "Failed to fetch interactions" });
  }
});

// GET a single interaction by id
router.get("/:interactionId", authenticateToken, async (req, res) => {
  const { participantId, sessionId } = resolveParticipantAndSessionId(req.params);
  const { interactionId } = req.params as { interactionId: string };
  const requester = (req as AuthenticatedRequest).user;
  if (!participantId || !sessionId || !interactionId) {
    return res
      .status(400)
      .json({ error: "Missing participantId, sessionId, or interactionId in route." });
  }
  try {
    if (!(await canAccessParticipant(requester, participantId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const doc = await participantSessionInteractionsCollection(participantId, sessionId)
      .doc(interactionId)
      .get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Interaction not found" });
    }
    return res.json({ interaction: normalizeInteraction(doc) });
  } catch (error) {
    console.error("Error fetching interaction:", error);
    return res.status(500).json({ error: "Failed to fetch interaction" });
  }
});

//Get Interaction for authenticated participant's session
router.get("/me/:interactionId", authenticateToken, async (req, res) => {
  const { sessionId } = req.params as { sessionId: string };
  const { interactionId } = req.params as { interactionId: string };
  const requester = (req as AuthenticatedRequest).user;
  if (!sessionId || !interactionId) {
    return res.status(400).json({ error: "Missing sessionId or interactionId in route." });
  }
  try {
    const doc = await participantSessionInteractionsCollection(requester.uid, sessionId)
      .doc(interactionId)
      .get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Interaction not found" });
    }
    return res.json({ interaction: normalizeInteraction(doc) });
  } catch (error) {
    console.error("Error fetching interaction:", error);
    return res.status(500).json({ error: "Failed to fetch interaction" });
  }
});
export default router;
