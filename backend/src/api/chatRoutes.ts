import express from "express";
import { chatController } from "@/controllers/chatController";

const router = express.Router();

/**
 * POST /api/chat/respond
 */
router.post("/respond", chatController.saveAndRespond);

export default router;
