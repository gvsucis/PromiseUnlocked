import React from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface AnswerModalProps {
  readonly visible: boolean;
  readonly currentPrompt: string;
  readonly userAnswer: string;
  readonly selectedImage: string | null;
  readonly isAnswerFromVoice: boolean;
  readonly isAnalyzingImage: boolean;
  readonly onSubmit: () => void;
  readonly onSubmitImage: () => void;
  readonly onChangeImage: () => void;
  readonly onZoomImage: () => void;
  readonly onRecordAgain: () => void;
  readonly onDismiss: () => void;
  readonly onAnswerChange: (text: string) => void;
}

export function AnswerModal({
  visible,
  currentPrompt,
  userAnswer,
  selectedImage,
  isAnswerFromVoice,
  isAnalyzingImage,
  onSubmit,
  onSubmitImage,
  onChangeImage,
  onZoomImage,
  onRecordAgain,
  onDismiss,
  onAnswerChange,
}: AnswerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onShow={() =>
        console.log("✅ Answer modal onShow callback fired with prompt:", currentPrompt)
      }
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

          <View style={styles.modalContent}>
            <Text style={styles.questionTitle}>Question for You</Text>
            <ScrollView
              style={{ maxHeight: 200 }}
              contentContainerStyle={{ paddingVertical: 4 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.questionText}>{currentPrompt || "(No question loaded)"}</Text>
            </ScrollView>

            {selectedImage ? (
              <>
                <TouchableOpacity onPress={onZoomImage}>
                  <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                </TouchableOpacity>
                <View style={styles.imageActions}>
                  <TouchableOpacity style={styles.replaceImageButton} onPress={onChangeImage}>
                    <Text style={styles.replaceImageButtonText}>Change Image</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      { flex: 1 },
                      isAnalyzingImage && styles.submitButtonDisabled,
                    ]}
                    onPress={onSubmitImage}
                    disabled={isAnalyzingImage}
                  >
                    <Text style={styles.submitButtonText}>
                      {isAnalyzingImage ? "Analyzing..." : "Submit"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {isAnswerFromVoice && (
                  <View style={styles.voiceTranscriptionBanner}>
                    <Ionicons name="mic" size={16} color="#4ECDC4" />
                    <Text style={styles.voiceTranscriptionText}>Voice transcription</Text>
                    <TouchableOpacity onPress={onRecordAgain} style={styles.recordAgainButton}>
                      <Ionicons name="refresh" size={14} color="#4ECDC4" />
                      <Text style={styles.recordAgainText}>Record again</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TextInput
                  style={[styles.answerInput, isAnswerFromVoice && styles.answerInputVoice]}
                  value={userAnswer}
                  onChangeText={onAnswerChange}
                  placeholder="Example: 'I led a team of 5 students to build a mobile app that helps local farmers track inventory. We used React Native and Firebase, and it's now used by 50+ farmers in our community.'"
                  placeholderTextColor="#999"
                  multiline
                  autoCorrect={true}
                  numberOfLines={4}
                />
                <TouchableOpacity style={styles.submitButton} onPress={onSubmit}>
                  <Text style={styles.submitButtonText}>Submit Answer</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 25,
    width: "90%",
    maxWidth: 500,
  },
  questionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  questionText: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
    textAlign: "center",
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    marginTop: 15,
    marginBottom: 15,
    resizeMode: "contain",
    backgroundColor: "#f1f3f5",
  },
  imageActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  replaceImageButton: {
    flex: 1,
    backgroundColor: "#eef2ff",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  replaceImageButtonText: {
    color: "#4f46e5",
    fontSize: 15,
    fontWeight: "600",
  },
  voiceTranscriptionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fcfc",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#4ECDC4",
  },
  voiceTranscriptionText: {
    fontSize: 14,
    color: "#4ECDC4",
    fontWeight: "600",
    marginLeft: 6,
    flex: 1,
  },
  recordAgainButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "rgba(78, 205, 196, 0.1)",
  },
  recordAgainText: {
    fontSize: 12,
    color: "#4ECDC4",
    fontWeight: "600",
    marginLeft: 4,
  },
  answerInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginTop: 15,
    marginBottom: 20,
    fontSize: 16,
    lineHeight: 20,
    textAlignVertical: "top",
    includeFontPadding: false,
    minHeight: 110,
    backgroundColor: "#fafafa",
  },
  answerInputVoice: {
    borderColor: "#4ECDC4",
    borderWidth: 2,
    backgroundColor: "#f9fffe",
  },
  submitButton: {
    backgroundColor: "#667eea",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
});
