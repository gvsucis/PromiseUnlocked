/**
 * Category Mapping Storage Service
 * Manages persistence of mapped categories and conversation history.
 * Write-through: AsyncStorage is the primary store; Firestore receives
 * a mirrored write after every AsyncStorage write (fire-and-forget).
 */

import { MappedCategory, ConversationInteraction } from "./categoryTaxonomyService";
import { STAMP_TAXONOMY } from "../config/stampTaxonomy";
import { DEFAULT_TIER } from "../config/stampConstants";
import { getJSONFromStorage, removeManyFromStorage, setJSONInStorage } from "../utils/asyncStorage";

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
  savePassportMapping,
  saveStampUnlock,
  fetchSessionInteractions,
} from "./firebase/firestoreService";
import { enqueueFirestoreWrite } from "./firebase/firestoreWriteQueue";

// Log errors to a file instead of console.error
import { logErrorToFile } from "../utils/logToFile";

const MAPPED_CATEGORIES_KEY = "@mappedCategories";
const INTERACTIONS_KEY = "@userInteractions";

function shouldSkipFirestoreMirror(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : undefined;

  if (code === "app/anonymous-auth-disabled" || code === "app/firestore-auth-unavailable") {
    return true;
  }

  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("No Firebase auth user is available for Firestore writes") ||
    message.includes("auth/admin-restricted-operation")
  );
}

function generateInteractionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getFirestoreWriteContext(): Promise<{ sessionId: string; userId: string }> {
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
  return getJSONFromStorage(storageKey, [] as MappedCategory[]);
}

/**
 * Get specific MappedCategory object
 */
export async function getMappedCategory(mappedCategoryName: string): Promise<MappedCategory> {
  const mappedCategories = await getMappedCategories();
  const result = mappedCategories.find((c) => c.category === mappedCategoryName);
  if (!result) {
    throw new Error(`MappedCategory not found: ${mappedCategoryName}`);
  }
  return result;
}

/**
 * Save a newly mapped category
 */
export async function saveMappedCategory(category: MappedCategory): Promise<void> {
  try {
    const current = await getMappedCategories();
    const updated = [...current, category];
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
  categoryName: string,
  stampName: string,
  minTier: number
): Promise<void> {
  try {
    const current = await getMappedCategories();
    const idx = current.findIndex((c) => c.category === categoryName);
    if (idx === -1) return;

    const entry = current[idx];
    const stamps = entry.unlockedStamps ?? [];
    const existingIdx = stamps.findIndex((s) => s.name === stampName);
    if (existingIdx < 0) return;

    stamps[existingIdx] = {
      ...stamps[existingIdx],
      tier: Math.max(stamps[existingIdx].tier ?? DEFAULT_TIER, minTier),
    };

    current[idx] = { ...entry, unlockedStamps: stamps };
    const storageKey = await getMappedCategoriesStorageKey();
    await setJSONInStorage(storageKey, current);
  } catch (error) {
    logErrorToFile("Error upgrading stamp tier:", error);
    throw error;
  }
}

/**
 * Add or increment a stamp unlock for a mapped category
 */
export async function addStampUnlock(
  categoryName: string,
  stampName: string,
  tier: number = DEFAULT_TIER
): Promise<void> {
  try {
    const current = await getMappedCategories();
    const idx = current.findIndex((c) => c.category === categoryName);
    if (idx === -1) return;

    const entry = current[idx];
    const stamps = entry.unlockedStamps ?? [];
    const existingIdx = stamps.findIndex((s) => s.name === stampName);

    if (existingIdx >= 0) {
      stamps[existingIdx] = {
        ...stamps[existingIdx],
        timesUnlocked: stamps[existingIdx].timesUnlocked + 1,
        tier: Math.max(stamps[existingIdx].tier ?? DEFAULT_TIER, tier),
      };
    } else {
      stamps.push({ name: stampName, timesUnlocked: 1, tier });
    }

    current[idx] = { ...entry, unlockedStamps: stamps };
    const storageKey = await getMappedCategoriesStorageKey();
    await setJSONInStorage(storageKey, current);

    try {
      const writeContext = await getFirestoreWriteContext();
      await enqueueFirestoreWrite(
        async () => {
          await saveStampUnlock(writeContext.userId, categoryName, stampName);
        },
        { rethrowOnFailure: true }
      );
    } catch (error) {
      if (shouldSkipFirestoreMirror(error)) {
        console.warn("[CategoryStorage] Skipping stamp unlock Firestore mirror:", error);
      } else {
        throw error;
      }
    }
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
    await addStampUnlock(mc.category, stampName);
  }
}

/**
 * Get unlocked stamps for a specific category
 */
export async function getUnlockedStampsForCategory(
  categoryName: string
): Promise<Array<{ name: string; timesUnlocked: number }>> {
  try {
    const current = await getMappedCategories();
    const entry = current.find((c) => c.category === categoryName);
    return entry?.unlockedStamps ?? [];
  } catch {
    return [];
  }
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
    if (remote.length <= local.length) return;

    const merged: ConversationInteraction[] = [];
    const seen = new Set<string>();
    for (const i of local) {
      const key = `${i.question}|${i.answer}|${i.timestamp}`;
      seen.add(key);
      merged.push(i);
    }
    for (const r of remote) {
      const key = `${r.question}|${r.answer}|${r.timestamp.toDate().toISOString()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({
        question: r.question,
        answer: r.answer,
        mappedCategory: r.mappedCategory ?? "",
        timestamp: r.timestamp.toDate().toISOString(),
        mappingOutcome: r.mappingOutcome,
        matchedToCategory: r.matchedToCategory,
        matchedToSequenceIndex: r.matchedToSequenceIndex,
      });
    }

    const storageKey = await getInteractionsStorageKey();
    await setJSONInStorage(storageKey, merged);
  } catch {
    // Firestore read failed — skip sync, rely on local data
  }
}

export async function isCategoryMapped(categoryName: string): Promise<boolean> {
  const mapped = await getMappedCategories();
  return mapped.some((c) => c.category === categoryName);
}

export async function saveConversationInteraction(
  interaction: ConversationInteraction,
  justification?: string
): Promise<string> {
  const interactionId = generateInteractionId();
  const current = await getConversationHistory();
  const sequenceIndex = current.length;
  current.push({ ...interaction });
  const storageKey = await getInteractionsStorageKey();
  await setJSONInStorage(storageKey, current);

  try {
    const { userId, sessionId } = await getFirestoreWriteContext();
    await enqueueFirestoreWrite(
      async () => {
        await saveInteraction(userId, sessionId, null, {
          sequenceIndex,
          question: interaction.question,
          answer: interaction.answer,
          inputMethod: "text",
          mappingOutcome: interaction.mappingOutcome ?? "mapped",
          mappedCategory: interaction.mappedCategory,
          isWeakFit: interaction.mappingOutcome === "weak_fit",
          isAlreadyMapped: interaction.mappingOutcome === "already_mapped",
          justification: justification ?? "",
          matchedToCategory: interaction.matchedToCategory ?? null,
          matchedToSequenceIndex: interaction.matchedToSequenceIndex ?? null,
        });
      },
      { rethrowOnFailure: true }
    );
  } catch (error) {
    if (shouldSkipFirestoreMirror(error)) {
      console.warn("[CategoryStorage] Skipping interaction Firestore mirror:", error);
    } else {
      throw error;
    }
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
      justification: mappedCategory.justification,
      dateIdentified: mappedCategory.dateIdentified,
      timesMapped: mappedCategory.timesMapped + 1,
      unlockedStamps: mappedCategory.unlockedStamps,
    };

    const newMappedCategories = current.map((c) =>
      c.category === updatedMappedCategory.category ? updatedMappedCategory : c
    );

    const storageKey = await getMappedCategoriesStorageKey();
    await setJSONInStorage(storageKey, newMappedCategories);
    return updatedMappedCategory;
  } catch (error) {
    logErrorToFile("Error updating mapped categories:", error);
    throw error;
  }
}
