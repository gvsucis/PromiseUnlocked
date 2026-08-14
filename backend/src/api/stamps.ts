import { Router } from "express";
import { StampController } from "@/controllers/StampController";

const router = Router();

router.post("/unlock", StampController.unlock);
router.get("/", StampController.getMyStamps);
router.get("/:stampName", StampController.getMyStampDetail);

export default router;
