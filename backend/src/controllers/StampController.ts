import type { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/services/firestore";
import type { AuthenticatedRequest } from "@/types/firestore";
import {
  sanitizeStampKey,
  sanitizeCategoryId,
  isValidCategory,
  isValidStamp,
} from "@/services/stampTaxonomy";

export class StampController {
  static async unlock(req: Request, res: Response) {
    const requester = (req as AuthenticatedRequest).user;
    if (!requester?.uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { category, stampName, tier } = req.body ?? {};

    if (typeof category !== "string" || typeof stampName !== "string") {
      return res.status(400).json({ error: "category and stampName are required" });
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
      const categoryId = sanitizeCategoryId(category);
      const passportRef = db
        .collection("participants")
        .doc(requester.uid)
        .collection("skillPassport")
        .doc(categoryId);

      const stampKey = `unlockedStamps.${sanitizeStampKey(stampName)}`;
      const existing = await passportRef.get();
      const data = existing.data();
      const hasStamp =
        data?.unlockedStamps &&
        typeof data.unlockedStamps === "object" &&
        stampName in data.unlockedStamps;

      const existingTier =
        hasStamp && data?.unlockedStamps
          ? (data.unlockedStamps as Record<string, { tier?: number }>)[stampName]?.tier ?? 1
          : 1;

      const mergedTier = Math.max(existingTier, targetTier);

      if (hasStamp) {
        await passportRef.set(
          {
            [stampKey]: {
              timesUnlocked: FieldValue.increment(1),
              lastUnlockedAt: FieldValue.serverTimestamp(),
              tier: mergedTier,
            },
          },
          { merge: true }
        );
      } else {
        await passportRef.set(
          {
            [stampKey]: {
              timesUnlocked: 1,
              firstUnlockedAt: FieldValue.serverTimestamp(),
              lastUnlockedAt: FieldValue.serverTimestamp(),
              tier: mergedTier,
            },
          },
          { merge: true }
        );
      }

      const existingUnlocks =
        hasStamp && data?.unlockedStamps
          ? (data.unlockedStamps as Record<string, { timesUnlocked?: number }>)[stampName]
              ?.timesUnlocked ?? 0
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
}
