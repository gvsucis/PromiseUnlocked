import { auth } from "../config/firebase";
import { CONFIG } from "../config/env";
import { apiFetch, GuestUserError } from "./apiClient";
import { uploadImage, uploadPDF, type UploadResult } from "./uploadService";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt: number;
  updatedAt: number;
  fullName?: string | null;
  schoolName?: string | null;
  schoolAddress?: string | null;
  phone?: string | null;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  ethnicity?: string | null;
  pageUrl?: string | null;
  metadata: Record<string, unknown>;
}

export interface ProfileUpdatePayload {
  email?: string;
  displayName?: string;
  photoURL?: string;
  pageUrl?: string;
  fullName?: string;
  schoolName?: string;
  schoolAddress?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  ethnicity?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export function buildLocalProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const user = auth.currentUser;
  const mergedMetadata = overrides.metadata ?? {};

  return {
    uid: overrides.uid ?? user?.uid ?? "local-preview",
    displayName: overrides.displayName ?? user?.displayName ?? null,
    email: overrides.email ?? user?.email ?? null,
    photoURL: overrides.photoURL ?? user?.photoURL ?? null,
    createdAt: overrides.createdAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
    fullName: overrides.displayName ?? null,
    schoolName: overrides.schoolName ?? null,
    schoolAddress: overrides.schoolAddress ?? null,
    phone: overrides.phone ?? null,
    address: overrides.address ?? null,
    dateOfBirth: overrides.dateOfBirth ?? null,
    gender: overrides.gender ?? null,
    ethnicity: overrides.ethnicity ?? null,
    pageUrl: overrides.pageUrl ?? null,
    metadata: mergedMetadata,
  };
}

function isApiAvailable(): boolean {
  return Boolean(CONFIG.API_BASE_URL?.trim());
}

export async function fetchProfile(): Promise<UserProfile> {
  if (!isApiAvailable()) {
    return buildLocalProfile();
  }

  try {
    const data = await apiFetch<{ participant?: UserProfile }>("/participants/me");
    const result = data.participant ?? buildLocalProfile();
    return result;
  } catch (error) {
    if (!(error instanceof GuestUserError)) {
      console.warn("[profileService] Falling back to local profile:", error);
    }
    return buildLocalProfile();
  }
}

export async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  if (!isApiAvailable()) {
    return buildLocalProfile(updates);
  }

  try {
    const data = await apiFetch<{ participant?: UserProfile }>("/participants/me", {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    const result = data.participant ?? buildLocalProfile(updates);

    return result;
  } catch (error) {
    console.warn("[updateProfile] API call failed, falling back to local profile:", error);
    const fallback = buildLocalProfile(updates);

    return fallback;
  }
}

export async function fetchUserSessionHistory(): Promise<
  { sessionId: string; timestamp: string }[]
> {
  if (!isApiAvailable()) {
    return [];
  }

  try {
    return await apiFetch<{ sessionId: string; timestamp: string }[]>("/participants/me/sessions");
  } catch (error) {
    if (!(error instanceof GuestUserError)) {
      console.warn("[profileService] Falling back to empty session history:", error);
    }
    return [];
  }
}

export async function fetchUserSessionDetails(_sessionId: string): Promise<unknown> {
  if (!isApiAvailable()) {
    return null;
  }

  try {
    return await apiFetch(`/participants/me/sessions/${_sessionId}`);
  } catch (error) {
    console.warn("[profileService] Falling back to empty session details:", error);
    return null;
  }
}

export async function uploadProfilePicture(imageUri: string): Promise<UploadResult> {
  if (!isApiAvailable()) {
    return { success: false, error: "API not available" };
  }

  return uploadImage({
    endpoint: "/participants/me/profile-picture",
    imageUri,
    fileField: "image",
  });
}

const PVA_KIND = "pva";

export async function uploadPvaResult(pdfUri: string): Promise<UploadResult> {
  if (!isApiAvailable()) {
    return { success: false, error: "API not available" };
  }

  return uploadPDF({
    endpoint: "/profile-embeddings/upload",
    pdfUri,
    fileField: "file",
    fields: { kind: PVA_KIND },
  });
}

export interface PvaResult {
  id: string;
  fileName: string;
  fileSizeBytes: number;
}

export async function listPvaResults(): Promise<PvaResult[]> {
  if (!isApiAvailable()) {
    return [];
  }

  try {
    const data = await apiFetch<{ embeddings: PvaResult[] }>(
      `/profile-embeddings/list?kind=${PVA_KIND}`
    );
    return data.embeddings ?? [];
  } catch (error) {
    if (!(error instanceof GuestUserError)) {
      console.warn("[profileService] Failed to list PVA results:", error);
    }
    return [];
  }
}

export async function getPvaFileUrl(embeddingId: string): Promise<string> {
  const data = await apiFetch<{ url: string }>(`/profile-embeddings/${embeddingId}/file`);
  return data.url;
}

export async function deletePvaResult(embeddingId: string): Promise<void> {
  await apiFetch(`/profile-embeddings/${embeddingId}`, { method: "DELETE" });
}
