import axios from "axios";
import type { GeminiError } from "../types/gemini";

interface Semaphore {
  acquire: () => Promise<void>;
  release: () => void;
}

function createSemaphore(maxConcurrent: number): Semaphore {
  let current = 0;
  const waitQueue: Array<() => void> = [];

  return {
    acquire(): Promise<void> {
      if (current < maxConcurrent) {
        current++;
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        waitQueue.push(resolve);
      });
    },
    release() {
      current--;
      if (waitQueue.length > 0) {
        current++;
        const next = waitQueue.shift()!;
        next();
      }
    },
  };
}

// Per-operation-type semaphores for independent concurrency control
const semaphores = new Map<string, Semaphore>();

function getSemaphore(operationType: string, maxConcurrent = 3): Semaphore {
  let sem = semaphores.get(operationType);
  if (!sem) {
    sem = createSemaphore(maxConcurrent);
    semaphores.set(operationType, sem);
  }
  return sem;
}

export function isCancellation(error: unknown): boolean {
  return axios.isCancel(error) || (error instanceof Error && error.message === "Request cancelled");
}

// Shared rate-limit backoff budget, keyed by the AbortSignal flowing through
// one logical operation, so chained retries share a single 20s deadline.
const retryDeadlines = new WeakMap<AbortSignal, number>();
const TOTAL_RETRY_BUDGET_MS = 20000;

function retryDeadlineFor(signal?: AbortSignal): number {
  if (!signal) return Number.POSITIVE_INFINITY;
  const existing = retryDeadlines.get(signal);
  if (existing !== undefined) return existing;
  const deadline = Date.now() + TOTAL_RETRY_BUDGET_MS;
  retryDeadlines.set(signal, deadline);
  return deadline;
}

export function getRetryDelayJitter(maxJitter: number): number {
  return Math.floor(Math.random() * maxJitter);
}

export function computeRetryDelay(error: unknown, attempt: number, initialDelay: number): number {
  if (!axios.isAxiosError(error)) return -1;

  const status = error.response?.status;
  const isRetryable = status === 429 || status === 503;
  if (!isRetryable) return -1;

  const retryAfterHeader = error.response?.headers?.["retry-after"];
  const retryAfterSeconds = Number(retryAfterHeader);
  const baseDelay =
    Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : initialDelay * Math.pow(2, attempt);
  const jitter = getRetryDelayJitter(500);
  return baseDelay + jitter;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  initialDelay: number = 2000,
  signal?: AbortSignal
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new Error("Request cancelled");
    }
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (isCancellation(error)) throw error;
      const delay = computeRetryDelay(error, attempt, initialDelay);
      if (delay < 0) throw error;
      // Give up once this operation's shared backoff budget is spent.
      if (Date.now() + delay > retryDeadlineFor(signal)) {
        throw error;
      }
      console.log(
        `Rate limit/service busy. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export function isRateLimitError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;

  const status = error.response?.status;
  if (status === 429) return true;

  const bodyText = JSON.stringify(error.response?.data ?? "").toLowerCase();
  const message = String(error.message ?? "").toLowerCase();
  const tooManyRequestsMarker = ["too", "many", "requests"].join("");

  return (
    bodyText.includes(tooManyRequestsMarker) ||
    bodyText.includes("resource_exhausted") ||
    bodyText.includes("quota") ||
    message.includes(tooManyRequestsMarker) ||
    message.includes("resource_exhausted")
  );
}

/** Run an async function with concurrency control for the given operation type. */
export async function withConcurrencyControl<T>(
  operationType: string,
  fn: () => Promise<T>,
  maxConcurrent = 3
): Promise<T> {
  const sem = getSemaphore(operationType, maxConcurrent);
  await sem.acquire();
  try {
    return await fn();
  } finally {
    sem.release();
  }
}

export function sanitizeUrl(url: string): string {
  return url.replaceAll(/key=[^&]*/g, "key=***");
}

export function normalizeError(error: unknown): GeminiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const retryAfterHeader = error.response?.headers?.["retry-after"];
    const retryAfterSeconds = Number(retryAfterHeader);
    const retryAfterMs =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : undefined;

    if (isRateLimitError(error) || status === 429 || status === 503) {
      return {
        code: "RATE_LIMIT",
        message: "System busy at the moment. Please try again later.",
        retryable: true,
        retryAfterMs,
      };
    }

    if (status === 401 || status === 403) {
      return {
        code: "AUTH",
        message: "API key invalid or missing. Check your configuration.",
        retryable: false,
      };
    }

    if (error.request && !error.response) {
      return {
        code: "NETWORK",
        message: "Network error. Please check your internet connection.",
        retryable: true,
      };
    }

    return {
      code: "API",
      message: `API Error: ${status ?? "unknown"}${
        error.response?.data ? ` - ${JSON.stringify(error.response.data)}` : ""
      }`,
      retryable: false,
    };
  }

  return {
    code: "UNKNOWN",
    message: error instanceof Error ? error.message : "Unexpected error",
    retryable: false,
  };
}
