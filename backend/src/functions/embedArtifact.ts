import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { runArtifactEmbedding } from "@/workers/artifactEmbeddingRunner";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export const embedArtifact = onDocumentCreated(
  {
    document: "users/{userId}/artifacts/{artifactId}",
    secrets: [geminiApiKey],
    memory: "1GiB",
    timeoutSeconds: 300,
    concurrency: 1,
    maxInstances: 10,
    retry: true,
  },
  async (event) => {
    if (!event.data) return;
    const { userId, artifactId } = event.params;
    await runArtifactEmbedding(userId, artifactId, `artifact:${userId}/${artifactId}`);
  }
);
