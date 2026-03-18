import React, { useRef } from "react";
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Alert } from "react-native";
import { Text, Card, ActivityIndicator } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import ConfettiCannon from "react-native-confetti-cannon";
import { RootStackParamList } from "../types/navigation";
import { CATEGORY_TAXONOMY, TOTAL_CATEGORIES } from "../services/categoryTaxonomyService";
import { GeminiService } from "../services/geminiService";
import { ImagePickerService } from "../services/imagePickerService";
import { Audio } from "expo-av";
import ZoomableImageView from "../components/ZoomableImageView";
import ImageEditor from "../components/ImageEditor";
import { LoadingModal } from "../components/dialogue/LoadingModal";
import { CompletionModal } from "../components/dialogue/CompletionModal";
import { WeakFitModal } from "../components/dialogue/WeakFitModal";
import { InputMethodModal } from "../components/dialogue/InputMethodModal";
import { AnswerModal } from "../components/dialogue/AnswerModal";
import { VoiceRecordingModal } from "../components/dialogue/VoiceRecordingModal";
import { CategoryCard } from "../components/dialogue/CategoryCard";
import { useDialogueState } from "../hooks/useDialogueState";

const { width } = Dimensions.get("window");

type DialogueDashboardNavigationProp = StackNavigationProp<RootStackParamList, "DialogueDashboard">;
type DialogueDashboardRouteProp = RouteProp<RootStackParamList, "DialogueDashboard">;

interface Props {
  readonly navigation: DialogueDashboardNavigationProp;
  readonly route: DialogueDashboardRouteProp;
}

export default function DialogueDashboardScreen({ navigation }: Props) {
  const {
    mappedCategories,
    uiState,
    currentPrompt,
    userAnswer,
    loadingMessage,
    error,
    weakFitJustification,
    showConfetti,
    showInputMethodModal,
    loading,
    setUserAnswer,
    setUiState,
    setCurrentPrompt,
    setShowInputMethodModal,
    resetData,
    mapAnswerToCategory,
    handleStartButtonPress,
    handleTextInputPress,
    handleVoiceInputPress,
    prepareImageQuestion,
    handleSubmitAnswer,
    handleWeakFitTryAgain,
    handleWeakFitNewQuestion,
    dismissAnswerModal,
  } = useDialogueState();

  // Voice recording state
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingDuration, setRecordingDuration] = React.useState(0);
  const [recordingUri, setRecordingUri] = React.useState<string | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = React.useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
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
        <TouchableOpacity
          onPress={handleReset}
          style={{ marginRight: 15 }}
          disabled={uiState !== "idle" && uiState !== "complete"}
        >
          <MaterialIcons
            name="refresh"
            size={24}
            color={uiState !== "idle" && uiState !== "complete" ? "#ccc" : "#fff"}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, uiState]);

  const handleReset = () => {
    Alert.alert("Reset Dashboard", "Are you sure you want to reset? All progress will be lost.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          try {
            await resetData();
          } catch {
            Alert.alert("Error", "Failed to reset dashboard");
          }
        },
      },
    ]);
  };

  const handleInputMethodSelect = async (method: "text" | "voice" | "image") => {
    setShowInputMethodModal(false);
    await new Promise((resolve) => setTimeout(resolve, 150));

    if (method === "text") {
      handleTextInputPress();
    } else if (method === "voice") {
      handleVoiceInputPress();
    } else if (method === "image") {
      const ready = prepareImageQuestion();
      if (ready) showImageSourceDialog();
    }
  };

  // --- Voice recording ---

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
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
    if (!recordingRef.current) return;

    try {
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

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
    if (isRecording && recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
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
    } else {
      {
        mappedCategories.length === 0
          ? Alert.alert(
              "Not Yet Mapped",
              "This trait is not yet mapped to you. Click the 'Start' button to discover new traits!",
              [{ text: "OK" }]
            )
          : Alert.alert(
              "Not Yet Mapped",
              "This trait is not yet mapped to you. Click the 'Continue' button to discover new traits!",
              [{ text: "OK" }]
            );
      }
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
          icon: item.icon || "category",
        }}
        isMapped={mappedNames.has(item.category)}
        mappedData={mappedNames.get(item.category)}
        onPress={() => handleCardClick(item.category)}
      />
    ));
  };

  const completionPercentage = Math.round((mappedCategories.length / TOTAL_CATEGORIES) * 100);

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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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

      <InputMethodModal
        visible={showInputMethodModal}
        onSelect={handleInputMethodSelect}
        onClose={() => setShowInputMethodModal(false)}
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
