/**
 * Stamp Display Service
 * Lightweight service to retrieve tier images for mapped categories
 * All lookups are client-side, O(1) average case
 */

import { Stamp } from "../types/dashboard";
import { AVAILABLE_STAMPS } from "../config/skillsTaxonomy";

export interface CategoryStampDisplay {
  category: string;
  primaryStamp: Stamp | null;
  allStamps: Stamp[];
  tierImages: Stamp["tierImages"];
}

/**
 * Get tier images and stamps for a mapped category
 * Efficient: O(n) where n = number of stamps (typically <100)
 * Runs locally, no API calls
 */
export function getStampsForCategory(category: string): CategoryStampDisplay {
  const categoryStamps = AVAILABLE_STAMPS.filter((s) => s.category === category);
  const primaryStamp = categoryStamps[0] || null;

  return {
    category,
    primaryStamp,
    allStamps: categoryStamps,
    tierImages: primaryStamp?.tierImages || {},
  };
}

/**
 * Get tier images for a specific mapped category
 * Quick access when you only need the tier image URLs
 */
export function getTierImagesForCategory(category: string): Stamp["tierImages"] {
  const stamp = AVAILABLE_STAMPS.find((s) => s.category === category);
  return stamp?.tierImages || {};
}

/**
 * Get all mapped category stamps with tier progression
 * Use when displaying full dashboard
 */
export function getMappedCategoryStamps(mappedCategoryNames: string[]): CategoryStampDisplay[] {
  return mappedCategoryNames.map((name) => getStampsForCategory(name));
}
