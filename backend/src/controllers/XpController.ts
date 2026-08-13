import type { Request, Response } from "express";
import { getParticipantXp, claimXpEvent, XP_EVENTS } from "@/services/xpService";
import type { AuthenticatedRequest } from "@/types/firestore";

export class XpController {
  static async getMyXp(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    if (!requester?.uid) return res.status(401).json({ error: "Unauthorized" });

    try {
      return res.json({ xp: await getParticipantXp(requester.uid) });
    } catch (error) {
      console.error("[XpController] Failed to fetch XP:", error);
      return res.status(500).json({ error: "Failed to fetch XP" });
    }
  }

  static async claimXpEvent(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    if (!requester?.uid) return res.status(401).json({ error: "Unauthorized" });

    const { eventType } = req.body ?? {};
    if (typeof eventType !== "string" || !XP_EVENTS[eventType]) {
      return res
        .status(400)
        .json({ error: `Invalid eventType. Must be one of: ${Object.keys(XP_EVENTS).join(", ")}` });
    }

    try {
      return res.json({ event: await claimXpEvent(requester.uid, eventType) });
    } catch (error) {
      console.error("[XpController] Failed to claim XP event:", error);
      return res.status(500).json({ error: "Failed to claim XP event" });
    }
  }
}
