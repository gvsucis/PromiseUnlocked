import express from "express";

import { authenticateToken } from "@/middleware/auth";
import { createRateLimitMiddleware } from "@/middleware/rateLimit";
import { PvaCatalogController } from "@/controllers/PvaCatalogController";

const router = express.Router({ mergeParams: true });
const pvaCatalogRateLimit = createRateLimitMiddleware({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
});

// Admin-only ingest (idempotent by checksum).
router.post("/", authenticateToken, pvaCatalogRateLimit, PvaCatalogController.uploadCatalogPdf);

// Selection dropdown source.
router.get("/", authenticateToken, pvaCatalogRateLimit, PvaCatalogController.list);

// Admin-only: full preview of every catalog entry (before the :id routes).
router.get("/all", authenticateToken, pvaCatalogRateLimit, PvaCatalogController.listAll);

// Personality context for the selected PVA.
router.get("/:id/context", authenticateToken, pvaCatalogRateLimit, PvaCatalogController.getContext);

// Admin-only: re-run embedding for a stuck/failed entry.
router.post("/:id/embed", authenticateToken, pvaCatalogRateLimit, PvaCatalogController.reembed);

export default router;
