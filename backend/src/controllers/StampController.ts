import type { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/services/firestore";
import type { AuthenticatedRequest } from "@/types/firestore";
import { sanitizeCategoryId, isValidCategory, isValidStamp } from "@/services/stampTaxonomy";
import { stampQueries } from "@/services/stampQueries";

export class StampController {
  static async unlock(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    if (!requester?.uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { category, categoryId, stampName, tier, sessionId } = req.body ?? {};

    if (typeof category !== "string" || typeof stampName !== "string") {
      return res.status(400).json({ error: "category and stampName are required" });
    }

    if (typeof sessionId !== "string") {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const targetTier = typeof tier === "number" ? Math.min(Math.max(1, tier), 4) : 1;

    if (!isValidCategory(category)) {
      return res.status(400).json({
        error: `Invalid category "${category}". Must be one of the taxonomy region names.`,
      });
    }

    if (!isValidStamp(stampName)) {
      return res.status(400).json({
        error: `Invalid stamp "${stampName}". Must be a valid stamp from the taxonomy.`,
      });
    }

    try {
      const docId = typeof categoryId === "string" ? categoryId : sanitizeCategoryId(category);
      const passportRef = db
        .collection("participants")
        .doc(requester.uid)
        .collection("sessions")
        .doc(sessionId)
        .collection("skillPassport")
        .doc(docId);

      const existing = await passportRef.get();
      const data = existing.data();
      const hasStamp =
        data?.unlockedStamps &&
        typeof data.unlockedStamps === "object" &&
        stampName in data.unlockedStamps;

      const existingTier =
        hasStamp && data?.unlockedStamps
          ? ((data.unlockedStamps as Record<string, { tier?: number }>)[stampName]?.tier ?? 1)
          : 1;

      const mergedTier = Math.max(existingTier, targetTier);

      const stampEntry = hasStamp
        ? {
            timesUnlocked: FieldValue.increment(1),
            lastUnlockedAt: FieldValue.serverTimestamp(),
            tier: mergedTier,
            categoryId: docId,
          }
        : {
            timesUnlocked: 1,
            firstUnlockedAt: FieldValue.serverTimestamp(),
            lastUnlockedAt: FieldValue.serverTimestamp(),
            tier: mergedTier,
            categoryId: docId,
          };

      await passportRef.set(
        {
          unlockedStamps: {
            [stampName]: stampEntry,
          },
        },
        { merge: true }
      );

      const existingUnlocks =
        hasStamp && data?.unlockedStamps
          ? ((data.unlockedStamps as Record<string, { timesUnlocked?: number }>)[stampName]
              ?.timesUnlocked ?? 0)
          : 0;

      return res.json({
        success: true,
        data: {
          stampName,
          timesUnlocked: existingUnlocks + 1,
        },
        error: null,
      });
    } catch (error) {
      console.error("[StampController] Failed to unlock stamp:", error);
      return res.status(500).json({ error: "Failed to unlock stamp" });
    }
  }

  static async getMyStamps(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    if (!requester?.uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const stamps = await stampQueries.listStampsForParticipant(requester.uid);
      return res.json({ stamps, total: stamps.length });
    } catch (error) {
      console.error("[StampController] Failed to list stamps:", error);
      return res.status(500).json({ error: "Failed to list stamps" });
    }
  }

  static async getMyStampDetail(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    if (!requester?.uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { stampName } = req.params as { stampName: string };
    if (!stampName) {
      return res.status(400).json({ error: "Missing stampName" });
    }

    try {
      const stamps = await stampQueries.listStampsForParticipant(requester.uid);
      const match = stamps.find((s: { stampName: string }) => s.stampName === stampName);
      if (!match) {
        return res.status(404).json({ error: `Stamp "${stampName}" not found` });
      }

      const evidence = await stampQueries.getStampEvidence(
        requester.uid,
        match.sessionId,
        stampName
      );

      return res.json({
        stamp: match,
        evidence: evidence.interactions,
      });
    } catch (error) {
      console.error("[StampController] Failed to get stamp detail:", error);
      return res.status(500).json({ error: "Failed to get stamp detail" });
    }
  }
}
