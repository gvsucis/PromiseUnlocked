import { db } from "@/services/firestore";
import { deleteArtifactFile } from "@/services/artifactStorageService";
import { toMillis } from "@/utils/timestamp";

const EMBEDDING_TIMEOUT_MS = 10 * 60 * 1000;

function isFailedOrStale(data: Record<string, unknown>): boolean {
  if (data.embeddingsStatus === "failed") return true;
  if (data.embeddingsStatus !== "processing") return false;
  const startedAt = data.embeddingStartedAt ?? data.createdAt;
  if (!startedAt) return false;
  return Date.now() - toMillis(startedAt) > EMBEDDING_TIMEOUT_MS;
}

async function discardOne(
  docRef: FirebaseFirestore.DocumentReference,
  storagePath: string
): Promise<void> {
  await deleteArtifactFile(storagePath).catch(() => {});
  await docRef.delete().catch(() => {});
}

export async function discardFailedArtifactsForUser(userId: string): Promise<number> {
  const snapshot = await db.collection("users").doc(userId).collection("artifacts").get();
  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (!isFailedOrStale(data)) continue;
    await discardOne(doc.ref, (data.storagePath ?? "") as string);
    count++;
  }
  return count;
}

export async function discardAllFailedArtifacts(): Promise<number> {
  const groups = await db.collectionGroup("artifacts").get();
  let total = 0;
  for (const doc of groups.docs) {
    if (!doc.ref.path.startsWith("users/")) continue;
    const data = doc.data() as Record<string, unknown>;
    if (!isFailedOrStale(data)) continue;
    await discardOne(doc.ref, (data.storagePath ?? "") as string);
    total++;
  }
  return total;
}
