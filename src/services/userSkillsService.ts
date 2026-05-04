/**
 * User Skills Storage Service
 * Manages identified skills in AsyncStorage
 */

import {
  SKILLS_TAXONOMY,
  mapSkillToTaxonomy,
  normalizeTaxonomyCategoryName,
} from "./skillTaxonomyService";
import { getJSONFromStorage, removeFromStorage, setJSONInStorage } from "../util/asyncStorage";
import { getActiveSessionId, getUserId } from "./sessionManager";
import {
  saveIdentifiedSkillToFirestore,
  saveIdentifiedSkillsToFirestore,
} from "./firebase/firestoreService";
import { enqueueFirestoreWrite } from "./firebase/firestoreWriteQueue";

const SKILLS_STORAGE_KEY = "@user_identified_skills";

type SkillSource = "image" | "voice" | "text";

export interface IdentifiedSkill {
  skill: string;
  category: string;
  dateIdentified: string;
  source: SkillSource;
  confidence?: number;
}

export interface UserSkillsData {
  skills: IdentifiedSkill[];
  lastUpdated: string;
}

/**
 * Save a newly identified skill
 */
export async function saveIdentifiedSkill(
  skill: string,
  category: string,
  source: SkillSource,
  confidence?: number
): Promise<void> {
  try {
    const existingData = await getUserSkills();
    const taxonomyMatch = mapSkillToTaxonomy(skill);
    const shouldUseMatchedSkill = taxonomyMatch.confidence >= 0.5;
    const normalizedSkill = shouldUseMatchedSkill ? taxonomyMatch.skill : skill;
    const normalizedCategory = shouldUseMatchedSkill
      ? taxonomyMatch.category
      : normalizeTaxonomyCategoryName(category);
    const storedConfidence = confidence ?? taxonomyMatch.confidence;

    // Check if skill already exists using Set for O(1) lookup
    if (existingData.skills.some((s) => s.skill === normalizedSkill)) {
      console.log("Skill already exists:", normalizedSkill);
      return;
    }

    const newSkill: IdentifiedSkill = {
      skill: normalizedSkill,
      category: normalizedCategory,
      dateIdentified: new Date().toISOString(),
      source,
      confidence: storedConfidence,
    };

    existingData.skills.push(newSkill);
    existingData.lastUpdated = new Date().toISOString();

    await setJSONInStorage(SKILLS_STORAGE_KEY, existingData);
    console.log("Skill saved:", skill);

    enqueueFirestoreWrite(async () => {
      const [userId, sessionId] = await Promise.all([getUserId(), getActiveSessionId()]);
      await saveIdentifiedSkillToFirestore(
        userId,
        normalizedSkill,
        normalizedCategory,
        source,
        storedConfidence,
        sessionId
      );
    });
  } catch (error) {
    console.error("Error saving skill:", error);
    throw error;
  }
}

/**
 * Save multiple identified skills
 */
export async function saveIdentifiedSkills(
  skills: string[],
  categories: string[],
  source: SkillSource,
  confidences: number[] = []
): Promise<void> {
  try {
    const existingData = await getUserSkills();
    
    // Convert existing skills to Set for O(1) lookup instead of O(N) Array.some()
    const existingSkillNames = new Set(existingData.skills.map((s) => s.skill));
    
    // Pre-compute all taxonomy mappings once (instead of 3x per skill)
    const taxonomyMappings = skills.map((skill) => mapSkillToTaxonomy(skill));
    
    const skillsToAdd: IdentifiedSkill[] = [];

    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];
      const category = categories[i] || "Unknown";
      const taxonomyMatch = taxonomyMappings[i];
      const shouldUseMatchedSkill = taxonomyMatch.confidence >= 0.5;
      const normalizedSkill = shouldUseMatchedSkill ? taxonomyMatch.skill : skill;
      const normalizedCategory = shouldUseMatchedSkill
        ? taxonomyMatch.category
        : normalizeTaxonomyCategoryName(category);
      const storedConfidence = confidences[i] ?? taxonomyMatch.confidence;

      // Check if skill already exists using Set (O(1) instead of O(N))
      if (existingSkillNames.has(normalizedSkill)) {
        continue;
      }

      const newSkill: IdentifiedSkill = {
        skill: normalizedSkill,
        category: normalizedCategory,
        dateIdentified: new Date().toISOString(),
        source,
        confidence: storedConfidence,
      };

      skillsToAdd.push(newSkill);
    }

    if (skillsToAdd.length === 0) {
      return; // No new skills to save
    }

    existingData.skills.push(...skillsToAdd);
    existingData.lastUpdated = new Date().toISOString();
    await setJSONInStorage(SKILLS_STORAGE_KEY, existingData);
    console.log("Multiple skills saved:", skillsToAdd.length);

    enqueueFirestoreWrite(async () => {
      const [userId, sessionId] = await Promise.all([getUserId(), getActiveSessionId()]);
      
      // Use pre-computed mappings instead of recalculating
      const normalizedSkills = skillsToAdd.map((skill) => skill.skill);
      const normalizedCategories = skillsToAdd.map((skill) => skill.category);

      await saveIdentifiedSkillsToFirestore(
        userId,
        normalizedSkills,
        normalizedCategories,
        source,
        sessionId
      );
    });
  } catch (error) {
    console.error("Error saving multiple skills:", error);
    throw error;
  }
}

/**
 * Get all user's identified skills
 */
export async function getUserSkills(): Promise<UserSkillsData> {
  return getJSONFromStorage(SKILLS_STORAGE_KEY, {
    skills: [],
    lastUpdated: new Date().toISOString(),
  });
}

/**
 * Get user's identified skill names only (simple array)
 */
export async function getUserSkillNames(): Promise<string[]> {
  const data = await getUserSkills();
  return data.skills.map((s) => s.skill);
}

/**
 * Check if user has a specific skill
 */
export async function hasSkill(skillName: string): Promise<boolean> {
  const data = await getUserSkills();
  return data.skills.some((s) => s.skill === skillName);
}

/**
 * Get skills by category
 */
export async function getSkillsByCategory(category: string): Promise<IdentifiedSkill[]> {
  const data = await getUserSkills();
  return data.skills.filter((s) => s.category === category);
}

/**
 * Remove a skill
 */
export async function removeSkill(skillName: string): Promise<void> {
  try {
    const data = await getUserSkills();
    data.skills = data.skills.filter((s) => s.skill !== skillName);
    data.lastUpdated = new Date().toISOString();

    await setJSONInStorage(SKILLS_STORAGE_KEY, data);
    console.log("Skill removed:", skillName);
  } catch (error) {
    console.error("Error removing skill:", error);
    throw error;
  }
}

/**
 * Clear all skills
 */
export async function clearAllSkills(): Promise<void> {
  try {
    await removeFromStorage(SKILLS_STORAGE_KEY);
    console.log("All skills cleared");
  } catch (error) {
    console.error("Error clearing skills:", error);
    throw error;
  }
}

/**
 * Get statistics about user's skills
 */
export async function getSkillsStats(): Promise<{
  totalSkills: number;
  skillsByCategory: { [category: string]: number };
  skillsBySource: { [source: string]: number };
  recentSkills: IdentifiedSkill[];
}> {
  const data = await getUserSkills();

  const skillsByCategory: { [category: string]: number } = {};
  const skillsBySource: { [source: string]: number } = {};

  data.skills.forEach((skill) => {
    skillsByCategory[skill.category] = (skillsByCategory[skill.category] || 0) + 1;
    skillsBySource[skill.source] = (skillsBySource[skill.source] || 0) + 1;
  });

  // Get 5 most recent skills
  const recentSkills = [...data.skills]
    .sort((a, b) => new Date(b.dateIdentified).getTime() - new Date(a.dateIdentified).getTime())
    .slice(0, 5);

  return {
    totalSkills: data.skills.length,
    skillsByCategory,
    skillsBySource,
    recentSkills,
  };
}

/**
 * Get all taxonomy skills with identified status
 * Returns array of skills with flag indicating if user has identified them
 */
export async function getTaxonomySkillsWithStatus(): Promise<
  {
    category: string;
    skills: {
      name: string;
      identified: boolean;
      dateIdentified?: string;
      confidence?: number;
    }[];
  }[]
> {
  const userData = await getUserSkills();

  const result = Object.entries(SKILLS_TAXONOMY).map(([category, skills]) => ({
    category,
    skills: skills.map((skillName) => ({
      name: skillName,
      identified: userData.skills.some((s) => {
        const matchedSkill = mapSkillToTaxonomy(s.skill);
        return (
          s.skill === skillName ||
          matchedSkill.skill === skillName ||
          normalizeTaxonomyCategoryName(s.category) === category
        );
      }),
      dateIdentified: userData.skills.find((s) => {
        const matchedSkill = mapSkillToTaxonomy(s.skill);
        return (
          s.skill === skillName ||
          matchedSkill.skill === skillName ||
          normalizeTaxonomyCategoryName(s.category) === category
        );
      })?.dateIdentified,
      confidence: userData.skills.find((s) => {
        const matchedSkill = mapSkillToTaxonomy(s.skill);
        return (
          s.skill === skillName ||
          matchedSkill.skill === skillName ||
          normalizeTaxonomyCategoryName(s.category) === category
        );
      })?.confidence,
    })),
  }));

  return result;
}
