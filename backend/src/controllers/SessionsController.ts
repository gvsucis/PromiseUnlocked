import type { Request, Response } from "express";
import {
  participantSessionDoc,
  participantSessionsCollection,
  normalizeSession,
} from "@/services/firestore";
import type { AuthenticatedRequest } from "@/types/firestore";
import { canAccessParticipant } from "@/utils/authz";
import { parsePagination } from "@/utils/pagination";

function resolveParticipantId(params: Record<string, any>): string | undefined {
  return params.participantId || params.uid || params.id;
}

export class SessionsController {
  static async listSessions(req: Request, res: Response) {
    const { status } = req.query;
    const { page, pageSize, offset } = parsePagination(req.query, 20, 100);
    const participantId = resolveParticipantId(req.params);
    const requester = (req as AuthenticatedRequest).user;
    if (!participantId) {
      return res.status(400).json({ error: "Missing participantId in route." });
    }
    if (!(await canAccessParticipant(requester, participantId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    let query = participantSessionsCollection(participantId).orderBy("startedAt", "desc");
    if (typeof status === "string" && ["active", "completed", "cancelled"].includes(status)) {
      query = query.where("status", "==", status);
    }
    try {
      const snapshot = await query.offset(offset).limit(pageSize).get();
      const sessions = snapshot.docs.map((doc) => normalizeSession(doc));
      return res.json({ sessions, page, pageSize });
    } catch (error) {
      console.error("Error listing sessions:", error);
      return res.status(500).json({ error: "Failed to list sessions" });
    }
  }

  static async getSessionById(req: Request, res: Response) {
    const participantId = resolveParticipantId(req.params);
    const { sessionId } = req.params as { sessionId: string };
    const requester = (req as AuthenticatedRequest).user;
    if (!participantId) {
      return res.status(400).json({ error: "Missing participantId in route." });
    }
    if (!(await canAccessParticipant(requester, participantId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const doc = await participantSessionDoc(participantId, sessionId).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Session not found" });
      }
      const session = normalizeSession(doc);
      return res.json({ session });
    } catch (error) {
      console.error("Error fetching session:", error);
      return res.status(500).json({ error: "Failed to fetch session" });
    }
  }
}
