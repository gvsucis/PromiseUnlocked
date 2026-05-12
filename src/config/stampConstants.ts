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
