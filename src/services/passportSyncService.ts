import {
  doc,
  onSnapshot,
  collection,
  getDocs,
  Timestamp,
  type Unsubscribe,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { getJSONFromStorage, setJSONInStorage } from "../utils/asyncStorage";
import { getScopedStorageKey } from "./auth/authSessionService";
import { DEFAULT_TIER } from "../config/stampConstants";

const PASSPORT_CACHE_KEY = "@passportData";
const JUSTIFICATIONS_CACHE_KEY = "@justifications";
const JUSTIFICATION_CACHE_TTL_MS = 5 * 60 * 1000;

export interface PassportStamp {
  stampName: string;
  category: string;
  categoryId: string;
  tier: number;
  timesUnlocked: number;
  firstUnlockedAt: string | null;
  lastUnlockedAt: string | null;
  sessionId: string;
}

export interface PassportCategorySummary {
  category: string;
  categoryId: string;
  totalMappings: number;
  firstMappedAt: string | null;
  lastMappedAt: string | null;
}

export interface PassportData {
  stamps: PassportStamp[];
  categories: PassportCategorySummary[];
}

interface PassportSummaryDocument {
  stamps: Record<
    string,
    {
      stampName: string;
      category: string;
      categoryId: string;
      tier: number;
      timesUnlocked: number;
      firstUnlockedAt: Timestamp | null;
      lastUnlockedAt: Timestamp | null;
      sessionId: string;
    }
  >;
  categorySummaries: Record<
    string,
    {
      category: string;
      categoryId: string;
      totalMappings: number;
      firstMappedAt: Timestamp | null;
      lastMappedAt: Timestamp | null;
    }
  >;
}

function toIso(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof ts === "string") return ts;
  if (typeof ts === "number") return new Date(ts).toISOString();
  if (ts && typeof ts === "object") {
    const t = ts as { toDate?: unknown; _seconds?: unknown };
    if (typeof t.toDate === "function") return (t.toDate as () => Date)().toISOString();
    if (typeof t._seconds === "number") return new Date(t._seconds * 1000).toISOString();
  }
  return null;
}

async function getCacheKey(): Promise<string> {
  return getScopedStorageKey(PASSPORT_CACHE_KEY);
}

async function getJustificationsCacheKey(): Promise<string> {
  return getScopedStorageKey(JUSTIFICATIONS_CACHE_KEY);
}

export async function getCachedPassportData(): Promise<PassportData> {
  try {
    const cacheKey = await getCacheKey();
    return getJSONFromStorage<PassportData>(cacheKey, { stamps: [], categories: [] });
  } catch {
    return { stamps: [], categories: [] };
  }
}

async function cachePassportData(data: PassportData): Promise<void> {
  const cacheKey = await getCacheKey();
  await setJSONInStorage(cacheKey, data);
}

function normalizeSummaryDoc(
  snapshot: DocumentSnapshot,
  sessionId: string
): { stamps: PassportStamp[]; category: PassportCategorySummary } | null {
  const data = snapshot.data();
  if (!data) return null;

  const categoryId = (data.categoryId as string) ?? snapshot.id;
  const category = (data.category as string) ?? "";
  const totalMappings = (data.totalMappings as number) ?? 0;
  const firstMappedAt = toIso(data.firstMappedAt);
  const lastMappedAt = toIso(data.lastMappedAt);

  const stamps: PassportStamp[] = [];
  const unlockedStamps = data.unlockedStamps as
    | Record<
        string,
        {
          timesUnlocked?: number;
          firstUnlockedAt?: unknown;
          lastUnlockedAt?: unknown;
          tier?: number;
        }
      >
    | undefined;
  if (unlockedStamps) {
    for (const [stampName, entry] of Object.entries(unlockedStamps)) {
      stamps.push({
        stampName,
        category,
        categoryId,
        tier: entry.tier ?? DEFAULT_TIER,
        timesUnlocked: entry.timesUnlocked ?? 0,
        firstUnlockedAt: toIso(entry.firstUnlockedAt),
        lastUnlockedAt: toIso(entry.lastUnlockedAt),
        sessionId,
      });
    }
  }

  return {
    stamps,
    category: { category, categoryId, totalMappings, firstMappedAt, lastMappedAt },
  };
}

async function fetchPassportFromSkillDocs(userId: string): Promise<PassportData> {
  const sessionsSnap = await getDocs(collection(db, "participants", userId, "sessions"));
  const allStamps: PassportStamp[] = [];
  const categoryMap = new Map<string, PassportCategorySummary>();

  for (const sessionDoc of sessionsSnap.docs) {
    const passportSnap = await getDocs(
      collection(db, "participants", userId, "sessions", sessionDoc.id, "skillPassport")
    );
    for (const pDoc of passportSnap.docs) {
      const result = normalizeSummaryDoc(pDoc, sessionDoc.id);
      if (!result) continue;
      allStamps.push(...result.stamps);
      const existing = categoryMap.get(result.category.categoryId);
      if (
        !existing ||
        (result.category.firstMappedAt &&
          existing.firstMappedAt &&
          result.category.firstMappedAt < existing.firstMappedAt)
      ) {
        categoryMap.set(result.category.categoryId, result.category);
      }
    }
  }

  return { stamps: allStamps, categories: Array.from(categoryMap.values()) };
}

export function listenToPassport(
  userId: string,
  onData: (data: PassportData) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const skillsPassportRef = doc(db, "participants", userId, "skillsPassport", "summary");

  const unsubscribe = onSnapshot(skillsPassportRef, {
    next: async (snapshot) => {
      if (snapshot.exists()) {
        const raw = snapshot.data() as PassportSummaryDocument;
        const stamps: PassportStamp[] = Object.values(raw.stamps ?? {}).map((s) => ({
          ...s,
          firstUnlockedAt: toIso(s.firstUnlockedAt),
          lastUnlockedAt: toIso(s.lastUnlockedAt),
        }));
        const categories: PassportCategorySummary[] = Object.values(
          raw.categorySummaries ?? {}
        ).map((c) => ({
          ...c,
          firstMappedAt: toIso(c.firstMappedAt),
          lastMappedAt: toIso(c.lastMappedAt),
        }));
        const data: PassportData = { stamps, categories };
        await cachePassportData(data);
        onData(data);
      } else {
        try {
          const data = await fetchPassportFromSkillDocs(userId);
          await cachePassportData(data);
          onData(data);
        } catch (err) {
          const cached = await getCachedPassportData();
          if (cached.stamps.length > 0) {
            onData(cached);
          }
          onError?.(err instanceof Error ? err : new Error("Failed to load passport"));
        }
      }
    },
    error: async (err) => {
      const cached = await getCachedPassportData();
      if (cached.stamps.length > 0) {
        onData(cached);
      }
      onError?.(err);
    },
  });

  return unsubscribe;
}

interface CacheEntry {
  data: string[];
  cachedAt: number;
}

export async function getCachedJustifications(
  categoryId: string,
  stampName?: string
): Promise<string[]> {
  try {
    const key = await getJustificationsCacheKey();
    const all = await getJSONFromStorage<Record<string, CacheEntry>>(key, {});
    const entry = all[stampName ? categoryId + ":" + stampName : categoryId];
    if (entry && Date.now() - entry.cachedAt < JUSTIFICATION_CACHE_TTL_MS) {
      return entry.data;
    }
    return [];
  } catch {
    return [];
  }
}

export async function cacheJustifications(
  categoryId: string,
  stampName: string | undefined,
  justifications: string[]
): Promise<void> {
  const key = await getJustificationsCacheKey();
  const all = await getJSONFromStorage<Record<string, CacheEntry>>(key, {});
  const uniqueJustifications = Array.from(new Set(justifications.filter(Boolean)));
  all[stampName ? categoryId + ":" + stampName : categoryId] = {
    data: uniqueJustifications,
    cachedAt: Date.now(),
  };
  await setJSONInStorage(key, all);
}

export function listenToPassportJustifications(
  userId: string,
  sessionId: string,
  categoryId: string,
  stampName: string,
  onData: (justifications: string[]) => void
): Unsubscribe {
  const passportRef = doc(
    db,
    "participants",
    userId,
    "sessions",
    sessionId,
    "skillPassport",
    categoryId
  );

  return onSnapshot(passportRef, (snapshot) => {
    if (!snapshot.exists()) {
      onData([]);
      return;
    }
    const data = snapshot.data();
    const mappings = (data.mappings ?? []) as Array<{
      justification?: string;
      specificStamp?: string | null;
    }>;
    const filtered = mappings
      .filter((m) => m.justification && m.specificStamp === stampName)
      .map((m) => m.justification!);
    onData(filtered);
  });
}
