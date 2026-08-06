import { db } from "@/services/firestore";
import { isFailedOrStale, discardArtifact } from "@/utils/artifactUtils";

export async function discardFailedArtifactsForUser(userId: string): Promise<number> {
  const snapshot = await db.collection("users").doc(userId).collection("artifacts").get();
  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (!isFailedOrStale(data)) continue;
    await discardArtifact(doc.ref, (data.storagePath ?? "") as string);
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
    await discardArtifact(doc.ref, (data.storagePath ?? "") as string);
    total++;
  }
  return total;
}
