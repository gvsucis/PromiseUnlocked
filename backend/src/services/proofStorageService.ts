import crypto from "node:crypto";
import { admin } from "@/services/firestore";

const PROOF_BUCKET_NAME = process.env.APP_FIREBASE_STORAGE_BUCKET;

if (!PROOF_BUCKET_NAME) {
  throw new Error(
    "APP_FIREBASE_STORAGE_BUCKET env var is required for proof storage. " +
      "Set it in backend/.env to your Firebase Storage bucket name " +
      "(e.g. \"promise-unlocked-for-sure.firebasestorage.app\")."
  );
}

const BUCKET_NAME: string = PROOF_BUCKET_NAME;

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PROOF_CACHE_CONTROL = "private, max-age=3600";

export interface UploadedProofImage {
  bucket: string;
  storagePath: string;
  mimeType: string;
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

function buildProofStoragePath(params: {
  userId: string;
  sessionId: string;
  interactionId: string;
  mimeType: string;
  timestamp: Date;
}): string {
  const extension = MIME_TO_EXTENSION[params.mimeType.toLowerCase()] ?? "jpg";
  const monthKey = `${params.timestamp.getUTCFullYear()}-${pad(params.timestamp.getUTCMonth() + 1)}`;
  const shortId = crypto.randomUUID().slice(0, 8);
  const filename = `${formatUploadTimestamp(params.timestamp)}-${shortId}.${extension}`;
  return `proof-images/${params.userId}/${monthKey}/${params.sessionId}/${params.interactionId}/${filename}`;
}

function getBucket() {
  return admin.storage().bucket(BUCKET_NAME);
}

export async function uploadProofImageToStorage(params: {
  userId: string;
  sessionId: string;
  interactionId: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<UploadedProofImage> {
  const storagePath = buildProofStoragePath({
    userId: params.userId,
    sessionId: params.sessionId,
    interactionId: params.interactionId,
    mimeType: params.mimeType,
    timestamp: new Date(),
  });
  const checksum = crypto.createHash("sha256").update(params.buffer).digest("hex");

  const bucket = getBucket();
  const file = bucket.file(storagePath);

  await file.save(params.buffer, {
    resumable: false,
    contentType: params.mimeType,
    metadata: {
      checksum,
      uploadedBy: params.userId,
    },
  });

  await file.setMetadata({ cacheControl: PROOF_CACHE_CONTROL });

  return {
    bucket: BUCKET_NAME,
    storagePath,
    mimeType: params.mimeType,
    checksum,
    size: params.buffer.length,
  };
}

export async function downloadProofImageFromStorage(storagePath: string): Promise<Buffer> {
  const bucket = getBucket();
  const [buffer] = await bucket.file(storagePath).download();
  return buffer;
}

export async function getProofSignedUrl(
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

