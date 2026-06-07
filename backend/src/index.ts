/**
 * Firebase Functions entry point.
 * Deploy with: npm run deploy
 *
 * Exports the Express app as an HTTPS Cloud Function.
 * For local development, use server.ts instead (npm run dev).
 */
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import app from "./app.js";

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const clientFirebaseApiKey = defineSecret("CLIENT_FIREBASE_API_KEY");

// Re-export trigger-based functions
export { verifyProof } from "./functions/verifyProof.js";

// Export the Express app as the "api" Cloud Function
export const api = onRequest(
  { secrets: [geminiApiKey, clientFirebaseApiKey] },
  app
);
