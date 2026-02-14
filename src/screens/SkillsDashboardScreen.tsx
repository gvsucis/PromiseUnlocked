import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Chip, ProgressBar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import {
  getUserSkills,
  getSkillsStats,
  getTaxonomySkillsWithStatus,
  IdentifiedSkill,
} from '../services/userSkillsService';
import { SKILLS_TAXONOMY } from '../services/skillTaxonomyService';

const { width } = Dimensions.get('window');

type SkillsDashboardScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'SkillsDashboard'
>;
type SkillsDashboardScreenRouteProp = RouteProp<RootStackParamList, 'SkillsDashboard'>;

interface Props {
  navigation: SkillsDashboardScreenNavigationProp;
  route: SkillsDashboardScreenRouteProp;
}

export default function SkillsDashboardScreen({ navigation, route }: Props) {
  const [loading, setLoading] = useState(true);
  const [userSkills, setUserSkills] = useState<IdentifiedSkill[]>([]);
  const [skillsStats, setSkillsStats] = useState<any>(null);
  const [taxonomySkills, setTaxonomySkills] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedView, setSelectedView] = useState<'overview' | 'taxonomy' | 'timeline'>(
    'overview'
  );

  // No route params expected for SkillsDashboard

  useEffect(() => {
    loadSkillsData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadSkillsData();
    });
    return unsubscribe;
  }, [navigation]);

  const loadSkillsData = async () => {
    setLoading(true);
    try {
      const [skills, stats, taxonomy] = await Promise.all([
        getUserSkills(),
        getSkillsStats(),
        getTaxonomySkillsWithStatus(),
      ]);

      setUserSkills(skills.skills);
      setSkillsStats(stats);
      setTaxonomySkills(taxonomy);
    } catch (error) {
      console.error('Error loading skills:', error);
      Alert.alert('Error', 'Failed to load skills data');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string): string => {
    const icons: { [key: string]: string } = {
      'Human Skills': 'people',
      'Meta-Learning': 'psychology',
      'Maker & Builder': 'construction',
      'Civic Impact': 'public',
      'Creative Expression': 'palette',
      'Problem-Solving': 'lightbulb',
      'Work Experience': 'work',
      'Future Self': 'rocket-launch',
    };
    return icons[category] || 'star';
  };

  const getCategoryColor = (category: string): string => {
    const colors: { [key: string]: string } = {
      'Human Skills': '#FF6B6B',
      'Meta-Learning': '#4ECDC4',
      'Maker & Builder': '#95E1D3',
      'Civic Impact': '#F38181',
      'Creative Expression': '#AA96DA',
      'Problem-Solving': '#FCBAD3',
      'Work Experience': '#A8D8EA',
      'Future Self': '#FFCB77',
    };
    return colors[category] || '#667eea';
  };

  const getSourceIcon = (source: string): string => {
    const icons: { [key: string]: string } = {
      image: 'photo-camera',
      voice: 'mic',
      text: 'edit',
    };
    return icons[source] || 'help';
  };

  const getTotalSkillsInTaxonomy = (): number => {
    return Object.values(SKILLS_TAXONOMY).reduce((sum, skills) => sum + skills.length, 0);
  };

  const getCompletionPercentage = (): number => {
    const total = getTotalSkillsInTaxonomy();
    const identified = userSkills.length;
    return Math.round((identified / total) * 100);
  };

  const getCategoryProgress = (
    category: string
  ): { identified: number; total: number; percentage: number } => {
    const categorySkills = SKILLS_TAXONOMY[category as keyof typeof SKILLS_TAXONOMY] || [];
    const total = categorySkills.length;
    const identified = userSkills.filter((s) => s.category === category).length;
    const percentage = total > 0 ? Math.round((identified / total) * 100) : 0;
    return { identified, total, percentage };
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const filteredSkills =
    selectedCategory === 'All'
      ? userSkills
      : userSkills.filter((s) => s.category === selectedCategory);

  const categories = ['All', ...Object.keys(SKILLS_TAXONOMY)];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading your skills...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <MaterialIcons name="emoji-events" size={40} color="#fff" />
          <Text style={styles.title}>Your Skills Journey</Text>
          <Text style={styles.subtitle}>
            {userSkills.length} {userSkills.length === 1 ? 'skill' : 'skills'} identified
          </Text>
        </View>

        {/* View Selector */}
        <Card style={styles.viewSelectorCard}>
          <Card.Content>
            <View style={styles.viewSelector}>
              <TouchableOpacity
                style={[styles.viewButton, selectedView === 'overview' && styles.viewButtonActive]}
                onPress={() => setSelectedView('overview')}
              >
                <MaterialIcons
                  name="dashboard"
                  size={20}
                  color={selectedView === 'overview' ? '#fff' : '#667eea'}
                />
                <Text
                  style={[
                    styles.viewButtonText,
                    selectedView === 'overview' && styles.viewButtonTextActive,
                  ]}
                >
                  Overview
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.viewButton, selectedView === 'taxonomy' && styles.viewButtonActive]}
                onPress={() => setSelectedView('taxonomy')}
              >
                <MaterialIcons
                  name="grid-view"
                  size={20}
                  color={selectedView === 'taxonomy' ? '#fff' : '#667eea'}
                />
                <Text
                  style={[
                    styles.viewButtonText,
                    selectedView === 'taxonomy' && styles.viewButtonTextActive,
                  ]}
                >
                  All Skills
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.viewButton, selectedView === 'timeline' && styles.viewButtonActive]}
                onPress={() => setSelectedView('timeline')}
              >
                <MaterialIcons
                  name="timeline"
                  size={20}
                  color={selectedView === 'timeline' ? '#fff' : '#667eea'}
                />
                <Text
                  style={[
                    styles.viewButtonText,
                    selectedView === 'timeline' && styles.viewButtonTextActive,
                  ]}
                >
                  Timeline
                </Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>

        {/* Overall Progress */}
        <Card style={styles.progressCard}>
          <Card.Content>
            <View style={styles.progressHeader}>
              <MaterialIcons name="trending-up" size={24} color="#667eea" />
              <Text style={styles.progressTitle}>Your Skills Progress</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{userSkills.length}</Text>
                <Text style={styles.statLabel}>Skills Identified</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{getTotalSkillsInTaxonomy()}</Text>
                <Text style={styles.statLabel}>Total Skills</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{getCompletionPercentage()}%</Text>
                <Text style={styles.statLabel}>Completion</Text>
              </View>
            </View>

            <ProgressBar
              progress={getCompletionPercentage() / 100}
              color="#667eea"
              style={styles.progressBar}
            />
            <Text style={styles.progressHint}>Keep exploring to unlock more skills!</Text>
          </Card.Content>
        </Card>

        {/* Overview View */}
        {selectedView === 'overview' && (
          <>
            {/* Categories Overview */}
            <Card style={styles.categoriesCard}>
              <Card.Content>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="category" size={24} color="#667eea" />
                  <Text style={styles.sectionTitle}>Skills by Category</Text>
                </View>

                {Object.keys(SKILLS_TAXONOMY).map((category) => {
                  const progress = getCategoryProgress(category);
                  return (
                    <View key={category} style={styles.categoryProgressItem}>
                      <View style={styles.categoryProgressHeader}>
                        <View style={styles.categoryProgressTitleRow}>
                          <MaterialIcons
                            name={getCategoryIcon(category) as any}
                            size={20}
                            color={getCategoryColor(category)}
                          />
                          <Text style={styles.categoryProgressName}>{category}</Text>
                        </View>
                        <Text style={styles.categoryProgressNumbers}>
                          {progress.identified}/{progress.total}
                        </Text>
                      </View>
                      <ProgressBar
                        progress={progress.percentage / 100}
                        color={getCategoryColor(category)}
                        style={styles.categoryProgressBar}
                      />
                    </View>
                  );
                })}
              </Card.Content>
            </Card>

            {/* Recent Skills */}
            {skillsStats && skillsStats.recentSkills.length > 0 && (
              <Card style={styles.recentCard}>
                <Card.Content>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="access-time" size={24} color="#667eea" />
                    <Text style={styles.sectionTitle}>Recently Identified</Text>
                  </View>

                  {skillsStats.recentSkills.map((skill: IdentifiedSkill, index: number) => (
                    <View key={index} style={styles.recentSkillItem}>
                      <View style={styles.recentSkillLeft}>
                        <View
                          style={[
                            styles.recentSkillIcon,
                            { backgroundColor: getCategoryColor(skill.category) },
                          ]}
                        >
                          <MaterialIcons
                            name={getSourceIcon(skill.source) as any}
                            size={16}
                            color="#fff"
                          />
                        </View>
                        <View style={styles.recentSkillInfo}>
                          <Text style={styles.recentSkillName}>{skill.skill}</Text>
                          <Text style={styles.recentSkillCategory}>{skill.category}</Text>
                        </View>
                      </View>
                      <Text style={styles.recentSkillDate}>{formatDate(skill.dateIdentified)}</Text>
                    </View>
                  ))}
                </Card.Content>
              </Card>
            )}
          </>
        )}

        {/* Taxonomy View */}
        {selectedView === 'taxonomy' && (
          <>
            {/* Category Filter */}
            <Card style={styles.filterCard}>
              <Card.Content>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {categories.map((category) => (
                    <Chip
                      key={category}
                      mode={selectedCategory === category ? 'flat' : 'outlined'}
                      selected={selectedCategory === category}
                      onPress={() => setSelectedCategory(category)}
                      style={styles.filterChip}
                      textStyle={styles.filterChipText}
                    >
                      {category}
                    </Chip>
                  ))}
                </ScrollView>
              </Card.Content>
            </Card>

            {/* All Skills Grid */}
            {taxonomySkills
              .filter(({ category }) => selectedCategory === 'All' || category === selectedCategory)
              .map(({ category, skills }) => (
                <Card key={category} style={styles.taxonomyCard}>
                  <Card.Content>
                    <View style={styles.taxonomyCategoryHeader}>
                      <MaterialIcons
                        name={getCategoryIcon(category) as any}
                        size={24}
                        color={getCategoryColor(category)}
                      />
                      <Text
                        style={[
                          styles.taxonomyCategoryTitle,
                          { color: getCategoryColor(category) },
                        ]}
                      >
                        {category}
                      </Text>
                    </View>

                    <View style={styles.taxonomySkillsGrid}>
                      {skills.map(
                        (skill: { name: string; identified: boolean; dateIdentified?: string }) => (
                          <Chip
                            key={skill.name}
                            mode="flat"
                            selected={skill.identified}
                            style={[
                              styles.taxonomySkillChip,
                              skill.identified
                                ? { backgroundColor: getCategoryColor(category) }
                                : styles.taxonomySkillChipUnidentified,
                            ]}
                            textStyle={[
                              styles.taxonomySkillChipText,
                              skill.identified
                                ? styles.taxonomySkillChipTextIdentified
                                : styles.taxonomySkillChipTextUnidentified,
                            ]}
                            icon={() =>
                              skill.identified ? (
                                <MaterialIcons name="check-circle" size={16} color="#fff" />
                              ) : null
                            }
                          >
                            {skill.name}
                          </Chip>
                        )
                      )}
                    </View>
                  </Card.Content>
                </Card>
              ))}
          </>
        )}

        {/* Timeline View */}
        {selectedView === 'timeline' && (
          <Card style={styles.timelineCard}>
            <Card.Content>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="history" size={24} color="#667eea" />
                <Text style={styles.sectionTitle}>Your Skills Timeline</Text>
              </View>

              {userSkills.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="explore" size={60} color="#ccc" />
                  <Text style={styles.emptyStateText}>No skills identified yet</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Start analyzing activities to build your skills profile!
                  </Text>
                </View>
              ) : (
                <View style={styles.timelineList}>
                  {[...userSkills]
                    .sort(
                      (a, b) =>
                        new Date(b.dateIdentified).getTime() - new Date(a.dateIdentified).getTime()
                    )
                    .map((skill, index) => (
                      <View key={index} style={styles.timelineItem}>
                        <View style={styles.timelineDot}>
                          <View
                            style={[
                              styles.timelineDotInner,
                              { backgroundColor: getCategoryColor(skill.category) },
                            ]}
                          />
                        </View>
                        <View style={styles.timelineContent}>
                          <View style={styles.timelineSkillHeader}>
                            <Text style={styles.timelineSkillName}>{skill.skill}</Text>
                            <MaterialIcons
                              name={getSourceIcon(skill.source) as any}
                              size={16}
                              color="#999"
                            />
                          </View>
                          <Text style={styles.timelineSkillCategory}>{skill.category}</Text>
                          <Text style={styles.timelineSkillDate}>
                            {formatDate(skill.dateIdentified)}
                          </Text>
                        </View>
                      </View>
                    ))}
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Action Buttons */}
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Text style={styles.actionsTitle}>Continue Your Journey</Text>

            <Button
              mode="contained"
              icon="camera"
              onPress={() => navigation.navigate('Home')}
              style={[styles.actionButton, { backgroundColor: '#FF6B6B' }]}
              labelStyle={styles.actionButtonLabel}
            >
              Analyze with Photo
            </Button>

            <Button
              mode="contained"
              icon="mic"
              onPress={() => navigation.navigate('VoiceAnalysis')}
              style={[styles.actionButton, { backgroundColor: '#4ECDC4' }]}
              labelStyle={styles.actionButtonLabel}
            >
              Analyze with Voice
            </Button>

            <Button
              mode="contained"
              icon="edit"
              onPress={() => navigation.navigate('TextAnalysis')}
              style={[styles.actionButton, { backgroundColor: '#45B7D1' }]}
              labelStyle={styles.actionButtonLabel}
            >
              Analyze with Text
            </Button>
          </Card.Content>
        </Card>

        {/* Motivational Card */}
        {userSkills.length > 0 && (
          <Card style={styles.motivationCard}>
            <Card.Content>
              <Text style={styles.motivationText}>
                🌟 "{getMotivationalMessage(userSkills.length)}"
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

function getMotivationalMessage(skillCount: number): string {
  if (skillCount < 5)
    return 'Great start! Every skill you discover is a step toward understanding yourself better.';
  if (skillCount < 10)
    return "You're building momentum! Keep exploring what makes you lose track of time.";
  if (skillCount < 20)
    return "Impressive collection! You're uncovering the patterns in your passions.";
  if (skillCount < 30) return 'Amazing progress! Your skills map is taking shape beautifully.';
  return "Wow! You're a skill-discovering champion! Your self-awareness is truly remarkable.";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#667eea',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#fff',
  },
  scrollView: {
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
    color: '#fff',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 5,
  },
  viewSelectorCard: {
    marginBottom: 15,
    elevation: 4,
  },
  viewSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  viewButtonActive: {
    backgroundColor: '#667eea',
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
  },
  viewButtonTextActive: {
    color: '#fff',
  },
  progressCard: {
    marginBottom: 15,
    elevation: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#667eea',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  progressHint: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  categoriesCard: {
    marginBottom: 15,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  categoryProgressItem: {
    marginBottom: 15,
  },
  categoryProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryProgressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryProgressName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  categoryProgressNumbers: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  categoryProgressBar: {
    height: 8,
    borderRadius: 4,
  },
  recentCard: {
    marginBottom: 15,
    elevation: 4,
  },
  recentSkillItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recentSkillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  recentSkillIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentSkillInfo: {
    flex: 1,
  },
  recentSkillName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  recentSkillCategory: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  recentSkillDate: {
    fontSize: 12,
    color: '#999',
  },
  filterCard: {
    marginBottom: 15,
    elevation: 4,
  },
  filterChip: {
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 13,
  },
  taxonomyCard: {
    marginBottom: 15,
    elevation: 4,
  },
  taxonomyCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  taxonomyCategoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  taxonomySkillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  taxonomySkillChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  taxonomySkillChipUnidentified: {
    backgroundColor: '#e0e0e0',
  },
  taxonomySkillChipText: {
    fontSize: 13,
  },
  taxonomySkillChipTextIdentified: {
    color: '#fff',
    fontWeight: '600',
  },
  taxonomySkillChipTextUnidentified: {
    color: '#999',
  },
  timelineCard: {
    marginBottom: 15,
    elevation: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 15,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  timelineList: {
    paddingTop: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineDot: {
    width: 40,
    alignItems: 'center',
    paddingTop: 5,
  },
  timelineDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: '#fff',
  },
  timelineContent: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginLeft: 10,
  },
  timelineSkillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  timelineSkillName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  timelineSkillCategory: {
    fontSize: 13,
    color: '#667eea',
    marginBottom: 5,
  },
  timelineSkillDate: {
    fontSize: 12,
    color: '#999',
  },
  actionsCard: {
    marginBottom: 15,
    elevation: 4,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  actionButton: {
    marginBottom: 10,
  },
  actionButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  motivationCard: {
    marginBottom: 15,
    elevation: 4,
    backgroundColor: '#FFF9E6',
  },
  motivationText: {
    fontSize: 15,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
  },
});
