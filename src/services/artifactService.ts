import { CONFIG } from "../config/env";
import { apiFetch } from "./apiClient";
import { getAuthHeaders } from "./uploadService";
import { ttlCache } from "../utils/ttlCache";

const artifactCache = ttlCache<ArtifactItem[]>(30_000);
export type ArtifactKind = "essay" | "citation" | "transcript" | "other";

export interface ArtifactItem {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
  kind: ArtifactKind;
  embeddingsStatus: "processing" | "ready" | "failed";
  createdAt: unknown;
  previewUrl: string;
}

export interface UploadResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export async function uploadArtifact(
  fileUri: string,
  fileName: string,
  kind: ArtifactKind
): Promise<UploadResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

  try {
    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("file", {
      uri: fileUri,
      name: fileName,
      type: getMimeType(fileName),
    } as unknown as Blob);

    const response = await fetch(`${CONFIG.API_BASE_URL}/artifacts/upload`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: body.error || `Upload failed (${response.status})`,
      };
    }

    artifactCache.invalidate();
    return { success: true, data: body.data ?? body };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Upload timed out — check your connection"
          : err.message
        : "Upload failed";
    return { success: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function listArtifacts(): Promise<ArtifactItem[]> {
  const cached = artifactCache.get();
  if (cached) return cached;
  const data = await apiFetch<{ success: boolean; data: ArtifactItem[] }>("/artifacts");
  const items = data.data ?? [];
  artifactCache.set(items);
  return items;
}

export async function getArtifact(id: string): Promise<ArtifactItem | null> {
  try {
    const data = await apiFetch<{ success: boolean; data: ArtifactItem }>(`/artifacts/${id}`);
    return data.data ?? null;
  } catch {
    return null;
  }
}

export async function deleteArtifact(id: string): Promise<boolean> {
  try {
    await apiFetch(`/artifacts/${id}`, { method: "DELETE" });
    artifactCache.invalidate();
    return true;
  } catch (err) {
    console.warn("[ArtifactService] Delete failed:", err);
    return false;
  }
}

export async function getArtifactBrief(): Promise<string | null> {
  try {
    const data = await apiFetch<{ success: boolean; data: { brief: string | null } }>(
      "/artifacts/brief"
    );
    return data.data?.brief ?? null;
  } catch {
    return null;
  }
}

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "doc":
      return "application/msword";
    case "txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}
