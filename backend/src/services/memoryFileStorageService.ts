import crypto from "node:crypto";
import { admin } from "@/services/firestore";
import { requireStorageBucket } from "@/utils/storageBucket";

const MEMORY_CACHE_CONTROL = "private, max-age=3600";
const VALID_MIME_TYPES = new Set(["application/pdf"]);

export interface UploadedMemoryFile {
  bucket: string;
  storagePath: string;
  checksum: string;
  size: number;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatUploadTimestamp(date: Date): string {
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "-" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds())
  );
}

function buildMemoryFilePath(userId: string, fileName: string, timestamp: Date): string {
  const monthKey = `${timestamp.getUTCFullYear()}-${pad(timestamp.getUTCMonth() + 1)}`;
  const shortId = crypto.randomUUID().slice(0, 8);
  const ts = formatUploadTimestamp(timestamp);
  const ext = fileName.includes(".") ? (fileName.split(".").pop() ?? "pdf") : "pdf";
  return `memory-files/${userId}/${monthKey}/${ts}-${shortId}.${ext}`;
}

function getBucket() {
  return admin.storage().bucket(requireStorageBucket());
}

export function isAllowedMimeType(mimeType: string): boolean {
  return VALID_MIME_TYPES.has(mimeType.toLowerCase());
}

export async function uploadMemoryFile(params: {
  userId: string;
  fileName: string;
  fileBuffer: Buffer;
  contentType: string;
}): Promise<UploadedMemoryFile> {
  const storagePath = buildMemoryFilePath(params.userId, params.fileName, new Date());
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

  await file.setMetadata({ cacheControl: MEMORY_CACHE_CONTROL });

  return {
    bucket: requireStorageBucket(),
    storagePath,
    checksum,
    size: params.fileBuffer.length,
  };
}

export async function downloadMemoryFile(storagePath: string): Promise<Buffer> {
  const bucket = getBucket();
  const [buffer] = await bucket.file(storagePath).download();
  return buffer;
}

export async function getMemoryFileSignedUrl(
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

export async function deleteMemoryFile(storagePath: string): Promise<void> {
  const bucket = getBucket();
  await bucket.file(storagePath).delete({ ignoreNotFound: true });
}
