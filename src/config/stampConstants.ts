/**
 * Stamp-related constants and utilities
 * Centralized for clean configuration and reuse
 */

export const DEFAULT_TIER_IMAGES = {
  t1: "Untitled_design_-_Tier_1__Pencil.png",
  t2: "Untitled_design_-_Tier_2__Ink.png",
  t3: "Untitled_design_-_Tier_3__Wax.png",
  t4: "Untitled_design_-_Tier_4__Medal__top_10__.png",
} as const;

export const TIER_CONFIG = {
  1: { label: "T1", color: "#9CA3AF" },
  2: { label: "T2", color: "#2E6EE6" },
  3: { label: "T3", color: "#7C3AED" },
  4: { label: "T4", color: "#F59E0B" },
} as const;

export const DEFAULT_TIER = 1;

/**
 * Convert text to URL-friendly slug (lowercase, hyphens)
 * Example: "My Cool Stamp" → "my-cool-stamp"
 */
export function slugify(...parts: string[]): string {
  return parts
    .join(" ")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}
