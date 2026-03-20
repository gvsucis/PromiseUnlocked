import express from "express";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { authenticateToken } from "@/middleware/auth";
import { sessionsCollection } from "@/services/firestore";
import type { AuthenticatedRequest, SessionRecord, SessionStatus } from "@/types/firestore";

const router = express.Router();

const parseLimit = (value?: string | string[]) => {
  const asString = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(asString ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, 100);
};

router.post("/", authenticateToken, async (req, res) => {
  const { topic, metadata = {} } = req.body ?? {};
  if (!topic) {
    return res.status(400).json({ error: "Session topic is required" });
  }
  const { uid } = (req as AuthenticatedRequest).user;
  const session: SessionRecord = {
    userId: uid,
    topic,
    status: "active",
    startedAt: Date.now(),
    metadata,
  };
  try {
    const docRef = await sessionsCollection.add(session);
    return res.status(201).json({ session: { ...session, id: docRef.id } });
  } catch (error) {
    console.error("Error creating session:", error);
    return res.status(500).json({ error: "Failed to create session" });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  const { uid } = (req as AuthenticatedRequest).user;
  const { status, limit } = req.query;
  let query = sessionsCollection.where("userId", "==", uid).orderBy("startedAt", "desc");
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
    const doc = await sessionsCollection.doc(sessionId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Session not found" });
    }
    const session = doc.data();
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (session.userId !== uid) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return res.json({ session });
  } catch (error) {
    console.error("Error fetching session:", error);
    return res.status(500).json({ error: "Failed to fetch session" });
  }
});

router.patch("/:sessionId", authenticateToken, async (req, res) => {
  const { uid } = (req as AuthenticatedRequest).user;
  const { sessionId } = req.params as { sessionId: string };
  const { status, endedAt, metadata } = req.body ?? {};
  if (
    typeof status === "undefined" &&
    typeof endedAt === "undefined" &&
    typeof metadata === "undefined"
  ) {
    return res.status(400).json({ error: "No updates provided" });
  }
  const updates: Partial<SessionRecord> = {};
  if (typeof status !== "undefined") {
    if (!["active", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    updates.status = status as SessionStatus;
  }
  if (typeof endedAt !== "undefined") {
    updates.endedAt = endedAt;
  }
  if (typeof metadata !== "undefined") {
    updates.metadata = metadata;
  }
  try {
    const doc = await sessionsCollection.doc(sessionId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Session not found" });
    }
    const session = doc.data();
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (session.userId !== uid) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await sessionsCollection.doc(sessionId).set(
      {
        ...updates,
      },
      { merge: true }
    );
    const updatedSnapshot = await sessionsCollection.doc(sessionId).get();
    const updatedSession = updatedSnapshot.data();
    if (!updatedSession) {
      return res.status(500).json({ error: "Failed to load updated session" });
    }
    return res.json({ session: updatedSession });
  } catch (error) {
    console.error("Error updating session:", error);
    return res.status(500).json({ error: "Failed to update session" });
  }
});

router.delete("/:sessionId", authenticateToken, async (req, res) => {
  const { uid } = (req as AuthenticatedRequest).user;
  const { sessionId } = req.params as { sessionId: string };
  try {
    const doc = await sessionsCollection.doc(sessionId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Session not found" });
    }
    const session = doc.data();
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    if (session.userId !== uid) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await sessionsCollection.doc(sessionId).delete();
    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting session:", error);
    return res.status(500).json({ error: "Failed to delete session" });
  }
});

export default router;
