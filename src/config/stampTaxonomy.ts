export interface StampDetailVariant {
  name: string;
  iconConcept?: string;
}

export interface StampFamily {
  stampCategory: string;
  detailedStamps?: StampDetailVariant[];
  iconConcept?: string;
  description?: string;
}

export type StampTaxonomy = Record<string, StampFamily[]>;

export const STAMP_TAXONOMY: StampTaxonomy = {
  "Human Skills (Durable)": [
    {
      stampCategory: "Research",
      detailedStamps: [
        { name: "Independent Research Project", iconConcept: "Magnifying glass over open book" },
        { name: "Science Fair / Expo Participant", iconConcept: "Ribbon on a beaker" },
        { name: "Oral History / Interview Project", iconConcept: "Microphone with speech bubble" },
      ],
      iconConcept: "Magnifying glass over open book",
    },
    {
      stampCategory: "Athletics",
      detailedStamps: [
        { name: "Team Sport", iconConcept: "Two figures passing a ball" },
        { name: "Individual Sport", iconConcept: "Single runner at finish line" },
        { name: "Adaptive / Para Athletics", iconConcept: "Wheelchair with lightning bolt" },
        { name: "Outdoor & Adventure Sport", iconConcept: "Mountain peak with flag" },
      ],
      iconConcept: "Two figures passing a ball",
    },
    {
      stampCategory: "Collaboration",
      iconConcept: "Three interlocking puzzle pieces",
      description: "Team-based work and shared problem-solving",
    },
    {
      stampCategory: "Conflict Resolution",
      iconConcept: "Two hands meeting in the middle",
      description: "Navigating disagreements constructively",
    },
    {
      stampCategory: "Mentorship Received",
      iconConcept: "Older hand guiding younger hand",
      description: "Support, coaching, or guidance from another person",
    },
    {
      stampCategory: "Cross-Cultural Communication",
      iconConcept: "Globe with speech bubbles",
      description: "Communication across cultures, languages, and contexts",
    },
  ],
  "Creative Expression & Communication": [
    {
      stampCategory: "Music",
      detailedStamps: [
        { name: "Vocalist", iconConcept: "Microphone with musical notes" },
        { name: "Instrumentalist", iconConcept: "Eighth note over piano keys" },
        { name: "Songwriter / Composer", iconConcept: "Pencil writing notes on staff" },
        { name: "DJ / Music Producer", iconConcept: "Headphones over waveform" },
      ],
      iconConcept: "Microphone with musical notes",
    },
    {
      stampCategory: "Performance",
      detailedStamps: [
        { name: "Dance", iconConcept: "Silhouette mid-leap" },
        { name: "Stand-Up / Comedy", iconConcept: "Spotlight on microphone stand" },
      ],
      iconConcept: "Silhouette mid-leap",
    },
    {
      stampCategory: "Public Speaking",
      detailedStamps: [
        { name: "Debate", iconConcept: "Two podiums facing each other" },
        { name: "Speech / Oratory", iconConcept: "Podium with radiating lines" },
      ],
      iconConcept: "Two podiums facing each other",
    },
    {
      stampCategory: "Theater",
      detailedStamps: [
        { name: "Acting", iconConcept: "Comedy/tragedy masks" },
        { name: "Stagecraft / Tech Theater", iconConcept: "Spotlight and gear" },
      ],
      iconConcept: "Comedy/tragedy masks",
    },
    {
      stampCategory: "Visual Art",
      iconConcept: "Palette with paintbrush",
      description: "Artistic drawing, painting, and visual design",
    },
    {
      stampCategory: "Photography & Film",
      iconConcept: "Camera lens with aperture",
      description: "Still and moving image creation",
    },
    {
      stampCategory: "Writing & Storytelling",
      iconConcept: "Quill in inkwell with scroll",
      description: "Narrative, prose, scripts, and written expression",
    },
    {
      stampCategory: "Podcasting / Broadcasting",
      iconConcept: "Radio tower with sound waves",
      description: "Audio and voice-based publishing",
    },
  ],
  "Problem-Solving & Systems Thinking": [
    {
      stampCategory: "Academic Competition",
      detailedStamps: [
        { name: "Math / Science Olympiad", iconConcept: "Trophy with sigma symbol" },
        { name: "Debate / Model UN", iconConcept: "Globe with gavel" },
        { name: "Coding / Hackathon", iconConcept: "Code brackets with lightning" },
      ],
      iconConcept: "Trophy with sigma symbol",
    },
    {
      stampCategory: "Strategic Games",
      iconConcept: "Chess piece over circuit board",
      description: "Chess, strategy, and decision-making games",
    },
    {
      stampCategory: "Engineering Challenge",
      iconConcept: "Gear with drafting triangle",
      description: "Designing and building solutions to constraints",
    },
    {
      stampCategory: "Logic & Puzzle Mastery",
      iconConcept: "Brain with jigsaw cutout",
      description: "Pattern recognition, puzzles, and logic problems",
    },
    {
      stampCategory: "Systems Design",
      iconConcept: "Flowchart with nodes",
      description: "Thinking in flows, dependencies, and feedback loops",
    },
  ],
  "Work & Entrepreneurial Experience": [
    {
      stampCategory: "Internship",
      detailedStamps: [
        { name: "STEM / Technical", iconConcept: "Microscope with briefcase" },
        { name: "Creative / Media", iconConcept: "Camera and briefcase" },
        { name: "Nonprofit / Civic", iconConcept: "Heart in briefcase" },
      ],
      iconConcept: "Microscope with briefcase",
    },
    {
      stampCategory: "Early Job",
      detailedStamps: [
        { name: "Retail / Food Service", iconConcept: "Apron with name tag" },
        { name: "Agricultural / Seasonal", iconConcept: "Wheat sheaf with sun" },
        { name: "Childcare / Elder Care", iconConcept: "Gentle hands holding small figure" },
      ],
      iconConcept: "Apron with name tag",
    },
    {
      stampCategory: "Freelance Work",
      iconConcept: "Laptop with dollar-sign swoosh",
      description: "Independent client-based work",
    },
    {
      stampCategory: "Gig Economy",
      iconConcept: "Phone with delivery icon",
      description: "Short-term platform or task-based work",
    },
  ],
  "Future Self & Directionality": [
    {
      stampCategory: "Entrepreneurship",
      detailedStamps: [
        { name: "Business Started", iconConcept: "Rocket launching from storefront" },
        { name: "Product / App Created", iconConcept: "Smartphone with star badge" },
      ],
      iconConcept: "Rocket launching from storefront",
    },
    {
      stampCategory: "Niche Interest & Expertise",
      detailedStamps: [
        { name: "Collector / Curator", iconConcept: "Framed item with magnifier" },
        { name: "Self-Taught Expert", iconConcept: "Stack of books with graduation cap" },
      ],
      iconConcept: "Framed item with magnifier",
    },
    {
      stampCategory: "College Exploration",
      iconConcept: "Campus gate with compass",
      description: "Visiting, researching, or planning postsecondary options",
    },
    {
      stampCategory: "Career Shadowing",
      iconConcept: "Binoculars over city skyline",
      description: "Observing a profession in practice",
    },
    {
      stampCategory: "Personal Mission Statement",
      iconConcept: "Scroll with north star",
      description: "Clarity around values, purpose, and direction",
    },
  ],
  "Meta-Learning & Self-Awareness": [
    {
      stampCategory: "Leadership",
      detailedStamps: [
        { name: "Club / Org Officer", iconConcept: "Podium with star" },
        { name: "Peer Mentor or Tutor", iconConcept: "Figure with guiding arrow" },
        { name: "Team Captain", iconConcept: "Captain's armband" },
      ],
      iconConcept: "Podium with star",
    },
    {
      stampCategory: "Goal Setting",
      iconConcept: "Target with arrow in bullseye",
      description: "Setting and achieving personal objectives",
    },
    {
      stampCategory: "Self-Advocacy",
      iconConcept: "Raised hand with speech lines",
      description: "Speaking up for yourself and your needs",
    },
    {
      stampCategory: "Overcoming Failure",
      iconConcept: "Cracked and repaired vase (kintsugi)",
      description: "Resilience and learning from setbacks",
    },
    {
      stampCategory: "Journaling & Reflection",
      iconConcept: "Open journal with ink quill",
      description: "Self-reflection and personal documentation",
    },
    {
      stampCategory: "Navigating Hardship",
      iconConcept: "Compass in a storm",
      description: "Building resilience through challenges",
    },
    {
      stampCategory: "Learning a New Skill Independently",
      iconConcept: "Lightbulb with gear inside",
      description: "Self-directed skill development",
    },
  ],
  "Maker & Builder Skills": [
    {
      stampCategory: "Event Planning",
      detailedStamps: [
        { name: "School Event", iconConcept: "Calendar with party popper" },
        { name: "Community Event", iconConcept: "City skyline with star" },
      ],
      iconConcept: "Calendar with party popper",
    },
    {
      stampCategory: "DIY & Fabrication",
      iconConcept: "Hammer and wrench crossed",
      description: "Hands-on making and building",
    },
    {
      stampCategory: "Culinary Arts",
      iconConcept: "Chef's hat with wooden spoon",
      description: "Cooking and food preparation",
    },
    {
      stampCategory: "Fashion & Textile",
      iconConcept: "Needle threading through fabric",
      description: "Sewing, fashion design, and textile work",
    },
    {
      stampCategory: "Home & Facilities",
      iconConcept: "House with tool belt",
      description: "Home maintenance and facility work",
    },
    {
      stampCategory: "Vehicle / Mechanical Work",
      iconConcept: "Wrench over engine block",
      description: "Automotive and mechanical skills",
    },
    {
      stampCategory: "Garden & Land Stewardship",
      iconConcept: "Seedling in soil with sun",
      description: "Gardening and environmental stewardship",
    },
    {
      stampCategory: "Prototype / Invention",
      iconConcept: "Blueprint with lightbulb",
      description: "Creating and inventing new solutions",
    },
  ],
  "Civic & Community Impact": [
    {
      stampCategory: "Family Responsibilities",
      detailedStamps: [
        { name: "Primary Caregiver", iconConcept: "Heart with small figure inside" },
        { name: "Sibling Mentor", iconConcept: "Two children side by side" },
        { name: "Household Manager", iconConcept: "House with checklist" },
      ],
      iconConcept: "Heart with small figure inside",
    },
    {
      stampCategory: "Student Government",
      iconConcept: "Gavel on a school crest",
      description: "Leadership in school governance and advocacy",
    },
    {
      stampCategory: "Tutoring",
      detailedStamps: [
        { name: "Peer Tutoring", iconConcept: "Two figures at a chalkboard" },
        { name: "Community / Youth Tutoring", iconConcept: "Book open with children's hands" },
      ],
      iconConcept: "Two figures at a chalkboard",
    },
    {
      stampCategory: "Volunteering",
      iconConcept: "Hands cupped around a heart",
      description: "Giving time and energy to serve others",
    },
    {
      stampCategory: "Environmental Action",
      iconConcept: "Leaf with recycling arrows",
      description: "Environmental conservation and sustainability",
    },
    {
      stampCategory: "Advocacy & Activism",
      iconConcept: "Megaphone with raised fist",
      description: "Championing causes and social change",
    },
    {
      stampCategory: "Religious / Faith Service",
      iconConcept: "Two hands in service gesture",
      description: "Community involvement through faith traditions",
    },
    {
      stampCategory: "Neighborhood Stewardship",
      iconConcept: "Block of houses with broom",
      description: "Taking care of your local community",
    },
  ],
  "Digital & Tech Fluency": [
    {
      stampCategory: "Coding & Programming",
      iconConcept: "Code brackets with gear",
      description: "Programming and software development",
    },
    {
      stampCategory: "Game Design",
      iconConcept: "Game controller with pencil",
      description: "Game development and design",
    },
    {
      stampCategory: "Social Media & Content Creation",
      iconConcept: "Phone screen with play button",
      description: "Creating and sharing digital content",
    },
    {
      stampCategory: "Data & Analytics",
      iconConcept: "Bar chart with magnifying glass",
      description: "Working with data visualization and insights",
    },
    {
      stampCategory: "Digital Safety & Ethics",
      iconConcept: "Shield with checkmark",
      description: "Online safety and digital ethics",
    },
    {
      stampCategory: "AI / Emerging Tech",
      iconConcept: "Circuit brain with spark",
      description: "Exploring artificial intelligence and emerging technologies",
    },
  ],
  "Wellbeing & Personal Resilience": [
    {
      stampCategory: "Mental Health Advocacy",
      iconConcept: "Ribbon with heartbeat line",
      description: "Supporting mental health awareness and wellness",
    },
    {
      stampCategory: "Physical Wellness Practice",
      iconConcept: "Lotus with sun rays",
      description: "Fitness, exercise, and holistic wellness",
    },
    {
      stampCategory: "Recovery & Perseverance",
      iconConcept: "Phoenix rising from embers",
      description: "Overcoming adversity and rebuilding",
    },
    {
      stampCategory: "Mindfulness & Meditation",
      iconConcept: "Calm water with single ripple",
      description: "Mindfulness practices and meditation",
    },
    {
      stampCategory: "Navigating Loss or Grief",
      iconConcept: "Candle with gentle glow",
      description: "Resilience through challenging life events",
    },
  ],
  "Faith, Culture & Identity": [
    {
      stampCategory: "Heritage & Cultural Practice",
      iconConcept: "Woven pattern with family crest",
      description: "Honoring and practicing cultural traditions",
    },
    {
      stampCategory: "Language & Multilingualism",
      iconConcept: "Speech bubble with two flags",
      description: "Learning and speaking multiple languages",
    },
    {
      stampCategory: "Faith Community Involvement",
      iconConcept: "Two hands in prayer / service",
      description: "Community involvement through faith traditions",
    },
    {
      stampCategory: "First-Generation Experience",
      iconConcept: "Door opening to horizon",
      description: "Pioneering path in family or community",
    },
    {
      stampCategory: "Immigration & Transition Story",
      iconConcept: "Suitcase with map inside",
      description: "Navigating cultural transitions and identity",
    },
    {
      stampCategory: "Indigenous Knowledge & Practice",
      iconConcept: "Circle with nature elements",
      description: "Honoring and practicing indigenous traditions",
    },
  ],
};
