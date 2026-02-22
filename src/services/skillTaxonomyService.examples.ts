/**
 * Skill Taxonomy Service - Usage Examples
 *
 * This file demonstrates how to use the skill mapping functionality
 */

import {
  mapSkillToTaxonomy,
  mapSkillsToTaxonomy,
  normalizeSkills,
  SKILLS_TAXONOMY,
} from '../services/skillTaxonomyService';

// Example 1: Map a single user skill to the taxonomy
export function example1_SingleSkillMapping() {
  const userInput = 'programming';
  const result = mapSkillToTaxonomy(userInput);

  console.log('Input:', userInput);
  console.log('Mapped to:', result.skill);
  console.log('Category:', result.category);
  console.log('Confidence:', result.confidence);

  // Output:
  // Input: programming
  // Mapped to: Technical Skills
  // Category: Maker & Builder
  // Confidence: 0.85
}

// Example 2: Map multiple skills with variations
export function example2_MultipleSkillsMapping() {
  const userSkills = [
    'teamwork',
    'coding',
    'public speaking',
    'managing projects',
    'creative thinking',
  ];

  const results = mapSkillsToTaxonomy(userSkills);

  console.log('User Skills:', userSkills);
  console.log('Mapped Results:');
  results.forEach((r) => {
    console.log(`  - ${r.skill} (${r.category}) - ${Math.round(r.confidence * 100)}%`);
  });

  // Output:
  // User Skills: ["teamwork", "coding", "public speaking", "managing projects", "creative thinking"]
  // Mapped Results:
  //   - Collaboration (Human Skills) - 85%
  //   - Technical Skills (Maker & Builder) - 80%
  //   - Public Speaking (Human Skills) - 100%
  //   - Project Management (Maker & Builder) - 90%
  //   - Critical Thinking (Meta-Learning) - 75%
}

// Example 3: Normalize skills (removes duplicates and low-confidence matches)
export function example3_NormalizeSkills() {
  const userSkills = [
    'communication',
    'communicating', // Duplicate/similar
    'teamwork',
    'collaboration', // Similar to teamwork
    'random skill xyz', // Low confidence
    'leadership',
  ];

  const normalized = normalizeSkills(userSkills);

  console.log('Input:', userSkills);
  console.log('Normalized:', normalized);

  // Output:
  // Input: ["communication", "communicating", "teamwork", "collaboration", "random skill xyz", "leadership"]
  // Normalized: ["Communication", "Collaboration", "Leadership"]
  // Note: Duplicates removed, low-confidence matches filtered out
}

// Example 4: Use in an API response processor
export function example4_ProcessAPIResponse(apiResponse: any) {
  // Simulate API returning skills that might not match taxonomy exactly
  const rawSkills = apiResponse.primary_skills || [
    'problem solving',
    'creative design',
    'team collaboration',
    'public presentations',
  ];

  // Normalize to match taxonomy
  const normalizedSkills = normalizeSkills(rawSkills);

  // Update the response
  const processedResponse = {
    ...apiResponse,
    primary_skills: normalizedSkills,
    original_skills: rawSkills, // Keep original for reference
  };

  return processedResponse;
}

// Example 5: Interactive skill selector (for UI components)
export function example5_InteractiveSelection(userInput: string) {
  const mapped = mapSkillToTaxonomy(userInput);

  if (mapped.confidence > 0.8) {
    return {
      status: 'high_confidence',
      message: `Great match! We found "${mapped.skill}" in our ${mapped.category} category.`,
      skill: mapped.skill,
      category: mapped.category,
    };
  } else if (mapped.confidence > 0.5) {
    return {
      status: 'medium_confidence',
      message: `Did you mean "${mapped.skill}"? (from ${mapped.category})`,
      skill: mapped.skill,
      category: mapped.category,
    };
  } else {
    return {
      status: 'low_confidence',
      message: `We couldn't find a good match. Try selecting from our skills taxonomy.`,
      skill: null,
      category: null,
    };
  }
}

// Example 6: Get suggestions based on partial input
export function example6_GetSuggestions(partialInput: string) {
  const allSkills = Object.values(SKILLS_TAXONOMY).flat();

  const suggestions = allSkills
    .filter((skill) => skill.toLowerCase().includes(partialInput.toLowerCase()))
    .slice(0, 5); // Top 5 suggestions

  return suggestions;
}

// Usage in a React Component:
/*
import { mapSkillToTaxonomy } from '../services/skillTaxonomyService';

function MyComponent() {
  const [userInput, setUserInput] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  
  const handleInput = (text) => {
    setUserInput(text);
    
    if (text.length > 2) {
      const mapped = mapSkillToTaxonomy(text);
      if (mapped.confidence > 0.5) {
        setSuggestion(mapped);
      }
    }
  };
  
  return (
    <View>
      <TextInput 
        value={userInput}
        onChangeText={handleInput}
        placeholder="Enter a skill..."
      />
      {suggestion && (
        <Text>
          Did you mean: {suggestion.skill} ({suggestion.category})?
        </Text>
      )}
    </View>
  );
}
*/
