import crypto from "node:crypto";
import { admin } from "@/services/firestore";
import { requireStorageBucket } from "@/utils/storageBucket";

const ARTIFACT_CACHE_CONTROL = "private, max-age=3600";
const MAX_PDF_PAGES = 12;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export interface UploadedArtifact {
  bucket: string;
  storagePath: string;
  checksum: string;
  size: number;
  contentType: string;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatUploadTimestamp(date: Date): string {
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) + "-" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds())
  );
}

function buildArtifactFilePath(userId: string, fileName: string, timestamp: Date): string {
  const monthKey = `${timestamp.getUTCFullYear()}-${pad(timestamp.getUTCMonth() + 1)}`;
  const shortId = crypto.randomUUID().slice(0, 8);
  const ts = formatUploadTimestamp(timestamp);
  const ext = fileName.includes(".") ? (fileName.split(".").pop() ?? "pdf") : "pdf";
  const stem = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return `artifacts/${userId}/${monthKey}/${stem}_${ts}-${shortId}.${ext}`;
}

function getBucket() {
  return admin.storage().bucket(requireStorageBucket());
}

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

export async function uploadArtifact(params: {
  userId: string;
  fileName: string;
  fileBuffer: Buffer;
  contentType: string;
}): Promise<UploadedArtifact> {
  const storagePath = buildArtifactFilePath(params.userId, params.fileName, new Date());
  const checksum = crypto.createHash("sha256").update(params.fileBuffer).digest("hex");

  const bucket = getBucket();
  const file = bucket.file(storagePath);

  await file.save(params.fileBuffer, {
    resumable: false,
    contentType: params.contentType,
    metadata: {
      checksum,
      uploadedBy: params.userId,
      originalFileName: params.fileName,
    },
  });

  await file.setMetadata({ cacheControl: ARTIFACT_CACHE_CONTROL });

  return {
    bucket: requireStorageBucket(),
    storagePath,
    checksum,
    size: params.fileBuffer.length,
    contentType: params.contentType,
  };
}

export async function downloadArtifact(storagePath: string): Promise<Buffer> {
  const bucket = getBucket();
  const [buffer] = await bucket.file(storagePath).download();
  return buffer;
}

export async function getArtifactSignedUrl(
  storagePath: string,
  ttlMs: number = 60 * 60 * 1000
): Promise<string> {
  const bucket = getBucket();
  const [url] = await bucket.file(storagePath).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + ttlMs,
  });
  return url;
}

export async function deleteArtifactFile(storagePath: string): Promise<void> {
  const bucket = getBucket();
  await bucket.file(storagePath).delete({ ignoreNotFound: true });
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const pages = Math.min(MAX_PDF_PAGES, pdf.numPages);
  const pageTexts: string[] = [];

  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }

  return pageTexts.join("\n\n--- Page ---\n\n");
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

export function extractTextFromTxt(buffer: Buffer): string {
  return buffer.toString("utf-8").trim();
}

export async function extractText(params: {
  buffer: Buffer;
  contentType: string;
}): Promise<string> {
  switch (params.contentType.toLowerCase()) {
    case "application/pdf":
      return extractTextFromPdf(params.buffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return extractTextFromDocx(params.buffer);
    case "text/plain":
      return extractTextFromTxt(params.buffer);
    default:
      throw new Error(`Unsupported content type: ${params.contentType}`);
  }
}
