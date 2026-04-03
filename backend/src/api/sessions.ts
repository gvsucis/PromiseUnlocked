import express from "express";
import { authenticateToken } from "@/middleware/auth";
import { participantSessionDoc, participantSessionsCollection } from "@/services/firestore";
import type { SessionRecord } from "@/types/firestore";

const router = express.Router({ mergeParams: true });

const parseLimit = (value?: string | string[]) => {
  const asString = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(asString ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, 100);
};

// Utility to resolve participantId from req.params
function resolveParticipantId(params: Record<string, any>): string | undefined {
  return params.participantId || params.uid || params.id;
}

router.get("/", authenticateToken, async (req, res) => {
  const { status, limit } = req.query;
  const participantId = resolveParticipantId(req.params);
  if (!participantId) {
    return res.status(400).json({ error: "Missing participantId in route." });
  }
  let query = participantSessionsCollection(participantId).orderBy("startedAt", "desc");
  if (typeof status === "string" && ["active", "completed", "cancelled"].includes(status)) {
    query = query.where("status", "==", status);
  }
  try {
    const snapshot = await query.limit(parseLimit(limit as string | undefined)).get();
    // Use normalizeSession for each doc
    const { normalizeSession } = await import("@/services/firestore");
    const sessions = snapshot.docs.map((doc) => normalizeSession(doc));
    return res.json({ sessions });
  } catch (error) {
    console.error("Error listing sessions:", error);
    return res.status(500).json({ error: "Failed to list sessions" });
  }
});

router.get("/:sessionId", authenticateToken, async (req, res) => {
  const participantId = resolveParticipantId(req.params);
  const { sessionId } = req.params as { sessionId: string };
  if (!participantId) {
    return res.status(400).json({ error: "Missing participantId in route." });
  }
  try {
    const doc = await participantSessionDoc(participantId, sessionId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Session not found" });
    }
    const { normalizeSession } = await import("@/services/firestore");
    if (!doc.exists) {
      return res.status(404).json({ error: "Session not found" });
    }
    const session = normalizeSession(doc);
    return res.json({ session });
  } catch (error) {
    console.error("Error fetching session:", error);
    return res.status(500).json({ error: "Failed to fetch session" });
  }
});

export default router;
