import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import participantsRouter from "@/api/participants";
import sessionsRouter from "@/api/sessions";
import interactionsRouter from "@/api/interactions";
import chatRoutes from "@/api/chatRoutes";
import proofRoutes from "@/api/proofRoutes";
import authRouter from "@/api/auth";
import profileEmbeddingsRouter from "@/api/profileEmbeddings";
import { authenticateToken } from "@/middleware/auth";
import { createRateLimitMiddleware } from "@/middleware/rateLimit";
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
app.use(express.json());

setupSwagger(app);

// Public routes
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "Server is running" });
});
app.use("/auth", publicRateLimit, authRouter);
app.use("/profile-embeddings", profileEmbeddingsRouter);

// Protected routes
app.use("/chat", authenticateToken, protectedRateLimit, chatRoutes, proofRoutes);
app.use("/participants", authenticateToken, protectedRateLimit, participantsRouter);
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

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.path} not found` });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
