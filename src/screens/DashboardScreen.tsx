import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { Button, Card, ActivityIndicator, Chip } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTaxonomySkillsWithStatus, getSkillsStats } from '../services/userSkillsService';

const { width } = Dimensions.get('window');

interface Stamp {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  unlocked: boolean;
  dateUnlocked?: string;
}

interface UserProgress {
  totalScans: number;
  stamps: Stamp[];
  achievements: string[];
  transcriptData?: TranscriptSummary;
  lastScanDate?: string;
}

interface TranscriptSummary {
  institution?: string;
  studentName?: string;
  degree?: string;
  gpa?: string;
  totalCredits?: string;
  graduationDate?: string;
  coursesBySubject: { [key: string]: number };
  topGrades: string[];
  achievements: string[];
}

interface CourseAnalysis {
  subjects: { [key: string]: number };
  advancedCourses: number;
  diversityScore: number;
  totalCourses: number;
}

const AVAILABLE_STAMPS: Stamp[] = [
  // Academic Stamps
  {
    id: 'math',
    name: 'Mathematics Master',
    icon: '🧮',
    category: 'Academic',
    description: 'Completed mathematics courses',
    unlocked: false,
  },
  {
    id: 'science',
    name: 'Science Scholar',
    icon: '🔬',
    category: 'Academic',
    description: 'Excelled in science subjects',
    unlocked: false,
  },
  {
    id: 'literature',
    name: 'Literature Lover',
    icon: '📚',
    category: 'Academic',
    description: 'Studied literature and languages',
    unlocked: false,
  },
  {
    id: 'history',
    name: 'History Buff',
    icon: '🏛️',
    category: 'Academic',
    description: 'Passionate about history',
    unlocked: false,
  },
  {
    id: 'art',
    name: 'Creative Artist',
    icon: '🎨',
    category: 'Academic',
    description: 'Pursued arts and creativity',
    unlocked: false,
  },
  {
    id: 'music',
    name: 'Music Maestro',
    icon: '🎵',
    category: 'Academic',
    description: 'Talented in music',
    unlocked: false,
  },

  // Achievement Stamps
  {
    id: 'dean_list',
    name: "Dean's List",
    icon: '⭐',
    category: 'Achievement',
    description: "Made it to the Dean's List",
    unlocked: false,
  },
  {
    id: 'honor_roll',
    name: 'Honor Roll',
    icon: '🏆',
    category: 'Achievement',
    description: 'Achieved honor roll status',
    unlocked: false,
  },
  {
    id: 'graduate',
    name: 'Graduate',
    icon: '🎓',
    category: 'Achievement',
    description: 'Successfully graduated',
    unlocked: false,
  },
  {
    id: 'scholarship',
    name: 'Scholar',
    icon: '💎',
    category: 'Achievement',
    description: 'Received scholarships',
    unlocked: false,
  },

  // Interest Stamps
  {
    id: 'technology',
    name: 'Tech Enthusiast',
    icon: '💻',
    category: 'Interest',
    description: 'Passionate about technology',
    unlocked: false,
  },
  {
    id: 'sports',
    name: 'Athletic Spirit',
    icon: '⚽',
    category: 'Interest',
    description: 'Active in sports',
    unlocked: false,
  },
  {
    id: 'leadership',
    name: 'Natural Leader',
    icon: '👑',
    category: 'Interest',
    description: 'Demonstrated leadership skills',
    unlocked: false,
  },
  {
    id: 'community',
    name: 'Community Helper',
    icon: '🤝',
    category: 'Interest',
    description: 'Engaged in community service',
    unlocked: false,
  },
  {
    id: 'research',
    name: 'Research Pioneer',
    icon: '🔍',
    category: 'Interest',
    description: 'Involved in research projects',
    unlocked: false,
  },
  {
    id: 'international',
    name: 'Global Citizen',
    icon: '🌍',
    category: 'Interest',
    description: 'International experience',
    unlocked: false,
  },
];

// Helper functions for transcript analysis
const analyzeCourses = (courses: any[]): CourseAnalysis => {
  const subjects: { [key: string]: number } = {};
  let advancedCourses = 0;

  courses.forEach((course) => {
    const courseName = course.name?.toLowerCase() || '';
    const courseCode = course.code?.toLowerCase() || '';

    // Count courses by subject
    if (
      courseName.includes('math') ||
      courseName.includes('calculus') ||
      courseName.includes('algebra') ||
      courseCode.includes('math')
    ) {
      subjects['math'] = (subjects['math'] || 0) + 1;
    }
    if (
      courseName.includes('science') ||
      courseName.includes('physics') ||
      courseName.includes('chemistry') ||
      courseName.includes('biology')
    ) {
      subjects['science'] = (subjects['science'] || 0) + 1;
    }
    if (
      courseName.includes('literature') ||
      courseName.includes('english') ||
      courseName.includes('writing')
    ) {
      subjects['literature'] = (subjects['literature'] || 0) + 1;
    }
    if (courseName.includes('history') || courseName.includes('hist')) {
      subjects['history'] = (subjects['history'] || 0) + 1;
    }
    if (
      courseName.includes('art') ||
      courseName.includes('design') ||
      courseName.includes('drawing')
    ) {
      subjects['art'] = (subjects['art'] || 0) + 1;
    }
    if (
      courseName.includes('music') ||
      courseName.includes('band') ||
      courseName.includes('orchestra')
    ) {
      subjects['music'] = (subjects['music'] || 0) + 1;
    }
    if (
      courseName.includes('business') ||
      courseName.includes('economics') ||
      courseName.includes('finance') ||
      courseName.includes('marketing')
    ) {
      subjects['business'] = (subjects['business'] || 0) + 1;
    }
    if (
      courseName.includes('engineering') ||
      courseName.includes('computer') ||
      courseName.includes('programming') ||
      courseName.includes('tech')
    ) {
      subjects['engineering'] = (subjects['engineering'] || 0) + 1;
    }
    if (
      courseName.includes('sport') ||
      courseName.includes('physical') ||
      courseName.includes('athletics')
    ) {
      subjects['sports'] = (subjects['sports'] || 0) + 1;
    }
    if (courseName.includes('leadership') || courseName.includes('management')) {
      subjects['leadership'] = (subjects['leadership'] || 0) + 1;
    }
    if (courseName.includes('research') || courseName.includes('thesis')) {
      subjects['research'] = (subjects['research'] || 0) + 1;
    }

    // Count advanced courses (400+ level or keywords like "advanced", "senior", "capstone")
    if (
      courseCode.match(/[4-9]\d\d/) ||
      courseName.includes('advanced') ||
      courseName.includes('senior') ||
      courseName.includes('capstone')
    ) {
      advancedCourses++;
    }
  });

  return {
    subjects,
    advancedCourses,
    diversityScore: Object.keys(subjects).length,
    totalCourses: courses.length,
  };
};

const getSubjectStampId = (subject: string): string => {
  const subjectMap: { [key: string]: string } = {
    math: 'math',
    science: 'science',
    literature: 'literature',
    history: 'history',
    art: 'art',
    music: 'music',
    business: 'business',
    engineering: 'engineering',
    sports: 'sports',
    leadership: 'leadership',
    research: 'research',
  };
  return subjectMap[subject] || subject;
};

const generateDynamicStamps = (transcriptData: any): Stamp[] => {
  const dynamicStamps: Stamp[] = [];

  // Create stamps based on specific institution
  if (transcriptData.institution) {
    const institutionName = transcriptData.institution;
    dynamicStamps.push({
      id: `institution_${institutionName.toLowerCase().replace(/\s+/g, '_')}`,
      name: `${institutionName} Alumni`,
      icon: '🏛️',
      category: 'Achievement',
      description: `Graduated from ${institutionName}`,
      unlocked: true,
    });
  }

  // Create stamps based on degree type
  if (transcriptData.degree) {
    const degree = transcriptData.degree;
    dynamicStamps.push({
      id: `degree_${degree.toLowerCase().replace(/\s+/g, '_')}`,
      name: `${degree} Graduate`,
      icon: '🎓',
      category: 'Achievement',
      description: `Earned ${degree}`,
      unlocked: true,
    });
  }

  return dynamicStamps;
};

const createTranscriptSummary = (transcriptData: any): TranscriptSummary => {
  const coursesBySubject: { [key: string]: number } = {};
  const topGrades: string[] = [];
  const achievements: string[] = [];

  // Analyze courses if available
  if (transcriptData.courses) {
    const courseAnalysis = analyzeCourses(transcriptData.courses);
    Object.assign(coursesBySubject, courseAnalysis.subjects);

    // Find top grades (A or A+ grades)
    transcriptData.courses.forEach((course: any) => {
      if (course.grade === 'A' || course.grade === 'A+' || course.grade === 'A-') {
        topGrades.push(`${course.name}: ${course.grade}`);
      }
    });
  }

  // Determine achievements based on GPA
  const gpa = parseFloat(transcriptData.gpa || '0');
  if (gpa >= 3.9) achievements.push('Summa Cum Laude');
  else if (gpa >= 3.7) achievements.push('Magna Cum Laude');
  else if (gpa >= 3.5) achievements.push("Dean's List");
  else if (gpa >= 3.0) achievements.push('Honor Roll');

  if (transcriptData.graduationDate) achievements.push('Graduate');

  return {
    institution: transcriptData.institution,
    studentName: transcriptData.studentName,
    degree: transcriptData.degree,
    gpa: transcriptData.gpa,
    totalCredits: transcriptData.totalCredits,
    graduationDate: transcriptData.graduationDate,
    coursesBySubject,
    topGrades: topGrades.slice(0, 5), // Keep top 5
    achievements,
  };
};

export default function DashboardScreen({ route, navigation }: any) {
  const [userProgress, setUserProgress] = useState<UserProgress>({
    totalScans: 0,
    stamps: [],
    achievements: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [skillsData, setSkillsData] = useState<any[]>([]);
  const [skillsStats, setSkillsStats] = useState<any>(null);
  const [selectedSkillCategory, setSelectedSkillCategory] = useState<string>('All');

  const analysisResult = route?.params?.analysisResult;

  useEffect(() => {
    loadUserProgress();
    loadSkillsData();
    if (analysisResult) {
      processTranscriptAnalysis(analysisResult);
    }
  }, []);

  useEffect(() => {
    // Reload skills when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadSkillsData();
    });
    return unsubscribe;
  }, [navigation]);

  const loadUserProgress = async () => {
    try {
      const savedProgress = await AsyncStorage.getItem('userProgress');
      if (savedProgress) {
        setUserProgress(JSON.parse(savedProgress));
      } else {
        // Initialize with default stamps
        const initialProgress: UserProgress = {
          totalScans: 0,
          stamps: AVAILABLE_STAMPS.map((stamp) => ({ ...stamp })),
          achievements: [],
        };
        setUserProgress(initialProgress);
        await AsyncStorage.setItem('userProgress', JSON.stringify(initialProgress));
      }
    } catch (error) {
      console.error('Error loading user progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSkillsData = async () => {
    try {
      const [taxonomySkills, stats] = await Promise.all([
        getTaxonomySkillsWithStatus(),
        getSkillsStats(),
      ]);

      setSkillsData(taxonomySkills);
      setSkillsStats(stats);
      console.log('Skills loaded. Total identified:', stats.totalSkills);
    } catch (error) {
      console.error('Error loading skills data:', error);
    }
  };

  const processTranscriptAnalysis = async (result: any) => {
    if (!result?.success || !result?.data) return;

    const transcriptData = result.data;
    const newStamps: string[] = [];
    const updatedStamps = userProgress.stamps.map((stamp) => ({ ...stamp }));

    // Create dynamic stamps based on actual transcript data
    const dynamicStamps = generateDynamicStamps(transcriptData);

    // Merge dynamic stamps with existing stamps
    const allStamps = [...AVAILABLE_STAMPS, ...dynamicStamps];

    // Analyze transcript content to unlock stamps
    if (transcriptData.courses) {
      const courseAnalysis = analyzeCourses(transcriptData.courses);

      // Unlock stamps based on course analysis
      Object.keys(courseAnalysis.subjects).forEach((subject) => {
        const count = courseAnalysis.subjects[subject];
        if (count >= 2) {
          // Unlock if 2+ courses in subject
          unlockStamp(updatedStamps, getSubjectStampId(subject), newStamps);
        }
      });

      // Advanced analysis stamps
      if (courseAnalysis.advancedCourses >= 5) {
        unlockStamp(updatedStamps, 'advanced_scholar', newStamps);
      }

      if (courseAnalysis.diversityScore >= 4) {
        unlockStamp(updatedStamps, 'well_rounded', newStamps);
      }

      // Check GPA for achievement stamps
      const gpa = parseFloat(transcriptData.gpa || '0');
      if (gpa >= 3.9) {
        unlockStamp(updatedStamps, 'summa_cum_laude', newStamps);
      } else if (gpa >= 3.7) {
        unlockStamp(updatedStamps, 'magna_cum_laude', newStamps);
      } else if (gpa >= 3.5) {
        unlockStamp(updatedStamps, 'dean_list', newStamps);
      } else if (gpa >= 3.0) {
        unlockStamp(updatedStamps, 'honor_roll', newStamps);
      }

      // Check if graduated
      if (transcriptData.graduationDate || transcriptData.degree) {
        unlockStamp(updatedStamps, 'graduate', newStamps);

        // Check degree level
        const degree = transcriptData.degree?.toLowerCase() || '';
        if (degree.includes('master') || degree.includes('mba') || degree.includes('ms')) {
          unlockStamp(updatedStamps, 'masters_graduate', newStamps);
        }
        if (degree.includes('phd') || degree.includes('doctorate')) {
          unlockStamp(updatedStamps, 'doctorate', newStamps);
        }
      }

      // Check total credits and course load
      const totalCredits = parseInt(transcriptData.totalCredits || '0');
      if (totalCredits >= 180) {
        unlockStamp(updatedStamps, 'overachiever', newStamps);
      } else if (totalCredits >= 120) {
        unlockStamp(updatedStamps, 'scholarship', newStamps);
      }

      // Institution-based stamps
      const institution = transcriptData.institution?.toLowerCase() || '';
      if (institution.includes('university') || institution.includes('college')) {
        unlockStamp(updatedStamps, 'college_graduate', newStamps);
      }
    }

    // Save transcript data for dashboard display
    const transcriptSummary = createTranscriptSummary(transcriptData);

    // Update user progress with transcript data
    const newProgress: UserProgress = {
      totalScans: userProgress.totalScans + 1,
      stamps: updatedStamps,
      achievements: [...userProgress.achievements, ...newStamps],
      transcriptData: transcriptSummary,
      lastScanDate: new Date().toISOString(),
    };

    setUserProgress(newProgress);
    await AsyncStorage.setItem('userProgress', JSON.stringify(newProgress));

    // Show congratulations for new stamps
    if (newStamps.length > 0) {
      const stampNames = newStamps
        .map((id) => allStamps.find((s) => s.id === id)?.name || 'Unknown')
        .join(', ');

      Alert.alert('🎉 New Stamps Unlocked!', `Congratulations! You've earned: ${stampNames}`, [
        { text: 'Awesome!', style: 'default' },
      ]);
    }
  };

  const unlockStamp = (stamps: Stamp[], stampId: string, newStamps: string[]) => {
    const stampIndex = stamps.findIndex((s) => s.id === stampId);
    if (stampIndex !== -1 && !stamps[stampIndex].unlocked) {
      stamps[stampIndex].unlocked = true;
      stamps[stampIndex].dateUnlocked = new Date().toLocaleDateString();
      newStamps.push(stampId);
    }
  };

  const categories = ['All', 'Academic', 'Achievement', 'Interest'];

  const filteredStamps =
    selectedCategory === 'All'
      ? userProgress.stamps
      : userProgress.stamps.filter((stamp) => stamp.category === selectedCategory);

  const unlockedCount = userProgress.stamps.filter((s) => s.unlocked).length;
  const totalCount = userProgress.stamps.length;
  // Skills progress: identified vs total taxonomy skills
  const totalTaxonomySkills = Array.isArray(skillsData)
    ? skillsData.reduce(
        (sum, group) => sum + (Array.isArray(group?.skills) ? group.skills.length : 0),
        0
      )
    : 0;
  const identifiedSkillsCount = skillsStats?.totalSkills || 0;
  const progressPercentage =
    totalTaxonomySkills > 0 ? Math.round((identifiedSkillsCount / totalTaxonomySkills) * 100) : 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🎯 Your Achievement Dashboard</Text>
          <Text style={styles.subtitle}>Track your identified skills and achievements!</Text>
        </View>

        {/* Progress Overview (Skills) */}
        <Card style={styles.progressCard}>
          <Card.Content>
            <Text style={styles.progressTitle}>Your Skills Progress</Text>
            <View style={styles.progressStats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{identifiedSkillsCount}</Text>
                <Text style={styles.statLabel}>Skills Identified</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{totalTaxonomySkills}</Text>
                <Text style={styles.statLabel}>Total Skills</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{progressPercentage}%</Text>
                <Text style={styles.statLabel}>Completion</Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
            </View>
          </Card.Content>
        </Card>

        {/* Skills Taxonomy Section */}
        {skillsStats && skillsStats.totalSkills > 0 && (
          <Card style={styles.skillsCard}>
            <Card.Content>
              <View style={styles.skillsHeader}>
                <MaterialIcons name="emoji-events" size={24} color="#667eea" />
                <Text style={styles.skillsTitle}>Your Identified Skills</Text>
              </View>

              {/* Skills Stats */}
              <View style={styles.skillsStatsContainer}>
                <View style={styles.skillStatItem}>
                  <Text style={styles.skillStatNumber}>{skillsStats.totalSkills}</Text>
                  <Text style={styles.skillStatLabel}>Skills Identified</Text>
                </View>
                <View style={styles.skillStatItem}>
                  <Text style={styles.skillStatNumber}>
                    {Object.keys(skillsStats.skillsByCategory).length}
                  </Text>
                  <Text style={styles.skillStatLabel}>Categories</Text>
                </View>
              </View>

              {/* Category Filter for Skills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.skillCategoryScroll}
              >
                <Chip
                  mode={selectedSkillCategory === 'All' ? 'flat' : 'outlined'}
                  selected={selectedSkillCategory === 'All'}
                  onPress={() => setSelectedSkillCategory('All')}
                  style={styles.skillCategoryChip}
                  textStyle={styles.skillCategoryChipText}
                >
                  All
                </Chip>
                {skillsData.map(({ category }) => (
                  <Chip
                    key={category}
                    mode={selectedSkillCategory === category ? 'flat' : 'outlined'}
                    selected={selectedSkillCategory === category}
                    onPress={() => setSelectedSkillCategory(category)}
                    style={styles.skillCategoryChip}
                    textStyle={styles.skillCategoryChipText}
                  >
                    {category}
                  </Chip>
                ))}
              </ScrollView>

              {/* Skills Grid */}
              {skillsData
                .filter(
                  ({ category }) =>
                    selectedSkillCategory === 'All' || category === selectedSkillCategory
                )
                .map(({ category, skills }) => (
                  <View key={category} style={styles.categorySkillsSection}>
                    <Text style={styles.categorySkillsTitle}>{category}</Text>
                    <View style={styles.skillsGrid}>
                      {skills.map(
                        (skill: { name: string; identified: boolean; dateIdentified?: string }) => (
                          <Chip
                            key={skill.name}
                            mode="flat"
                            selected={skill.identified}
                            style={[
                              styles.skillChipItem,
                              skill.identified
                                ? styles.skillChipIdentified
                                : styles.skillChipUnidentified,
                            ]}
                            textStyle={[
                              styles.skillChipText,
                              skill.identified
                                ? styles.skillChipTextIdentified
                                : styles.skillChipTextUnidentified,
                            ]}
                            icon={() =>
                              skill.identified ? (
                                <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
                              ) : null
                            }
                          >
                            {skill.name}
                          </Chip>
                        )
                      )}
                    </View>
                  </View>
                ))}

              <Text style={styles.skillsHint}>
                💡 Identified skills are highlighted in color. Keep analyzing activities to discover
                more!
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Category Filter */}
        <View style={styles.categoryFilter}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  selectedCategory === category && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === category && styles.categoryButtonTextActive,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Stamps Grid */}
        <View style={styles.stampsGrid}>
          {filteredStamps.map((stamp) => (
            <TouchableOpacity
              key={stamp.id}
              style={[
                styles.stampCard,
                stamp.unlocked ? styles.stampCardUnlocked : styles.stampCardLocked,
              ]}
              onPress={() => {
                Alert.alert(
                  stamp.name,
                  `${stamp.description}\n\n${
                    stamp.unlocked
                      ? `Unlocked on: ${stamp.dateUnlocked}`
                      : 'Complete relevant courses to unlock this stamp!'
                  }`
                );
              }}
            >
              <Text style={[styles.stampIcon, !stamp.unlocked && styles.stampIconLocked]}>
                {stamp.unlocked ? stamp.icon : '🔒'}
              </Text>
              <Text style={[styles.stampName, !stamp.unlocked && styles.stampNameLocked]}>
                {stamp.name}
              </Text>
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: getCategoryColor(stamp.category) },
                ]}
              >
                <Text style={styles.categoryBadgeText}>{stamp.category}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            style={styles.scanButton}
            onPress={() => navigation.navigate('Home')}
            icon="camera"
          >
            Scan Another Transcript
          </Button>

          <Button
            mode="outlined"
            style={styles.voiceButton}
            onPress={() => navigation.navigate('Blue')}
            icon="microphone"
          >
            Try Voice Transcription
          </Button>
        </View>

        {/* Tips Section removed to focus on skills */}
      </ScrollView>
    </View>
  );
}

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Academic':
      return '#4CAF50';
    case 'Achievement':
      return '#FF9800';
    case 'Interest':
      return '#2196F3';
    default:
      return '#9E9E9E';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#2196F3',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#E3F2FD',
    textAlign: 'center',
    marginTop: 5,
  },
  progressCard: {
    margin: 20,
    elevation: 4,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  categoryFilter: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  categoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    marginRight: 10,
  },
  categoryButtonActive: {
    backgroundColor: '#2196F3',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  stampsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
    justifyContent: 'space-between',
  },
  stampCard: {
    width: (width - 50) / 2,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  stampCardUnlocked: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  stampCardLocked: {
    opacity: 0.6,
  },
  stampIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  stampIconLocked: {
    opacity: 0.5,
  },
  stampName: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    minHeight: 32,
  },
  stampNameLocked: {
    color: '#999',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 5,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  actionButtons: {
    padding: 20,
    gap: 10,
  },
  scanButton: {
    backgroundColor: '#4CAF50',
  },
  voiceButton: {
    borderColor: '#2196F3',
  },
  tipsCard: {
    margin: 20,
    marginTop: 0,
    elevation: 2,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  tipsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  summaryCard: {
    margin: 20,
    marginTop: 0,
    elevation: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  summarySection: {
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  gpaValue: {
    color: '#4CAF50',
    fontSize: 16,
  },
  subjectSection: {
    marginBottom: 15,
  },
  subjectTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  subjectName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1976D2',
    textTransform: 'capitalize',
  },
  subjectCount: {
    fontSize: 10,
    color: '#666',
  },
  achievementSection: {
    marginBottom: 15,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  achievementList: {
    paddingLeft: 10,
  },
  achievementItem: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 4,
    fontWeight: '500',
  },
  gradesSection: {
    marginBottom: 10,
  },
  gradesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  gradesList: {
    paddingLeft: 10,
  },
  gradeItem: {
    fontSize: 14,
    color: '#FF9800',
    marginBottom: 4,
    fontWeight: '500',
  },
  // Skills Section Styles
  skillsCard: {
    margin: 20,
    marginTop: 0,
    elevation: 4,
    backgroundColor: '#fff',
  },
  skillsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  skillsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  skillsStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
  },
  skillStatItem: {
    alignItems: 'center',
  },
  skillStatNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#667eea',
  },
  skillStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  skillCategoryScroll: {
    marginBottom: 20,
  },
  skillCategoryChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  skillCategoryChipText: {
    fontSize: 13,
  },
  categorySkillsSection: {
    marginBottom: 20,
  },
  categorySkillsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 10,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChipItem: {
    marginRight: 8,
    marginBottom: 8,
  },
  skillChipIdentified: {
    backgroundColor: '#667eea',
    elevation: 3,
  },
  skillChipUnidentified: {
    backgroundColor: '#e0e0e0',
    elevation: 0,
  },
  skillChipText: {
    fontSize: 13,
  },
  skillChipTextIdentified: {
    color: '#fff',
    fontWeight: 'bold',
  },
  skillChipTextUnidentified: {
    color: '#999',
  },
  skillsHint: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginTop: 15,
    fontStyle: 'italic',
    lineHeight: 20,
  },
});
