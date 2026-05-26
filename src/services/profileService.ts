import { auth } from "../config/firebase";
import { CONFIG } from "../config/env";
import { apiFetch } from "./apiClient";

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  metadata: Record<string, unknown>;
}

function buildLocalProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const user = auth.currentUser;
  const mergedMetadata = overrides.metadata ?? {};

  return {
    uid: overrides.uid ?? user?.uid ?? "local-preview",
    displayName: overrides.displayName ?? user?.displayName ?? null,
    email: overrides.email ?? user?.email ?? null,
    photoURL: overrides.photoURL ?? user?.photoURL ?? null,
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
    const data = await apiFetch<{ participant?: UserProfile }>("/api/participants/me");
    return data.participant ?? buildLocalProfile();
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
    const data = await apiFetch<{ participant?: UserProfile }>("/api/participants/me", {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    return data.participant ?? buildLocalProfile(updates);
  } catch (error) {
    console.warn("[profileService] Falling back to local profile update:", error);
    return buildLocalProfile(updates);
  }
}

export async function fetchUserSessionHistory(): Promise<{ sessionId: string; timestamp: string }[]> {
  if (!isApiAvailable()) {
    return [];
  }

  try {
    return await apiFetch<{ sessionId: string; timestamp: string }[]>("/api/user/sessions");
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
    return await apiFetch(`/api/user/sessions/${_sessionId}`);
  } catch (error) {
    console.warn("[profileService] Falling back to empty session details:", error);
    return null;
  }
}
