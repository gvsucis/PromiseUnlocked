import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface VoiceRecordingModalProps {
  visible: boolean;
  currentPrompt: string;
  isRecording: boolean;
  recordingDuration: number;
  recordingUri: string | null;
  isProcessingAudio: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onSubmit: () => void;
  onRecordAgain: () => void;
  onCancel: () => void;
}

export function VoiceRecordingModal({
  visible,
  currentPrompt,
  isRecording,
  recordingDuration,
  recordingUri,
  isProcessingAudio,
  onStartRecording,
  onStopRecording,
  onSubmit,
  onRecordAgain,
  onCancel,
}: VoiceRecordingModalProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <Text style={styles.questionTitle}>Voice Response</Text>
              <Text style={styles.questionText}>
                {currentPrompt || "(No question loaded)"}
              </Text>

              <View style={styles.voiceRecordingContainer}>
                {!recordingUri ? (
                  /* Recording Interface */
                  <>
                    <View style={styles.recordingVisualization}>
                      <View
                        style={[
                          styles.recordingCircle,
                          isRecording && styles.recordingActive,
                        ]}
                      >
                        <Ionicons
                          name={isRecording ? "stop" : "mic"}
                          size={48}
                          color={isRecording ? "white" : "#666"}
                        />
                      </View>
                    </View>

                    {isRecording && (
                      <Text style={styles.recordingTimer}>
                        {formatDuration(recordingDuration)}
                      </Text>
                    )}

                    <Text style={styles.recordingInstruction}>
                      {isRecording
                        ? "Recording... Tap to stop"
                        : "Tap to start recording"}
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.recordButton,
                        isRecording && styles.recordButtonActive,
                      ]}
                      onPress={isRecording ? onStopRecording : onStartRecording}
                      disabled={isProcessingAudio}
                    >
                      <Text
                        style={[
                          styles.recordButtonText,
                          isRecording && styles.recordButtonTextActive,
                        ]}
                      >
                        {isRecording ? "Stop Recording" : "Start Recording"}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  /* Playback Interface */
                  <>
                    <View style={styles.playbackContainer}>
                      <Ionicons
                        name="checkmark-circle"
                        size={64}
                        color="#4CAF50"
                      />
                      <Text style={styles.playbackTitle}>
                        Recording Complete!
                      </Text>
                      <Text style={styles.playbackDuration}>
                        Duration: {formatDuration(recordingDuration)}
                      </Text>
                    </View>

                    <View style={styles.voiceActions}>
                      <TouchableOpacity
                        style={styles.voiceActionButton}
                        onPress={onRecordAgain}
                      >
                        <Text style={styles.voiceActionButtonText}>
                          Record Again
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.voiceActionButton,
                          styles.voiceActionButtonPrimary,
                        ]}
                        onPress={onSubmit}
                        disabled={isProcessingAudio}
                      >
                        <Text
                          style={[
                            styles.voiceActionButtonText,
                            styles.voiceActionButtonTextPrimary,
                          ]}
                        >
                          {isProcessingAudio
                            ? "Processing..."
                            : "Submit Recording"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 25,
    width: "90%",
    maxWidth: 450,
  },
  questionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  questionText: {
    fontSize: 15,
    color: "#666",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 25,
  },
  voiceRecordingContainer: {
    alignItems: "center",
  },
  recordingVisualization: {
    marginVertical: 20,
  },
  recordingCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#ddd",
  },
  recordingActive: {
    backgroundColor: "#FF5252",
    borderColor: "#FF5252",
    shadowColor: "#FF5252",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  recordingTimer: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FF5252",
    marginTop: 15,
    fontVariant: ["tabular-nums"],
  },
  recordingInstruction: {
    fontSize: 16,
    color: "#666",
    marginTop: 10,
    marginBottom: 25,
    textAlign: "center",
  },
  recordButton: {
    backgroundColor: "#4ECDC4",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 25,
    minWidth: 180,
    alignItems: "center",
  },
  recordButtonActive: {
    backgroundColor: "#FF5252",
  },
  recordButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  recordButtonTextActive: {
    color: "white",
  },
  playbackContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  playbackTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 15,
    marginBottom: 8,
  },
  playbackDuration: {
    fontSize: 16,
    color: "#666",
  },
  voiceActions: {
    flexDirection: "row",
    gap: 15,
    width: "100%",
    marginTop: 20,
  },
  voiceActionButton: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  voiceActionButtonPrimary: {
    backgroundColor: "#4ECDC4",
  },
  voiceActionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  voiceActionButtonTextPrimary: {
    color: "#fff",
  },
});
