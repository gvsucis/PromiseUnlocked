import { db } from "@/services/firestore";

export interface ParticipantPdfContext {
  pdfEmbeddingId: string | undefined;
  pdfEmbedding: number[] | undefined;
  pdfContextText: string | undefined;
  pdfExtractedText: string | undefined;
  pdfFileName: string | undefined;
  pdfStoragePath: string | undefined;
  pdfPagesUsed: number | undefined;
  pdfTotalPages: number | undefined;
}

export function toIsoTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value).toISOString();
  if (value instanceof Date) return value.toISOString();

  type FirestoreLike = { toDate?: () => Date; _seconds?: number };
  const obj = value as FirestoreLike | undefined;
  if (obj && typeof obj.toDate === "function") return obj.toDate().toISOString();
  if (obj && typeof obj._seconds === "number") return new Date(obj._seconds * 1000).toISOString();

  return null;
}

async function findParticipantDoc(
  owner: string
): Promise<FirebaseFirestore.DocumentSnapshot | null> {
  const directDoc = await db.collection("participants").doc(owner).get();
  if (directDoc.exists) {
    return directDoc;
  }

  const byEmail = await db.collection("participants").where("email", "==", owner).limit(1).get();
  return byEmail.docs[0] ?? null;
}

export async function getParticipantPdfContext(
  owner: string
): Promise<ParticipantPdfContext | null> {
  const trimmedOwner = owner.trim();
  if (!trimmedOwner) {
    return null;
  }

  const participantDoc = await findParticipantDoc(trimmedOwner);
  if (!participantDoc) {
    return null;
  }

  const data = participantDoc.data() as Record<string, unknown>;
  if (!Array.isArray(data.pdfEmbedding) || !data.pdfEmbedding.length) {
    return null;
  }

  return {
    pdfEmbeddingId: typeof data.pdfEmbeddingId === "string" ? data.pdfEmbeddingId : undefined,
    pdfEmbedding: data.pdfEmbedding as number[],
    pdfContextText: typeof data.pdfContextText === "string" ? data.pdfContextText : undefined,
    pdfExtractedText: typeof data.pdfExtractedText === "string" ? data.pdfExtractedText : undefined,
    pdfFileName: typeof data.pdfFileName === "string" ? data.pdfFileName : undefined,
    pdfStoragePath: typeof data.pdfStoragePath === "string" ? data.pdfStoragePath : undefined,
    pdfPagesUsed: typeof data.pdfPagesUsed === "number" ? data.pdfPagesUsed : undefined,
    pdfTotalPages: typeof data.pdfTotalPages === "number" ? data.pdfTotalPages : undefined,
  };
}
