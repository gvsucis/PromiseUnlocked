/**
 * Category Taxonomy Service
 * Manages the taxonomy for dialogue-based mapping
 * Aligned to the 11 top-level skill groups used across the app
 */

import { SKILLS_TAXONOMY } from "../config/skillsTaxonomy";

export interface CategoryDefinition {
  id: string;
  category: string;
  description: string;
  stamps: string;
  icon?: string;
}

export interface MappedCategory {
  category: string;
  categoryId: string;
  justification: string;
  dateIdentified: string;
  timesMapped: number;
  unlockedStamps?: Array<{
    name: string;
    category: string;
    categoryId: string;
    timesUnlocked: number;
    tier?: number;
  }>;
}

export interface ConversationInteraction {
  question: string;
  answer: string;
  mappedCategory: string;
  categoryId?: string;
  timestamp: string;
  mappingOutcome?: "mapped" | "already_mapped" | "weak_fit" | "invalid";
  matchedToCategory?: string | null;
  matchedToSequenceIndex?: number | null;
  justification?: string;
  specificStamp?: string;
}

// Define the 11 top-level categories matching the skills taxonomy
export const CATEGORY_TAXONOMY: CategoryDefinition[] = [
  {
    id: "human-skills-durable",
    category: "Human Skills (Durable)",
    description: "Interpersonal, emotional, and cognitive traits that AI can't replicate",
    stamps:
      "Leading with Empathy - Conflict Navigation - Curiosity in Action - Speaking Up for What's Right",
    icon: "people",
  },
  {
    id: "meta-learning",
    category: "Meta-Learning & Self-Awareness",
    description: "Learning how to learn; adapting in real-time",
    stamps: "Learning from Failure - Reframing Feedback - Time I Pivoted - Curating My Strengths",
    icon: "psychology",
  },
  {
    id: "maker-builder",
    category: "Maker & Builder Skills",
    description: "Tactile, creative, or constructive projects",
    stamps:
      "Built Something with My Hands - DIY or Maker Showcase - Coding or Game Design Sprint - Organized a Community Project",
    icon: "build",
  },
  {
    id: "civic-community",
    category: "Civic & Community Impact",
    description: "Actions that show care for others or collective systems",
    stamps:
      "Showed Up for My People - Volunteering or Advocacy - Family Responsibilities - Bridging Cultures",
    icon: "volunteer-activism",
  },
  {
    id: "creative-expression",
    category: "Creative Expression & Communication",
    description: "Use of language, art, or performance to express ideas",
    stamps:
      "Published Something - Designed an Experience - Spoken Word / Theatre / Music - Public Speaking Moment",
    icon: "palette",
  },
  {
    id: "problem-solving",
    category: "Problem-Solving & Systems Thinking",
    description: "Navigating complexity or ambiguity",
    stamps:
      "Solved a Problem Without a Clear Answer - My Role in a Team Crisis - Optimized a Process - Designed a Better Way",
    icon: "lightbulb",
  },
  {
    id: "work-entrepreneurial",
    category: "Work & Entrepreneurial Experience",
    description: "Paid, unpaid, gig, and hustle-based learning",
    stamps:
      "Ran a Side Hustle - Work-Study or Part-Time Job - Supported a Business or Startup - Managed a Budget",
    icon: "business-center",
  },
  {
    id: "future-self",
    category: "Future Self & Directionality",
    description: "Purpose, values, and vision",
    stamps:
      "My Personal Mission Statement - Imagining My Future Life - When I Realized What I Want to Do - Values I Live By",
    icon: "explore",
  },
  {
    id: "tech-fluency",
    category: "Digital & Tech Fluency",
    description: "Coding, digital creation, data, and emerging technology skills.",
    stamps: "Coding and Programming - Data and Analytics - AI - Digital Safety and Ethics",
    icon: "computer",
  },
  {
    id: "wellbeing-resilience",
    category: "Wellbeing & Personal Resilience",
    description: "Mental, physical, and emotional resilience over time.",
    stamps: "Mental Health - Physical Wellness - Recovery - Mindfulness",
    icon: "health-and-safety",
  },
  {
    id: "faith-culture-identity",
    category: "Faith, Culture & Identity",
    description: "Heritage, language, faith, and identity-based experiences.",
    stamps:
      "Heritage and Culture - Language - Faith Community Involvement - First-Generation Experience",
    icon: "person",
  },
];

// NO_OP category for weak fits
export const NO_OP_CATEGORY = "NO_MAP_WEAK_FIT";

export const NO_OP_DEFINITION: CategoryDefinition = {
  id: "no-map-weak-fit",
  category: NO_OP_CATEGORY,
  description:
    "Use this category if and only if the user's answer does not clearly, obviously, and rigorously map to any other category, or if the user's answer is too brief/generic to draw a strong conclusion. This choice will result in no UI update.",
  stamps: "NO_OP_EXPERIENCE",
};

// All categories including NO_OP for API prompts
export const ALL_CATEGORIES: CategoryDefinition[] = [...CATEGORY_TAXONOMY, NO_OP_DEFINITION];

export const TOTAL_CATEGORIES = CATEGORY_TAXONOMY.length; // 11

export const INITIAL_PROMPT = "What are you doing when you lose track of time?";

/**
 * Get taxonomy as formatted string for prompts
 * Includes derived stamp list from STAMP_TAXONOMY per category
 */
export function getTaxonomyString(): string {
  return ALL_CATEGORIES.map((t) => {
    const stamps = SKILLS_TAXONOMY[t.category];
    const stampList = stamps?.length ? stamps.join(", ") : t.stamps;
    return `${t.category}: ${t.description} | Available Stamps: ${stampList}`;
  }).join("\n");
}

/**
 * Get taxonomy string filtered to a single region by its ID
 */
export function getFilteredTaxonomyString(regionId: string): string {
  const def = CATEGORY_TAXONOMY.find((t) => t.id === regionId);
  if (!def) return getTaxonomyString();
  const stamps = SKILLS_TAXONOMY[def.category]?.join(", ") ?? def.stamps;
  return `${def.category}: ${def.description} | Available Stamps: ${stamps}`;
}

/**
 * Resolve category ID from a display name
 */
export function getCategoryIdFromName(name: string): string {
  const def = ALL_CATEGORIES.find((t) => t.category === name);
  return def?.id ?? name;
}

/**
 * Check if a category name is valid (case-insensitive partial match)
 * Returns the matched CategoryDefinition with its stable ID.
 */
export function findValidCategory(categoryName: string): CategoryDefinition | null {
  const normalized = categoryName.trim().toLowerCase();
  return (
    ALL_CATEGORIES.find(
      (t) =>
        t.category.trim().toLowerCase().includes(normalized) ||
        normalized.includes(t.category.trim().toLowerCase())
    ) || null
  );
}

/**
 * Calculate completion percentage
 */
export function getCompletionPercentage(mappedCount: number): number {
  return Math.round((mappedCount / TOTAL_CATEGORIES) * 100);
}
