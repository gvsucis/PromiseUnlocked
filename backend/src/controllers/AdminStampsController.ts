import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "@/types/firestore";
import { isAdminUser } from "@/utils/authz";
import { isValidCategory } from "@/services/stampTaxonomy";
import { stampQueries } from "@/services/stampQueries";

function requireAdmin(req: Request, res: Response): boolean {
  const requester = (req as AuthenticatedRequest).user;
  if (!isAdminUser(requester)) {
    res.status(403).json({ error: "Forbidden — admin access required" });
    return false;
  }
  return true;
}

export class AdminStampsController {
  /** #3 — counts grouped by category, platform-wide. */
  static async summarizeByCategory(req: Request, res: Response) {
    if (!requireAdmin(req, res)) return;
    try {
      const categories = await stampQueries.summarizeByCategory();
      return res.json({ categories });
    } catch (error) {
      console.error("[AdminStampsController] summarizeByCategory failed:", error);
      return res.status(500).json({ error: "Failed to summarize stamps by category" });
    }
  }

  /** #4 — every stamp under one category, across all participants. */
  static async listStampsInCategory(req: Request, res: Response) {
    if (!requireAdmin(req, res)) return;
    const { category } = req.params as { category: string };
    if (!isValidCategory(category)) {
      return res.status(400).json({
        error: `Invalid category "${category}". Must be one of the taxonomy region names.`,
      });
    }
    try {
      const stamps = await stampQueries.listStampsInCategory(category);
      return res.json({ category, stamps, total: stamps.length });
    } catch (error) {
      console.error("[AdminStampsController] listStampsInCategory failed:", error);
      return res.status(500).json({ error: "Failed to list stamps in category" });
    }
  }

  /** #1 — one participant's stamps across all their sessions. */
  static async listStampsForParticipant(req: Request, res: Response) {
    if (!requireAdmin(req, res)) return;
    const { participantId } = req.params as { participantId: string };
    if (!participantId) {
      return res.status(400).json({ error: "Missing participantId" });
    }
    try {
      const stamps = await stampQueries.listStampsForParticipant(participantId);
      return res.json({ participantId, stamps, total: stamps.length });
    } catch (error) {
      console.error("[AdminStampsController] listStampsForParticipant failed:", error);
      return res.status(500).json({ error: "Failed to list participant stamps" });
    }
  }

  /** #2 — stamps earned within a single session. */
  static async listStampsForSession(req: Request, res: Response) {
    if (!requireAdmin(req, res)) return;
    const { participantId, sessionId } = req.params as {
      participantId: string;
      sessionId: string;
    };
    if (!participantId || !sessionId) {
      return res.status(400).json({ error: "Missing participantId or sessionId" });
    }
    try {
      const stamps = await stampQueries.listStampsForSession(participantId, sessionId);
      return res.json({ participantId, sessionId, stamps, total: stamps.length });
    } catch (error) {
      console.error("[AdminStampsController] listStampsForSession failed:", error);
      return res.status(500).json({ error: "Failed to list session stamps" });
    }
  }

  /** #5 — a stamp plus the interaction(s) that justified it. */
  static async getStampEvidence(req: Request, res: Response) {
    if (!requireAdmin(req, res)) return;
    const { participantId, sessionId, stampName } = req.params as {
      participantId: string;
      sessionId: string;
      stampName: string;
    };
    if (!participantId || !sessionId || !stampName) {
      return res
        .status(400)
        .json({ error: "Missing participantId, sessionId, or stampName" });
    }
    try {
      const evidence = await stampQueries.getStampEvidence(participantId, sessionId, stampName);
      if (!evidence.stamp) {
        return res.status(404).json({ error: "Stamp not found in this session" });
      }
      return res.json(evidence);
    } catch (error) {
      console.error("[AdminStampsController] getStampEvidence failed:", error);
      return res.status(500).json({ error: "Failed to fetch stamp evidence" });
    }
  }
}
