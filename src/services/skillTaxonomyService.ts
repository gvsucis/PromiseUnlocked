/**
 * Skills Taxonomy Service
 * Provides utilities for skill mapping, normalization, and matching
 */
import { SKILLS_TAXONOMY, SKILL_SYNONYMS } from "../config/skillsTaxonomy";
export { SKILLS_TAXONOMY } from "../config/skillsTaxonomy";

const CATEGORY_ALIASES: Record<string, string> = {
  // Map stampTaxonomy formal names to SKILLS_TAXONOMY category names
  "Human Skills (Durable)": "Human Skills",
  "Meta-Learning & Self-Awareness": "Meta-Learning & Self-Awareness",
  "Maker & Builder Skills": "Maker & Builder",
  "Civic & Community Impact": "Civic & Community",
  "Creative Expression & Communication": "Creative Expression",
  "Problem-Solving & Systems Thinking": "Problem-Solving",
  "Work & Entrepreneurial Experience": "Work Experience",
  "Future Self & Directionality": "Future Self & Direction",
  "Digital & Tech Fluency": "Technological Fluency",
  "Wellbeing & Personal Resilience": "Wellbeing & Personal Resilience",
  "Faith, Culture & Identity": "Faith, Culture & Identity",
};

export function normalizeTaxonomyCategoryName(category: string): string {
  const trimmed = category.trim();
  return CATEGORY_ALIASES[trimmed] ?? trimmed;
}

type SkillMatch = {
  skill: string;
  category: string;
  confidence: number;
};

// Memoization cache for similarity calculations (LRU-style, max 500 entries)
const similarityCache = new Map<string, number>();
const MAX_CACHE_SIZE = 500;

/**
 * Space-optimized Levenshtein distance using Wagner-Fischer algorithm
 * O(min(n,m)) space instead of O(n*m)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Use shorter string as reference for space optimization
  let a = s1;
  let b = s2;
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  // Only need two rows for DP
  const prevRow = new Array(a.length + 1).fill(0).map((_, i) => i);
  const currRow = new Array(a.length + 1).fill(0);

  for (let i = 1; i <= b.length; i++) {
    currRow[0] = i;
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      currRow[j] = Math.min(currRow[j - 1] + 1, prevRow[j] + 1, prevRow[j - 1] + cost);
    }
    prevRow.splice(0, prevRow.length, ...currRow);
  }

  return currRow[a.length];
}

/**
 * Calculate similarity score with memoization (0-1, higher is more similar)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Create cache key (order-independent for efficiency)
  const cacheKey = s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`;
  const cached = similarityCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let result = 0;

  // Exact match
  if (s1 === s2) {
    result = 1;
  } else if (s1.includes(s2) || s2.includes(s1)) {
    // Check if one contains the other
    result = 0.9;
  } else {
    // Use space-optimized Levenshtein distance
    const distance = levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    result = 1 - distance / maxLength;
  }

  // Simple cache eviction when size exceeds limit
  if (similarityCache.size >= MAX_CACHE_SIZE) {
    const firstKey = similarityCache.keys().next().value;
    if (firstKey !== undefined) {
      similarityCache.delete(firstKey);
    }
  }

  similarityCache.set(cacheKey, result);
  return result;
}

function getSkillMaxSimilarity(normalizedInput: string, skill: string): number {
  let maxSimilarity = calculateSimilarity(normalizedInput, skill);
  const synonyms = SKILL_SYNONYMS[skill] ?? [];

  for (const synonym of synonyms) {
    const synonymSimilarity = calculateSimilarity(normalizedInput, synonym);
    maxSimilarity = Math.max(maxSimilarity, synonymSimilarity);
  }

  return maxSimilarity;
}

function getBestDirectMatch(normalizedInput: string): SkillMatch {
  let bestMatch: SkillMatch = {
    skill: "",
    category: "",
    confidence: 0,
  };

  for (const [category, skills] of Object.entries(SKILLS_TAXONOMY)) {
    for (const skill of skills) {
      const maxSimilarity = getSkillMaxSimilarity(normalizedInput, skill);
      if (maxSimilarity > bestMatch.confidence) {
        bestMatch = {
          skill,
          category,
          confidence: maxSimilarity,
        };
      }
    }
  }

  return bestMatch;
}

function getBestPartialWordMatch(normalizedInput: string, currentBest: SkillMatch): SkillMatch {
  const words = normalizedInput.split(/\s+/).filter((word) => word.length >= 3);
  let bestMatch = currentBest;

  for (const word of words) {
    for (const [category, skills] of Object.entries(SKILLS_TAXONOMY)) {
      for (const skill of skills) {
        const normalizedSkill = skill.toLowerCase();
        if (normalizedSkill.includes(word) || word.includes(normalizedSkill)) {
          const partialSimilarity = 0.6;
          if (partialSimilarity > bestMatch.confidence) {
            bestMatch = {
              skill,
              category,
              confidence: partialSimilarity,
            };
          }
        }
      }
    }
  }

  return bestMatch;
}

/**
 * Map a user-provided skill to the most accurate skill in the taxonomy
 * Returns the best matching skill from the taxonomy
 */
export function mapSkillToTaxonomy(userSkill: string): {
  skill: string;
  category: string;
  confidence: number;
} {
  const normalizedInput = userSkill.toLowerCase().trim();
  const bestDirectMatch = getBestDirectMatch(normalizedInput);

  if (bestDirectMatch.confidence < 0.5) {
    return getBestPartialWordMatch(normalizedInput, bestDirectMatch);
  }

  return bestDirectMatch;
}

/**
 * Map multiple user skills to their best matches in the taxonomy
 * Returns only unique skills (removes duplicates)
 */
export function mapSkillsToTaxonomy(userSkills: string[]): {
  skill: string;
  category: string;
  confidence: number;
}[] {
  const mappedSkills = userSkills.map((skill) => mapSkillToTaxonomy(skill));

  // Remove duplicates - keep the one with highest confidence
  const uniqueSkills = new Map<string, (typeof mappedSkills)[0]>();

  for (const mapped of mappedSkills) {
    const existing = uniqueSkills.get(mapped.skill);
    if (!existing || mapped.confidence > existing.confidence) {
      uniqueSkills.set(mapped.skill, mapped);
    }
  }

  return Array.from(uniqueSkills.values());
}

// Precompute all skills at module load time for efficiency
const allSkillsCache = Object.values(SKILLS_TAXONOMY).flat();

/**
 * Get all skills from the taxonomy as a flat array (cached)
 */
export function getAllSkills(): string[] {
  return allSkillsCache;
}

/**
 * Get all skills for a specific category
 */
export function getSkillsByCategory(category: string): string[] {
  const skills = SKILLS_TAXONOMY[category];
  return skills ?? [];
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
 * Normalize a list of skills by mapping them to taxonomy and removing duplicates
 * Returns only the skill names (not the full mapping objects)
 */
export function normalizeSkills(userSkills: string[]): string[] {
  const mapped = mapSkillsToTaxonomy(userSkills);
  return mapped
    .filter((m) => m.confidence >= 0.5) // Only keep reasonable matches
    .map((m) => m.skill);
}
