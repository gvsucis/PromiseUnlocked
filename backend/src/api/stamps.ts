import { Router } from "express";
import { authenticateToken } from "@/middleware/auth";
import { createRateLimitMiddleware } from "@/middleware/rateLimit";
import { StampController } from "@/controllers/StampController";

const router = Router();
const rateLimit = createRateLimitMiddleware({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
});

router.post("/unlock", authenticateToken, rateLimit, StampController.unlock);
router.get("/", authenticateToken, rateLimit, StampController.getMyStamps);
router.get("/:stampName", authenticateToken, rateLimit, StampController.getMyStampDetail);

export default router;
