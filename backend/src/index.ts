import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import gracefulShutdown from "http-graceful-shutdown";
import usersRouter from "./api/users";
import sessionsRouter from "./api/sessions";
import interactionsRouter from "./api/interactions";
import authRouter from "./api/auth";
import { setupSwagger } from "./swagger";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

setupSwagger(app);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/interactions", interactionsRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.path} not found` });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(PORT || 4000, () => {
  console.log(`Server is running on port ${PORT}`);
});

gracefulShutdown(server, {
  signals: "SIGINT SIGTERM",
  timeout: 20000,
  development: false,
  forceExit: true,
  onShutdown: async () => {
    console.log("Performing graceful shutdown...");
  },
  finally() {
    console.log("Shutdown complete. Exiting.");
  },
});
export default app;
