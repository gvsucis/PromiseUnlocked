import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Button, Card, Title, Paragraph, ActivityIndicator } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types/navigation";
import { GeminiService } from "../services/geminiService";
import { SKILLS_TAXONOMY, normalizeTaxonomyCategoryName } from "../services/skillTaxonomyService";

type VoiceAnalysisScreenNavigationProp = StackNavigationProp<RootStackParamList, "VoiceAnalysis">;
type VoiceAnalysisScreenRouteProp = RouteProp<RootStackParamList, "VoiceAnalysis">;

interface Props {
  navigation: VoiceAnalysisScreenNavigationProp;
  route: VoiceAnalysisScreenRouteProp;
}

export default function VoiceAnalysisScreen({ navigation, route }: Props) {
  const { question, context } = route.params || {};

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [analysis, setAnalysis] = useState<string>("");
  const [identifiedSkills, setIdentifiedSkills] = useState<{ [category: string]: string[] }>({});
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const durationTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }
    };
  }, []);

  const requestPermissions = async () => {
    try {
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please grant microphone permission to record audio.");
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error requesting permissions:", error);
      return false;
    }
  };

  const startRecording = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      durationTimer.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("Error", "Failed to start recording. Please try again.");
    }
  };

  const stopRecording = async () => {
    try {
      if (!recorder.isRecording) return;

      setIsRecording(false);
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }

      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;

      if (uri) {
        setIsProcessing(true);
        await processAudio(uri);
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      Alert.alert("Error", "Failed to stop recording. Please try again.");
    }
  };

  const processAudio = async (audioUri: string) => {
    try {
      // First, transcribe the audio
      const transcriptionResult = await GeminiService.transcribeAudio(audioUri);

      if (!transcriptionResult.success || !transcriptionResult.transcript) {
        Alert.alert("Error", transcriptionResult.error || "Failed to transcribe audio");
        setIsProcessing(false);
        return;
      }

      setTranscript(transcriptionResult.transcript);

      // If we came from a follow-up question (DialogueDashboard flow)
      if (question) {
        // Show success message and navigate back to DialogueDashboard
        Alert.alert(
          "Voice Recording Complete!",
          "Your response has been transcribed. Returning to dashboard...",
          [
            {
              text: "OK",
              onPress: () => navigation.navigate("DialogueDashboard"),
            },
          ]
        );
        setIsProcessing(false);
        return;
      }

      // Otherwise, continue with normal analysis for standalone voice analysis
      await analyzeTranscriptWithTaxonomy(transcriptionResult.transcript);

      // After analysis is complete, automatically navigate to DialogueDashboard
      setTimeout(() => {
        navigation.navigate("DialogueDashboard");
      }, 1500);
    } catch (error) {
      console.error("Error processing audio:", error);
      Alert.alert("Error", "Failed to process audio. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeTranscriptWithTaxonomy = async (transcriptText: string) => {
    try {
      const analysisPrompt = `
Analyze the following transcript where someone is describing what they do when they lose track of time. Based on the content, identify which skills and categories from this taxonomy apply:

SKILLS TAXONOMY:
${Object.entries(SKILLS_TAXONOMY)
  .map(([category, skills]) => `${category}: ${skills.join(", ")}`)
  .join("\n")}

TRANSCRIPT: "${transcriptText}"

Please provide:
1. A brief analysis of what this person enjoys doing and why it makes them lose track of time
2. Which specific skills from the taxonomy are demonstrated or developed through their activities
3. Which taxonomy categories are most relevant to their interests
4. Insights about their potential strengths and growth areas

Format your response as a thoughtful analysis that helps them understand their skills and interests better.`;

      const analysisResult = await GeminiService.processTranscriptText(analysisPrompt);

      if (analysisResult) {
        setAnalysis(analysisResult);

        // Extract skills mentioned in the analysis
        const extractedSkills: { [category: string]: string[] } = {};

        Object.entries(SKILLS_TAXONOMY).forEach(([category, skills]) => {
          const matchedSkills = skills.filter(
            (skill) =>
              transcriptText.toLowerCase().includes(skill.toLowerCase()) ||
              analysisResult.toLowerCase().includes(skill.toLowerCase())
          );

          if (matchedSkills.length > 0) {
            extractedSkills[category] = matchedSkills;
          }
        });

        setIdentifiedSkills(extractedSkills);
      }
    } catch (error) {
      console.error("Error analyzing transcript:", error);
      Alert.alert("Error", "Failed to analyze transcript. Please try again.");
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const resetSession = () => {
    setTranscript("");
    setAnalysis("");
    setIdentifiedSkills({});
    setRecordingDuration(0);
  };

  const hasCategory = (categories: string[], targetCategory: string): boolean =>
    categories.map(normalizeTaxonomyCategoryName).includes(targetCategory);

  const generateFollowUpQuestion = (): string => {
    const categories = Object.keys(identifiedSkills);
    const firstCategory = categories[0];
    const firstSkill = firstCategory ? identifiedSkills[firstCategory]?.[0] : undefined;
    if (hasCategory(categories, "Creative Expression")) {
      return "Would you create a small piece this week (e.g., a 60-second reel, a sketch, or a short story) to explore this interest?";
    }
    if (hasCategory(categories, "Maker & Builder")) {
      return "What quick prototype could you build in the next 2–3 hours to test an idea from this activity?";
    }
    if (hasCategory(categories, "Meta-Learning & Self-Awareness")) {
      return "What is one question you’re curious about here, and how would you research it?";
    }
    if (hasCategory(categories, "Human Skills")) {
      return "Who could you share or collaborate with this week to amplify your impact or get feedback?";
    }
    if (hasCategory(categories, "Problem-Solving")) {
      return "What challenge did you hit during this activity, and how might you approach it differently next time?";
    }
    if (hasCategory(categories, "Civic & Community")) {
      return "Is there a community or cause that could benefit from this—what’s one small action you could take?";
    }
    if (hasCategory(categories, "Work Experience")) {
      return "Is there a real-world context (internship, freelance, volunteer) where you could apply this in the next month?";
    }
    if (hasCategory(categories, "Future Self & Direction")) {
      return "If this became part of your routine, what would “leveling up” look like in 30 days?";
    }
    if (firstSkill) {
      return `Which part of this activity best builds ${firstSkill}, and how could you double that time next week?`;
    }
    return "What is one small next step you could take to explore this interest further?";
  };

  return (
    <LinearGradient colors={["#4c669f", "#3b5998", "#192f6a"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Voice Analysis</Text>
          <Text style={styles.subtitle}>
            {question || "Tell me about what you do when you lose track of time"}
          </Text>
        </View>

        <Card style={styles.recordingCard}>
          <Card.Content style={styles.recordingContent}>
            {!isRecording && !transcript && (
              <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
                <MaterialIcons name="mic" size={28} color="#fff" style={styles.recordButtonIcon} />
                <Text style={styles.recordButtonText}>Tap to Start</Text>
              </TouchableOpacity>
            )}

            {isRecording && (
              <View style={styles.recordingIndicator}>
                <View style={styles.pulseContainer}>
                  <MaterialIcons name="mic" size={60} color="#ff4444" />
                </View>
                <Text style={styles.recordingText}>Recording...</Text>
                <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
                <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
                  <MaterialIcons name="stop" size={40} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            {isProcessing && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color="#4c669f" />
                <Text style={styles.processingText}>Analyzing your voice...</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {transcript && (
          <Card style={styles.resultCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>What You Said:</Title>
              <Paragraph style={styles.transcriptText}>{transcript}</Paragraph>
            </Card.Content>
          </Card>
        )}

        {analysis && (
          <Card style={styles.resultCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Skills Analysis:</Title>
              <Paragraph style={styles.analysisText}>{analysis}</Paragraph>
            </Card.Content>
          </Card>
        )}

        {!!(analysis || transcript) && (
          <Card
            style={styles.resultCard}
            onPress={() =>
              navigation.navigate("FollowUpQuestion", {
                question: generateFollowUpQuestion(),
                context: { transcript, analysis },
              })
            }
          >
            <Card.Content>
              <View style={styles.cardTitleContainer}>
                <MaterialIcons name="extension" size={22} color="#667eea" />
                <Title style={styles.sectionTitle}>Follow-up Question</Title>
              </View>
              <Paragraph style={styles.analysisText}>{generateFollowUpQuestion()}</Paragraph>
              <Paragraph style={styles.tapHint}>👆 Tap to answer this question</Paragraph>
            </Card.Content>
          </Card>
        )}

        {Object.keys(identifiedSkills).length > 0 && (
          <Card style={styles.resultCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Identified Skills:</Title>
              {Object.entries(identifiedSkills).map(([category, skills]) => (
                <View key={category} style={styles.skillCategory}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  <View style={styles.skillsContainer}>
                    {skills.map((skill, index) => (
                      <View key={index} style={styles.skillChip}>
                        <Text style={styles.skillText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {(transcript || analysis) && (
          <View style={styles.actionButtons}>
            <Button
              mode="outlined"
              onPress={resetSession}
              style={styles.actionButton}
              labelStyle={styles.buttonLabel}
            >
              Record Again
            </Button>
            <Button
              mode="contained"
              onPress={() => navigation.navigate("Dashboard")}
              style={[styles.actionButton, styles.primaryButton]}
              labelStyle={styles.buttonLabel}
            >
              View Dashboard
            </Button>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    lineHeight: 22,
  },
  recordingCard: {
    marginBottom: 20,
    elevation: 4,
  },
  recordingContent: {
    alignItems: "center",
    padding: 30,
  },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    elevation: 0,
  },
  recordButtonIcon: {
    marginRight: 8,
  },
  recordButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  recordingIndicator: {
    alignItems: "center",
  },
  pulseContainer: {
    padding: 20,
  },
  recordingText: {
    fontSize: 18,
    color: "#ff4444",
    fontWeight: "bold",
    marginTop: 10,
  },
  durationText: {
    fontSize: 24,
    color: "#333",
    fontWeight: "bold",
    marginTop: 5,
  },
  stopButton: {
    backgroundColor: "#ff4444",
    padding: 15,
    borderRadius: 50,
    marginTop: 20,
  },
  processingContainer: {
    alignItems: "center",
    padding: 20,
  },
  processingText: {
    fontSize: 16,
    color: "#666",
    marginTop: 15,
  },
  resultCard: {
    marginBottom: 20,
    elevation: 4,
  },
  cardTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  transcriptText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#555",
  },
  analysisText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#333",
  },
  tapHint: {
    fontSize: 12,
    color: "#667eea",
    fontStyle: "italic",
    marginTop: 8,
    textAlign: "center",
  },
  skillCategory: {
    marginBottom: 15,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4c669f",
    marginBottom: 8,
  },
  skillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  skillChip: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    margin: 3,
  },
  skillText: {
    fontSize: 12,
    color: "#1976d2",
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  primaryButton: {
    backgroundColor: "#4c669f",
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
});
