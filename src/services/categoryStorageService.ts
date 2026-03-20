/**
 * Category Mapping Storage Service
 * Manages persistence of mapped categories and conversation history
 */

import { MappedCategory, ConversationInteraction } from "./categoryTaxonomyService";
import { getJSONFromStorage, removeManyFromStorage, setJSONInStorage } from "../util/asyncStorage";

const MAPPED_CATEGORIES_KEY = "@mappedCategories";
const INTERACTIONS_KEY = "@userInteractions";

/**
 * Get all mapped categories
 */
export async function getMappedCategories(): Promise<MappedCategory[]> {
  return getJSONFromStorage(MAPPED_CATEGORIES_KEY, [] as MappedCategory[]);
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
    await setJSONInStorage(MAPPED_CATEGORIES_KEY, updated);
  } catch (error) {
    console.error("Error saving mapped category:", error);
    throw error;
  }
}

/**
 * Get all conversation interactions
 */
export async function getConversationHistory(): Promise<ConversationInteraction[]> {
  return getJSONFromStorage(INTERACTIONS_KEY, [] as ConversationInteraction[]);
}

/**
 * Add a conversation interaction
 */
export async function addConversationInteraction(
  interaction: ConversationInteraction
): Promise<void> {
  try {
    const current = await getConversationHistory();
    const updated = [...current, interaction];
    await setJSONInStorage(INTERACTIONS_KEY, updated);
  } catch (error) {
    console.error("Error saving conversation interaction:", error);
    throw error;
  }
}

/**
 * Check if a category is already mapped
 */
export async function isCategoryMapped(categoryName: string): Promise<boolean> {
  const mapped = await getMappedCategories();
  return mapped.some((c) => c.category === categoryName);
}

/**
 * Get mapped category names
 */
export async function getMappedCategoryNames(): Promise<string[]> {
  const mapped = await getMappedCategories();
  return mapped.map((c) => c.category);
}

/**
 * Clear all data (reset)
 */
export async function clearAllData(): Promise<void> {
  try {
    await removeManyFromStorage([MAPPED_CATEGORIES_KEY, INTERACTIONS_KEY]);
  } catch (error) {
    console.error("Error clearing data:", error);
    throw error;
  }
}

/**
 * Get statistics
 */
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

    await setJSONInStorage(MAPPED_CATEGORIES_KEY, newMappedCategories);
    return updatedMappedCategory;
  } catch (error) {
    console.error("Error updating mapped categories:", error);
    throw error;
  }
}
