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

export const STAMPS_LIST: Record<string, string> = {
  "Research: Independent Research Project": "research-independent-research-project.png",
  "Research: Science Fair / Expo Participant": "research-science-fair-expo-participant.png",
  "Research: Oral History / Interview Project": "research-oral-history-interview-project.png",
  "Athletics: Team Sport": "athletics-team-sport.png",
  "Athletics: Individual Sport": "athletics-individual-sport.png",
  "Athletics: Adaptive / Para Athletics": "athletics-adaptive-para-athletics.png",
  "Athletics: Outdoor & Adventure Sport": "athletics-outdoor-adventure-sport.png",
  Collaboration: "collaboration.png",
  "Conflict Resolution": "conflict-resolution.png",
  "Mentorship Received": "mentorship-received.png",
  "Cross-Cultural Communication": "cross-cultural-communication.png",
  "Leadership: Club / Org Officer": "leadership-club-org-officer.png",
  "Leadership: Peer Mentor or Tutor": "leadership-peer-mentor-or-tutor.png",
  "Leadership: Team Captain": "leadership-team-captain.png",
  "Goal Setting": "goal-setting.png",
  "Self-Advocacy": "self-advocacy.png",
  "Overcoming Failure": "overcoming-failure.png",
  "Journaling & Reflection": "journaling-reflection.png",
  "Navigating Hardship": "navigating-hardship.png",
  "Learning a New Skill Independently": "learning-a-new-skill-independently.png",
  "Event Planning: School Event": "event-planning-school-event.png",
  "Event Planning: Community Event": "event-planning-community-event.png",
  "DIY & Fabrication": "diy-fabrication.png",
  "Culinary Arts": "culinary-arts.png",
  "Fashion & Textile": "fashion-textile.png",
  "Home & Facilities": "home-facilities.png",
  "Vehicle / Mechanical Work": "vehicle-mechanical-work.png",
  "Garden & Land Stewardship": "garden-land-stewardship.png",
  "Prototype / Invention": "prototype-invention.png",
  "Family Responsibilities: Primary Caregiver": "family-responsibilities-primary-caregiver.png",
  "Family Responsibilities: Sibling Mentor": "family-responsibilities-sibling-mentor.png",
  "Family Responsibilities: Household Manager": "family-responsibilities-household-manager.png",
  "Student Government": "student-government.png",
  "Tutoring: Peer Tutoring": "tutoring-peer-tutoring.png",
  "Tutoring: Community / Youth Tutoring": "tutoring-community-youth-tutoring.png",
  Volunteering: "volunteering.png",
  "Environmental Action": "environmental-action.png",
  "Advocacy & Activism": "advocacy-activism.png",
  "Religious / Faith Service": "religious-faith-service.png",
  "Neighborhood Stewardship": "neighborhood-stewardship.png",
  "Music: Vocalist": "music-vocalist.png",
  "Music: Instrumentalist": "music-instrumentalist.png",
  "Music: Songwriter / Composer": "music-songwriter-composer.png",
  "Music: DJ / Music Producer": "music-dj-music-producer.png",
  "Performance: Dance": "performance-dance.png",
  "Performance: Stand-Up / Comedy": "performance-stand-up-comedy.png",
  "Public Speaking: Debate": "public-speaking-debate.png",
  "Public Speaking: Speech / Oratory": "public-speaking-speech-oratory.png",
  "Theater: Acting": "theater-acting.png",
  "Theater: Stagecraft / Tech Theater": "theater-stagecraft-tech-theater.png",
  "Visual Art": "visual-art.png",
  "Photography & Film": "photography-film.png",
  "Writing & Storytelling": "writing-storytelling.png",
  "Podcasting / Broadcasting": "podcasting-broadcasting.png",
  "Academic Competition: Math / Science Olympiad": "academic-competition-math-science-olympiad.png",
  "Academic Competition: Debate / Model UN": "academic-competition-debate-model-un.png",
  "Academic Competition: Coding / Hackathon": "academic-competition-coding-hackathon.png",
  "Strategic Games": "strategic-games.png",
  "Engineering Challenge": "engineering-challenge.png",
  "Logic & Puzzle Mastery": "logic-puzzle-mastery.png",
  "Systems Design": "systems-design.png",
  "Internship: STEM / Technical": "internship-stem-technical.png",
  "Internship: Creative / Media": "internship-creative-media.png",
  "Internship: Nonprofit / Civic": "internship-nonprofit-civic.png",
  "Early Job: Retail / Food Service": "early-job-retail-food-service.png",
  "Early Job: Agricultural / Seasonal": "early-job-agricultural-seasonal.png",
  "Early Job: Childcare / Elder Care": "early-job-childcare-elder-care.png",
  "Freelance Work": "freelance-work.png",
  "Gig Economy": "gig-economy.png",
  "Entrepreneurship: Business Started": "entrepreneurship-business-started.png",
  "Entrepreneurship: Product / App Created": "entrepreneurship-product-app-created.png",
  "Niche Interest & Expertise: Collector / Curator":
    "niche-interest-expertise-collector-curator.png",
  "Niche Interest & Expertise: Self-Taught Expert":
    "niche-interest-expertise-self-taught-expert.png",
  "College Exploration": "college-exploration.png",
  "Career Shadowing": "career-shadowing.png",
  "Personal Mission Statement": "personal-mission-statement.png",
  "Coding & Programming": "coding-programming.png",
  "Game Design": "game-design.png",
  "Social Media & Content Creation": "social-media-content-creation.png",
  "Data & Analytics": "data-analytics.png",
  "Digital Safety & Ethics": "digital-safety-ethics.png",
  "AI / Emerging Tech": "ai-emerging-tech.png",
  "Mental Health Advocacy": "mental-health-advocacy.png",
  "Physical Wellness Practice": "physical-wellness-practice.png",
  "Recovery & Perseverance": "recovery-perseverance.png",
  "Mindfulness & Meditation": "mindfulness-meditation.png",
  "Navigating Loss or Grief": "navigating-loss-or-grief.png",
  "Heritage & Cultural Practice": "heritage-cultural-practice.png",
  "Language & Multilingualism": "language-multilingualism.png",
  "Faith Community Involvement": "faith-community-involvement.png",
  "First-Generation Experience": "first-generation-experience.png",
  "Immigration & Transition Story": "immigration-transition-story.png",
};

const FB_STORAGE_BASE =
  "https://firebasestorage.googleapis.com/v0/b/promise-unlocked-for-sure.firebasestorage.app/o";

export function getStampBaseImage(stampName: string): { uri: string } {
  const filename = STAMPS_LIST[stampName] ?? `${slugify(stampName)}.png`;
  const encodedPath = encodeURIComponent(`stamp-icons/${filename}`);

  return {
    uri: `${FB_STORAGE_BASE}/${encodedPath}?alt=media`,
  };
}

export const TIER_WRAPPERS: Record<number, { uri: string }> = {
  1: {
    uri: `${FB_STORAGE_BASE}/${encodeURIComponent("wrapper-icons/thumbs-gray-stamp-transparent.png")}?alt=media`,
  },
  2: {
    uri: `${FB_STORAGE_BASE}/${encodeURIComponent("wrapper-icons/thumbs-black-stamp-transparent.png")}?alt=media`,
  },
  3: {
    uri: `${FB_STORAGE_BASE}/${encodeURIComponent("wrapper-icons/thumbs-blue-stamp-transparent.png")}?alt=media`,
  },
  4: {
    uri: `${FB_STORAGE_BASE}/${encodeURIComponent("wrapper-icons/thumbs-gold-stamp-transparent.png")}?alt=media`,
  },
};

export const TIER_CONFIG = {
  1: { label: "Tier 1", color: "#9CA3AF" },
  2: { label: "Tier 2", color: "#2E6EE6" },
  3: { label: "Tier 3", color: "#7C3AED" },
  4: { label: "Tier 4", color: "#F59E0B" },
} as const;

export const DEFAULT_TIER = 1;

function encodeStoragePath(path: string): string {
  return `${FB_STORAGE_BASE}/${encodeURIComponent(path)}?alt=media`;
}

export function getAllPreloadUrls(): string[] {
  const stampUrls = Object.values(STAMPS_LIST).map((filename) =>
    encodeStoragePath(`stamp-icons/${filename}`)
  );
  const wrapperUrls = Object.values(TIER_WRAPPERS).map((w) => w.uri);
  return [...stampUrls, ...wrapperUrls];
}

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
