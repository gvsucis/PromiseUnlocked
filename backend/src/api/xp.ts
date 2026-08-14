import { Router } from "express";
import { XpController } from "@/controllers/XpController";

const router = Router();

router.get("/", XpController.getMyXp);
router.post("/events", XpController.claimXpEvent);

export default router;
