import { admin, db } from "@/services/firestore";
import {
  deleteArtifactFile,
  downloadArtifact,
  extractText,
} from "@/services/artifactStorageService";
import {
  extractTextFromPdfBuffer,
  generateTextEmbedding,
  truncateForEmbedding,
} from "@/workers/embeddingWorker";
import type { UserArtifact } from "@/types/firestore";

const MAX_EMBEDDING_ATTEMPTS = 5;
export type EmbeddingRunResult = "skipped" | "ready" | "failed";

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function isPermanent(message: string): boolean {
  return /no extractable text|invalid pdf|password|encrypted|api key not valid/i.test(message);
}

async function discardArtifact(
  docRef: FirebaseFirestore.DocumentReference,
  storagePath: string,
  error: string
): Promise<"failed"> {
  console.error(`[ArtifactEmbed] Discarding artifact: ${error}`);
  if (storagePath) {
    await deleteArtifactFile(storagePath).catch(() => {});
  }
  await docRef.delete().catch(() => {});
  return "failed";
}

export async function runArtifactEmbedding(
  userId: string,
  artifactId: string,
  label: string
): Promise<EmbeddingRunResult> {
  const docRef = db.collection("users").doc(userId).collection("artifacts").doc(artifactId);

  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) return null;
    const data = snap.data() as UserArtifact;
    if (data.embeddingsStatus !== "processing" || data.embedding != null) return null;
    const attempt = (data.embeddingAttempts ?? 0) + 1;
    tx.update(docRef, {
      embeddingAttempts: attempt,
      embeddingStartedAt: serverTimestamp(),
    });
    return { data, attempt };
  });

  if (!claim) return "skipped";
  const { data, attempt } = claim;

  if (attempt > MAX_EMBEDDING_ATTEMPTS) {
    return discardArtifact(docRef, data.storagePath ?? "", `Exceeded ${MAX_EMBEDDING_ATTEMPTS} attempts`);
  }
  if (!data.storagePath) {
    return discardArtifact(docRef, "", "Missing storagePath");
  }

  console.log(`[ArtifactEmbed] Embedding ${label} (attempt ${attempt})`);

  try {
    let text = data.extractedText;

    if (!text && data.contentType === "application/pdf") {
      const buffer = await downloadArtifact(data.storagePath);
      const uint8 = new Uint8Array(buffer);
      text = truncateForEmbedding(await extractTextFromPdfBuffer(uint8, 12));
    } else if (!text) {
      const buffer = await downloadArtifact(data.storagePath);
      text = truncateForEmbedding(
        await extractText({ buffer, contentType: data.contentType })
      );
    } else {
      text = truncateForEmbedding(text);
    }

    if (!text.trim()) {
      return discardArtifact(docRef, data.storagePath, "No extractable text content");
    }

    const vector = await generateTextEmbedding(text);

    await docRef.update({
      embedding: vector,
      extractedText: text,
      embeddingsStatus: "ready",
      embeddingError: null,
      embeddingFinishedAt: serverTimestamp(),
    });

    console.log(`[ArtifactEmbed] ${label} ready`);

    try {
      const { regenerateArtifactBrief } = await import("@/services/artifactBriefService");
      await regenerateArtifactBrief(userId);
    } catch (err) {
      console.warn(`[ArtifactEmbed] Brief regeneration failed for ${userId}:`, err);
    }

    return "ready";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isPermanent(message) || attempt >= MAX_EMBEDDING_ATTEMPTS) {
      return discardArtifact(docRef, data.storagePath, message);
    }
    console.warn(`[ArtifactEmbed] ${label} transient failure (attempt ${attempt}): ${message}`);
    throw err;
  }
}
