import express from "express";
import { authenticateToken } from "@/middleware/auth";
import { ParticipantsController } from "../controllers/ParticipantsController";

const router = express.Router();

// Create participant
router.post("/", ParticipantsController.createParticipant);

// Get all participants
router.get("/", authenticateToken, ParticipantsController.getAllParticipants);

router.get("/me", authenticateToken, ParticipantsController.getMe);
router.put("/me", authenticateToken, ParticipantsController.updateMe);

router.get("/me/sessions", authenticateToken, ParticipantsController.getMeSessions);

router.get("/me/sessions/:sessionId", authenticateToken, ParticipantsController.getMeSessionById);

// Get individual participant
router.get("/:uid", authenticateToken, ParticipantsController.getParticipantById);

// Delete participant
router.delete("/:uid", authenticateToken, ParticipantsController.deleteParticipant);

export default router;
