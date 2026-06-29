import { admin, db } from "@/services/firestore";
import { embeddingService } from "./embeddingService";
import type { UserFileEmbedding } from "@/types/firestore";

const MAX_LIST_RESULTS = 50;
const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 20;

function getCollection(uid: string) {
  return db.collection("user_file_embeddings").doc(uid).collection("embeddings");
}

export async function saveEmbedding(
  uid: string,
  data: Omit<UserFileEmbedding, "id" | "createdAt">
): Promise<string> {
  const docRef = await getCollection(uid).add({
    ...data,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

export async function listEmbeddings(
  uid: string,
  opts: { limit?: number; kind?: string } = {}
): Promise<
  Array<{
    id: string;
    fileName: string;
    fileSizeBytes: number;
    kind: string | null;
    uploadedAt: FirebaseFirestore.Timestamp | null;
  }>
> {
  const { limit = MAX_LIST_RESULTS, kind } = opts;

  // Filter by kind with a single-field equality (no composite index needed) and
  // sort in memory; otherwise use the ordered query directly.
  const collection = getCollection(uid);
  const query = kind
    ? collection.where("kind", "==", kind).limit(Math.min(limit, 100))
    : collection.orderBy("createdAt", "desc").limit(Math.min(limit, 100));

  const snapshot = await query.get();

  const items = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      fileName: data.fileName ?? "unknown",
      fileSizeBytes: data.fileSizeBytes ?? 0,
      kind: (data.kind as string) ?? null,
      uploadedAt: (data.createdAt as FirebaseFirestore.Timestamp) ?? null,
    };
  });

  if (kind) {
    items.sort((a, b) => (b.uploadedAt?.toMillis() ?? 0) - (a.uploadedAt?.toMillis() ?? 0));
  }

  return items;
}

export async function setEmbeddingKind(uid: string, id: string, kind: string): Promise<void> {
  await getCollection(uid).doc(id).update({ kind });
}

export async function deleteEmbedding(uid: string, id: string): Promise<void> {
  await getCollection(uid).doc(id).delete();
}

export async function getEmbedding(
  uid: string,
  embeddingId: string
): Promise<(UserFileEmbedding & { id: string }) | null> {
  const doc = await getCollection(uid).doc(embeddingId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as UserFileEmbedding) };
}

export async function findEmbeddingByChecksum(
  uid: string,
  checksum: string
): Promise<(UserFileEmbedding & { id: string }) | null> {
  const snapshot = await getCollection(uid).where("checksum", "==", checksum).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc!.id, ...(doc!.data() as UserFileEmbedding) };
}

function isMissingVectorIndexError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("FAILED_PRECONDITION") &&
    error.message.includes("Missing vector index configuration")
  );
}

function isVectorUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes("Firestore vector search is not available");
}

export async function searchEmbeddings(
  uid: string,
  queryText: string,
  limit = DEFAULT_SEARCH_LIMIT
): Promise<
  Array<{
    id: string;
    fileName: string;
    extractedText: string;
    distance: number | undefined;
  }>
> {
  const queryEmbedding = await embeddingService.generateEmbedding(queryText);
  const collection = getCollection(uid);
  const limitVal = Math.min(limit, MAX_SEARCH_LIMIT);
  const findNearest = (
    collection as unknown as {
      findNearest?: (opts: {
        vectorField: string;
        queryVector: number[];
        limit: number;
        distanceMeasure: "COSINE" | "EUCLIDEAN" | "DOT_PRODUCT";
        distanceResultField: string;
      }) => FirebaseFirestore.Query;
    }
  ).findNearest;

  try {
    if (!findNearest) {
      throw new Error("Firestore vector search is not available in this runtime.");
    }
    const snapshot = await findNearest
      .call(collection, {
        vectorField: "embedding",
        queryVector: queryEmbedding,
        limit: limitVal,
        distanceMeasure: "COSINE",
        distanceResultField: "distance",
      })
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        fileName: data.fileName ?? "unknown",
        extractedText: data.extractedText ?? "",
        distance: data.distance as number | undefined,
      };
    });
  } catch (error) {
    if (!isMissingVectorIndexError(error) && !isVectorUnavailableError(error)) {
      throw error;
    }
    console.warn(
      "Vector search unavailable for file embeddings. " +
        "Ensure a vector index exists on user_file_embeddings/{uid}/embeddings.embedding"
    );
    return [];
  }
}
