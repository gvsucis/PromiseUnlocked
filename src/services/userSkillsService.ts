/**
 * User Skills Storage Service
 * Manages identified skills in AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SKILLS_TAXONOMY } from './skillTaxonomyService';

const SKILLS_STORAGE_KEY = '@user_identified_skills';

export interface IdentifiedSkill {
  skill: string;
  category: string;
  dateIdentified: string;
  source: 'image' | 'voice' | 'text'; // How the skill was identified
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
  source: 'image' | 'voice' | 'text',
  confidence?: number
): Promise<void> {
  try {
    const existingData = await getUserSkills();

    // Check if skill already exists
    const skillExists = existingData.skills.some((s) => s.skill === skill);

    if (!skillExists) {
      const newSkill: IdentifiedSkill = {
        skill,
        category,
        dateIdentified: new Date().toISOString(),
        source,
        confidence,
      };

      existingData.skills.push(newSkill);
      existingData.lastUpdated = new Date().toISOString();

      await AsyncStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(existingData));
      console.log('Skill saved:', skill);
    } else {
      console.log('Skill already exists:', skill);
    }
  } catch (error) {
    console.error('Error saving skill:', error);
    throw error;
  }
}

/**
 * Save multiple identified skills
 */
export async function saveIdentifiedSkills(
  skills: string[],
  categories: string[],
  source: 'image' | 'voice' | 'text'
): Promise<void> {
  try {
    const existingData = await getUserSkills();

    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];
      const category = categories[i] || 'Unknown';

      // Check if skill already exists
      const skillExists = existingData.skills.some((s) => s.skill === skill);

      if (!skillExists) {
        const newSkill: IdentifiedSkill = {
          skill,
          category,
          dateIdentified: new Date().toISOString(),
          source,
        };

        existingData.skills.push(newSkill);
      }
    }

    existingData.lastUpdated = new Date().toISOString();
    await AsyncStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(existingData));
    console.log('Multiple skills saved:', skills.length);
  } catch (error) {
    console.error('Error saving multiple skills:', error);
    throw error;
  }
}

/**
 * Get all user's identified skills
 */
export async function getUserSkills(): Promise<UserSkillsData> {
  try {
    const data = await AsyncStorage.getItem(SKILLS_STORAGE_KEY);

    if (data) {
      return JSON.parse(data);
    }

    // Return empty data if none exists
    return {
      skills: [],
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting user skills:', error);
    return {
      skills: [],
      lastUpdated: new Date().toISOString(),
    };
  }
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

    await AsyncStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(data));
    console.log('Skill removed:', skillName);
  } catch (error) {
    console.error('Error removing skill:', error);
    throw error;
  }
}

/**
 * Clear all skills
 */
export async function clearAllSkills(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SKILLS_STORAGE_KEY);
    console.log('All skills cleared');
  } catch (error) {
    console.error('Error clearing skills:', error);
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
    }[];
  }[]
> {
  const userData = await getUserSkills();
  const identifiedSkillNames = userData.skills.map((s) => s.skill);

  const result = Object.entries(SKILLS_TAXONOMY).map(([category, skills]) => ({
    category,
    skills: skills.map((skillName) => ({
      name: skillName,
      identified: identifiedSkillNames.includes(skillName),
      dateIdentified: userData.skills.find((s) => s.skill === skillName)?.dateIdentified,
    })),
  }));

  return result;
}
