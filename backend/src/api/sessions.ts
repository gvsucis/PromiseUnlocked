import express from "express";
import { authenticateToken } from "@/middleware/auth";
import { SessionsController } from "../controllers/SessionsController";

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

router.get("/", authenticateToken, SessionsController.listSessions);

router.get("/:sessionId", authenticateToken, SessionsController.getSessionById);

export default router;
