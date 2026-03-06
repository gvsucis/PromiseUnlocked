/**
 * Category Mapping Storage Service
 * Manages persistence of mapped categories and conversation history.
 * Write-through: AsyncStorage is the primary store; Firestore receives
 * a mirrored write after every AsyncStorage write (fire-and-forget).
 */

import { MappedCategory, ConversationInteraction } from "./categoryTaxonomyService";
import { getJSONFromStorage, removeManyFromStorage, setJSONInStorage } from "../util/asyncStorage";
import { clearSessionState, endSession, getOrStartSession, getUserId } from "./sessionManager";
import { saveInteraction, savePassportMapping } from "./firebase/firestoreService";
import { enqueueFirestoreWrite } from "./firebase/firestoreWriteQueue";

const MAPPED_CATEGORIES_KEY = "@mappedCategories";
const INTERACTIONS_KEY = "@userInteractions";

async function getFirestoreWriteContext(): Promise<{ sessionId: string; userId: string }> {
  const [sessionId, userId] = await Promise.all([getOrStartSession(), getUserId()]);
  return { sessionId, userId };
}

export async function getMappedCategories(): Promise<MappedCategory[]> {
  return getJSONFromStorage(MAPPED_CATEGORIES_KEY, [] as MappedCategory[]);
}

export async function saveMappedCategory(category: MappedCategory): Promise<void> {
  try {
    const current = await getMappedCategories();
    const updated = [...current, category];
    await setJSONInStorage(MAPPED_CATEGORIES_KEY, updated);
  } catch (error) {
    console.error("Error saving mapped category:", error);
    throw error;
  }
}

export async function getConversationHistory(): Promise<ConversationInteraction[]> {
  return getJSONFromStorage(INTERACTIONS_KEY, [] as ConversationInteraction[]);
}

export async function addConversationInteraction(
  interaction: ConversationInteraction,
  inputMethod: "text" | "voice" | "image" = "text"
): Promise<void> {
  try {
    const current = await getConversationHistory();
    const sequenceIndex = current.length;
    const updated = [...current, interaction];
    await setJSONInStorage(INTERACTIONS_KEY, updated);

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

    enqueueFirestoreWrite(async () => {
      const { sessionId, userId } = await getFirestoreWriteContext();
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
    });
  } catch (error) {
    console.error("Error saving conversation interaction:", error);
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
    await setJSONInStorage(INTERACTIONS_KEY, updated);

    enqueueFirestoreWrite(async () => {
      const { sessionId, userId } = await getFirestoreWriteContext();
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
    });
  } catch (error) {
    console.error("Error saving conversation interaction with mapping:", error);
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
    await removeManyFromStorage([MAPPED_CATEGORIES_KEY, INTERACTIONS_KEY]);
    await clearSessionState();
  } catch (error) {
    console.error("Error clearing data:", error);
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
