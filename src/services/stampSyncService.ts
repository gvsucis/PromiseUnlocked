import { apiFetch } from "./apiClient";
import { getJSONFromStorage, setJSONInStorage } from "../utils/asyncStorage";
import { getScopedStorageKey } from "./storageScopeService";
import type { MappedCategory } from "./categoryTaxonomyService";
import { DEFAULT_TIER } from "../config/stampConstants";

const STAMPS_CACHE_KEY = "@myStamps";

export interface StampEntry {
  stampName: string;
  category: string;
  categoryId: string;
  tier: number;
  timesUnlocked: number;
  firstUnlockedAt: string | null;
  lastUnlockedAt: string | null;
  sessionId: string;
}

interface StampsResponse {
  stamps: StampEntry[];
  total: number;
}

async function getCacheKey(): Promise<string> {
  return getScopedStorageKey(STAMPS_CACHE_KEY);
}

export async function fetchMyStamps(): Promise<StampEntry[]> {
  try {
    const [data, cached] = await Promise.all([
      apiFetch<StampsResponse>("/participants/me/stamps"),
      getCachedStamps(),
    ]);
    const cacheKey = await getCacheKey();
    const byKey = new Map<string, StampEntry>();
    for (const s of cached) {
      byKey.set(`${s.stampName}\u0000${s.categoryId}`, s);
    }
    for (const s of data.stamps) {
      byKey.set(`${s.stampName}\u0000${s.categoryId}`, s);
    }
    const merged = Array.from(byKey.values());
    await setJSONInStorage(cacheKey, merged);
    return merged;
  } catch {
    return getCachedStamps();
  }
}

export async function getCachedStamps(): Promise<StampEntry[]> {
  try {
    const cacheKey = await getCacheKey();
    return getJSONFromStorage<StampEntry[]>(cacheKey, []);
  } catch {
    return [];
  }
}

export function deriveMappedCategories(stamps: StampEntry[]): MappedCategory[] {
  const byCategory = new Map<
    string,
    { stamps: StampEntry[]; category: string; categoryId: string }
  >();

  for (const s of stamps) {
    const existing = byCategory.get(s.categoryId);
    if (existing) {
      existing.stamps.push(s);
    } else {
      byCategory.set(s.categoryId, {
        stamps: [s],
        category: s.category,
        categoryId: s.categoryId,
      });
    }
  }

  return Array.from(byCategory.values()).map(({ stamps, category, categoryId }) => {
    const uniqueStamps = new Map<string, StampEntry>();
    for (const s of stamps) {
      const existing = uniqueStamps.get(s.stampName);
      if (!existing || s.tier > existing.tier) {
        uniqueStamps.set(s.stampName, s);
      }
    }

    return {
      category,
      categoryId,
      justification: "",
      dateIdentified: stamps.reduce(
        (earliest, s) =>
          s.firstUnlockedAt && s.firstUnlockedAt < earliest ? s.firstUnlockedAt : earliest,
        stamps[0]?.firstUnlockedAt ?? new Date().toISOString()
      ),
      timesMapped: stamps.length,
      unlockedStamps: Array.from(uniqueStamps.values()).map((s) => ({
        name: s.stampName,
        category: s.category,
        categoryId: s.categoryId,
        timesUnlocked: s.timesUnlocked,
        tier: s.tier ?? DEFAULT_TIER,
      })),
    };
  });
}
