import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import participantsRouter from "./api/participants";
import sessionsRouter from "./api/sessions";
import interactionsRouter from "./api/interactions";
import chatRoutes from "./api/chatRoutes";
import authRouter from "./api/auth";
import profileEmbeddingsRouter from "./api/profileEmbeddings";
import { authenticateToken } from "./middleware/auth";
import { setupSwagger } from "./swagger";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

setupSwagger(app);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "Server is running" });
});

app.use("/api/auth", authRouter);
app.use("/api/chat", chatRoutes);
app.use("/api/profile-embeddings", profileEmbeddingsRouter);

app.use("/api/participants", authenticateToken, participantsRouter);
app.use("/api/participants/:participantId/sessions", authenticateToken, sessionsRouter);
app.use(
  "/api/participants/:participantId/sessions/:sessionId/interactions",
  authenticateToken,
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
