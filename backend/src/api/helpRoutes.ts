import { Router } from "express";
import { HelpController } from "@/controllers/HelpController";

const router = Router();

router.post("/report", HelpController.submitReport);

export default router;
