import { useCallback, useRef, useState } from "react";

/**
 * A proof request raised when an answer is strong enough that an uploaded
 * artifact (photo, document) would upgrade the unlocked stamp's tier.
 */
export interface ProofRequest {
  question: string;
  answer: string;
  interactionId: string;
  category: string;
  stampName?: string;
  artifactUploadReason?: string;
  proofTier?: number;
}

/**
 * The dismissible banner shown after a stamp-unlock modal, inviting the user
 * to act on a deferred {@link ProofRequest}.
 */
export interface ProofNotification {
  artifactUploadReason: string;
  stampName: string;
  proofTier: number;
  category: string;
}

const DEFAULT_NOTIFICATION_REASON = "Share proof to upgrade your stamp tier!";

/**
 * Owns the proof-request workflow that previously lived as four atoms inside
 * useDialogueState. The interface is small; the deferral bookkeeping — holding
 * a request behind a stamp-unlock modal, surfacing it as a notification, and
 * promoting it to an active request — is hidden behind it.
 *
 * Lifecycle:
 *   requestNow(r)                      → active request (immediate path)
 *   deferAfterUnlock(r) → surfaceDeferred() → notification → activateFromNotification() → active request
 */
export interface ProofWorkflow {
  /** Active request — drives the proof-upload modal. */
  proofRequest: ProofRequest | null;
  /** Pending banner — drives the proof notification. */
  proofNotification: ProofNotification | null;
  /** Raise a proof request immediately (no stamp-unlock modal in the way). */
  requestNow: (request: ProofRequest) => void;
  /** Hold a proof request behind an in-progress stamp-unlock modal. */
  deferAfterUnlock: (request: ProofRequest) => void;
  /** Promote any held request into a notification. No-op when nothing is held. */
  surfaceDeferred: () => void;
  /** Drop a held request without surfacing it (e.g. on dialogue completion). */
  clearDeferred: () => void;
  /** Turn the current notification into an active request. */
  activateFromNotification: () => void;
  /** Dismiss the active request. */
  clearRequest: () => void;
  /** Dismiss the notification. */
  clearNotification: () => void;
}

export function useProofWorkflow(): ProofWorkflow {
  const [proofRequest, setProofRequest] = useState<ProofRequest | null>(null);
  const [proofNotification, setProofNotification] = useState<ProofNotification | null>(null);
  const [deferred, setDeferred] = useState<ProofRequest | null>(null);
  // Ground truth for the request behind a notification, so activation survives
  // a re-render between surfacing the banner and the user tapping it.
  const notifiedRequestRef = useRef<ProofRequest | null>(null);

  const requestNow = useCallback((request: ProofRequest) => {
    setProofRequest(request);
  }, []);

  const deferAfterUnlock = useCallback((request: ProofRequest) => {
    setDeferred(request);
  }, []);

  const clearDeferred = useCallback(() => {
    setDeferred(null);
  }, []);

  const surfaceDeferred = useCallback(() => {
    if (deferred) {
      notifiedRequestRef.current = deferred;
      setProofNotification({
        category: deferred.category,
        stampName: deferred.stampName ?? "",
        proofTier: deferred.proofTier ?? 3,
        artifactUploadReason: deferred.artifactUploadReason ?? DEFAULT_NOTIFICATION_REASON,
      });
    }
    setDeferred(null);
  }, [deferred]);

  const activateFromNotification = useCallback(() => {
    if (notifiedRequestRef.current) {
      setProofRequest(notifiedRequestRef.current);
    }
    setProofNotification(null);
  }, []);

  const clearRequest = useCallback(() => {
    setProofRequest(null);
  }, []);

  const clearNotification = useCallback(() => {
    setProofNotification(null);
    notifiedRequestRef.current = null;
  }, []);

  return {
    proofRequest,
    proofNotification,
    requestNow,
    deferAfterUnlock,
    surfaceDeferred,
    clearDeferred,
    activateFromNotification,
    clearRequest,
    clearNotification,
  };
}
