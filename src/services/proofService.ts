import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { auth } from "../config/firebase";
import { CONFIG } from "../config/env";

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

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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
  if (__DEV__) console.log("[ProofUpload] Original image", { imageUri, sizeBytes: originalSizeBytes });

  try {
    let compressed = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: PROOF_MAX_DIMENSION, height: PROOF_MAX_DIMENSION } }],
      {
        compress: PROOF_PRIMARY_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    let compressedSizeBytes = await getFileSizeBytes(compressed.uri);

    if (compressedSizeBytes && compressedSizeBytes > PROOF_TARGET_MAX_BYTES) {
      compressed = await ImageManipulator.manipulateAsync(
        compressed.uri,
        [{ resize: { width: PROOF_REDUCED_DIMENSION, height: PROOF_REDUCED_DIMENSION } }],
        {
          compress: PROOF_SECONDARY_QUALITY,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      compressedSizeBytes = await getFileSizeBytes(compressed.uri);
    }

    if (__DEV__) console.log("[ProofUpload] Compressed image", {
      compressedUri: compressed.uri,
      sizeBytes: compressedSizeBytes,
      targetMaxBytes: PROOF_TARGET_MAX_BYTES,
    });

    return { uri: compressed.uri, sizeBytes: compressedSizeBytes };
  } catch (error) {
    if (__DEV__) console.warn("[ProofUpload] Compression failed, using original image", error);
    return { uri: imageUri, sizeBytes: originalSizeBytes };
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
  if (__DEV__) console.log("[ProofUpload] Starting upload", {
    userId: params.userId,
    sessionId: params.sessionId,
    interactionId: params.interactionId,
  });

  const compressedImage = await compressProofImage(params.imageUri);

  if (__DEV__) console.log("[ProofUpload] Payload prepared", {
    imageUri: compressedImage.uri,
    compressedSizeBytes: compressedImage.sizeBytes,
  });

  const formData = new FormData();
  formData.append("sessionId", params.sessionId);
  formData.append("interactionId", params.interactionId);
  formData.append("question", params.question);
  formData.append("answer", params.answer);

  // React Native requires this specific object shape for file uploads in FormData
  formData.append("image", {
    uri: compressedImage.uri,
    name: `proof_${Date.now()}.jpg`,
    type: "image/jpeg",
  } as unknown as Blob);

  const response = await fetch(`${CONFIG.API_BASE_URL}/chat/proof/upload`, {
    method: "POST",
    headers: {
      ...(await getAuthHeaders()),
      // Note: Do NOT set Content-Type here. Fetch will automatically set
      // "multipart/form-data" with the correct boundary for FormData.
    },
    body: formData,
  });

  if (__DEV__) console.log("[ProofUpload] Upload response", {
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    throw new Error(`Proof upload failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { data?: ProofUploadResponse };
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

  if (__DEV__) console.log("[ProofUpload] Status response", {
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
