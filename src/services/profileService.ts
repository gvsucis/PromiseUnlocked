import { auth } from "../config/firebase";
import { CONFIG } from "../config/env";
import { apiFetch } from "./apiClient";
import { uploadImage, type UploadResult } from "./uploadService";
import { clearPvaContextCache, invalidatePvaCatalogCache } from "./profileEmbeddingService";
import { ttlCache } from "../utils/ttlCache";
import { UserProfile } from "../types/profile";

const profileCache = ttlCache<UserProfile>(30_000);

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
    fullName: overrides.fullName ?? overrides.displayName ?? null,
    firstName: overrides.firstName ?? null,
    lastName: overrides.lastName ?? null,
    schoolName: overrides.schoolName ?? null,
    schoolAddress: overrides.schoolAddress ?? null,
    phone: overrides.phone ?? null,
    address: overrides.address ?? null,
    dateOfBirth: overrides.dateOfBirth ?? null,
    gender: overrides.gender ?? null,
    ethnicity: overrides.ethnicity ?? null,
    pageUrl: overrides.pageUrl ?? null,
    selectedPvaId: overrides.selectedPvaId ?? null,
    metadata: mergedMetadata,
  };
}

function isApiAvailable(): boolean {
  return Boolean(CONFIG.API_BASE_URL?.trim());
}

export async function fetchProfile(): Promise<UserProfile> {
  const cached = profileCache.get();
  if (cached) return cached;

  if (!isApiAvailable()) {
    return buildLocalProfile();
  }

  try {
    const data = await apiFetch<{ participant?: UserProfile }>("/participants/me");
    const profile = data.participant ?? buildLocalProfile();
    profileCache.set(profile);
    return profile;
  } catch (error) {
    console.warn("[profileService] Falling back to local profile:", error);
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
    profileCache.set(result);
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
    console.warn("[profileService] Falling back to empty session history:", error);
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

// Select a shared catalog PVA for the user; its persona brief feeds the dialogue.
export async function selectPva(pvaId: string | null): Promise<UserProfile> {
  const result = await updateProfile({ selectedPvaId: pvaId });
  await clearPvaContextCache();
  invalidatePvaCatalogCache();
  return result;
}
