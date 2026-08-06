import { CONFIG } from "../config/env";
import { log } from "../utils/logger";

const TAG = "BackendHealth";

export type BackendHealthResult = {
  ok: boolean;
  status?: number;
  statusText?: string;
  latencyMs?: number;
  baseUrl: string;
  url: string;
  body?: string;
  error?: string;
};

/**
 * One-shot connectivity probe to the backend.
 * Pings `${API_BASE_URL}/health` and reports status + latency.
 */
export async function checkBackendHealth(timeoutMs = 5000): Promise<BackendHealthResult> {
  const baseUrl = CONFIG.API_BASE_URL.replace(/\/$/, "");
  const url = `${baseUrl}/health`;
  const started = Date.now();

  log.info(TAG, "Pinging backend", { baseUrl, url, timeoutMs });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    const body = await response.text();
    const result: BackendHealthResult = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      latencyMs,
      baseUrl,
      url,
      body,
    };
    if (response.ok) {
      log.info(TAG, "Backend reachable ✅", result);
    } else {
      log.warn(TAG, "Backend responded with non-2xx ❗", result);
    }
    return result;
  } catch (err) {
    const latencyMs = Date.now() - started;
    const error = err instanceof Error ? err.message : String(err);
    const result: BackendHealthResult = {
      ok: false,
      latencyMs,
      baseUrl,
      url,
      error,
    };
    log.error(TAG, "Backend unreachable ❌", result);
    return result;
  } finally {
    clearTimeout(timer);
  }
}
