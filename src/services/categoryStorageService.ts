/**
 * Category Mapping Storage Service
 * Manages persistence of mapped categories and conversation history.
 * Write-through: AsyncStorage is the primary store; Firestore receives
 * a mirrored write after every AsyncStorage write (fire-and-forget).
 */

import { MappedCategory, ConversationInteraction } from "./categoryTaxonomyService";
import { getJSONFromStorage, removeManyFromStorage, setJSONInStorage } from "../utils/asyncStorage";

import { getScopedStorageKey } from "./auth/authSessionService";
import { clearSessionState, endSession, getOrStartSession, getUserId } from "./sessionManager";
import { saveInteraction, savePassportMapping } from "./firebase/firestoreService";
import { enqueueFirestoreWrite } from "./firebase/firestoreWriteQueue";

// Log errors to a file instead of console.error
import { logErrorToFile } from "../utils/logToFile";

const MAPPED_CATEGORIES_KEY = "@mappedCategories";
const INTERACTIONS_KEY = "@userInteractions";

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

export async function getConversationHistory(): Promise<ConversationInteraction[]> {
  const storageKey = await getInteractionsStorageKey();
  return getJSONFromStorage(storageKey, [] as ConversationInteraction[]);
}

export async function addConversationInteraction(
  interaction: ConversationInteraction,
  inputMethod: "text" | "voice" | "image" = "text"
): Promise<void> {
  try {
    const current = await getConversationHistory();
    const sequenceIndex = current.length;
    const updated = [...current, interaction];
    const storageKey = await getInteractionsStorageKey();
    await setJSONInStorage(storageKey, updated);

    let mappingOutcome = interaction.mappingOutcome;
    if (!mappingOutcome) {
      if (interaction.mappedCategory === "NO-OP (WEAK FIT)") {
        mappingOutcome = "weak_fit";
      } else if (interaction.mappedCategory === "ALREADY MAPPED (IGNORED)") {
        mappingOutcome = "already_mapped";
      } else if (interaction.mappedCategory.startsWith("INVALID")) {
        mappingOutcome = "invalid";
      } else {
        mappingOutcome = "mapped";
      }
    }

    const isWeakFit = mappingOutcome === "weak_fit";
    const isAlreadyMapped = mappingOutcome === "already_mapped";
    const mappedCategory =
      mappingOutcome === "mapped" || mappingOutcome === "already_mapped"
        ? interaction.mappedCategory
        : null;
    const writeContext = await getFirestoreWriteContext();

    enqueueFirestoreWrite(
      async () => {
        const { sessionId, userId } = writeContext;
        await saveInteraction(userId, sessionId, {
          sequenceIndex,
          question: interaction.question,
          answer: interaction.answer,
          inputMethod,
          mappingOutcome,
          mappedCategory,
          isWeakFit,
          isAlreadyMapped,
          justification: "",
          matchedToCategory: interaction.matchedToCategory ?? null,
          matchedToSequenceIndex: interaction.matchedToSequenceIndex ?? null,
        });
      },
      { rethrowOnFailure: true }
    );
  } catch (error) {
    logErrorToFile("Error saving conversation interaction:", error);
    throw error;
  }
}

export async function addConversationInteractionWithMapping(
  interaction: ConversationInteraction,
  justification: string,
  inputMethod: "text" | "voice" | "image" = "text"
): Promise<void> {
  try {
    const current = await getConversationHistory();
    const sequenceIndex = current.length;
    const updated = [...current, interaction];
    const storageKey = await getInteractionsStorageKey();
    await setJSONInStorage(storageKey, updated);
    const writeContext = await getFirestoreWriteContext();

    await enqueueFirestoreWrite(
      async () => {
        const { sessionId, userId } = writeContext;
        const interactionId = await saveInteraction(userId, sessionId, {
          sequenceIndex,
          question: interaction.question,
          answer: interaction.answer,
          inputMethod,
          mappingOutcome: "mapped",
          mappedCategory: interaction.mappedCategory,
          isWeakFit: false,
          isAlreadyMapped: false,
          justification,
          matchedToCategory: null,
          matchedToSequenceIndex: null,
        });

        await savePassportMapping(
          userId,
          sessionId,
          interactionId,
          interaction.mappedCategory,
          justification
        );
      },
      { rethrowOnFailure: true }
    );
  } catch (error) {
    logErrorToFile("Error saving conversation interaction with mapping:", error);
    throw error;
  }
}

export async function isCategoryMapped(categoryName: string): Promise<boolean> {
  const mapped = await getMappedCategories();
  return mapped.some((c) => c.category === categoryName);
}

export async function getMappedCategoryNames(): Promise<string[]> {
  const mapped = await getMappedCategories();
  return mapped.map((c) => c.category);
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
    };

    const newMappedCategories = current.map((c) =>
      c.category === updatedMappedCategory.category ? updatedMappedCategory : c
    );

    const storageKey = await getMappedCategoriesStorageKey();
    await setJSONInStorage(storageKey, newMappedCategories);
    return updatedMappedCategory;
  } catch (error) {
    console.error("Error updating mapped categories:", error);
    throw error;
  }
}
