/**
 * Category Taxonomy Service
 * Manages the 8-category taxonomy for dialogue-based mapping
 * Matches the web app implementation
 */

export interface CategoryDefinition {
  category: string;
  description: string;
  stamps: string;
  icon?: string;
}

export interface MappedCategory {
  category: string;
  justification: string;
  dateIdentified: string;
}

export interface ConversationInteraction {
  question: string;
  answer: string;
  mappedCategory: string;
  timestamp: string;
}

// Define the 8 categories matching the web app taxonomy
export const CATEGORY_TAXONOMY: CategoryDefinition[] = [
  {
    category: 'Human Skills (Durable)',
    description: "Interpersonal, emotional, and cognitive traits that AI can't replicate",
    stamps:
      "Leading with Empathy - Conflict Navigation - Curiosity in Action - Speaking Up for What's Right",
    icon: 'people',
  },
  {
    category: 'Meta-Learning & Self-Awareness',
    description: 'Learning how to learn; adapting in real-time',
    stamps: 'Learning from Failure - Reframing Feedback - Time I Pivoted - Curating My Strengths',
    icon: 'psychology',
  },
  {
    category: 'Maker & Builder Skills',
    description: 'Tactile, creative, or constructive projects',
    stamps:
      'Built Something with My Hands - DIY or Maker Showcase - Coding or Game Design Sprint - Organized a Community Project',
    icon: 'build',
  },
  {
    category: 'Civic & Community Impact',
    description: 'Actions that show care for others or collective systems',
    stamps:
      'Showed Up for My People - Volunteering or Advocacy - Family Responsibilities - Bridging Cultures',
    icon: 'volunteer-activism',
  },
  {
    category: 'Creative Expression & Communication',
    description: 'Use of language, art, or performance to express ideas',
    stamps:
      'Published Something - Designed an Experience - Spoken Word / Theatre / Music - Public Speaking Moment',
    icon: 'palette',
  },
  {
    category: 'Problem-Solving & Systems Thinking',
    description: 'Navigating complexity or ambiguity',
    stamps:
      'Solved a Problem Without a Clear Answer - My Role in a Team Crisis - Optimized a Process - Designed a Better Way',
    icon: 'lightbulb',
  },
  {
    category: 'Work & Entrepreneurial Experience',
    description: 'Paid, unpaid, gig, and hustle-based learning',
    stamps:
      'Ran a Side Hustle - Work-Study or Part-Time Job - Supported a Business or Startup - Managed a Budget',
    icon: 'business-center',
  },
  {
    category: 'Future Self & Directionality',
    description: 'Purpose, values, and vision',
    stamps:
      'My Personal Mission Statement - Imagining My Future Life - When I Realized What I Want to Do - Values I Live By',
    icon: 'explore',
  },
];

// NO_OP category for weak fits
export const NO_OP_CATEGORY = 'NO_MAP_WEAK_FIT';

export const NO_OP_DEFINITION: CategoryDefinition = {
  category: NO_OP_CATEGORY,
  description:
    "Use this category if and only if the user's answer does not clearly, obviously, and rigorously map to any other category, or if the user's answer is too brief/generic to draw a strong conclusion. This choice will result in no UI update.",
  stamps: 'NO_OP_EXPERIENCE',
};

// All categories including NO_OP for API prompts
export const ALL_CATEGORIES: CategoryDefinition[] = [...CATEGORY_TAXONOMY, NO_OP_DEFINITION];

export const TOTAL_CATEGORIES = CATEGORY_TAXONOMY.length; // 8

export const INITIAL_PROMPT = 'Tell me what you are typically doing when you lose track of time';

/**
 * Get taxonomy as formatted string for prompts
 */
export function getTaxonomyString(): string {
  return ALL_CATEGORIES.map(
    (t) => `${t.category}: ${t.description} | Sample Experience Stamps: ${t.stamps}`
  ).join('\n');
}

/**
 * Get unmapped categories
 */
export function getUnmappedCategories(mappedCategories: MappedCategory[]): string[] {
  const mappedNames = new Set(mappedCategories.map((c) => c.category));
  return CATEGORY_TAXONOMY.map((t) => t.category).filter((name) => !mappedNames.has(name));
}

/**
 * Check if a category name is valid (case-insensitive partial match)
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
