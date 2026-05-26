import { apiFetch } from "./apiClient";

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  metadata: Record<string, unknown>;
}

export async function fetchProfile(): Promise<UserProfile> {
  const data = await apiFetch<{ participant: UserProfile }>("/api/participants/me");
  return data.participant;
}

export async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  const data = await apiFetch<{ participant: UserProfile }>("/api/participants/me", {
    method: "PUT",
    body: JSON.stringify(updates),
  });
  return data.participant;
}

export async function fetchUserSessionHistory(): Promise<
  { sessionId: string; timestamp: string }[]
> {
  return apiFetch<{ sessionId: string; timestamp: string }[]>("/api/user/sessions");
}

export async function fetchUserSessionDetails(sessionId: string): Promise<any> {
  return apiFetch(`/api/user/sessions/${sessionId}`);
}
