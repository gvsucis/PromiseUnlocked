import express from "express";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { authenticateToken } from "@/middleware/auth";
import { participantSessionDoc, participantSessionsCollection } from "@/services/firestore";
import type { AuthenticatedRequest, SessionRecord } from "@/types/firestore";

const router = express.Router();

const parseLimit = (value?: string | string[]) => {
  const asString = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(asString ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, 100);
};

router.get("/", authenticateToken, async (req, res) => {
  const { uid } = (req as AuthenticatedRequest).user;
  const { status, limit } = req.query;
  let query = participantSessionsCollection(uid).orderBy("startedAt", "desc");
  if (typeof status === "string" && ["active", "completed", "cancelled"].includes(status)) {
    query = query.where("status", "==", status);
  }
  try {
    const snapshot = await query.limit(parseLimit(limit as string | undefined)).get();
    const sessions = snapshot.docs.map((doc: QueryDocumentSnapshot<SessionRecord>) => doc.data());
    return res.json({ sessions });
  } catch (error) {
    console.error("Error listing sessions:", error);
    return res.status(500).json({ error: "Failed to list sessions" });
  }
});

router.get("/:sessionId", authenticateToken, async (req, res) => {
  const { uid } = (req as AuthenticatedRequest).user;
  const { sessionId } = req.params as { sessionId: string };
  try {
    const doc = await participantSessionDoc(uid, sessionId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Session not found" });
    }
    const session = doc.data();
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    return res.json({ session });
  } catch (error) {
    console.error("Error fetching session:", error);
    return res.status(500).json({ error: "Failed to fetch session" });
  }
});

export default router;
