import { deleteArtifactFile } from "@/services/artifactStorageService";
import { toMillis } from "@/utils/timestamp";

export const EMBEDDING_TIMEOUT_MS = 10 * 60 * 1000;

export function isStaleProcessing(data: Record<string, unknown>): boolean {
  if (data.embeddingsStatus !== "processing") return false;
  const startedAt = data.embeddingStartedAt ?? data.createdAt;
  if (!startedAt) return false;
  return Date.now() - toMillis(startedAt) > EMBEDDING_TIMEOUT_MS;
}

export function isFailedOrStale(data: Record<string, unknown>): boolean {
  return data.embeddingsStatus === "failed" || isStaleProcessing(data);
}

export async function discardArtifact(
  docRef: FirebaseFirestore.DocumentReference,
  storagePath: string
): Promise<void> {
  await deleteArtifactFile(storagePath).catch(() => {});
  await docRef.delete().catch(() => {});
}
