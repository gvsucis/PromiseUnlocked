import React, { useRef, useState } from "react";
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Alert } from "react-native";
import { Text, Card, ActivityIndicator } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import TopTabBar from "../components/TopTabBar";
import { MaterialIcons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import ConfettiCannon from "react-native-confetti-cannon";
import { RootStackParamList } from "../types/navigation";
import { CATEGORY_TAXONOMY, TOTAL_CATEGORIES } from "../services/categoryTaxonomyService";
import { GeminiService } from "../services/geminiService";
import { ImagePickerService } from "../services/imagePickerService";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import ZoomableImageView from "../components/ZoomableImageView";
import ImageEditor from "../components/ImageEditor";
import { LoadingModal } from "../components/dialogue/LoadingModal";
import { CompletionModal } from "../components/dialogue/CompletionModal";
import { WeakFitModal } from "../components/dialogue/WeakFitModal";
import { QuestionInputModal } from "../components/dialogue/QuestionInputModal";
import { AnswerModal } from "../components/dialogue/AnswerModal";
import { VoiceRecordingModal } from "../components/dialogue/VoiceRecordingModal";
import { CategoryCard } from "../components/dialogue/CategoryCard";
import { useDialogueState } from "../hooks/useDialogueState";
import { useAuth } from "../context/AuthContext";

const { width } = Dimensions.get("window");

type DialogueDashboardNavigationProp = StackNavigationProp<RootStackParamList, "DialogueDashboard">;
type DialogueDashboardRouteProp = RouteProp<RootStackParamList, "DialogueDashboard">;

interface Props {
  readonly navigation: DialogueDashboardNavigationProp;
  readonly route: DialogueDashboardRouteProp;
}

export default function DialogueDashboardScreen({ navigation }: Props) {
  const { session, logoutToGuest } = useAuth();
  const {
    mappedCategories,
    uiState,
    currentPrompt,
    userAnswer,
    loadingMessage,
    error,
    weakFitJustification,
    showConfetti,
    loading,
    prefetchedQuestion,
    showInputMethodModal,
    setUserAnswer,
    setUiState,
    setCurrentPrompt,
    setShowInputMethodModal,
    resetData,
    mapAnswerToCategory,
    handleStartButtonPress,
    handleVoiceInputPress,
    prepareImageQuestion,
    handleSubmitAnswer,
    handleWeakFitTryAgain,
    handleWeakFitNewQuestion,
    dismissAnswerModal,
  } = useDialogueState();

  const [showQuestionInputModal, setShowQuestionInputModal] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const suppressModalReopenRef = useRef(false);

  // Voice recording state
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingDuration, setRecordingDuration] = React.useState(0);
  const [recordingUri, setRecordingUri] = React.useState<string | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = React.useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Image state
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = React.useState(false);
  const [tempImageUri, setTempImageUri] = React.useState<string | null>(null);
  const [zoomViewerVisible, setZoomViewerVisible] = React.useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = React.useState(false);
  const [isAnswerFromVoice, setIsAnswerFromVoice] = React.useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={session.mode === "authenticated" ? handleLogout : handleAccountPress}
            style={styles.headerActionButton}
          >
            <MaterialIcons
              name={session.mode === "authenticated" ? "logout" : "person"}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleReset}
            style={styles.headerActionButton}
            disabled={uiState !== "idle" && uiState !== "complete"}
          >
            <MaterialIcons
              name="refresh"
              size={24}
              color={uiState !== "idle" && uiState !== "complete" ? "#ccc" : "#fff"}
            />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, session.mode, uiState]);

  const handleAccountPress = () => {
    navigation.navigate("Login");
  };

  const handleLogout = () => {
    Alert.alert(
      "Switch to Guest",
      "You will keep this account's saved progress, and the app will continue in guest mode.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => {
            void logoutToGuest()
              .then(() => {
                navigation.replace("Welcome");
              })
              .catch(() => {
                Alert.alert("Error", "Failed to switch to guest mode.");
              });
          },
        },
      ]
    );
  };

  const handleReset = () => {
    Alert.alert("Reset Dashboard", "Are you sure you want to reset? All progress will be lost.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => {
          resetData().catch(() => {
            Alert.alert("Error", "Failed to reset dashboard");
          });
        },
      },
    ]);
  };

  const handleSubmitTextFromModal = (text: string) => {
    if (!text.trim()) return;
    suppressModalReopenRef.current = true;
    setShowQuestionInputModal(false);
    const q = pendingQuestion || currentPrompt;
    setPendingQuestion(null);
    setCurrentPrompt("");
    suppressModalReopenRef.current = false;
    mapAnswerToCategory(q, text);
  };

  const handleInputTypeSelect = async (method: "voice" | "image") => {
    suppressModalReopenRef.current = true;
    setShowQuestionInputModal(false);
    setPendingQuestion(null);
    await new Promise((resolve) => setTimeout(resolve, 150));
    suppressModalReopenRef.current = false;
    if (method === "voice") {
      handleVoiceInputPress();
    } else if (method === "image") {
      const ready = prepareImageQuestion();
      if (ready) showImageSourceDialog();
    }
  };

  // --- Voice recording ---

  const startRecording = async () => {
    try {
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please grant microphone permission to continue.");
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording", err);
      Alert.alert("Error", "Failed to start recording. Please check your microphone permissions.");
    }
  };

  const stopRecording = async () => {
    if (!recorder.isRecording) return;

    try {
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      const uri = recorder.uri;

      if (uri) setRecordingUri(uri);
    } catch (err) {
      console.error("Error stopping recording:", err);
      Alert.alert("Error", "Failed to stop recording");
    }
  };

  const handleVoiceSubmit = async () => {
    if (!recordingUri || !currentPrompt) {
      Alert.alert("Error", "No recording available");
      return;
    }

    setIsProcessingAudio(true);

    try {
      const transcriptionResult = await GeminiService.transcribeAudio(recordingUri);

      if (
        !transcriptionResult.success ||
        !transcriptionResult.transcript ||
        transcriptionResult.transcript.trim().length === 0
      ) {
        Alert.alert(
          "Transcription Error",
          transcriptionResult.error ||
            "Could not transcribe your audio. Please try recording again."
        );
        return;
      }

      const question = currentPrompt;
      const answer = transcriptionResult.transcript.trim();

      setRecordingUri(null);
      setRecordingDuration(0);
      setCurrentPrompt("");

      await mapAnswerToCategory(question, answer);
      setIsAnswerFromVoice(false);
    } catch (err) {
      console.error("Error processing voice answer:", err);
      let errorMessage = "Failed to process your voice response. Please try again.";

      if (err instanceof Error) {
        if (err.message.includes("Rate limit")) {
          errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
        } else if (err.message.includes("API key")) {
          errorMessage = "API key issue. Please check your configuration.";
        }
      }

      Alert.alert("Processing Error", errorMessage);
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const handleVoiceCancel = async () => {
    if (isRecording && recorder.isRecording) {
      try {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
      } catch (err) {
        console.error("Error stopping recording on cancel:", err);
      }
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setUiState("idle");
    setIsRecording(false);
    setRecordingUri(null);
    setRecordingDuration(0);
  };

  // --- Image handling ---

  const showImageSourceDialog = () => {
    Alert.alert(
      "Choose Image Source",
      "How would you like to add your image?",
      [
        { text: "Take Photo", onPress: () => handleImageSelection(true) },
        { text: "Choose from Gallery", onPress: () => handleImageSelection(false) },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const handleImageSelection = async (useCamera: boolean) => {
    try {
      const hasPermissions = await ImagePickerService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert(
          "Permissions Required",
          "Camera and photo library permissions are required to use this feature."
        );
        return;
      }

      const result = useCamera
        ? await ImagePickerService.takePhotoWithCamera()
        : await ImagePickerService.pickImageFromGalleryWithOptions(false);

      if (result.success && result.imageUri) {
        setTempImageUri(result.imageUri);
        setShowImageEditor(true);
      } else if (result.error) {
        Alert.alert("Error", result.error);
      }
    } catch (err) {
      console.error("Error selecting image:", err);
      Alert.alert("Error", "An error occurred while selecting image");
    }
  };

  const handleImageEditorSave = (editedImageUri: string) => {
    setSelectedImage(editedImageUri);
    setShowImageEditor(false);
    setTempImageUri(null);
    setUiState("answering");
  };

  const handleImageEditorCancel = () => {
    setShowImageEditor(false);
    setTempImageUri(null);
    setUiState("idle");
  };

  const handleSubmitImage = async () => {
    if (!selectedImage || !currentPrompt) {
      Alert.alert("Error", "Missing image or question");
      return;
    }

    setIsAnalyzingImage(true);
    setUiState("loading");

    try {
      const analysisResult = await GeminiService.analyzeActionImage(selectedImage);

      if (!analysisResult.success || !analysisResult.rawResponse) {
        throw new Error(analysisResult.error || "Failed to analyze image");
      }

      const answer = analysisResult.rawResponse;
      setSelectedImage(null);

      await mapAnswerToCategory(currentPrompt, answer);
    } catch (err) {
      console.error("Error processing image:", err);
      Alert.alert("Error", "Failed to process image. Please try again.");
      setUiState("idle");
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  // --- UI helpers ---

  const handleCardClick = (categoryName: string) => {
    const mapped = mappedCategories.find((c) => c.category === categoryName);
    if (mapped) {
      Alert.alert(categoryName, `Why you have this trait:\n\n"${mapped.justification}"`, [
        { text: "OK" },
      ]);
    } else if (mappedCategories.length === 0) {
      Alert.alert(
        "Not Yet Mapped",
        "This trait is not yet mapped to you. Click the 'Start' button to discover new traits!",
        [{ text: "OK" }]
      );
    } else {
      Alert.alert(
        "Not Yet Mapped",
        "This trait is not yet mapped to you. Click the 'Continue' button to discover new traits!",
        [{ text: "OK" }]
      );
    }
  };

  const renderCategoryCards = () => {
    const mappedNames = new Map(mappedCategories.map((c) => [c.category, c]));

    return CATEGORY_TAXONOMY.map((item) => (
      <CategoryCard
        key={item.category}
        category={{
          ...item,
          example: "",
          icon: (item.icon as any) || ("category" as any),
        }}
        isMapped={mappedNames.has(item.category)}
        mappedData={mappedNames.get(item.category)}
        onPress={() => handleCardClick(item.category)}
      />
    ));
  };

  const completionPercentage = Math.round((mappedCategories.length / TOTAL_CATEGORIES) * 100);

  React.useEffect(() => {
    if (
      uiState === "idle" &&
      currentPrompt &&
      !showQuestionInputModal &&
      !suppressModalReopenRef.current
    ) {
      setPendingQuestion(currentPrompt);
      setShowQuestionInputModal(true);
    }
  }, [uiState, currentPrompt, showQuestionInputModal]);

  React.useEffect(() => {
    if (showInputMethodModal && prefetchedQuestion) {
      setPendingQuestion(prefetchedQuestion);
      setShowQuestionInputModal(true);
      setShowInputMethodModal(false);
    }
  }, [showInputMethodModal, prefetchedQuestion]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading your journey...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <MaterialIcons name="explore" size={40} color="#fff" />
          <Text style={styles.title}>My Skills Passport</Text>
          <Text style={styles.subtitle}>
            {mappedCategories.length}/{TOTAL_CATEGORIES} categories discovered
          </Text>
        </View>

        <Card style={styles.progressCard}>
          <Card.Content>
            <View style={styles.progressHeader}>
              <MaterialIcons name="trending-up" size={24} color="#667eea" />
              <Text style={styles.progressTitle}>Your Progress</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{mappedCategories.length}</Text>
                <Text style={styles.statLabel}>Mapped</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{TOTAL_CATEGORIES}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{completionPercentage}%</Text>
                <Text style={styles.statLabel}>Complete</Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${completionPercentage}%` }]} />
            </View>

            {mappedCategories.length < TOTAL_CATEGORIES && (
              <TouchableOpacity
                style={styles.startButton}
                onPress={handleStartButtonPress}
                disabled={uiState !== "idle"}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name="play-arrow"
                  size={28}
                  color="white"
                  style={styles.startButtonIcon}
                />
                <Text style={styles.startButtonText}>
                  {mappedCategories.length === 0 ? "Start" : "Continue"}
                </Text>
              </TouchableOpacity>
            )}
          </Card.Content>
        </Card>

        <TopTabBar
          containerStyle={styles.topTabBarInPassport}
          tabs={[
            {
              key: "profile",
              title: "Profile",
              onPress: () => navigation.navigate("Profile"),
            },
            {
              key: "schools",
              title: "Schools",
              onPress: () => {},
            },
            {
              key: "interests",
              title: "Interests",
              onPress: () => {},
            },
          ]}
        />

        {error ? (
          <Card style={styles.errorCard}>
            <Card.Content>
              <Text style={styles.errorText}>🚨 {error}</Text>
            </Card.Content>
          </Card>
        ) : null}

        <View style={styles.categoryGrid}>{renderCategoryCards()}</View>
      </ScrollView>

      <LoadingModal visible={uiState === "loading"} message={loadingMessage} />

      <CompletionModal visible={uiState === "complete"} onDismiss={() => setUiState("idle")} />

      <WeakFitModal
        visible={uiState === "weak-fit"}
        justification={weakFitJustification}
        onTryAgain={handleWeakFitTryAgain}
        onNewQuestion={handleWeakFitNewQuestion}
      />

      <AnswerModal
        visible={uiState === "answering"}
        currentPrompt={currentPrompt}
        userAnswer={userAnswer}
        selectedImage={selectedImage}
        isAnswerFromVoice={isAnswerFromVoice}
        isAnalyzingImage={isAnalyzingImage}
        onDismiss={dismissAnswerModal}
        onZoomImage={() => setZoomViewerVisible(true)}
        onChangeImage={() => {
          setSelectedImage(null);
          showImageSourceDialog();
        }}
        onSubmitImage={handleSubmitImage}
        onAnswerChange={setUserAnswer}
        onRecordAgain={() => {
          setUiState("voice-recording");
          setUserAnswer("");
          setIsAnswerFromVoice(false);
        }}
        onSubmit={handleSubmitAnswer}
      />

      <VoiceRecordingModal
        visible={uiState === "voice-recording"}
        currentPrompt={currentPrompt}
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        recordingUri={recordingUri}
        isProcessingAudio={isProcessingAudio}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onRecordAgain={() => {
          setRecordingUri(null);
          setRecordingDuration(0);
        }}
        onSubmit={handleVoiceSubmit}
        onCancel={handleVoiceCancel}
      />

      {/* Combined Question + Input Type Modal */}
      <QuestionInputModal
        visible={showQuestionInputModal && !!pendingQuestion}
        question={pendingQuestion || ""}
        onSelectInputType={handleInputTypeSelect}
        onSubmitText={handleSubmitTextFromModal}
        onClose={() => {
          setShowQuestionInputModal(false);
          setPendingQuestion(null);
          setCurrentPrompt("");
        }}
      />

      {showImageEditor && tempImageUri && (
        <ImageEditor
          imageUri={tempImageUri}
          onSave={handleImageEditorSave}
          onCancel={handleImageEditorCancel}
        />
      )}

      {zoomViewerVisible && selectedImage && (
        <ZoomableImageView
          imageUri={selectedImage}
          visible={zoomViewerVisible}
          onClose={() => setZoomViewerVisible(false)}
        />
      )}

      {showConfetti && (
        <ConfettiCannon
          count={200}
          origin={{ x: width / 2, y: 0 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={3000}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  questionInputModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  questionInputModalContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    alignItems: "center",
  },
  questionInputModalQuestion: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  questionInputModalSubtitle: {
    fontSize: 15,
    marginBottom: 18,
    color: "#555",
    textAlign: "center",
  },
  questionInputModalInputRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  questionInputModalInputButton: {
    alignItems: "center",
    marginHorizontal: 12,
  },
  questionInputModalInputLabel: {
    marginTop: 6,
  },
  questionInputModalCancelButton: {
    marginTop: 24,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  questionInputModalCancelText: {
    color: "#667eea",
    fontWeight: "bold",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  headerActionButton: {
    marginLeft: 12,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#667eea",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 10,
  },
  topTabBarInPassport: {
    marginTop: 14,
    marginBottom: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 5,
  },
  progressCard: {
    marginBottom: 20,
    elevation: 4,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  statBox: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#667eea",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 5,
  },
  progressBar: {
    height: 10,
    backgroundColor: "#E0E0E0",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#667eea",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  startButtonIcon: {
    marginRight: 8,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  errorCard: {
    marginBottom: 20,
    backgroundColor: "#ffebee",
    elevation: 4,
  },
  errorText: {
    fontSize: 14,
    color: "#c62828",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
});
