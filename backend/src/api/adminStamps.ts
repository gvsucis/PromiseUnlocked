import { Router } from "express";
import { authenticateToken } from "@/middleware/auth";
import { AdminStampsController } from "@/controllers/AdminStampsController";

const router = Router();

// #3 — counts grouped by category, platform-wide
router.get("/categories", authenticateToken, AdminStampsController.summarizeByCategory);

// #4 — every stamp under one category, across all participants
router.get("/categories/:category", authenticateToken, AdminStampsController.listStampsInCategory);

// #1 — one participant's stamps across all their sessions
router.get(
  "/participants/:participantId",
  authenticateToken,
  AdminStampsController.listStampsForParticipant
);

// #2 — stamps earned within a single session
router.get(
  "/participants/:participantId/sessions/:sessionId",
  authenticateToken,
  AdminStampsController.listStampsForSession
);

// #5 — a stamp plus the interaction(s) that justified it
router.get(
  "/participants/:participantId/sessions/:sessionId/stamps/:stampName/evidence",
  authenticateToken,
  AdminStampsController.getStampEvidence
);

export default router;
