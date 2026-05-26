import { GoogleGenAI } from "@google/genai";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import fs from "node:fs/promises";
import { admin, db } from "../services/firestore";
import type { EmbeddingJob } from "@/types/firestore";

const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  throw new Error("GEMINI API KEY is not configured.");
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });

// Simple in-process queue for prototype (stores job payloads)
const queue: EmbeddingJob[] = [];
let processing = false;
const MAX_RETRIES = Number.parseInt(process.env.EMBEDDING_MAX_RETRIES || "3", 10);

export async function enqueueJob(job: EmbeddingJob) {
  queue.push(job);
  processNext();
}

async function processNext() {
  if (processing) return;
  const job = queue.shift();
  if (!job) return;
  processing = true;
  try {
    await workerProcess(job);
  } catch (err) {
    console.error("Job processing failed:", err);
  } finally {
    processing = false;
    // process next in next tick
    setImmediate(processNext);
  }
}

async function workerProcess(job: EmbeddingJob) {
  let attempts = job.attempts ?? 0;
  try {
    // process the job payload directly
    await processJob(job);
  } catch (err: unknown) {
    attempts += 1;
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Job ${job.jobId} failed on attempt ${attempts}:`, errorMessage);
    if (attempts >= MAX_RETRIES) {
      console.error(`Dropping job ${job.jobId} after ${attempts} attempts`);
    } else {
      // exponential backoff re-enqueue
      const delayMs = Math.min(60_000, 1000 * Math.pow(2, attempts));
      const retryJob = { ...job, attempts };
      setTimeout(() => enqueueJob(retryJob).catch((e) => console.error(e)), delayMs);
    }
  }
}

async function extractTextFromPdfBuffer(buffer: Uint8Array, maxPages = 6): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pages = Math.min(maxPages, totalPages);
  const texts: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str?: string }>;
    const pageText = items.map((item) => (item.str ? item.str : "")).join(" ");
    texts.push(pageText);
  }
  return texts.join("\n\n");
}

async function generatePdfEmbedding(pdfBytes: Uint8Array, fallbackText: string): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-2",
      contents: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: Buffer.from(pdfBytes).toString("base64"),
          },
        },
      ],
    });
    const values = response.embeddings?.[0]?.values;
    if (values?.length) {
      return values;
    }
  } catch (error) {
    console.warn("PDF inlineData embedding failed, falling back to text embedding:", error);
  }

  const fallback = await ai.models.embedContent({
    model: "gemini-embedding-2",
    contents: fallbackText,
  });
  const vector = fallback.embeddings?.[0]?.values ?? null;
  if (!vector) {
    throw new Error("Empty embedding response");
  }
  return vector;
}

async function processJob(job: EmbeddingJob) {
  const buffer = await fs.readFile(job.storagePath);
  const uint8 = new Uint8Array(buffer);

  const loadingTask = pdfjsLib.getDocument({ data: uint8 });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  // pagesCount recorded only in-memory/logs for this simplified flow
  console.log(`Job ${job.jobId} pagesCount=${totalPages}`);

  const extractedText = await extractTextFromPdfBuffer(uint8, 6);

  const contextText = [
    `PDF file: ${job.fileName}`,
    job.text ? `User text: ${job.text}` : "",
    extractedText,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const embeddingSource = contextText || `PDF file: ${job.fileName}`;
  const vector = await generatePdfEmbedding(uint8, embeddingSource);

  const embedDoc = {
    jobId: job.jobId,
    owner: job.owner,
    sourceType: "pdf",
    embedding: vector,
    storagePath: job.storagePath,
    fileName: job.fileName,
    extractedText: extractedText.slice(0, 12000),
    contextText: embeddingSource.slice(0, 12000),
    pagesUsed: totalPages > 0 ? Math.min(6, totalPages) : 0,
    totalPages,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const embedRef = await db.collection("profile_embeddings").add(embedDoc);

  const participantEmbeddingPayload = {
    pdfEmbeddingId: embedRef.id,
    pdfEmbedding: vector,
    pdfContextText: embeddingSource,
    pdfExtractedText: extractedText,
    pdfFileName: job.fileName,
    pdfStoragePath: job.storagePath,
    pdfPagesUsed: embedDoc.pagesUsed,
    pdfTotalPages: totalPages,
    pdfEmbeddingModel: "gemini-embedding-2",
    pdfEmbeddingUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    if (job.owner) {
      const participantDocRef = db.collection("participants").doc(job.owner);
      const participantSnap = await participantDocRef.get();
      if (participantSnap.exists) {
        await participantDocRef.set(participantEmbeddingPayload, { merge: true });
        console.log(`Saved PDF embedding on participant (uid) ${job.owner}`);
      } else {
        // try lookup by email
        const q = await db
          .collection("participants")
          .where("email", "==", job.owner)
          .limit(1)
          .get();
        const firstDoc = q.docs[0];
        if (firstDoc) {
          await firstDoc.ref.set(participantEmbeddingPayload, { merge: true });
          console.log(`Saved PDF embedding on participant (email) ${job.owner}`);
        } else {
          console.log(
            `No participant found for owner ${job.owner}; embedding saved in profile_embeddings only`
          );
        }
      }
    }
  } catch (err) {
    console.error("Failed to assign embedding to user profile:", err);
  }

  console.log(`Job ${job.jobId} completed, embedId=${embedRef.id}`);
}
