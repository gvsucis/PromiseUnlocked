/**
 * Skills Taxonomy Service
 * Maps user-provided skills to canonical taxonomy categories
 * Provides utilities for skill normalization and lookup
 */

import { SKILLS_TAXONOMY, SKILL_SYNONYMS } from "../config/skillsTaxonomy";
export { SKILLS_TAXONOMY } from "../config/skillsTaxonomy";

export function normalizeTaxonomyCategoryName(category: string): string {
  return category.trim();
}

type SkillMatch = {
  skill: string;
  category: string;
  confidence: number;
};

/**
 * Simple string similarity calculation (0-1, higher = more similar)
 * Uses substring matching and word overlap for O(n) efficiency
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1;

  // One string contains the other (substring match)
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Count common words
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  let commonWords = 0;

  words1.forEach((word) => {
    if (words2.has(word)) commonWords++;
  });

  const totalWords = Math.max(words1.size, words2.size);
  return totalWords > 0 ? commonWords / totalWords : 0;
}

/**
 * Find best skill match in SKILLS_TAXONOMY
 * Considers skill name and SKILL_SYNONYMS
 */
function getBestSkillMatch(input: string): SkillMatch {
  let best: SkillMatch = { skill: "", category: "", confidence: 0 };

  for (const [category, skills] of Object.entries(SKILLS_TAXONOMY)) {
    for (const skill of skills) {
      let confidence = calculateSimilarity(input, skill);

      // Also check synonyms
      const synonyms = SKILL_SYNONYMS[skill] ?? [];
      for (const synonym of synonyms) {
        confidence = Math.max(confidence, calculateSimilarity(input, synonym));
      }

      if (confidence > best.confidence) {
        best = { skill, category, confidence };
      }
    }
  }

  return best;
}

/**
 * Find partial matches using word boundaries
 */
function getBestPartialMatch(input: string, currentBest: SkillMatch): SkillMatch {
  const words = input.split(/\s+/).filter((w) => w.length >= 3);
  let best = currentBest;

  for (const word of words) {
    for (const [category, skills] of Object.entries(SKILLS_TAXONOMY)) {
      for (const skill of skills) {
        if (skill.toLowerCase().includes(word) || word.includes(skill.toLowerCase())) {
          const confidence = 0.6;
          if (confidence > best.confidence) {
            best = { skill, category, confidence };
          }
        }
      }
    }
  }

  return best;
}

/**
 * Map a user-provided skill to the best match in the taxonomy
 */
export function mapSkillToTaxonomy(userSkill: string): SkillMatch {
  const input = userSkill.toLowerCase().trim();
  const directMatch = getBestSkillMatch(input);

  // If direct match confidence is low, try partial matching
  return directMatch.confidence < 0.5 ? getBestPartialMatch(input, directMatch) : directMatch;
}

/**
 * Map multiple user skills, removing duplicates (keeps highest confidence)
 */
export function mapSkillsToTaxonomy(userSkills: string[]): SkillMatch[] {
  const mapped = userSkills.map((skill) => mapSkillToTaxonomy(skill));

  // Deduplicate by skill name, keeping highest confidence
  const uniqueMap = new Map<string, SkillMatch>();
  for (const match of mapped) {
    const existing = uniqueMap.get(match.skill);
    if (!existing || match.confidence > existing.confidence) {
      uniqueMap.set(match.skill, match);
    }
  }

  return Array.from(uniqueMap.values());
}

// Cache all skills at module load time
const allSkillsCache = Object.values(SKILLS_TAXONOMY).flat();

/**
 * Get all skills from taxonomy as a flat array
 */
export function getAllSkills(): string[] {
  return allSkillsCache;
}

/**
 * Get skills for a specific category
 */
export function getSkillsByCategory(category: string): string[] {
  return SKILLS_TAXONOMY[category] ?? [];
}

/**
 * Find which category a skill belongs to
 */
export function findSkillCategory(skill: string): string | null {
  for (const [category, skills] of Object.entries(SKILLS_TAXONOMY)) {
    if (skills.includes(skill)) {
      return category;
    }
  }
  return null;
}

/**
 * Normalize user skills by mapping to taxonomy and filtering low confidence
 */
export function normalizeSkills(userSkills: string[]): string[] {
  return mapSkillsToTaxonomy(userSkills)
    .filter((m) => m.confidence >= 0.5)
    .map((m) => m.skill);
}
