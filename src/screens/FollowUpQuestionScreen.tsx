import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Card, Title, Paragraph, Snackbar, TextInput, Button } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types/navigation";
import { ImagePickerService } from "../services/imagePickerService";
import { GeminiService } from "../services/geminiService";
import ZoomableImageView from "../components/ZoomableImageView";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";

type FollowUpQuestionScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "FollowUpQuestion"
>;

type FollowUpQuestionScreenRouteProp = RouteProp<RootStackParamList, "FollowUpQuestion">;

interface Props {
  navigation: FollowUpQuestionScreenNavigationProp;
  route: FollowUpQuestionScreenRouteProp;
}

export default function FollowUpQuestionScreen({ navigation, route }: Readonly<Props>) {
  const { question } = route.params;

  const [textInput, setTextInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [zoomViewerVisible, setZoomViewerVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (recordingTimer.current) clearInterval(recordingTimer.current);
      if (recorder.isRecording) {
        recorder.stop().catch(() => {});
      }
    };
  }, []);

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const handleImageSelection = async (useCamera: boolean) => {
    try {
      const hasPermissions = await ImagePickerService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert("Permissions Required", "Camera and photo library permissions are required.");
        return;
      }
      const result = useCamera
        ? await ImagePickerService.takePhotoWithCamera()
        : await ImagePickerService.pickImageFromGalleryWithOptions(false);
      if (result.success && result.imageUri) {
        setSelectedImage(result.imageUri);
        showSnackbar("Image attached!");
      } else {
        showSnackbar(result.error || "Failed to select image");
      }
    } catch (error) {
      console.error("Image selection error:", error);
      showSnackbar("An error occurred while selecting image");
    }
  };

  const handleStartRecording = async () => {
    try {
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== "granted") {
        showSnackbar("Microphone permission is required");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordingDuration(0);
      setIsRecording(true);
      recordingTimer.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      showSnackbar("Failed to start recording");
    }
  };

  const handleStopRecording = async () => {
    if (!recorder.isRecording) return;
    try {
      setIsRecording(false);
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (recorder.uri) setVoiceUri(recorder.uri);
    } catch (error) {
      console.error("Failed to stop recording:", error);
      showSnackbar("Failed to stop recording");
    }
  };

  const handleSubmit = async () => {
    if (!textInput.trim() && !selectedImage && !voiceUri) {
      showSnackbar("Please enter a response, record audio, or attach an image");
      return;
    }

    setIsAnalyzing(true);
    try {
      if (voiceUri) {
        // Voice-to-text: transcribe into the input so it can be reviewed and sent.
        const transcription = await GeminiService.transcribeAudio(voiceUri);
        if (transcription.success && transcription.transcript?.trim()) {
          setTextInput((prev) =>
            [prev.trim(), transcription.transcript!.trim()].filter(Boolean).join(" ")
          );
          setVoiceUri(null);
          setRecordingDuration(0);
        } else {
          Alert.alert(
            "Transcription Failed",
            transcription.error || "Couldn't transcribe your recording. Please try again."
          );
        }
        return;
      }

      if (selectedImage) {
        const result = await GeminiService.analyzeActionImage(selectedImage, question);
        if (result.success) {
          navigation.navigate("Result", { result });
        } else {
          Alert.alert("Analysis Failed", result.error || "Failed to analyze");
        }
      } else {
        setTextInput("");
        navigation.goBack();
      }
    } catch (error) {
      console.error("Follow-up submit error:", error);
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImagePickPress = () => {
    Alert.alert("Choose Image Source", "How would you like to add your image?", [
      { text: "Take Photo", onPress: () => handleImageSelection(true) },
      { text: "Choose from Gallery", onPress: () => handleImageSelection(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Question Card */}
          <Card style={styles.questionCard}>
            <Card.Content>
              <View style={styles.cardTitleContainer}>
                <MaterialIcons name="extension" size={24} color="#667eea" />
                <Title style={styles.cardTitle}>Follow-up Question</Title>
              </View>
              <Paragraph style={styles.questionText}>{question}</Paragraph>
            </Card.Content>
          </Card>

          {/* Text Input */}
          <Card style={styles.inputCard}>
            <Card.Content>
              <View style={styles.cardTitleContainer}>
                <MaterialIcons name="edit" size={22} color="#667eea" />
                <Title style={styles.inputTitle}>Your Response</Title>
              </View>
              <TextInput
                mode="outlined"
                placeholder="Type your answer here..."
                value={textInput}
                onChangeText={setTextInput}
                multiline
                numberOfLines={4}
                style={styles.textInput}
                outlineColor="#6C5CE7"
                activeOutlineColor="#667eea"
              />
            </Card.Content>
          </Card>

          {/* Preview Row: image/voice on left, icons on right */}
          <View style={styles.attachmentRow}>
            <View style={styles.previewsLeft}>
              {selectedImage && (
                <View style={styles.previewItem}>
                  <TouchableOpacity onPress={() => setZoomViewerVisible(true)}>
                    <Image source={{ uri: selectedImage }} style={styles.thumbnail} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => setSelectedImage(null)}>
                    <MaterialIcons name="cancel" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              )}
              {voiceUri && (
                <View style={styles.previewItem}>
                  <View style={styles.voicePreview}>
                    <MaterialIcons name="mic" size={20} color="#4ECDC4" />
                    <Text style={styles.voiceDuration}>{recordingDuration}s</Text>
                  </View>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => setVoiceUri(null)}>
                    <MaterialIcons name="cancel" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <View style={styles.iconsRight}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={isRecording ? handleStopRecording : handleStartRecording}
              >
                <MaterialIcons
                  name={isRecording ? "stop-circle" : "mic"}
                  size={28}
                  color={isRecording ? "#FF6B6B" : "#4ECDC4"}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleImagePickPress}>
                <MaterialIcons name="image" size={28} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <Button
              mode="text"
              textColor="rgba(255,255,255,0.7)"
              onPress={() => navigation.goBack()}
            >
              Skip
            </Button>
            <Button
              mode="text"
              textColor="rgba(255,255,255,0.7)"
              onPress={() => navigation.goBack()}
            >
              New Region
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={isAnalyzing}
              disabled={isAnalyzing || (!textInput.trim() && !selectedImage && !voiceUri)}
              buttonColor="#6C5CE7"
            >
              {isAnalyzing ? "Analyzing..." : "Submit"}
            </Button>
          </View>
        </ScrollView>

        {/* Zoom Viewer */}
        {zoomViewerVisible && selectedImage && (
          <ZoomableImageView
            imageUri={selectedImage}
            visible={zoomViewerVisible}
            onClose={() => setZoomViewerVisible(false)}
          />
        )}

        {/* Snackbar */}
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          style={styles.snackbar}
        >
          {snackbarMessage}
        </Snackbar>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  questionCard: {
    marginBottom: 20,
    elevation: 4,
    borderRadius: 12,
  },
  cardTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#667eea",
    marginBottom: 10,
  },
  questionText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
  },
  inputCard: {
    marginBottom: 20,
    elevation: 4,
    borderRadius: 12,
  },
  inputTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#667eea",
    marginBottom: 10,
  },
  textInput: {
    marginBottom: 0,
    backgroundColor: "#fff",
  },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
    minHeight: 60,
  },
  previewsLeft: {
    flexDirection: "row",
    gap: 10,
    flex: 1,
    flexWrap: "wrap",
  },
  previewItem: {
    position: "relative",
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  voicePreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "rgba(78, 205, 196, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  voiceDuration: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4ECDC4",
  },
  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  iconsRight: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginLeft: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  snackbar: {
    backgroundColor: "#6C5CE7",
  },
});
