import { admin, db } from "@/services/firestore";
import { downloadMemoryFile } from "@/services/memoryFileStorageService";
import {
  extractTextFromPdfBuffer,
  generateTextEmbedding,
  truncateForEmbedding,
} from "@/workers/embeddingWorker";
import type { UserFileEmbedding } from "@/types/firestore";

const MAX_PDF_PAGES = 12;
export const MAX_EMBEDDING_ATTEMPTS = 5;

export type EmbeddingRunResult = "skipped" | "ready" | "failed";

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

// Fail fast on errors that never succeed on retry. Match invalid-key narrowly so
// transient auth/quota blips still retry.
function isPermanent(message: string): boolean {
  return /no extractable text|invalid pdf|password|encrypted|api key not valid/i.test(message);
}

async function markFailed(
  docRef: FirebaseFirestore.DocumentReference,
  error: string
): Promise<"failed"> {
  await docRef.update({ embeddingStatus: "failed", embeddingError: error, embeddingFinishedAt: serverTimestamp() });
  return "failed";
}

// Embed one profile PDF. Idempotent and attempt-capped: claims live doc state in
// a transaction (the trigger's snapshot is frozen at create). Throws on transient
// failure so the caller retries; returns the terminal outcome otherwise.
export async function runProfileEmbedding(
  docRef: FirebaseFirestore.DocumentReference,
  label: string
): Promise<EmbeddingRunResult> {
  const claim = await db.runTransaction(async (tx) => {
    const data = (await tx.get(docRef)).data() as UserFileEmbedding | undefined;
    if (!data) return null;
    if (data.embeddingStatus !== "processing" || data.embedding != null) return null;
    const attempt = (data.embeddingAttempts ?? 0) + 1;
    tx.update(docRef, { embeddingAttempts: attempt, embeddingStartedAt: serverTimestamp() });
    return { data, attempt };
  });

  if (!claim) return "skipped";
  const { data, attempt } = claim;

  if (attempt > MAX_EMBEDDING_ATTEMPTS) {
    console.error(`[EmbedWorker] ${label} exceeded ${MAX_EMBEDDING_ATTEMPTS} attempts; giving up`);
    return markFailed(docRef, `Exceeded ${MAX_EMBEDDING_ATTEMPTS} attempts`);
  }
  if (!data.storagePath) {
    return markFailed(docRef, "Missing storagePath");
  }

  console.log(`[EmbedWorker] Embedding ${label} (attempt ${attempt})`);

  try {
    const uint8 = new Uint8Array(await downloadMemoryFile(data.storagePath));
    // Text-less PDFs yield "" → generateTextEmbedding throws (permanent), no
    // filename fallback. Truncate once so stored text and vector match.
    const text = truncateForEmbedding(await extractTextFromPdfBuffer(uint8, MAX_PDF_PAGES));
    const vector = await generateTextEmbedding(text);

    await docRef.update({
      embedding: vector,
      extractedText: text,
      embeddingStatus: "ready",
      embeddingError: null,
      embeddingFinishedAt: serverTimestamp(),
    });
    console.log(`[EmbedWorker] ${label} ready`);
    return "ready";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isPermanent(message) || attempt >= MAX_EMBEDDING_ATTEMPTS) {
      console.error(`[EmbedWorker] ${label} failed: ${message}`);
      return markFailed(docRef, message);
    }
    // Transient: leave it "processing" and rethrow so the caller retries.
    console.warn(`[EmbedWorker] ${label} transient failure (attempt ${attempt}): ${message}`);
    throw err;
  }
}
