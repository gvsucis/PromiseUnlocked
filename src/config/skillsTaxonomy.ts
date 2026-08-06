/**
 * Skills Taxonomy Configuration
 * - SKILLS_TAXONOMY: derived from STAMP_TAXONOMY
 * - SKILL_SYNONYMS: common variations for better user input matching
 * - AVAILABLE_STAMPS: computed from STAMP_TAXONOMY (one entry per detailed variant)
 */

import { Stamp } from "../types/dashboard";
import { STAMP_TAXONOMY, computeDerivedSkills } from "./stampTaxonomy";
import { DEFAULT_TIER_IMAGES, slugify } from "./stampConstants";

export type SkillsTaxonomy = Record<string, string[]>;

export const SKILLS_TAXONOMY: SkillsTaxonomy = computeDerivedSkills();

export const SKILL_SYNONYMS: Record<string, string[]> = {
  Communication: [
    "communicating",
    "speaking",
    "talking",
    "expressing",
    "communication skills",
    "verbal communication",
  ],
  Collaboration: ["collaborating", "teamwork", "working together", "cooperative work", "team work"],
  Leadership: ["leading", "managing people", "guiding", "mentoring", "leading teams"],
  "Critical Thinking": [
    "analyzing",
    "critical analysis",
    "thinking critically",
    "analytical skills",
    "reasoning",
  ],
  "Problem Solving": [
    "solving problems",
    "troubleshooting",
    "finding solutions",
    "problem resolution",
  ],
  Creativity: ["being creative", "creative thinking", "innovation", "creative work"],
  "Design Thinking": ["designing", "design", "user experience", "ux design", "design process"],
  "Project Management": [
    "managing projects",
    "project planning",
    "organizing work",
    "project coordination",
  ],
  "Technical Skills": ["coding", "programming", "technical work", "technology", "tech skills"],
  "Public Speaking": ["presenting", "presentations", "speaking publicly", "giving talks"],
  Writing: ["written communication", "content creation", "authoring", "composing"],
  "Research Skills": ["researching", "investigation", "studying", "gathering information"],
  "Time Management": ["managing time", "scheduling", "planning", "organizing time"],
  "Goal Setting": ["setting goals", "planning goals", "objective setting", "target setting"],
};

/**
 * Generate AVAILABLE_STAMPS from STAMP_TAXONOMY
 * Creates one Stamp entry per detailed variant, with default tier images
 */
function computeAvailableStamps(): Stamp[] {
  const stampMap = new Map<string, Stamp>();

  Object.entries(STAMP_TAXONOMY).forEach(([category, families]) => {
    families.forEach((family) => {
      const familyName = family.stampCategory;
      const baseDescription = family.description || family.iconConcept || familyName;

      const stamps = family.detailedStamps?.length
        ? family.detailedStamps.map((variant) => ({
            id: slugify(category, familyName, variant.name),
            name: variant.name,
            description: variant.iconConcept || baseDescription,
          }))
        : [
            {
              id: slugify(category, familyName),
              name: familyName,
              description: baseDescription,
            },
          ];

      stamps.forEach(({ id, name, description }) => {
        if (!stampMap.has(id)) {
          stampMap.set(id, {
            id,
            name,
            icon: "",
            category,
            description,
            unlocked: false,
            tierImages: { ...DEFAULT_TIER_IMAGES },
          });
        }
      });
    });
  });

  return Array.from(stampMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export const AVAILABLE_STAMPS: Stamp[] = computeAvailableStamps();
export const TOTAL_STAMPS = AVAILABLE_STAMPS.length;
