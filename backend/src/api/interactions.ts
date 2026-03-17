import express from "express";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { authenticateToken } from "../middleware/auth";
import { interactionsCollection, sessionsCollection } from "../services/firestore";
import type { AuthenticatedRequest, InteractionRecord } from "../types/firestore";

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
  const sessionDoc = await sessionsCollection.doc(sessionId).get();
  if (!sessionDoc.exists) {
    return { code: 404 as const };
  }
  const session = sessionDoc.data();
  if (!session) {
    return { code: 404 as const };
  }
  if (session.userId !== uid) {
    return { code: 403 as const };
  }
  return { code: 200 as const };
};

router.post("/", authenticateToken, async (req, res) => {
  const { sessionId, type, payload = {} } = req.body ?? {};
  if (!sessionId || !type) {
    return res.status(400).json({ error: "sessionId and type are required" });
  }
  const { uid } = (req as AuthenticatedRequest).user;
  try {
    const ownership = await ensureSessionOwnership(sessionId, uid);
    if (ownership.code === 404) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (ownership.code === 403) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const interaction: InteractionRecord = {
      sessionId,
      userId: uid,
      type,
      payload,
      createdAt: Date.now(),
    };
    const docRef = await interactionsCollection.add(interaction);
    return res.status(201).json({ interaction: { ...interaction, id: docRef.id } });
  } catch (error) {
    console.error("Error logging interaction:", error);
    return res.status(500).json({ error: "Failed to log interaction" });
  }
});

router.get("/:sessionId", authenticateToken, async (req, res) => {
  const { uid } = (req as AuthenticatedRequest).user;
  const { sessionId } = req.params as { sessionId: string };
  const { limit } = req.query;
  try {
    const ownership = await ensureSessionOwnership(sessionId, uid);
    if (ownership.code === 404) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (ownership.code === 403) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const snapshot = await interactionsCollection
      .where("sessionId", "==", sessionId)
      .orderBy("createdAt", "asc")
      .limit(parseLimit(limit as string | undefined))
      .get();
    const interactions = snapshot.docs.map((doc: QueryDocumentSnapshot<InteractionRecord>) =>
      doc.data(),
    );
    return res.json({ interactions });
  } catch (error) {
    console.error("Error fetching interactions:", error);
    return res.status(500).json({ error: "Failed to fetch interactions" });
  }
});

router.delete("/:interactionId", authenticateToken, async (req, res) => {
  const { uid } = (req as AuthenticatedRequest).user;
  const { interactionId } = req.params as { interactionId: string };
  try {
    const doc = await interactionsCollection.doc(interactionId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Interaction not found" });
    }
    const interaction = doc.data();
    if (!interaction) {
      return res.status(404).json({ error: "Interaction not found" });
    }
    const ownership = await ensureSessionOwnership(interaction.sessionId, uid);
    if (ownership.code === 404) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (ownership.code === 403) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await interactionsCollection.doc(interactionId).delete();
    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting interaction:", error);
    return res.status(500).json({ error: "Failed to delete interaction" });
  }
});

export default router;
