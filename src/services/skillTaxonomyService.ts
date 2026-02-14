/**
 * Skills Taxonomy Service
 * Provides utilities for skill mapping, normalization, and matching
 */

export const SKILLS_TAXONOMY = {
  'Human Skills': [
    'Communication',
    'Collaboration',
    'Leadership',
    'Empathy',
    'Active Listening',
    'Conflict Resolution',
    'Networking',
    'Public Speaking',
    'Team Management',
  ],
  'Meta-Learning': [
    'Critical Thinking',
    'Research Skills',
    'Self-Reflection',
    'Learning Strategies',
    'Information Synthesis',
    'Knowledge Transfer',
    'Continuous Learning',
    'Adaptability',
  ],
  'Maker & Builder': [
    'Prototyping',
    'Design Thinking',
    'Craftsmanship',
    'Innovation',
    'Technical Skills',
    'Project Management',
    'Problem Solving',
    'Creative Construction',
    'Engineering',
  ],
  'Civic Impact': [
    'Community Engagement',
    'Social Responsibility',
    'Advocacy',
    'Volunteer Work',
    'Policy Understanding',
    'Cultural Awareness',
    'Environmental Stewardship',
    'Civic Participation',
  ],
  'Creative Expression': [
    'Artistic Creation',
    'Storytelling',
    'Music',
    'Writing',
    'Visual Arts',
    'Performance',
    'Creative Problem Solving',
    'Imagination',
    'Aesthetic Appreciation',
  ],
  'Problem-Solving': [
    'Analytical Thinking',
    'Strategic Planning',
    'Troubleshooting',
    'Decision Making',
    'Systems Thinking',
    'Root Cause Analysis',
    'Innovation',
    'Logic',
    'Pattern Recognition',
  ],
  'Work Experience': [
    'Professional Skills',
    'Industry Knowledge',
    'Workplace Etiquette',
    'Time Management',
    'Client Relations',
    'Business Acumen',
    'Career Development',
    'Mentorship',
  ],
  'Future Self': [
    'Goal Setting',
    'Vision Creation',
    'Personal Growth',
    'Skill Development',
    'Career Planning',
    'Life Balance',
    'Self-Improvement',
    'Aspiration Mapping',
  ],
};

// Common skill variations and synonyms
const SKILL_SYNONYMS: Record<string, string[]> = {
  Communication: [
    'communicating',
    'speaking',
    'talking',
    'expressing',
    'communication skills',
    'verbal communication',
  ],
  Collaboration: ['collaborating', 'teamwork', 'working together', 'cooperative work', 'team work'],
  Leadership: ['leading', 'managing people', 'guiding', 'mentoring', 'leading teams'],
  'Critical Thinking': [
    'analyzing',
    'critical analysis',
    'thinking critically',
    'analytical skills',
    'reasoning',
  ],
  'Problem Solving': [
    'solving problems',
    'troubleshooting',
    'finding solutions',
    'problem resolution',
  ],
  Creativity: ['being creative', 'creative thinking', 'innovation', 'creative work'],
  'Design Thinking': ['designing', 'design', 'user experience', 'ux design', 'design process'],
  'Project Management': [
    'managing projects',
    'project planning',
    'organizing work',
    'project coordination',
  ],
  'Technical Skills': ['coding', 'programming', 'technical work', 'technology', 'tech skills'],
  'Public Speaking': ['presenting', 'presentations', 'speaking publicly', 'giving talks'],
  Writing: ['written communication', 'content creation', 'authoring', 'composing'],
  'Research Skills': ['researching', 'investigation', 'studying', 'gathering information'],
  'Time Management': ['managing time', 'scheduling', 'planning', 'organizing time'],
  'Goal Setting': ['setting goals', 'planning goals', 'objective setting', 'target setting'],
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
  if (s1 === s2) return 1.0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.9;
  }

  // Use Levenshtein distance
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  return 1 - distance / maxLength;
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

  let bestMatch = {
    skill: '',
    category: '',
    confidence: 0,
  };

  // Check each category and skill in the taxonomy
  for (const [category, skills] of Object.entries(SKILLS_TAXONOMY)) {
    for (const skill of skills) {
      let maxSimilarity = calculateSimilarity(normalizedInput, skill);

      // Check synonyms
      if (SKILL_SYNONYMS[skill]) {
        for (const synonym of SKILL_SYNONYMS[skill]) {
          const synonymSimilarity = calculateSimilarity(normalizedInput, synonym);
          maxSimilarity = Math.max(maxSimilarity, synonymSimilarity);
        }
      }

      // Update best match if this is better
      if (maxSimilarity > bestMatch.confidence) {
        bestMatch = {
          skill,
          category,
          confidence: maxSimilarity,
        };
      }
    }
  }

  // If confidence is too low, try partial word matching
  if (bestMatch.confidence < 0.5) {
    const words = normalizedInput.split(/\s+/);
    for (const word of words) {
      if (word.length < 3) continue; // Skip very short words

      for (const [category, skills] of Object.entries(SKILLS_TAXONOMY)) {
        for (const skill of skills) {
          if (skill.toLowerCase().includes(word) || word.includes(skill.toLowerCase())) {
            const partialSimilarity = 0.6; // Give partial matches a moderate confidence
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
  }

  return bestMatch;
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
  return SKILLS_TAXONOMY[category as keyof typeof SKILLS_TAXONOMY] || [];
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
