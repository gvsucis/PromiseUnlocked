import { auth } from "../config/firebase";
import { CONFIG } from "../config/env";
import { apiFetch, GuestUserError } from "./apiClient";

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
  address?: { street?: string; city?: string; state?: string; postalCode?: string; country?: string } | null;
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
    fullName: overrides.fullName ?? null,
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
    const data = await apiFetch<{ participant?: UserProfile }>("/api/participants/me");
    return data.participant ?? buildLocalProfile();
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
    const data = await apiFetch<{ participant?: UserProfile }>("/api/participants/me", {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    return data.participant ?? buildLocalProfile(updates);
  } catch (error) {
    if (!(error instanceof GuestUserError)) {
      console.warn("[profileService] Falling back to local profile update:", error);
    }
    return buildLocalProfile(updates);
  }
}

export async function fetchUserSessionHistory(): Promise<
  { sessionId: string; timestamp: string }[]
> {
  if (!isApiAvailable()) {
    return [];
  }

  try {
    return await apiFetch<{ sessionId: string; timestamp: string }[]>("/api/user/sessions");
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
    return await apiFetch(`/api/user/sessions/${_sessionId}`);
  } catch (error) {
    console.warn("[profileService] Falling back to empty session details:", error);
    return null;
  }
}
