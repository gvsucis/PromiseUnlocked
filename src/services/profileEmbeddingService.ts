import { getJSONFromStorage, setJSONInStorage, removeFromStorage } from "../utils/asyncStorage";
import { getScopedStorageKey } from "./auth/authSessionService";
import { apiFetch } from "./apiClient";

const PVA_CONTEXT_KEY = "@pva_context";
let cachedCatalog: PvaCatalogItem[] | null = null;

export type PvaEmbeddingStatus = "processing" | "ready" | "failed";

export interface PvaCatalogItem {
  id: string;
  name: string;
  embeddingStatus: PvaEmbeddingStatus;
}

export function invalidatePvaCatalogCache(): void {
  cachedCatalog = null;
}

/** Shared catalog of selectable PVAs. Cached in memory after first fetch. */
export async function listPvaCatalog(): Promise<PvaCatalogItem[]> {
  if (cachedCatalog) return cachedCatalog;
  try {
    const data = await apiFetch<{ pvas: PvaCatalogItem[] }>("/pva-catalog");
    cachedCatalog = data.pvas ?? [];
    return cachedCatalog;
  } catch (error) {
    console.warn("[PvaCatalog] Failed to list catalog:", error);
    return [];
  }
}

// Selected PVA's persona brief; cached per user, invalidated on selection change.
export async function getPvaContext(): Promise<string> {
  const key = await getScopedStorageKey(PVA_CONTEXT_KEY);
  const cached = await getJSONFromStorage<string | null>(key, null);
  if (cached !== null) return cached;

  const fetched = await fetchSelectedPvaContext();
  // Don't cache a miss (no selection yet, or still processing) — retry next time.
  if (fetched) await setJSONInStorage(key, fetched);
  return fetched;
}

async function fetchSelectedPvaContext(): Promise<string> {
  try {
    const profile = await apiFetch<{ participant?: { selectedPvaId?: string | null } }>(
      "/participants/me"
    );
    const selectedPvaId = profile.participant?.selectedPvaId;
    if (!selectedPvaId) return "";

    const data = await apiFetch<{ context: string; embeddingStatus: PvaEmbeddingStatus }>(
      `/pva-catalog/${selectedPvaId}/context`
    );
    return data.context ?? "";
  } catch (error) {
    console.warn("[PvaCatalog] Failed to fetch selected PVA context:", error);
    return "";
  }
}

export async function clearPvaContextCache(): Promise<void> {
  const key = await getScopedStorageKey(PVA_CONTEXT_KEY);
  await removeFromStorage(key);
}
