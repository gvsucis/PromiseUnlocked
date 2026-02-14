/**
 * Category Mapping Storage Service
 * Manages persistence of mapped categories and conversation history
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { MappedCategory, ConversationInteraction } from './categoryTaxonomyService';

const MAPPED_CATEGORIES_KEY = '@mappedCategories';
const INTERACTIONS_KEY = '@userInteractions';

/**
 * Get all mapped categories
 */
export async function getMappedCategories(): Promise<MappedCategory[]> {
  try {
    const data = await AsyncStorage.getItem(MAPPED_CATEGORIES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading mapped categories:', error);
    return [];
  }
}

/**
 * Save a newly mapped category
 */
export async function saveMappedCategory(category: MappedCategory): Promise<void> {
  try {
    const current = await getMappedCategories();
    const updated = [...current, category];
    await AsyncStorage.setItem(MAPPED_CATEGORIES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving mapped category:', error);
    throw error;
  }
}

/**
 * Get all conversation interactions
 */
export async function getConversationHistory(): Promise<ConversationInteraction[]> {
  try {
    const data = await AsyncStorage.getItem(INTERACTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading conversation history:', error);
    return [];
  }
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
    await AsyncStorage.setItem(INTERACTIONS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving conversation interaction:', error);
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
    await AsyncStorage.multiRemove([MAPPED_CATEGORIES_KEY, INTERACTIONS_KEY]);
  } catch (error) {
    console.error('Error clearing data:', error);
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
    lastInteractionDate:
      interactions.length > 0 ? interactions[interactions.length - 1].timestamp : undefined,
  };
}
