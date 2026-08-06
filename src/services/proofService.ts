import * as FileSystem from "expo-file-system/legacy";
import { CONFIG } from "../config/env";
import {
  getAuthHeaders,
  parseJsonBody,
  uploadMultipartFile,
  type MultipartUploadResponse,
} from "./uploadService";
import { compressImage } from "../utils/compressImage";

const PROOF_MAX_DIMENSION = 1280;
const PROOF_REDUCED_DIMENSION = 1024;
const PROOF_TARGET_MAX_BYTES = 700 * 1024;
const PROOF_PRIMARY_QUALITY = 0.72;
const PROOF_SECONDARY_QUALITY = 0.55;

export interface ProofUploadResponse {
  jobId: string;
  proofStatus: string;
}

export interface ProofStatusResponse {
  id?: string;
  status?: string;
  proofStatus?: string;
  proofTier?: string | null;
  verificationConfidence?: number | null;
  userFeedbackMessage?: string | null;
  requiredAction?: string | null;
  errorMessage?: string | null;
}

function resolveImageMimeType(uri: string): string {
  const ext = uri.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

async function getFileSizeBytes(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      return null;
    }

    return "size" in info && typeof info.size === "number" ? info.size : null;
  } catch {
    return null;
  }
}

async function compressProofImage(
  imageUri: string
): Promise<{ uri: string; sizeBytes: number | null }> {
  const originalSizeBytes = await getFileSizeBytes(imageUri);
  if (__DEV__)
    console.log("[ProofUpload] Original image", { imageUri, sizeBytes: originalSizeBytes });

  try {
    let compressedUri = await compressImage(imageUri, {
      maxDimension: PROOF_MAX_DIMENSION,
      quality: PROOF_PRIMARY_QUALITY,
    });

    let compressedSizeBytes = await getFileSizeBytes(compressedUri);

    if (compressedSizeBytes && compressedSizeBytes > PROOF_TARGET_MAX_BYTES) {
      compressedUri = await compressImage(compressedUri, {
        maxDimension: PROOF_REDUCED_DIMENSION,
        quality: PROOF_SECONDARY_QUALITY,
      });
      compressedSizeBytes = await getFileSizeBytes(compressedUri);
    }

    if (__DEV__)
      console.log("[ProofUpload] Compressed image", {
        compressedUri,
        sizeBytes: compressedSizeBytes,
        targetMaxBytes: PROOF_TARGET_MAX_BYTES,
      });

    return { uri: compressedUri, sizeBytes: compressedSizeBytes };
  } catch (error) {
    if (__DEV__) console.warn("[ProofUpload] Compression failed, using original image", error);
    return { uri: imageUri, sizeBytes: originalSizeBytes ?? null };
  }
}

export async function uploadProofImage(params: {
  userId: string;
  sessionId: string;
  interactionId: string;
  question: string;
  answer: string;
  imageUri: string;
}): Promise<ProofUploadResponse> {
  if (__DEV__)
    console.log("[ProofUpload] Starting upload", {
      userId: params.userId,
      sessionId: params.sessionId,
      interactionId: params.interactionId,
    });

  const compressedImage = await compressProofImage(params.imageUri);

  if (__DEV__)
    console.log("[ProofUpload] Payload prepared", {
      imageUri: compressedImage.uri,
      compressedSizeBytes: compressedImage.sizeBytes,
    });

  const fields = {
    sessionId: params.sessionId,
    interactionId: params.interactionId,
    question: params.question,
    answer: params.answer,
  };

  const upload = async (fileUri: string): Promise<MultipartUploadResponse> =>
    uploadMultipartFile({
      endpoint: "/chat/proof/upload",
      fileUri,
      fileField: "image",
      mimeType: resolveImageMimeType(fileUri),
      fields,
    });

  let response: MultipartUploadResponse;
  try {
    response = await upload(compressedImage.uri);
  } catch (err) {
    if (compressedImage.uri === params.imageUri) throw err;
    console.warn("[ProofUpload] Native upload failed, retrying with original image", err);
    response = await upload(params.imageUri);
  }

  if (__DEV__)
    console.log("[ProofUpload] Upload response", {
      status: response.status,
      ok: response.status >= 200 && response.status < 300,
    });

  if (response.status < 200 || response.status >= 300) {
    const parsedBody = parseJsonBody(response.body);
    throw new Error(parsedBody.error || `Proof upload failed: ${response.status}`);
  }

  const payload = parseJsonBody(response.body) as { data?: ProofUploadResponse };
  if (__DEV__) console.log("[ProofUpload] Upload payload", payload);

  if (!payload.data?.jobId) {
    throw new Error("Proof upload did not return a job ID.");
  }

  return payload.data;
}

export async function fetchProofStatus(jobId: string): Promise<ProofStatusResponse> {
  if (__DEV__) console.log("[ProofUpload] Fetching job status", { jobId });

  const response = await fetch(`${CONFIG.API_BASE_URL}/chat/proof/${jobId}`, {
    headers: {
      ...(await getAuthHeaders()),
    },
  });

  if (__DEV__)
    console.log("[ProofUpload] Status response", {
      jobId,
      status: response.status,
      ok: response.ok,
    });

  if (!response.ok) {
    throw new Error(`Proof status request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { data?: ProofStatusResponse };
  if (__DEV__) console.log("[ProofUpload] Status payload", { jobId, payload });
  return payload.data ?? {};
}
