import express from "express";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { authenticateToken } from "@/middleware/auth";
import { participantSessionDoc, participantSessionInteractionsCollection } from "@/services/firestore";
import type { AuthenticatedRequest, InteractionRecord } from "@/types/firestore";

const router = express.Router();

const parseLimit = (value?: string | string[]) => {
  const asString = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(asString ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 50;
  }
  return Math.min(parsed, 200);
};

const ensureSessionOwnership = async (sessionId: string, uid: string) => {
  const sessionDoc = await participantSessionDoc(uid, sessionId).get();
  if (!sessionDoc.exists) {
    return { code: 404 as const };
  }
  const session = sessionDoc.data();
  if (!session) {
    return { code: 404 as const };
  }
  return { code: 200 as const };
};

router.get("/:sessionId", authenticateToken, async (req, res) => {
  const { uid } = (req as AuthenticatedRequest).user;
  const { sessionId } = req.params as { sessionId: string };
  const { limit } = req.query;
  try {
    const ownership = await ensureSessionOwnership(sessionId, uid);
    if (ownership.code === 404) {
      return res.status(404).json({ error: "Session not found" });
    }
    const snapshot = await participantSessionInteractionsCollection(uid, sessionId)
      .orderBy("createdAt", "asc")
      .limit(parseLimit(limit as string | undefined))
      .get();
    const interactions = snapshot.docs.map((doc: QueryDocumentSnapshot<InteractionRecord>) =>
      doc.data()
    );
    return res.json({ interactions });
  } catch (error) {
    console.error("Error fetching interactions:", error);
    return res.status(500).json({ error: "Failed to fetch interactions" });
  }
});

export default router;
