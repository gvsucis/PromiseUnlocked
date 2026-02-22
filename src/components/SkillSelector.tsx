import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Searchbar, Chip, Text, Card, Title } from 'react-native-paper';
import {
  mapSkillToTaxonomy,
  getAllSkills,
  SKILLS_TAXONOMY,
} from '../services/skillTaxonomyService';

interface SkillSelectorProps {
  readonly onSkillSelect: (skill: string, category: string) => void;
  readonly selectedSkills?: string[];
}

export default function SkillSelector({
  onSkillSelect,
  selectedSkills = [],
}: Readonly<SkillSelectorProps>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestion, setSuggestion] = useState<{
    skill: string;
    category: string;
    confidence: number;
  } | null>(null);

  // Get all skills from taxonomy
  const allSkills = useMemo(() => getAllSkills(), []);

  // Handle search input change
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);

    if (query.trim().length > 2) {
      // Map user input to taxonomy
      const mapped = mapSkillToTaxonomy(query);

      if (mapped.confidence > 0.5) {
        setSuggestion(mapped);
      } else {
        setSuggestion(null);
      }
    } else {
      setSuggestion(null);
    }
  };

  // Handle skill selection from suggestion
  const handleSelectSuggestion = () => {
    if (suggestion) {
      onSkillSelect(suggestion.skill, suggestion.category);
      setSearchQuery('');
      setSuggestion(null);
    }
  };

  // Filter skills based on search query
  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    return allSkills.filter((skill) => skill.toLowerCase().includes(query)).slice(0, 10); // Limit to 10 results
  }, [searchQuery, allSkills]);

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search or type a skill..."
        onChangeText={handleSearchChange}
        value={searchQuery}
        style={styles.searchBar}
      />

      {/* Best Match Suggestion */}
      {suggestion && suggestion.confidence > 0.5 && (
        <Card style={styles.suggestionCard} onPress={handleSelectSuggestion}>
          <Card.Content>
            <View style={styles.suggestionHeader}>
              <Text style={styles.suggestionLabel}>Best Match:</Text>
              <Chip
                mode="flat"
                style={[
                  styles.confidenceChip,
                  {
                    backgroundColor:
                      suggestion.confidence > 0.8
                        ? '#4CAF50'
                        : suggestion.confidence > 0.6
                          ? '#FF9800'
                          : '#FFC107',
                  },
                ]}
                textStyle={styles.confidenceText}
              >
                {Math.round(suggestion.confidence * 100)}% match
              </Chip>
            </View>
            <Title style={styles.suggestionSkill}>{suggestion.skill}</Title>
            <Text style={styles.suggestionCategory}>Category: {suggestion.category}</Text>
            <Text style={styles.tapHint}>👆 Tap to select this skill</Text>
          </Card.Content>
        </Card>
      )}

      {/* Filtered Skills List */}
      {filteredSkills.length > 0 && !suggestion && (
        <Card style={styles.resultsCard}>
          <Card.Content>
            <Text style={styles.resultsTitle}>Matching Skills from Taxonomy:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.skillsScroll}
            >
              {filteredSkills.map((skill, index) => (
                <Chip
                  key={index}
                  mode="outlined"
                  onPress={() => {
                    const category =
                      Object.entries(SKILLS_TAXONOMY).find(([_, skills]) =>
                        skills.includes(skill)
                      )?.[0] || 'Unknown';
                    onSkillSelect(skill, category);
                  }}
                  style={[styles.skillChip, selectedSkills.includes(skill) && styles.selectedChip]}
                  textStyle={styles.skillChipText}
                  selected={selectedSkills.includes(skill)}
                >
                  {skill}
                </Chip>
              ))}
            </ScrollView>
          </Card.Content>
        </Card>
      )}

      {/* Instructions when empty */}
      {!searchQuery.trim() && (
        <Card style={styles.instructionCard}>
          <Card.Content>
            <Text style={styles.instructionText}>
              Start typing a skill name (e.g., "programming", "teamwork", "design") and we'll help
              you find the best match from our skills taxonomy.
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* No matches message */}
      {searchQuery.trim().length > 2 && !suggestion && filteredSkills.length === 0 && (
        <Card style={styles.noMatchCard}>
          <Card.Content>
            <Text style={styles.noMatchText}>
              No exact matches found. Try using different words or check our skills taxonomy below.
            </Text>
          </Card.Content>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  searchBar: {
    marginBottom: 15,
    elevation: 2,
  },
  suggestionCard: {
    marginBottom: 15,
    elevation: 4,
    backgroundColor: '#f0f8ff',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  suggestionLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  confidenceChip: {
    elevation: 0,
  },
  confidenceText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  suggestionSkill: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 5,
  },
  suggestionCategory: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
  },
  tapHint: {
    fontSize: 12,
    color: '#667eea',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  resultsCard: {
    marginBottom: 15,
    elevation: 2,
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  skillsScroll: {
    flexDirection: 'row',
  },
  skillChip: {
    marginRight: 8,
    marginBottom: 8,
    borderColor: '#667eea',
  },
  selectedChip: {
    backgroundColor: '#667eea',
  },
  skillChipText: {
    fontSize: 13,
  },
  instructionCard: {
    marginTop: 10,
    elevation: 1,
    backgroundColor: '#f9f9f9',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
  },
  noMatchCard: {
    marginTop: 10,
    elevation: 1,
    backgroundColor: '#fff3cd',
  },
  noMatchText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
    textAlign: 'center',
  },
});
