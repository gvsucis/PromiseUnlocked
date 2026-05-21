/**
 * Skills Taxonomy Configuration
 * - SKILLS_TAXONOMY: master category-to-skills mapping
 * - SKILL_SYNONYMS: common variations for better user input matching
 * - AVAILABLE_STAMPS: computed from STAMP_TAXONOMY (one entry per detailed variant)
 */

import { Stamp } from "../types/dashboard";
import { STAMP_TAXONOMY } from "./stampTaxonomy";
import { DEFAULT_TIER_IMAGES, slugify } from "./stampConstants";

export type SkillsTaxonomy = Record<string, string[]>;

export const SKILLS_TAXONOMY: SkillsTaxonomy = {
  "Human Skills": [
    "Collaboration",
    "Leadership",
    "Empathy",
    "Active Listening",
    "Conflict Resolution",
    "Team Management",
    "Research: Independent Research Project",
    "Research: Science Fair / Expo Participant",
    "Research: Oral History / Interview Project",
    "Athletics: Team Sport",
    "Athletics: Individual Sport",
    "Athletics: Adaptive / Para Athletics",
    "Athletics: Outdoor & Adventure Sport",
    "Cross-Cultural Communication",
    "Mentorship Received",
  ],
  "Meta-Learning & Self-Awareness": [
    "Critical Thinking",
    "Research Skills",
    "Self-Reflection",
    "Learning Strategies",
    "Information Synthesis",
    "Knowledge Transfer",
    "Continuous Learning",
    "Adaptability",
    "Leadership: Club / Org Officer",
    "Leadership: Peer Mentor or Tutor",
    "Leadership: Team Captain",
    "Goal Setting",
    "Self-Advocacy",
    "Overcoming Failure",
    "Journaling & Reflection",
    "Navigating Hardship",
    "Learning a New Skill Independently",
  ],
  "Maker & Builder": [
    "Prototyping",
    "Design Thinking",
    "Craftsmanship",
    "Innovation",
    "Technical Skills",
    "Project Management",
    "Problem Solving",
    "Creative Construction",
    "Engineering",
    "Event Planning: School Event",
    "Event Planning: Community Event",
    "DIY & Fabrication",
    "Culinary Arts",
    "Fashion & Textile",
    "Home & Facilities",
    "Vehicle / Mechanical Work",
    "Garden & Land Stewardship",
    "Prototype / Invention",
  ],
  "Civic & Community": [
    "Community Engagement",
    "Social Responsibility",
    "Volunteer Work",
    "Policy Understanding",
    "Cultural Awareness",
    "Environmental Stewardship",
    "Civic Participation",
    "Family Responsibilities Primary Caregiver",
    "Family Responsibilities: Sibling Mentor",
    "Family Responsibilities: Household Manager",
    "Student Government",
    "Tutoring: Peer Tutoring",
    "Tutoring: Community / Youth Tutoring",
    "Environmental Action",
    "Advocacy & Activism",
    "Religious / Faith Service",
    "Neighborhood Stewardship",
  ],
  "Creative Expression": [
    "Artistic Creation",
    "Music: Vocalist",
    "Music: Instrumentalist",
    "Music: Songwriter / Composer",
    "Music: DJ / Music Producer",
    "Performance: Dance",
    "Performance: Stand-Up / Comedy",
    "Creative Problem Solving",
    "Imagination",
    "Aesthetic Appreciation",
    "Public Speaking: Debate",
    "Public Speaking: Speech / Oratory",
    "Theater: Acting",
    "Theater: Stagecraft / Tech Theater",
    "Visual Art",
    "Photography & Film",
    "Writing & Storytelling",
    "Podcasting / Broadcasting",
  ],
  "Problem-Solving": [
    "Analytical Thinking",
    "Strategic Planning",
    "Troubleshooting",
    "Decision Making",
    "Systems Thinking",
    "Root Cause Analysis",
    "Logic",
    "Pattern Recognition",
    "Academic Competition: Math / Science Olympiad",
    "Academic Competition: Debate / Model UN",
    "Academic Competition: Coding / Hackathon",
    "Strategic Games",
    "Engineering Challenge",
    "Logic & Puzzle Mastery",
    "Systems Design",
  ],
  "Work Experience": [
    "Professional Skills",
    "Industry Knowledge",
    "Workplace Etiquette",
    "Time Management",
    "Client Relations",
    "Business Acumen",
    "Career Development",
    "Mentorship",
    "Internship: STEM / Technical",
    "Internship: Creative / Media",
    "Internship: Nonprofit / Civic",
    "Early Job: Retail / Food Service",
    "Early Job: Agricultural / Seasonal",
    "Early Job: Childcare / Petcare / Elder Care",
    "Freelance Work",
    "Gig Economy",
  ],
  "Future Self & Direction": [
    "Vision Creation",
    "Personal Growth",
    "Skill Development",
    "Career Planning",
    "Life Balance",
    "Self-Improvement",
    "Aspiration Mapping",
    "Entrepreneurship: Business Started",
    "Entrepreneurship: Product / App Created",
    "Niche Interest & Expertise: Collector / Curator",
    "Niche Interest & Expertise: Self-Taught Expert",
    "College Exploration",
    "Career Shadowing",
    "Personal Mission Statement",
  ],
  "Technological Fluency": [
    "Coding & Programming",
    "Game Design",
    "Social Media & Content Creation",
    "Data & Analytics",
    "Digital Safety & Ethics",
    "Artificial Intelligence",
    "Emerging Technology",
  ],
  "Wellbeing & Personal Resilience": [
    "Mental Health",
    "Mental Health Advocacy",
    "Physical Wellness Practice",
    "Recovery & Perseverance",
    "Mindfulness & Meditation",
    "Navigating Loss or Grief",
  ],
  "Faith, Culture & Identity": [
    "Faith Community Involvement",
    "First-Generation Experience",
    "Immigration and Transition Story",
    "Heritage & Cultural Practice",
    "Language & Multilingualism",
    "Indigenous Knowledge & Practice",
  ],
};

/**
 * Common skill variations for flexible user input matching
 * Maps canonical skill names to common synonyms/aliases
 */
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

      // Create one stamp per detailed variant, or fallback to family level
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

      // Add stamps to map (first occurrence wins for duplicates)
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
