import { admin, db } from "@/services/firestore";
import type { PvaCatalogEntry } from "@/types/firestore";
import type { EmbeddingRunResult } from "@/workers/profileEmbeddingRunner";

const COLLECTION = "pva_catalog";

function collection() {
  return db.collection(COLLECTION);
}

export function catalogDocRef(id: string) {
  return collection().doc(id);
}

export async function createCatalogEntry(
  data: Omit<PvaCatalogEntry, "id" | "createdAt">
): Promise<string> {
  const docRef = await collection().add({
    ...data,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

export async function findByChecksum(
  checksum: string
): Promise<(PvaCatalogEntry & { id: string }) | null> {
  const snapshot = await collection().where("checksum", "==", checksum).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0]!;
  return { id: doc.id, ...(doc.data() as PvaCatalogEntry) };
}

export async function getById(
  id: string
): Promise<(PvaCatalogEntry & { id: string }) | null> {
  const doc = await collection().doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as PvaCatalogEntry) };
}

type CatalogListItem = {
  id: string;
  name: string;
  embeddingStatus: "processing" | "ready" | "failed";
};

/** Ready-first, newest-first. */
export async function listCatalog(): Promise<CatalogListItem[]> {
  const snapshot = await collection().orderBy("createdAt", "desc").limit(200).get();
  const items: CatalogListItem[] = snapshot.docs.map(
    (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data() as PvaCatalogEntry;
      return {
        id: doc.id,
        name: data.name ?? data.fileName ?? "Untitled",
        embeddingStatus:
          (data.embeddingStatus as "processing" | "ready" | "failed" | undefined) ??
          (data.embedding ? "ready" : "failed"),
      };
    }
  );
  return items.sort(
    (a: CatalogListItem, b: CatalogListItem) =>
      Number(b.embeddingStatus === "ready") - Number(a.embeddingStatus === "ready")
  );
}

/** Full preview of every catalog entry (admin) — excludes the raw embedding vector. */
export async function listCatalogDetailed(): Promise<
  Array<{
    id: string;
    name: string;
    fileName: string | null;
    fileSizeBytes: number;
    embeddingStatus: "processing" | "ready" | "failed";
    embeddingError: string | null;
    hasEmbedding: boolean;
    personaBrief: string | null;
    extractedTextPreview: string;
    createdAt: string | null;
  }>
> {
  const snapshot = await collection().orderBy("createdAt", "desc").limit(200).get();
  return snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
    const d = doc.data() as PvaCatalogEntry;
    const createdAt = d.createdAt as { toDate?: () => Date } | undefined;
    return {
      id: doc.id,
      name: d.name ?? d.fileName ?? "Untitled",
      fileName: d.fileName ?? null,
      fileSizeBytes: d.fileSizeBytes ?? 0,
      embeddingStatus:
        (d.embeddingStatus as "processing" | "ready" | "failed" | undefined) ??
        (d.embedding ? "ready" : "failed"),
      embeddingError: d.embeddingError ?? null,
      hasEmbedding: Array.isArray(d.embedding) && d.embedding.length > 0,
      personaBrief: d.personaBrief ?? null,
      extractedTextPreview: (d.extractedText ?? "").slice(0, 500),
      createdAt: createdAt?.toDate?.().toISOString() ?? null,
    };
  });
}

export async function setPersonaBrief(id: string, personaBrief: string): Promise<void> {
  await collection().doc(id).update({ personaBrief });
}

// Reset an entry so embedAndBrief will re-process it (re-embed of stuck/failed).
export async function resetForReembed(id: string): Promise<void> {
  await collection().doc(id).update({
    embeddingStatus: "processing",
    embedding: null,
    embeddingAttempts: 0,
    embeddingError: null,
    personaBrief: null,
  });
}

// Embed a catalog entry, then distill its persona brief (best-effort). Shared by
// the create trigger and the admin re-embed endpoint.
export async function embedAndBrief(id: string, label: string): Promise<EmbeddingRunResult> {
  const docRef = collection().doc(id);
  // Lazy-load pdf.js + GenAI so the api function (HTTP serving) doesn't pull them
  // on cold start — only this path (create trigger / admin re-embed) needs them.
  const { runProfileEmbedding } = await import("@/workers/profileEmbeddingRunner");
  const result = await runProfileEmbedding(docRef, label);
  if (result !== "ready") return result;

  try {
    const data = (await docRef.get()).data() as PvaCatalogEntry | undefined;
    if (data?.extractedText && !data.personaBrief) {
      const { distillPersonaBrief } = await import("@/services/personaBriefService");
      await setPersonaBrief(id, await distillPersonaBrief(data.extractedText));
      console.log(`[PvaCatalog] ${id} persona brief ready`);
    }
  } catch (err) {
    console.warn(`[PvaCatalog] persona brief distill failed for ${id}:`, err);
  }
  return result;
}
