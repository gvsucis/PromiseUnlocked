import React, { useEffect, useRef } from "react";
import { View, StyleSheet, ScrollView, Alert, Share } from "react-native";
import { Card, Title, Paragraph, Button, DataTable, Chip } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types/navigation";
import { TranscriptAnalysis, Course } from "../types";
import {
  mapSkillsToTaxonomy,
  normalizeTaxonomyCategoryName,
} from "../services/skillTaxonomyService";
import { saveIdentifiedSkills } from "../services/userSkillsService";

interface ActionAnalysisResult {
  activity_description: string;
  primary_skills?: string[];
  taxonomy_categories?: string[];
  skill_development_insights?: string;
  flow_state_potential?: string;
  growth_opportunities?: string;
  confidence_level?: string;
}

type ResultScreenNavigationProp = StackNavigationProp<RootStackParamList, "Result">;
type ResultScreenRouteProp = RouteProp<RootStackParamList, "Result">;

interface Props {
  navigation: ResultScreenNavigationProp;
  route: ResultScreenRouteProp;
}

export default function ResultScreen({ navigation, route }: Readonly<Props>) {
  const { result } = route.params;
  const data = result.data as TranscriptAnalysis | ActionAnalysisResult;
  const savedActionSkillsRef = useRef(false);

  // Detect if this is action analysis or transcript analysis
  const isActionAnalysis = data && "activity_description" in data;

  const hasCategory = (categories: string[], targetCategory: string): boolean =>
    categories.map(normalizeTaxonomyCategoryName).includes(targetCategory);

  useEffect(() => {
    if (!isActionAnalysis || !data || savedActionSkillsRef.current) {
      return;
    }

    const primarySkills = "primary_skills" in data ? (data.primary_skills ?? []) : [];
    const matchedSkills = mapSkillsToTaxonomy(primarySkills).filter(
      (skill) => skill.confidence >= 0.5
    );

    if (matchedSkills.length === 0) {
      savedActionSkillsRef.current = true;
      return;
    }

    savedActionSkillsRef.current = true;

    void saveIdentifiedSkills(
      matchedSkills.map((skill) => skill.skill),
      matchedSkills.map((skill) => skill.category),
      "text",
      matchedSkills.map((skill) => skill.confidence)
    ).catch((error) => {
      console.error("Error saving action analysis skills:", error);
      savedActionSkillsRef.current = false;
    });
  }, [data, isActionAnalysis]);

  const handleShare = async () => {
    if (!data) return;

    try {
      const shareText = isActionAnalysis ? generateActionShareText(data) : generateShareText(data);
      const title = isActionAnalysis ? "My Activity Analysis" : "My Transcript Analysis";
      await Share.share({
        message: shareText,
        title,
      });
    } catch (error) {
      console.error("Failed to share results:", error);
      Alert.alert("Error", "Failed to share results");
    }
  };

  const generateFollowUpQuestion = (actionData: ActionAnalysisResult): string => {
    const activity = actionData.activity_description.toLowerCase();
    const categories = actionData.taxonomy_categories ?? [];
    const skills = actionData.primary_skills ?? [];

    // Priority: ask about depth/next step tailored to category
    if (hasCategory(categories, "Creative Expression")) {
      return "Would you like to create a small project this week (e.g., a 60-second reel, a sketch, or a short story) to explore this interest further?";
    }
    if (hasCategory(categories, "Maker & Builder")) {
      return "What’s a simple prototype or build you could complete in the next 2–3 hours to test an idea from this activity?";
    }
    if (hasCategory(categories, "Meta-Learning & Self-Awareness")) {
      return "What is one question you’re curious about from this activity, and how would you go about researching it?";
    }
    if (hasCategory(categories, "Human Skills")) {
      return "Who could you share or collaborate with on this activity this week to amplify your impact or feedback?";
    }
    if (hasCategory(categories, "Problem-Solving")) {
      return "What challenge did you encounter during this activity, and how might you approach solving it differently next time?";
    }
    if (hasCategory(categories, "Civic & Community")) {
      return "Is there a community or cause that could benefit from this activity—what’s one small action you could take?";
    }
    if (hasCategory(categories, "Work Experience")) {
      return "Is there a real-world context (internship, freelance, volunteer) where you could apply this activity in the next month?";
    }
    if (hasCategory(categories, "Future Self & Direction")) {
      return "If this became part of your routine, what would “leveling up” look like in 30 days?";
    }

    // Generic backstop using skills if available
    if (skills.length > 0) {
      return `Which part of this activity best builds ${skills[0]}, and how could you double that time next week?`;
    }
    // Fallback to activity description
    if (activity) {
      return "What is one tiny next step you could take to go a bit deeper with this activity this week?";
    }
    return "What is one small next step you could take to explore this interest further?";
  };

  const generateActionShareText = (actionData: ActionAnalysisResult): string => {
    let text = "🎯 Activity Analysis Results\n\n";

    text += `📝 Activity: ${actionData.activity_description}\n\n`;

    const primarySkills = actionData.primary_skills ?? [];
    if (primarySkills.length > 0) {
      text += "🛠️ Primary Skills:\n";
      primarySkills.forEach((skill: string) => {
        text += `• ${skill}\n`;
      });
      text += "\n";
    }

    const taxonomyCategories = actionData.taxonomy_categories ?? [];
    if (taxonomyCategories.length > 0) {
      text += "📚 Categories:\n";
      taxonomyCategories.forEach((category: string) => {
        text += `• ${category}\n`;
      });
      text += "\n";
    }

    if (actionData.flow_state_potential) {
      text += `⏰ Flow State: ${actionData.flow_state_potential}\n\n`;
    }

    if (actionData.skill_development_insights) {
      text += `💡 Insights: ${actionData.skill_development_insights}\n\n`;
    }

    if (actionData.confidence_level) {
      text += `🎯 Confidence: ${actionData.confidence_level}\n`;
    }

    return text;
  };

  const generateShareText = (transcriptData: TranscriptAnalysis): string => {
    let text = "📚 Academic Transcript Analysis\n\n";

    if (transcriptData.institution) {
      text += `🏫 Institution: ${transcriptData.institution}\n`;
    }
    if (transcriptData.studentName) {
      text += `👤 Student: ${transcriptData.studentName}\n`;
    }
    if (transcriptData.degree) {
      text += `🎓 Degree: ${transcriptData.degree}\n`;
    }
    if (transcriptData.gpa) {
      text += `📊 GPA: ${transcriptData.gpa}\n`;
    }
    if (transcriptData.totalCredits) {
      text += `📝 Total Credits: ${transcriptData.totalCredits}\n`;
    }
    if (transcriptData.graduationDate) {
      text += `🎉 Graduation Date: ${transcriptData.graduationDate}\n`;
    }

    text += "\n📋 Courses:\n";
    transcriptData.courses.forEach((course, index) => {
      text += `${index + 1}. ${course.code} - ${course.name}\n`;
      text += `   Grade: ${course.grade} | Credits: ${course.credits}\n`;
      if (course.semester && course.year) {
        text += `   ${course.semester} ${course.year}\n`;
      }
      text += "\n";
    });

    return text;
  };

  const getGradeColor = (grade: string): string => {
    const gradeUpper = grade.toUpperCase();
    if (gradeUpper.includes("A") || gradeUpper.includes("4.0")) return "#4CAF50";
    if (gradeUpper.includes("B") || gradeUpper.includes("3.0")) return "#FF9800";
    if (gradeUpper.includes("C") || gradeUpper.includes("2.0")) return "#FF5722";
    if (gradeUpper.includes("D") || gradeUpper.includes("1.0")) return "#F44336";
    if (gradeUpper.includes("F") || gradeUpper.includes("0.0")) return "#9C27B0";
    return "#757575";
  };

  const getConfidenceColor = (level?: string): string => {
    if (level === "High") return "#4CAF50";
    if (level === "Medium") return "#FF9800";
    return "#FF5722";
  };

  const renderActionAnalysis = (actionData: ActionAnalysisResult) => (
    <ScrollView style={styles.scrollView}>
      {/* Activity Description Card */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardTitleContainer}>
            <MaterialIcons name="track-changes" size={24} color="#667eea" />
            <Title style={styles.cardTitle}>Activity Identified</Title>
          </View>
          <Paragraph style={styles.activityDescription}>
            {actionData.activity_description}
          </Paragraph>
        </Card.Content>
      </Card>

      {/* Primary Skills */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>🛠️ Primary Skills Demonstrated</Title>
          <View style={styles.skillsContainer}>
            {(actionData.primary_skills ?? []).map((skill: string, index: number) => (
              <Chip
                key={index}
                style={[styles.skillChip, { backgroundColor: "#e3f2fd" }]}
                textStyle={styles.skillChipText}
              >
                {skill}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      {/* Taxonomy Categories */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>📚 Skills Categories</Title>
          <View style={styles.categoriesContainer}>
            {(actionData.taxonomy_categories ?? []).map((category: string, index: number) => (
              <Chip
                key={index}
                style={[styles.categoryChip, { backgroundColor: "#f3e5f5" }]}
                textStyle={styles.categoryChipText}
              >
                {category}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      {/* Flow State Potential */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>⏰ Flow State Analysis</Title>
          <Paragraph style={styles.analysisText}>{actionData.flow_state_potential}</Paragraph>
        </Card.Content>
      </Card>

      {/* Development Insights */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardTitleContainer}>
            <MaterialIcons name="lightbulb" size={24} color="#667eea" />
            <Title style={styles.cardTitle}>Development Insights</Title>
          </View>
          <Paragraph style={styles.analysisText}>{actionData.skill_development_insights}</Paragraph>
        </Card.Content>
      </Card>

      {/* Growth Opportunities */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardTitleContainer}>
            <MaterialIcons name="trending-up" size={24} color="#667eea" />
            <Title style={styles.cardTitle}>Growth Opportunities</Title>
          </View>
          <Paragraph style={styles.analysisText}>{actionData.growth_opportunities}</Paragraph>
        </Card.Content>
      </Card>

      {/* Confidence Level */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardTitleContainer}>
            <MaterialIcons name="verified" size={24} color="#667eea" />
            <Title style={styles.cardTitle}>Analysis Confidence</Title>
          </View>
          <Chip
            style={[
              styles.confidenceChip,
              {
                backgroundColor: getConfidenceColor(actionData.confidence_level),
              },
            ]}
            textStyle={styles.confidenceChipText}
          >
            {actionData.confidence_level} Confidence
          </Chip>
        </Card.Content>
      </Card>

      {/* Follow-up Question */}
      <Card
        style={styles.card}
        onPress={() =>
          navigation.navigate("FollowUpQuestion", {
            question: generateFollowUpQuestion(actionData),
            context: actionData,
          })
        }
      >
        <Card.Content>
          <View style={styles.cardTitleContainer}>
            <MaterialIcons name="extension" size={24} color="#667eea" />
            <Title style={styles.cardTitle}>Follow-up Question</Title>
          </View>
          <Paragraph style={styles.analysisText}>{generateFollowUpQuestion(actionData)}</Paragraph>
          <Paragraph style={styles.tapHint}>👆 Tap to answer this question</Paragraph>
        </Card.Content>
      </Card>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <Button mode="outlined" onPress={handleShare} style={styles.button} icon="share">
          Share Analysis
        </Button>
        <Button
          mode="contained"
          onPress={() => navigation.navigate("SkillsDashboard")}
          style={[styles.button, styles.primaryButton]}
          icon="view-dashboard"
        >
          View Skills Dashboard
        </Button>
      </View>
    </ScrollView>
  );

  if (!result.success || !data) {
    return (
      <View style={styles.errorContainer}>
        <LinearGradient colors={["#f44336", "#d32f2f"]} style={styles.gradient}>
          <Card style={styles.errorCard}>
            <Card.Content>
              <Title style={styles.errorTitle}>Analysis Failed</Title>
              <Paragraph style={styles.errorText}>
                {result.error ||
                  "Unable to analyze the transcript. Please try again with a clearer image."}
              </Paragraph>
              <Button
                mode="contained"
                onPress={() => navigation.goBack()}
                style={styles.backButton}
              >
                Try Again
              </Button>
            </Card.Content>
          </Card>
        </LinearGradient>
      </View>
    );
  }

  // Conditionally render based on analysis type
  if (isActionAnalysis) {
    return (
      <LinearGradient colors={["#4c669f", "#3b5998", "#192f6a"]} style={styles.gradient}>
        {renderActionAnalysis(data)}
      </LinearGradient>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={["#4CAF50", "#388E3C"]} style={styles.gradient}>
        <View style={styles.content}>
          {/* Header Information */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Transcript Analysis Complete</Title>
              <Paragraph style={styles.subtitle}>
                Successfully extracted information from your transcript
              </Paragraph>
            </Card.Content>
          </Card>

          {/* Student Information */}
          {(data.institution || data.studentName || data.degree || data.graduationDate) && (
            <Card style={styles.card}>
              <Card.Content>
                <Title style={styles.sectionTitle}>Student Information</Title>
                <View style={styles.infoGrid}>
                  {data.institution && (
                    <View style={styles.infoItem}>
                      <Paragraph style={styles.infoLabel}>Institution</Paragraph>
                      <Paragraph style={styles.infoValue}>{data.institution}</Paragraph>
                    </View>
                  )}
                  {data.studentName && (
                    <View style={styles.infoItem}>
                      <Paragraph style={styles.infoLabel}>Student Name</Paragraph>
                      <Paragraph style={styles.infoValue}>{data.studentName}</Paragraph>
                    </View>
                  )}
                  {data.degree && (
                    <View style={styles.infoItem}>
                      <Paragraph style={styles.infoLabel}>Degree</Paragraph>
                      <Paragraph style={styles.infoValue}>{data.degree}</Paragraph>
                    </View>
                  )}
                  {data.graduationDate && (
                    <View style={styles.infoItem}>
                      <Paragraph style={styles.infoLabel}>Graduation Date</Paragraph>
                      <Paragraph style={styles.infoValue}>{data.graduationDate}</Paragraph>
                    </View>
                  )}
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Academic Summary */}
          {(data.gpa || data.totalCredits) && (
            <Card style={styles.card}>
              <Card.Content>
                <Title style={styles.sectionTitle}>Academic Summary</Title>
                <View style={styles.summaryContainer}>
                  {data.gpa && (
                    <Chip
                      icon="chart-line"
                      style={[styles.summaryChip, { backgroundColor: "#2196F3" }]}
                      textStyle={styles.summaryChipText}
                    >
                      GPA: {data.gpa}
                    </Chip>
                  )}
                  {data.totalCredits && (
                    <Chip
                      icon="book-open-variant"
                      style={[styles.summaryChip, { backgroundColor: "#4CAF50" }]}
                      textStyle={styles.summaryChipText}
                    >
                      Credits: {data.totalCredits}
                    </Chip>
                  )}
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Courses Table */}
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Course Details</Title>
              <Paragraph style={styles.courseCount}>
                {data.courses.length} course{data.courses.length !== 1 ? "s" : ""} found
              </Paragraph>

              <DataTable>
                <DataTable.Header>
                  <DataTable.Title>Course</DataTable.Title>
                  <DataTable.Title>Name</DataTable.Title>
                  <DataTable.Title numeric>Grade</DataTable.Title>
                  <DataTable.Title numeric>Credits</DataTable.Title>
                </DataTable.Header>

                {data.courses.map((course: Course, index: number) => (
                  <DataTable.Row key={index}>
                    <DataTable.Cell>
                      <Paragraph style={styles.courseCode}>{course.code}</Paragraph>
                    </DataTable.Cell>
                    <DataTable.Cell>
                      <Paragraph style={styles.courseName} numberOfLines={2}>
                        {course.name}
                      </Paragraph>
                    </DataTable.Cell>
                    <DataTable.Cell numeric>
                      <Chip
                        style={[styles.gradeChip, { backgroundColor: getGradeColor(course.grade) }]}
                        textStyle={styles.gradeChipText}
                      >
                        {course.grade}
                      </Chip>
                    </DataTable.Cell>
                    <DataTable.Cell numeric>
                      <Paragraph style={styles.credits}>{course.credits}</Paragraph>
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            </Card.Content>
          </Card>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={handleShare}
              style={[styles.actionButton, styles.shareButton]}
              icon="share"
            >
              Share Results
            </Button>

            <Button
              mode="contained"
              onPress={() => navigation.navigate("SkillsDashboard")}
              style={[styles.actionButton, styles.dashboardButton]}
              icon="view-dashboard"
            >
              View Skills Dashboard
            </Button>

            <Button
              mode="outlined"
              onPress={() => navigation.navigate("Home")}
              style={[styles.actionButton, styles.newAnalysisButton]}
              textColor="#4CAF50"
            >
              Analyze Another
            </Button>
          </View>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  gradient: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    marginBottom: 20,
    elevation: 4,
  },
  cardTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  title: {
    textAlign: "center",
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  subtitle: {
    textAlign: "center",
    color: "#666",
    marginTop: 8,
  },
  sectionTitle: {
    color: "#2E7D32",
    marginBottom: 16,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  infoItem: {
    width: "48%",
    marginBottom: 12,
  },
  infoLabel: {
    color: "#666",
    fontSize: 12,
    fontWeight: "bold",
  },
  infoValue: {
    color: "#333",
    fontSize: 14,
    marginTop: 2,
  },
  summaryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  summaryChipText: {
    color: "#fff",
    fontWeight: "bold",
  },
  courseCount: {
    color: "#666",
    marginBottom: 16,
    fontStyle: "italic",
  },
  courseCode: {
    fontWeight: "bold",
    color: "#333",
  },
  courseName: {
    color: "#666",
    fontSize: 12,
  },
  gradeChip: {
    minWidth: 40,
  },
  gradeChipText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  credits: {
    color: "#333",
    fontWeight: "bold",
  },
  buttonContainer: {
    marginTop: 16,
  },
  actionButton: {
    marginVertical: 8,
    paddingVertical: 8,
  },
  shareButton: {
    backgroundColor: "#2196F3",
  },
  dashboardButton: {
    backgroundColor: "#FF9800",
  },
  newAnalysisButton: {
    borderColor: "#4CAF50",
  },
  errorContainer: {
    flex: 1,
  },
  errorCard: {
    margin: 16,
    elevation: 4,
  },
  errorTitle: {
    color: "#d32f2f",
    textAlign: "center",
  },
  errorText: {
    textAlign: "center",
    marginVertical: 16,
    color: "#666",
  },
  backButton: {
    backgroundColor: "#f44336",
    marginTop: 16,
  },
  // Action Analysis Styles
  scrollView: {
    flex: 1,
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  activityDescription: {
    fontSize: 16,
    lineHeight: 24,
    color: "#444",
  },
  skillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  skillChip: {
    margin: 4,
    elevation: 2,
  },
  skillChipText: {
    fontSize: 12,
    color: "#1976d2",
    fontWeight: "500",
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  categoryChip: {
    margin: 4,
    elevation: 2,
  },
  categoryChipText: {
    fontSize: 12,
    color: "#7b1fa2",
    fontWeight: "500",
  },
  analysisText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#555",
  },
  tapHint: {
    fontSize: 12,
    color: "#667eea",
    fontStyle: "italic",
    marginTop: 8,
    textAlign: "center",
  },
  confidenceChip: {
    marginTop: 8,
    elevation: 2,
  },
  confidenceChipText: {
    fontSize: 12,
    color: "white",
    fontWeight: "bold",
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
    marginVertical: 4,
  },
  primaryButton: {
    backgroundColor: "#4c669f",
  },
});
