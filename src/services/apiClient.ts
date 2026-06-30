import { auth } from "../config/firebase";
import { CONFIG } from "../config/env";
import { log } from "../utils/logger";

const TAG = "API";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!auth.currentUser) {
    throw new Error("Not authenticated");
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

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), CONFIG.REQUEST_TIMEOUT);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal ?? timeoutController.signal,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error(TAG, "✗ network error", { method, url, latencyMs: Date.now() - started, error });
    throw err;
  } finally {
    clearTimeout(timeoutId);
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
