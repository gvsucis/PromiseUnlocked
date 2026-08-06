import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import participantsRouter from "@/api/participants";
import sessionsRouter, { adminRouter as sessionsAdminRouter } from "@/api/sessions";
import interactionsRouter from "@/api/interactions";
import chatRoutes from "@/api/chatRoutes";
import proofRoutes from "@/api/proofRoutes";
import stampsRouter from "@/api/stamps";
import adminStampsRouter from "@/api/adminStamps";
import authRouter from "@/api/auth";
import pvaCatalogRouter from "@/api/pvaCatalog";
import skillsRouter from "@/api/skills";
import usersRouter from "@/api/users";
import helpRouter from "@/api/helpRoutes";
import artifactsRouter from "@/api/artifacts";
import { authenticateToken } from "@/middleware/auth";
import { createRateLimitMiddleware } from "@/middleware/rateLimit";
import { InteractionsController } from "@/controllers/InteractionsController";
import { setupSwagger } from "@/swagger";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const app = express();
const publicRateLimit = createRateLimitMiddleware({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
  exemptPaths: ["/health", "/api-docs", "/swagger", "/openapi.json"],
});
const protectedRateLimit = createRateLimitMiddleware({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120),
});
const rawCorsOrigin = process.env.CORS_ORIGIN?.trim();
const allowedOrigins = rawCorsOrigin
  ? rawCorsOrigin
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : ["*"];

app.use(cors({ origin: allowedOrigins }));

// Raw-body middleware for multipart uploads — runs BEFORE any async middleware
// so body-parser captures the stream before it settles (Cloud Run / GFE quirk).
app.use(express.raw({ type: "multipart/form-data", limit: "10mb" }));

app.use("/pva-catalog", pvaCatalogRouter);

app.use(express.json());

setupSwagger(app);

// Public routes
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "Server is running" });
});
app.use("/auth", publicRateLimit, authRouter);
app.use("/skills", publicRateLimit, skillsRouter);
app.use("/users", publicRateLimit, usersRouter);

// Protected routes
app.use("/chat", authenticateToken, protectedRateLimit, chatRoutes, proofRoutes);
app.use("/participants", protectedRateLimit, participantsRouter);
app.use("/participants/me/stamps", authenticateToken, protectedRateLimit, stampsRouter);
app.post(
  "/participants/me/interactions",
  authenticateToken,
  protectedRateLimit,
  InteractionsController.saveInteraction
);
app.use(
  "/participants/:participantId/sessions",
  authenticateToken,
  protectedRateLimit,
  sessionsRouter
);
app.use(
  "/participants/:participantId/sessions/:sessionId/interactions",
  authenticateToken,
  protectedRateLimit,
  interactionsRouter
);
app.use("/help", authenticateToken, protectedRateLimit, helpRouter);

app.use("/sessions", authenticateToken, protectedRateLimit, sessionsAdminRouter);
app.use("/admin/stamps", authenticateToken, protectedRateLimit, adminStampsRouter);
app.use("/artifacts", authenticateToken, protectedRateLimit, artifactsRouter);

app.use((req, res) => {
  console.warn("[App] 404 — route not found", {
    method: req.method,
    path: req.path,
    query: req.query,
  });
  res.status(404).json({ error: `Route ${req.path} not found` });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
