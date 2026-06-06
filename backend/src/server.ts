/**
 * Local development server entry point.
 * Run with: npm run dev
 *
 * This file is NOT used when deploying to Firebase Functions.
 * For Firebase, see index.ts which exports the app as an onRequest handler.
 */
import dotenv from "dotenv";
import gracefulShutdown from "http-graceful-shutdown";
import app from "@/app";

dotenv.config();

const PORT = Number(process.env.APP_PORT) || 4000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📖 API docs at http://localhost:${PORT}/api-docs`);
});

gracefulShutdown(server, {
  signals: "SIGINT SIGTERM",
  timeout: 20_000,
  development: true,
  forceExit: false,
  onShutdown: async () => {
    console.log("Performing graceful shutdown...");
  },
  finally() {
    console.log("Shutdown complete. Exiting.");
  },
});

export default server;
