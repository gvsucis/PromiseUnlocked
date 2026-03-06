/**
 * Skills Taxonomy Service
 * Provides utilities for skill mapping, normalization, and matching
 */
import { SKILLS_TAXONOMY, SKILL_SYNONYMS } from "../config/skillsTaxonomy";
export { SKILLS_TAXONOMY } from "../config/skillsTaxonomy";

type SkillMatch = {
  skill: string;
  category: string;
  confidence: number;
};

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Calculate similarity score between two strings (0-1, higher is more similar)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.9;
  }

  // Use Levenshtein distance
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  return 1 - distance / maxLength;
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

/**
 * Get all skills from the taxonomy as a flat array
 */
export function getAllSkills(): string[] {
  return Object.values(SKILLS_TAXONOMY).flat();
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
