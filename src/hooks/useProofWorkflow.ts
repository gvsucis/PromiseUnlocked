import { useCallback, useRef, useState } from "react";
import type { ProofRequest, ProofNotification, ProofWorkflow } from "../types/hooks";

export type { ProofRequest, ProofNotification, ProofWorkflow } from "../types/hooks";

const DEFAULT_NOTIFICATION_REASON = "Share proof to upgrade your stamp tier!";

export function useProofWorkflow(): ProofWorkflow {
  const [proofRequest, setProofRequest] = useState<ProofRequest | null>(null);
  const [proofNotification, setProofNotification] = useState<ProofNotification | null>(null);
  const [deferred, setDeferred] = useState<ProofRequest | null>(null);
  // Ground truth for the notification behind a banner, surviving re-renders.
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
        categoryId: deferred.categoryId,
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
