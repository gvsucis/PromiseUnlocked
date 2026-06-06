import type { Response } from "express";

/**
 * Standard API response shape used across all controllers.
 */
interface ApiResponseBody {
  success: boolean;
  data: unknown;
  error: string | null;
  details?: unknown;
}

/**
 * Creates a guard that ensures only one response is ever sent for a request.
 *
 * Useful in streaming / callback-based handlers (e.g. Busboy) where multiple
 * code paths may attempt to respond. After the first call, subsequent calls
 * are no-ops that return the existing `res` object.
 *
 * @example
 * ```ts
 * const respond = createRespondOnce(res);
 * respond.error(400, "Bad request");
 * respond.error(500, "Too late — already responded"); // no-op
 * ```
 */
export function createRespondOnce(res: Response) {
  let responded = false;

  function send(status: number, body: ApiResponseBody): Response {
    if (responded || res.headersSent) return res;
    responded = true;
    return res.status(status).json(body);
  }

  return {
    /** Whether a response has already been sent. */
    get hasResponded() {
      return responded;
    },

    /** Mark as responded externally (e.g. when state is tracked elsewhere). */
    markResponded() {
      responded = true;
    },

    /** Send a success response. */
    success(status: number, data: unknown): Response {
      return send(status, { success: true, data, error: null });
    },

    /** Send an error response. */
    error(status: number, error: string, details?: unknown): Response {
      return send(status, {
        success: false,
        data: null,
        error,
        details: details ?? null,
      });
    },
  };
}

export type RespondOnce = ReturnType<typeof createRespondOnce>;
