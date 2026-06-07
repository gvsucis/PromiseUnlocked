import express from "express";
import { authenticateToken } from "@/middleware/auth";
import { InteractionsController } from "@/controllers/InteractionsController";

const router = express.Router({ mergeParams: true });

router.get("/", authenticateToken, InteractionsController.listInteractions);

router.get("/:interactionId", authenticateToken, InteractionsController.getInteractionById);

router.get("/me/:interactionId", authenticateToken, InteractionsController.getMyInteractionById);
export default router;
