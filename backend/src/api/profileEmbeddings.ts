import express from "express";

import { authenticateToken } from "@/middleware/auth";
import { createRateLimitMiddleware } from "@/middleware/rateLimit";
import { ProfileEmbeddingsController } from "@/controllers/ProfileEmbeddingsController";

const router = express.Router({ mergeParams: true });
const profileEmbeddingsRateLimit = createRateLimitMiddleware({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
});

router.post(
  "/upload",
  authenticateToken,
  profileEmbeddingsRateLimit,
  ProfileEmbeddingsController.uploadPdf
);

router.get(
  "/jobs/:jobId",
  authenticateToken,
  profileEmbeddingsRateLimit,
  ProfileEmbeddingsController.getJobStatus
);

router.get(
  "/list",
  authenticateToken,
  profileEmbeddingsRateLimit,
  ProfileEmbeddingsController.listEmbeddings
);

router.get(
  "/context/:embeddingId",
  authenticateToken,
  profileEmbeddingsRateLimit,
  ProfileEmbeddingsController.getEmbeddingContext
);

router.post(
  "/search",
  authenticateToken,
  profileEmbeddingsRateLimit,
  ProfileEmbeddingsController.searchEmbeddingsHandler
);

export default router;
