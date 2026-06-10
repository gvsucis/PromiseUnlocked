import { auth } from "../config/firebase";
import { CONFIG } from "../config/env";
import { log } from "../utils/logger";

const TAG = "API";

/** Thrown when an API call is skipped because the current user is a guest (anonymous). */
export class GuestUserError extends Error {
  readonly code = "app/guest-user";
  constructor() {
    super("API calls are not available for guest users.");
    this.name = "GuestUserError";
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Anonymous (guest) or unauthenticated users don't have backend accounts — skip the network
  // call entirely instead of making a request that will always return 401.
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    throw new GuestUserError();
  }

  const token = await auth.currentUser.getIdToken();
  const method = (options.method ?? "GET").toUpperCase();
  const url = `${CONFIG.API_BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const started = Date.now();
  log.info(TAG, "→ request", { method, url, hasAuth: Boolean(token) });

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error(TAG, "✗ network error", { method, url, latencyMs: Date.now() - started, error });
    throw err;
  }

  const latencyMs = Date.now() - started;
  if (!response.ok) {
    const errorText = await response.text();
    log.warn(TAG, "← non-2xx", {
      method,
      url,
      status: response.status,
      statusText: response.statusText,
      latencyMs,
      body: errorText.slice(0, 500),
    });
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = (await response.json()) as T;
  log.info(TAG, "←- ok", {
    method,
    url,
    status: response.status,
    latencyMs,
  });
  return data;
}
