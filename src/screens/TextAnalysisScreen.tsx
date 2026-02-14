import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { GeminiService } from '../services/geminiService';

type TextAnalysisScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TextAnalysis'>;

interface Props {
  navigation: TextAnalysisScreenNavigationProp;
}

const SKILLS_TAXONOMY = {
  'Human Skills': [
    'Communication',
    'Collaboration',
    'Leadership',
    'Empathy',
    'Active Listening',
    'Conflict Resolution',
    'Networking',
    'Public Speaking',
    'Team Management',
  ],
  'Meta-Learning': [
    'Critical Thinking',
    'Research Skills',
    'Self-Reflection',
    'Learning Strategies',
    'Information Synthesis',
    'Knowledge Transfer',
    'Continuous Learning',
    'Adaptability',
  ],
  'Maker & Builder': [
    'Prototyping',
    'Design Thinking',
    'Craftsmanship',
    'Innovation',
    'Technical Skills',
    'Project Management',
    'Problem Solving',
    'Creative Construction',
    'Engineering',
  ],
  'Civic Impact': [
    'Community Engagement',
    'Social Responsibility',
    'Advocacy',
    'Volunteer Work',
    'Policy Understanding',
    'Cultural Awareness',
    'Environmental Stewardship',
    'Civic Participation',
  ],
  'Creative Expression': [
    'Artistic Creation',
    'Storytelling',
    'Music',
    'Writing',
    'Visual Arts',
    'Performance',
    'Creative Problem Solving',
    'Imagination',
    'Aesthetic Appreciation',
  ],
  'Problem-Solving': [
    'Analytical Thinking',
    'Strategic Planning',
    'Troubleshooting',
    'Decision Making',
    'Systems Thinking',
    'Root Cause Analysis',
    'Innovation',
    'Logic',
    'Pattern Recognition',
  ],
  'Work Experience': [
    'Professional Skills',
    'Industry Knowledge',
    'Workplace Etiquette',
    'Time Management',
    'Client Relations',
    'Business Acumen',
    'Career Development',
    'Mentorship',
  ],
  'Future Self': [
    'Goal Setting',
    'Vision Creation',
    'Personal Growth',
    'Skill Development',
    'Career Planning',
    'Life Balance',
    'Self-Improvement',
    'Aspiration Mapping',
  ],
};

interface AnalysisResult {
  activity_description: string;
  primary_skills: string[];
  taxonomy_categories: string[];
  skill_development_insights: string;
  flow_state_potential: string;
  growth_opportunities: string;
  confidence_level: string;
}

export default function TextAnalysisScreen({ navigation }: Props) {
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeText = async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const analysisPrompt = `
Analyze the following text where someone describes an activity they do. Based on the content, analyze it using this skills taxonomy framework:

SKILLS TAXONOMY:
${Object.entries(SKILLS_TAXONOMY)
  .map(([category, skills]) => `${category}: ${skills.join(', ')}`)
  .join('\n')}

TEXT TO ANALYZE: "${inputText}"

Please provide a detailed analysis and return it as a JSON object with this exact structure:
{
  "activity_description": "Brief description of the activity based on the text",
  "primary_skills": ["List of 3-5 most relevant skills from the taxonomy"],
  "taxonomy_categories": ["List of 2-3 most relevant category names"],
  "skill_development_insights": "Analysis of how this activity develops skills and what it reveals about interests",
  "flow_state_potential": "Explanation of why this activity might cause someone to lose track of time",
  "growth_opportunities": "Suggestions for related skills or activities to explore",
  "confidence_level": "High/Medium/Low - confidence level based on text clarity and detail"
}

Analyze the text carefully and provide thoughtful insights about the skills being demonstrated or developed through the described activity. Return only valid JSON.`;

      const response = await GeminiService.processTranscriptText(analysisPrompt);

      if (!response) {
        throw new Error('No response received from analysis service');
      }

      // Try to extract JSON from the response
      let jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse analysis response');
      }

      const parsedResult: AnalysisResult = JSON.parse(jsonMatch[0]);
      setAnalysisResult(parsedResult);
    } catch (error) {
      console.error('Error analyzing text:', error);
      setError(error instanceof Error ? error.message : 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setInputText('');
    setAnalysisResult(null);
    setError(null);
  };

  const navigateWithResults = () => {
    if (analysisResult) {
      // Create a result object that matches the expected format
      const mockResult = {
        success: true,
        data: analysisResult as any, // Cast to any to bypass type checking
        rawResponse: JSON.stringify(analysisResult),
      };
      navigation.navigate('Result', { result: mockResult });
    }
  };

  const generateFollowUpQuestion = (data: AnalysisResult): string => {
    const categories = data.taxonomy_categories || [];
    const skills = data.primary_skills || [];
    if (categories.includes('Creative Expression')) {
      return 'Would you create a small piece this week (e.g., a 60-second reel, a sketch, or a short story) to explore this interest?';
    }
    if (categories.includes('Maker & Builder')) {
      return 'What quick prototype could you build in the next 2–3 hours to test an idea from this activity?';
    }
    if (categories.includes('Meta-Learning')) {
      return 'What is one question you’re curious about here, and how would you research it?';
    }
    if (categories.includes('Human Skills')) {
      return 'Who could you share or collaborate with this week to amplify your impact or get feedback?';
    }
    if (categories.includes('Problem-Solving')) {
      return 'What challenge did you hit during this activity, and how might you approach it differently next time?';
    }
    if (categories.includes('Civic Impact')) {
      return 'Is there a community or cause that could benefit from this—what’s one small action you could take?';
    }
    if (categories.includes('Work Experience')) {
      return 'Is there a real-world context (internship, freelance, volunteer) where you could apply this in the next month?';
    }
    if (categories.includes('Future Self')) {
      return 'If this became part of your routine, what would “leveling up” look like in 30 days?';
    }
    if (skills.length > 0) {
      return `Which part of this activity best builds ${skills[0]}, and how could you double that time next week?`;
    }
    return 'What is one small next step you could take to explore this interest further?';
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Text Activity Analysis</Text>
            <Text style={styles.subtitle}>
              Describe an activity you enjoy and we'll analyze it using our skills taxonomy
            </Text>
          </View>

          <Card style={styles.inputCard}>
            <Card.Content>
              <Title style={styles.cardTitle}>Describe Your Activity</Title>
              <TextInput
                mode="outlined"
                placeholder="Example: I love cooking elaborate meals for my family. I spend hours researching recipes, planning ingredients, and experimenting with new techniques..."
                value={inputText}
                onChangeText={setInputText}
                multiline
                numberOfLines={6}
                style={styles.textInput}
                theme={{
                  colors: {
                    primary: '#667eea',
                    outline: '#ccc',
                  },
                }}
                autoCorrect={true}
              />

              <View style={styles.buttonContainer}>
                <Button
                  mode="contained"
                  onPress={analyzeText}
                  disabled={isAnalyzing || !inputText.trim()}
                  loading={isAnalyzing}
                  style={styles.analyzeButton}
                  icon={isAnalyzing ? undefined : 'brain'}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Activity'}
                </Button>

                {inputText && (
                  <Button
                    mode="outlined"
                    onPress={resetAnalysis}
                    style={styles.clearButton}
                    textColor="#667eea"
                  >
                    Clear
                  </Button>
                )}
              </View>
            </Card.Content>
          </Card>

          {error && (
            <Card style={styles.errorCard}>
              <Card.Content>
                <Title style={styles.errorTitle}>Analysis Error</Title>
                <Paragraph style={styles.errorText}>{error}</Paragraph>
              </Card.Content>
            </Card>
          )}

          {analysisResult && (
            <>
              <Card style={styles.resultCard}>
                <Card.Content>
                  <View style={styles.cardTitleContainer}>
                    <MaterialIcons name="track-changes" size={22} color="#667eea" />
                    <Title style={styles.cardTitle}>Activity Identified</Title>
                  </View>
                  <Paragraph style={styles.resultText}>
                    {analysisResult.activity_description}
                  </Paragraph>
                </Card.Content>
              </Card>

              <Card style={styles.resultCard}>
                <Card.Content>
                  <Title style={styles.cardTitle}>🛠️ Primary Skills</Title>
                  <View style={styles.skillsContainer}>
                    {analysisResult.primary_skills?.map((skill, index) => (
                      <Chip key={index} style={styles.skillChip} textStyle={styles.chipText}>
                        {skill}
                      </Chip>
                    ))}
                  </View>
                </Card.Content>
              </Card>

              <Card style={styles.resultCard}>
                <Card.Content>
                  <Title style={styles.cardTitle}>📚 Skill Categories</Title>
                  <View style={styles.categoriesContainer}>
                    {analysisResult.taxonomy_categories?.map((category, index) => (
                      <Chip key={index} style={styles.categoryChip} textStyle={styles.chipText}>
                        {category}
                      </Chip>
                    ))}
                  </View>
                </Card.Content>
              </Card>

              <Card style={styles.resultCard}>
                <Card.Content>
                  <Title style={styles.cardTitle}>⏰ Flow State Potential</Title>
                  <Paragraph style={styles.resultText}>
                    {analysisResult.flow_state_potential}
                  </Paragraph>
                </Card.Content>
              </Card>

              <Card style={styles.resultCard}>
                <Card.Content>
                  <View style={styles.cardTitleContainer}>
                    <MaterialIcons name="lightbulb" size={22} color="#667eea" />
                    <Title style={styles.cardTitle}>Development Insights</Title>
                  </View>
                  <Paragraph style={styles.resultText}>
                    {analysisResult.skill_development_insights}
                  </Paragraph>
                </Card.Content>
              </Card>

              <Card style={styles.resultCard}>
                <Card.Content>
                  <View style={styles.cardTitleContainer}>
                    <MaterialIcons name="trending-up" size={22} color="#667eea" />
                    <Title style={styles.cardTitle}>Growth Opportunities</Title>
                  </View>
                  <Paragraph style={styles.resultText}>
                    {analysisResult.growth_opportunities}
                  </Paragraph>
                </Card.Content>
              </Card>

              <Card
                style={styles.resultCard}
                onPress={() =>
                  navigation.navigate('FollowUpQuestion', {
                    question: generateFollowUpQuestion(analysisResult),
                    context: analysisResult,
                  })
                }
              >
                <Card.Content>
                  <View style={styles.cardTitleContainer}>
                    <MaterialIcons name="extension" size={22} color="#667eea" />
                    <Title style={styles.cardTitle}>Follow-up Question</Title>
                  </View>
                  <Paragraph style={styles.resultText}>
                    {generateFollowUpQuestion(analysisResult)}
                  </Paragraph>
                  <Paragraph style={styles.tapHint}>👆 Tap to answer this question</Paragraph>
                </Card.Content>
              </Card>

              <View style={styles.actionButtons}>
                <Button
                  mode="outlined"
                  onPress={navigateWithResults}
                  style={styles.actionButton}
                  textColor="#667eea"
                >
                  View Full Results
                </Button>
                <Button
                  mode="contained"
                  onPress={() => navigation.navigate('Dashboard')}
                  style={[styles.actionButton, styles.dashboardButton]}
                >
                  View Dashboard
                </Button>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  inputCard: {
    marginBottom: 20,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: 'white',
    marginBottom: 16,
    minHeight: 120,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  analyzeButton: {
    flex: 1,
    backgroundColor: '#667eea',
    marginRight: 8,
  },
  clearButton: {
    borderColor: '#667eea',
  },
  errorCard: {
    marginBottom: 20,
    backgroundColor: '#ffebee',
    elevation: 4,
  },
  errorTitle: {
    color: '#d32f2f',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#d32f2f',
    marginTop: 8,
  },
  resultCard: {
    marginBottom: 16,
    elevation: 4,
  },
  resultText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555',
  },
  tapHint: {
    fontSize: 12,
    color: '#667eea',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  skillChip: {
    margin: 3,
    backgroundColor: '#e3f2fd',
  },
  categoryChip: {
    margin: 3,
    backgroundColor: '#f3e5f5',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  dashboardButton: {
    backgroundColor: '#667eea',
  },
});
