const STAMP_TAXONOMY: Record<string, { stampCategory: string; detailedStamps?: { name: string }[] }[]> = {
  "Human Skills (Durable)": [
    {
      stampCategory: "Research",
      detailedStamps: [
        { name: "Independent Research Project" },
        { name: "Science Fair / Expo Participant" },
        { name: "Oral History / Interview Project" },
      ],
    },
    {
      stampCategory: "Athletics",
      detailedStamps: [
        { name: "Team Sport" },
        { name: "Individual Sport" },
        { name: "Adaptive / Para Athletics" },
        { name: "Outdoor & Adventure Sport" },
      ],
    },
    { stampCategory: "Collaboration" },
    { stampCategory: "Conflict Resolution" },
    { stampCategory: "Mentorship Received" },
    { stampCategory: "Cross-Cultural Communication" },
  ],
  "Creative Expression & Communication": [
    {
      stampCategory: "Music",
      detailedStamps: [
        { name: "Vocalist" },
        { name: "Instrumentalist" },
        { name: "Songwriter / Composer" },
        { name: "DJ / Music Producer" },
      ],
    },
    {
      stampCategory: "Performance",
      detailedStamps: [
        { name: "Dance" },
        { name: "Stand-Up / Comedy" },
      ],
    },
    {
      stampCategory: "Public Speaking",
      detailedStamps: [
        { name: "Debate" },
        { name: "Speech / Oratory" },
      ],
    },
    {
      stampCategory: "Theater",
      detailedStamps: [
        { name: "Acting" },
        { name: "Stagecraft / Tech Theater" },
      ],
    },
    { stampCategory: "Visual Art" },
    { stampCategory: "Photography & Film" },
    { stampCategory: "Writing & Storytelling" },
    { stampCategory: "Podcasting / Broadcasting" },
  ],
  "Problem-Solving & Systems Thinking": [
    {
      stampCategory: "Academic Competition",
      detailedStamps: [
        { name: "Math / Science Olympiad" },
        { name: "Debate / Model UN" },
        { name: "Coding / Hackathon" },
      ],
    },
    { stampCategory: "Strategic Games" },
    { stampCategory: "Engineering Challenge" },
    { stampCategory: "Logic & Puzzle Mastery" },
    { stampCategory: "Systems Design" },
  ],
  "Work & Entrepreneurial Experience": [
    {
      stampCategory: "Internship",
      detailedStamps: [
        { name: "STEM / Technical" },
        { name: "Creative / Media" },
        { name: "Nonprofit / Civic" },
      ],
    },
    {
      stampCategory: "Early Job",
      detailedStamps: [
        { name: "Retail / Food Service" },
        { name: "Agricultural / Seasonal" },
        { name: "Childcare / Elder Care" },
      ],
    },
    { stampCategory: "Freelance Work" },
    { stampCategory: "Gig Economy" },
  ],
  "Future Self & Directionality": [
    {
      stampCategory: "Entrepreneurship",
      detailedStamps: [
        { name: "Business Started" },
        { name: "Product / App Created" },
      ],
    },
    {
      stampCategory: "Niche Interest & Expertise",
      detailedStamps: [
        { name: "Collector / Curator" },
        { name: "Self-Taught Expert" },
      ],
    },
    { stampCategory: "College Exploration" },
    { stampCategory: "Career Shadowing" },
    { stampCategory: "Personal Mission Statement" },
  ],
  "Meta-Learning & Self-Awareness": [
    {
      stampCategory: "Leadership",
      detailedStamps: [
        { name: "Club / Org Officer" },
        { name: "Peer Mentor or Tutor" },
        { name: "Team Captain" },
      ],
    },
    { stampCategory: "Goal Setting" },
    { stampCategory: "Self-Advocacy" },
    { stampCategory: "Overcoming Failure" },
    { stampCategory: "Journaling & Reflection" },
    { stampCategory: "Navigating Hardship" },
    { stampCategory: "Learning a New Skill Independently" },
  ],
  "Maker & Builder Skills": [
    {
      stampCategory: "Event Planning",
      detailedStamps: [
        { name: "School Event" },
        { name: "Community Event" },
      ],
    },
    { stampCategory: "DIY & Fabrication" },
    { stampCategory: "Culinary Arts" },
    { stampCategory: "Fashion & Textile" },
    { stampCategory: "Home & Facilities" },
    { stampCategory: "Vehicle / Mechanical Work" },
    { stampCategory: "Garden & Land Stewardship" },
    { stampCategory: "Prototype / Invention" },
  ],
  "Civic & Community Impact": [
    {
      stampCategory: "Family Responsibilities",
      detailedStamps: [
        { name: "Primary Caregiver" },
        { name: "Sibling Mentor" },
        { name: "Household Manager" },
      ],
    },
    { stampCategory: "Student Government" },
    {
      stampCategory: "Tutoring",
      detailedStamps: [
        { name: "Peer Tutoring" },
        { name: "Community / Youth Tutoring" },
      ],
    },
    { stampCategory: "Volunteering" },
    { stampCategory: "Environmental Action" },
    { stampCategory: "Advocacy & Activism" },
    { stampCategory: "Religious / Faith Service" },
    { stampCategory: "Neighborhood Stewardship" },
  ],
  "Digital & Tech Fluency": [
    { stampCategory: "Coding & Programming" },
    { stampCategory: "Game Design" },
    { stampCategory: "Social Media & Content Creation" },
    { stampCategory: "Data & Analytics" },
    { stampCategory: "Digital Safety & Ethics" },
    { stampCategory: "AI / Emerging Tech" },
  ],
  "Wellbeing & Personal Resilience": [
    { stampCategory: "Mental Health Advocacy" },
    { stampCategory: "Physical Wellness Practice" },
    { stampCategory: "Recovery & Perseverance" },
    { stampCategory: "Mindfulness & Meditation" },
    { stampCategory: "Navigating Loss or Grief" },
  ],
  "Faith, Culture & Identity": [
    { stampCategory: "Heritage & Cultural Practice" },
    { stampCategory: "Language & Multilingualism" },
    { stampCategory: "Faith Community Involvement" },
    { stampCategory: "First-Generation Experience" },
    { stampCategory: "Immigration & Transition Story" },
    { stampCategory: "Indigenous Knowledge & Practice" },
  ],
};

const VALID_CATEGORIES: string[] = Object.keys(STAMP_TAXONOMY);

function computeDerivedStamps(): string[] {
  const stamps: string[] = [];
  for (const families of Object.values(STAMP_TAXONOMY)) {
    for (const family of families) {
      if (family.detailedStamps?.length) {
        for (const detail of family.detailedStamps) {
          stamps.push(`${family.stampCategory}: ${detail.name}`);
        }
      } else {
        stamps.push(family.stampCategory);
      }
    }
  }
  return stamps;
}

const DERIVED_STAMPS: string[] = computeDerivedStamps();

function sanitizeStampKey(name: string): string {
  return name.replace(/[.[\]/]/g, "_");
}

function sanitizeCategoryId(category: string): string {
  return category.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
}

function isValidCategory(category: string): boolean {
  return VALID_CATEGORIES.includes(category);
}

function isValidStamp(stamp: string): boolean {
  return DERIVED_STAMPS.includes(stamp);
}

export {
  STAMP_TAXONOMY,
  VALID_CATEGORIES,
  DERIVED_STAMPS,
  sanitizeStampKey,
  sanitizeCategoryId,
  isValidCategory,
  isValidStamp,
};
