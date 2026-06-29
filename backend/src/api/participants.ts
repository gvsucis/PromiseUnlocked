import express from "express";
import { authenticateToken } from "@/middleware/auth";
import { ParticipantsController } from "@/controllers/ParticipantsController";
import { ProfilePictureController } from "@/controllers/ProfilePictureController";

const router = express.Router();

// Create participant
router.post("/", ParticipantsController.createParticipant);

// Get all participants
router.get("/", authenticateToken, ParticipantsController.getAllParticipants);

router.get("/me", authenticateToken, ParticipantsController.getMe);
router.put("/me", authenticateToken, ParticipantsController.updateMe);
router.post("/me/profile-picture", authenticateToken, ProfilePictureController.uploadProfilePicture);

router.get("/me/sessions", authenticateToken, ParticipantsController.getMeSessions);

router.get("/me/sessions/:sessionId", authenticateToken, ParticipantsController.getMeSessionById);

router.get("/me/passport", authenticateToken, ParticipantsController.getMePassport);

// Admin — get all participants' passport context
router.get("/passport/all", authenticateToken, ParticipantsController.getAllPassports);

// Get individual participant passport
router.get("/:uid/passport", authenticateToken, ParticipantsController.getPassport);

// Get individual participant
router.get("/:uid", authenticateToken, ParticipantsController.getParticipantById);

// Delete participant
router.delete("/:uid", authenticateToken, ParticipantsController.deleteParticipant);

export default router;
