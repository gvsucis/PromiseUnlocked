export const PVA_STYLE_PROFILES: Record<string, string> = {
  Analyzer: `Style: Analyzer
Core traits: An intensely logical, independent, and discerning thinker focused on making sense of the world. They excel at uncovering root causes, theoretical problem-solving, and spotting logical flaws or unintended consequences that others miss. Self-governing and serious, they deeply value autonomy and cutting through convention.
Communication style: Direct, precise, and objective, prioritizing facts and internal logic over emotional delivery. They prefer straightforward language and like asking probing questions to examine ideas before giving buy-in.
What engages them: Complex puzzles, unspooling intricate systems, and exploring deeper truths or unconventional ideas. They lean in when given full access to information, autonomy to follow curiosity, and room to challenge the status quo.
How they process: They dissect problems privately and systematically, using internal logic and observation to weigh facts, map out hidden risks, and test consistency.`,

  Catalyst: `Style: Catalyst
Core traits: A spirited, future-oriented innovator driven by new possibilities, fresh ideas, and positive change. They bring natural enthusiasm to new enterprises and excel at inspiring others with what could be. Enterprising and inventive, they are naturally curious and eager to venture into uncharted territory.
Communication style: Out-loud, expressive, and brainstorming-driven, relying on open discussions and visual ideas rather than rigid structures. They appreciate warm, affirming dialogue that validates their creative vision.
What engages them: Uncapped brainstorming sessions, novel concepts, and opportunities to pioneer innovative solutions or champion big-picture causes. They lean in when encouraged to think outside the box without immediate constraints.
How they process: They process dynamically out loud, generating multiple ideas rapidly and grasping broad concepts before circling back to details.`,

  Evaluator: `Style: Evaluator
Core traits: A thoughtful, values-oriented harmonizer who leads with deep empathy, integrity, and personal belief systems. They are sensitive, humble, and perceptive, often working behind the scenes to support others and stand up for fairness. Warm-hearted and reflective, they prioritize personal meaning over mere dispassionate metrics.
Communication style: Gentle, considerate, and non-confrontational, focusing on mutual respect, active listening, and understanding. They appreciate a warm, sincere, and inclusive tone that avoids heavy-handedness or aggression.
What engages them: Purpose-driven initiatives, human-centered challenges, and opportunities to restore harmony or help others thrive. They lean in when their personal values align with a broader cause and everyone's voice is honored.
How they process: They reflect deeply against their personal compass, evaluating decisions through the lens of ethics, personal impact, and long-term values.`,

  Maverick: `Style: Maverick
Core traits: A energetic, present-oriented troubleshooter who thrives in the moment with a high zest for experience. Pragmatic, outgoing, and adaptable, they prefer action over long-winded planning and excel at navigating rapid changes or unexpected crises.
Communication style: Quick, punchy, and practical, keeping conversations light, engaging, and directly to the point. They respond best to clear, unambiguous guidance paired with freedom in how they execute.
What engages them: Hands-on activities, real-time problem-solving, and immediate challenges where they can see instant results. They lean in during dynamic, fun, and fast-paced environments where trial and error is encouraged.
How they process: They process by doing, utilizing trial-and-error, quick situational analysis, and immediate practical experimentation rather than lingering over theory.`,

  Organizer: `Style: Organizer
Core traits: A decisive, goal-oriented leader who brings systematic structure, clarity, and rational order to any task or group. Assertive and matter-of-fact, they take charge readily, set high standards, and drive projects efficiently toward completion.
Communication style: Direct, clear, and focused strictly on relevant facts, timelines, and bottom-line outcomes. They prefer well-structured, purposeful interactions and appreciate competent, confident dialogue.
What engages them: Clear targets, strategic plans, and ambitious challenges that offer measurable wins. They lean in when given leadership opportunities to coordinate resources, define roles, and establish order out of chaos.
How they process: They process analytically and rapidly, structuring tasks into actionable steps, establishing benchmarks, and executing decisively.`,

  Pragmatist: `Style: Pragmatist
Core traits: A steady, task-oriented implementer who values reliability, realistic thinking, and proven experience. Conscientious, exacting, and dutiful, they excel at details, take commitments seriously, and build stable, organized routines.
Communication style: Reserved, measured, and detail-focused, preferring calm, businesslike conversations over small talk or hyperbole. They respond best to clear expectations, precise facts, and sufficient time to prepare.
What engages them: Practical execution, tangible problem-solving, and mastering specialized, concrete knowledge. They lean in when working in well-organized, stable environments with clear definitions of success.
How they process: They process methodically and deliberately, gathering all relevant information and thinking things through privately before acting.`,

  Relator: `Style: Relator
Core traits: A warm, community-oriented builder who excels at forging consensus, maintaining harmony, and uniting groups. Conscientious and highly communicative, they are dedicated team players who balance ambition with genuine care for others.
Communication style: Personable, encouraging, and tactful, emphasizing positive reinforcement, kindness, and consensus-building. They appreciate a collaborative, friendly tone that takes an interest in them as individuals.
What engages them: Team-oriented goals, collaborative projects, and activities that celebrate shared achievements. They lean in when creating inclusive spaces, resolving interpersonal friction, and supporting others' growth.
How they process: They process interactively through discussion and collaboration, weighing group input and social impact to ensure everyone is supported.`,

  Strategist: `Style: Strategist
Core traits: A visionary, forward-thinking conceptualizer focused on long-range possibilities, original solutions, and overarching patterns. Imaginative and independent, they excel at seeing the big picture and designing ingenious ways to navigate complex future challenges.
Communication style: Conceptual and articulate, favoring discussions around high-level concepts, strategic vision, and broader implications. They appreciate open-minded, intellectual dialogue that allows room to explore non-traditional perspectives.
What engages them: Complex future scenarios, structural problem-solving, and designing new frameworks. They lean in when challenged to look beyond immediate constraints and craft innovative, long-term roadmaps.
How they process: They process abstractly by mapping out connections, considering long-term outcomes, and synthesizing holistic solutions before committing to action.`,
};

function normalizeStyleName(name: string): string {
  const n = name.toLowerCase().replace(/[^a-z]/g, "");
  for (const key of Object.keys(PVA_STYLE_PROFILES)) {
    if (n.includes(key.toLowerCase())) return key;
  }
  return "";
}

export function getPvaProfile(entryName: string): string {
  return PVA_STYLE_PROFILES[normalizeStyleName(entryName)] ?? "";
}
