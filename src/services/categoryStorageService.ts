/**
 * Category Mapping Storage Service
 * Manages persistence of mapped categories and conversation history.
 * Write-through: AsyncStorage is the primary store; Firestore receives
 * a mirrored write after every AsyncStorage write (fire-and-forget).
 */

import {
  MappedCategory,
  ConversationInteraction,
  getCategoryIdFromName,
} from "./categoryTaxonomyService";
import { STAMP_TAXONOMY } from "../config/stampTaxonomy";
import { DEFAULT_TIER } from "../config/stampConstants";
import { getJSONFromStorage, removeManyFromStorage, setJSONInStorage } from "../utils/asyncStorage";
import type { StampEntry } from "./stampSyncService";

import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import type { SkillPassportDocument } from "../types/firestore";
import { getScopedStorageKey } from "./auth/authSessionService";
import {
  clearSessionState,
  endSession,
  getOrStartSession,
  getUserId,
  getActiveSessionId,
} from "./sessionManager";
import {
  saveInteraction,
  saveStampUnlock,
  fetchSessionInteractions,
  canWriteToFirestore,
} from "./firebase/firestoreService";

import { randomUUID } from "expo-crypto";
// Log errors to a file instead of console.error
import { logErrorToFile } from "../utils/logToFile";

const MAPPED_CATEGORIES_KEY = "@mappedCategories";
const INTERACTIONS_KEY = "@userInteractions";

async function mirrorStampUnlockToFirestore(
  categoryId: string,
  stampName: string,
  tier: number,
  categoryName: string
): Promise<void> {
  try {
    const writeContext = await getFirestoreWriteContext();
    await saveStampUnlock(
      writeContext.userId,
      writeContext.sessionId,
      categoryId,
      stampName,
      tier,
      categoryName
    );
  } catch {
    // AsyncStorage is the source of truth; Firestore mirror is best-effort
  }
}

function generateInteractionId(): string {
  return randomUUID();
}

async function getFirestoreWriteContext(): Promise<{ sessionId: string; userId: string }> {
  if (!canWriteToFirestore()) {
    throw new Error("Firestore writes are disabled for unauthenticated users.");
  }
  const [sessionId, userId] = await Promise.all([getOrStartSession(), getUserId()]);
  return { sessionId, userId };
}

async function getMappedCategoriesStorageKey(): Promise<string> {
  return getScopedStorageKey(MAPPED_CATEGORIES_KEY);
}

async function getInteractionsStorageKey(): Promise<string> {
  return getScopedStorageKey(INTERACTIONS_KEY);
}

export async function getMappedCategories(): Promise<MappedCategory[]> {
  const storageKey = await getMappedCategoriesStorageKey();
  const raw = await getJSONFromStorage<Record<string, unknown>[]>(storageKey, []);
  return raw.map((entry) => {
    const categoryName = typeof entry.category === "string" ? entry.category : "";
    return {
      category: categoryName,
      categoryId:
        typeof entry.categoryId === "string"
          ? entry.categoryId
          : getCategoryIdFromName(categoryName),
      justification: typeof entry.justification === "string" ? entry.justification : "",
      dateIdentified:
        typeof entry.dateIdentified === "string" ? entry.dateIdentified : new Date().toISOString(),
      timesMapped: typeof entry.timesMapped === "number" ? entry.timesMapped : 1,
      unlockedStamps: Array.isArray(entry.unlockedStamps)
        ? (entry.unlockedStamps as MappedCategory["unlockedStamps"])
        : undefined,
    };
  });
}

/**
 * Get specific MappedCategory object
 */
export async function getMappedCategory(categoryId: string): Promise<MappedCategory> {
  const mappedCategories = await getMappedCategories();
  const result = mappedCategories.find((c) => c.categoryId === categoryId);
  if (!result) {
    throw new Error(`MappedCategory not found: ${categoryId}`);
  }
  return result;
}

/**
 * Save a newly mapped category
 */
export async function saveMappedCategory(category: MappedCategory): Promise<void> {
  try {
    const current = await getMappedCategories();
    const entry = {
      ...category,
      categoryId: category.categoryId || getCategoryIdFromName(category.category),
    };
    const updated = [...current, entry];
    const storageKey = await getMappedCategoriesStorageKey();
    await setJSONInStorage(storageKey, updated);
  } catch (error) {
    logErrorToFile("Error saving mapped category:", error);
    throw error;
  }
}

/**
 * Upgrade a stamp's tier without incrementing the unlock count.
 * Used when proof is uploaded for an already-unlocked stamp.
 */
export async function upgradeStampTier(
  categoryId: string,
  stampName: string,
  minTier: number
): Promise<{ previousTier: number; newTier: number } | null> {
  try {
    const current = await getMappedCategories();
    const idx = current.findIndex((c) => c.categoryId === categoryId);
    if (idx === -1) return null;

    const entry = current[idx];
    const stamps = entry.unlockedStamps ?? [];
    const existingIdx = stamps.findIndex((s) => s.name === stampName);
    if (existingIdx < 0) return null;

    const previousTier = stamps[existingIdx].tier ?? DEFAULT_TIER;
    const newTier = Math.max(previousTier, minTier);

    stamps[existingIdx] = {
      ...stamps[existingIdx],
      category: stamps[existingIdx].category ?? entry.category,
      categoryId: stamps[existingIdx].categoryId ?? categoryId,
      tier: newTier,
    };

    current[idx] = { ...entry, unlockedStamps: stamps };
    const storageKey = await getMappedCategoriesStorageKey();
    await setJSONInStorage(storageKey, current);

    await mirrorStampUnlockToFirestore(categoryId, stampName, newTier, entry.category);

    if (newTier <= previousTier) return null;
    return { previousTier, newTier };
  } catch (error) {
    logErrorToFile("Error upgrading stamp tier:", error);
    throw error;
  }
}

/**
 * Add or increment a stamp unlock for a mapped category
 */
export async function addStampUnlock(
  categoryId: string,
  stampName: string,
  tier: number = DEFAULT_TIER
): Promise<{ previousTier: number; newTier: number } | null> {
  try {
    const current = await getMappedCategories();
    const idx = current.findIndex((c) => c.categoryId === categoryId);
    if (idx === -1) return null;

    const entry = current[idx];
    const stamps = entry.unlockedStamps ?? [];
    const existingIdx = stamps.findIndex((s) => s.name === stampName);

    let resolvedTier = tier;
    let tierChange: { previousTier: number; newTier: number } | null = null;

    if (existingIdx >= 0) {
      const previousTier = stamps[existingIdx].tier ?? DEFAULT_TIER;
      const newTimesUnlocked = stamps[existingIdx].timesUnlocked + 1;
      resolvedTier = Math.max(previousTier, tier);

      stamps[existingIdx] = {
        ...stamps[existingIdx],
        category: stamps[existingIdx].category ?? entry.category,
        categoryId: stamps[existingIdx].categoryId ?? categoryId,
        timesUnlocked: newTimesUnlocked,
        tier: resolvedTier,
      };

      if (resolvedTier > previousTier) {
        tierChange = { previousTier, newTier: resolvedTier };
      }
    } else {
      stamps.push({
        name: stampName,
        category: entry.category,
        categoryId,
        timesUnlocked: 1,
        tier,
      });
    }

    current[idx] = { ...entry, unlockedStamps: stamps };
    const storageKey = await getMappedCategoriesStorageKey();
    await setJSONInStorage(storageKey, current);

    await mirrorStampUnlockToFirestore(categoryId, stampName, resolvedTier, entry.category);

    try {
      const stampsCacheKey = await getScopedStorageKey("@myStamps");
      const cachedStamps = await getJSONFromStorage<StampEntry[]>(stampsCacheKey, []);
      const now = new Date().toISOString();
      const sessionId = await getActiveSessionId();
      const existingIdx = cachedStamps.findIndex(
        (s) => s.stampName === stampName && s.categoryId === categoryId
      );
      if (existingIdx >= 0) {
        cachedStamps[existingIdx] = {
          ...cachedStamps[existingIdx],
          tier: resolvedTier,
          timesUnlocked: cachedStamps[existingIdx].timesUnlocked + 1,
          lastUnlockedAt: now,
        };
      } else {
        cachedStamps.push({
          stampName,
          category: entry.category,
          categoryId,
          tier: resolvedTier,
          timesUnlocked: 1,
          firstUnlockedAt: now,
          lastUnlockedAt: now,
          sessionId: sessionId ?? "",
        });
      }
      await setJSONInStorage(stampsCacheKey, cachedStamps);
    } catch {
      // @myStamps cache sync is best-effort
    }

    return tierChange;
  } catch (error) {
    logErrorToFile("Error adding stamp unlock:", error);
    throw error;
  }
}

/**
 * Ensure every mapped category has at least one stamp unlocked.
 * Used by screens on focus to recover from data loss.
 */
export async function ensureAllMappedCategoriesHaveStamps(): Promise<void> {
  const mappedCategories = await getMappedCategories();
  for (const mc of mappedCategories) {
    if (mc.unlockedStamps?.length) continue;
    const families = STAMP_TAXONOMY[mc.category];
    if (!families?.length) continue;
    const first = families[0];
    const stampName = first.detailedStamps?.length
      ? `${first.stampCategory}: ${first.detailedStamps[0].name}`
      : first.stampCategory;
    await addStampUnlock(mc.categoryId, stampName);
  }
}

/**
 * Get unlocked stamps for a specific category
 */
export async function getUnlockedStampsForCategory(categoryId: string): Promise<
  Array<{
    name: string;
    category: string;
    categoryId: string;
    timesUnlocked: number;
    tier?: number;
  }>
> {
  try {
    const current = await getMappedCategories();
    const entry = current.find((c) => c.categoryId === categoryId);
    return entry?.unlockedStamps ?? [];
  } catch {
    return [];
  }
}

export async function getStampUnlockSummary(categoryId: string): Promise<string> {
  const stamps = await getUnlockedStampsForCategory(categoryId);
  return stamps
    .map((s) => `${s.name}: unlocked ${s.timesUnlocked}x (tier ${s.tier ?? DEFAULT_TIER})`)
    .join(", ");
}

export async function clearAllData(): Promise<void> {
  try {
    await endSession("abandoned");
    const [mappedCategoriesKey, interactionsKey] = await Promise.all([
      getMappedCategoriesStorageKey(),
      getInteractionsStorageKey(),
    ]);
    await removeManyFromStorage([mappedCategoriesKey, interactionsKey]);
    await clearSessionState();
  } catch (error) {
    logErrorToFile("Error clearing data:", error);
    throw error;
  }
}

export async function getConversationHistory(): Promise<ConversationInteraction[]> {
  const storageKey = await getInteractionsStorageKey();
  return getJSONFromStorage(storageKey, [] as ConversationInteraction[]);
}

export async function syncFromFirestore(): Promise<void> {
  try {
    const sessionId = await getActiveSessionId();
    if (!sessionId) return;
    const userId = await getUserId();
    const remote = await fetchSessionInteractions(userId, sessionId);
    if (remote.length === 0) return;

    const local = await getConversationHistory();

    // Identity that is stable across the local↔Firestore boundary. The
    // timestamp is deliberately NOT part of the key: local rows store a client
    // clock (`new Date().toISOString()`) while Firestore stores
    // `serverTimestamp()`, so keying on it treats every synced interaction as
    // new and duplicates it on each sync. A question+answer pair uniquely
    // identifies an interaction within a session; the NUL separator keeps the
    // boundary unambiguous so two distinct pairs can't concatenate to one key.
    const identityKey = (i: { question: string; answer: string }) =>
      `${i.question}\u0000${i.answer}`;

    // Local rows win (they carry the device-authored timestamp/ordering); a
    // remote-only interaction is added, and a justification present only
    // remotely backfills the local row. This makes sync idempotent — running it
    // repeatedly converges instead of appending duplicates.
    const byKey = new Map<string, ConversationInteraction>();
    for (const i of local) {
      byKey.set(identityKey(i), i);
    }

    for (const r of remote) {
      const key = identityKey(r);
      const existing = byKey.get(key);
      if (existing) {
        if (r.justification && !existing.justification) {
          existing.justification = r.justification;
        }
        if (r.noMapReason && !existing.noMapReason) {
          existing.noMapReason = r.noMapReason;
        }
        continue;
      }
      byKey.set(key, {
        question: r.question,
        answer: r.answer,
        mappedCategory: r.mappedCategory ?? "",
        categoryId: r.categoryId ?? undefined,
        // serverTimestamp() reads back null until the write resolves — fall
        // back to "now" rather than throwing and aborting the whole sync.
        timestamp: r.timestamp ? r.timestamp.toDate().toISOString() : new Date().toISOString(),
        mappingOutcome: r.mappingOutcome,
        matchedToCategory: r.matchedToCategory,
        matchedToSequenceIndex: r.matchedToSequenceIndex,
        justification: r.justification || undefined,
        noMapReason: r.noMapReason,
        specificStamp: r.specificStamp || undefined,
      });
    }

    // Deterministic chronological order regardless of local/remote origin.
    const merged = Array.from(byKey.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const storageKey = await getInteractionsStorageKey();
    await setJSONInStorage(storageKey, merged);
  } catch {
    // Firestore read failed — skip sync, rely on local data
  }
}

/**
 * Fetch justification entries from the Firestore skillPassport document.
 * Each mapped interaction saves a PassportCategoryMapping with a real
 * justification string (falls back to mappedCategory.justification),
 * so this is the most reliable source for historical justifications.
 * Optionally filter by sessionId so only the current session's entries appear.
 */
export async function fetchPassportJustifications(
  categoryId: string,
  sessionId?: string,
  stampName?: string
): Promise<string[]> {
  try {
    const resolvedSessionId = sessionId || (await getActiveSessionId());
    if (!resolvedSessionId) return [];

    const userId = await getUserId();
    const passportRef = doc(
      db,
      "participants",
      userId,
      "sessions",
      resolvedSessionId,
      "skillPassport",
      categoryId
    );
    const snapshot = await getDoc(passportRef);
    if (!snapshot.exists()) return [];
    const data = snapshot.data() as SkillPassportDocument;
    const items = data.mappings ?? [];
    return items
      .filter((m) => m.justification && (!stampName || m.specificStamp === stampName))
      .map((m) => m.justification);
  } catch {
    return [];
  }
}

export async function isCategoryMapped(categoryId: string): Promise<boolean> {
  const mapped = await getMappedCategories();
  return mapped.some((c) => c.categoryId === categoryId);
}

export async function saveConversationInteraction(
  interaction: ConversationInteraction,
  justification?: string
): Promise<string> {
  const interactionId = generateInteractionId();
  const current = await getConversationHistory();
  const sequenceIndex = current.length;
  // Store an absent justification as undefined, not "", so it matches the
  // remote shape and the sync backfill can later fill it in from Firestore.
  current.push({ ...interaction, justification: justification || undefined });
  const storageKey = await getInteractionsStorageKey();
  await setJSONInStorage(storageKey, current);

  try {
    const { userId, sessionId } = await getFirestoreWriteContext();
    await saveInteraction(userId, sessionId, null, {
      sequenceIndex,
      question: interaction.question,
      answer: interaction.answer,
      inputMethod: "text",
      mappingOutcome: interaction.mappingOutcome ?? "mapped",
      mappedCategory: interaction.mappedCategory,
      categoryId: interaction.categoryId ?? null,
      isWeakFit: interaction.mappingOutcome === "weak_fit",
      isAlreadyMapped: interaction.mappingOutcome === "already_mapped",
      justification: justification ?? "",
      noMapReason: interaction.noMapReason ?? "",
      specificStamp: interaction.specificStamp,
      matchedToCategory: interaction.matchedToCategory ?? null,
      matchedToSequenceIndex: interaction.matchedToSequenceIndex ?? null,
    });
  } catch {
    // AsyncStorage is the source of truth; Firestore mirror is best-effort
  }

  return interactionId;
}

export async function getMappingStats(): Promise<{
  totalMapped: number;
  totalInteractions: number;
  lastInteractionDate?: string;
}> {
  const [mapped, interactions] = await Promise.all([
    getMappedCategories(),
    getConversationHistory(),
  ]);

  return {
    totalMapped: mapped.length,
    totalInteractions: interactions.length,
    lastInteractionDate: interactions.at(-1)?.timestamp,
  };
}

/**
 * Update mapped category counter
 */
export async function updateMappedCategoryCounter(
  mappedCategory: MappedCategory
): Promise<MappedCategory> {
  try {
    const current = await getMappedCategories();
    const updatedMappedCategory = {
      category: mappedCategory.category,
      categoryId: mappedCategory.categoryId,
      justification: mappedCategory.justification,
      dateIdentified: mappedCategory.dateIdentified,
      timesMapped: mappedCategory.timesMapped + 1,
      unlockedStamps: mappedCategory.unlockedStamps,
    };

    const newMappedCategories = current.map((c) =>
      c.categoryId === updatedMappedCategory.categoryId ? updatedMappedCategory : c
    );

    const storageKey = await getMappedCategoriesStorageKey();
    await setJSONInStorage(storageKey, newMappedCategories);
    return updatedMappedCategory;
  } catch (error) {
    logErrorToFile("Error updating mapped categories:", error);
    throw error;
  }
}
