import express from "express";
import type { NextFunction, Request, Response } from "express";

import { authenticateToken } from "../middleware/auth";
import { ProfileEmbeddingsController } from "@/controllers/ProfileEmbeddingsController";

const router = express.Router({ mergeParams: true });

// optional auth middleware depending on env flag
function optionalAuth(req: Request, res: Response, next: NextFunction) {
  if (process.env.EMBEDDING_AUTH_OPTIONAL === "true") return next();
  return authenticateToken(req, res, next);
}

router.post("/upload", optionalAuth, ProfileEmbeddingsController.uploadPdf);
router.get("/jobs/:jobId", optionalAuth, ProfileEmbeddingsController.getJobStatus);

export default router;
