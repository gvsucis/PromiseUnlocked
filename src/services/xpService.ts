import { apiFetch } from "./apiClient";
import { getJSONFromStorage, setJSONInStorage } from "../utils/asyncStorage";
import { getScopedStorageKey } from "./storageScopeService";

const XP_CACHE_KEY = "@xpSummary";
const XP_CACHE_TTL_MS = 60 * 1000;

export interface XpSummary {
  totalXp: number;
  stampXp: number;
  bonusXp: number;
  stampCount: number;
  breakdown: Array<{ categoryId: string; category: string | null; xp: number }>;
}

export type XpEventType = "profile_completion" | "artifact_upload";

interface CacheEntry {
  xp: XpSummary;
  cachedAt: number;
}

async function cacheXp(xp: XpSummary): Promise<void> {
  const key = await getScopedStorageKey(XP_CACHE_KEY);
  await setJSONInStorage(key, { xp, cachedAt: Date.now() } satisfies CacheEntry);
}

async function getCachedXp(): Promise<CacheEntry | null> {
  try {
    const key = await getScopedStorageKey(XP_CACHE_KEY);
    return getJSONFromStorage<CacheEntry | null>(key, null);
  } catch {
    return null;
  }
}

/**
 * Server XP first, cached XP as fallback. `force` bypasses the TTL window so
 * post-claim refreshes always hit the network.
 */
export async function getXpSummary(force = false): Promise<XpSummary | null> {
  const cached = await getCachedXp();
  if (!force && cached && Date.now() - cached.cachedAt < XP_CACHE_TTL_MS) {
    return cached.xp;
  }

  try {
    const { xp } = await apiFetch<{ xp: XpSummary }>("/participants/me/xp");
    await cacheXp(xp);
    return xp;
  } catch {
    return cached?.xp ?? null;
  }
}

export async function claimXpEvent(
  eventType: XpEventType
): Promise<{ xp: number; awarded: boolean }> {
  const { event } = await apiFetch<{ event: { xp: number; awarded: boolean } }>(
    "/participants/me/xp/events",
    { method: "POST", body: JSON.stringify({ eventType }) }
  );
  return event;
}
