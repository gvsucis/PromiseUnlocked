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
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

const MAX_RECORDING_SECONDS = 120;
const WARNING_SECONDS = 15;

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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface RecordingInterfaceProps {
  isRecording: boolean;
  recordingDuration: number;
  isProcessingAudio: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

function RecordingInterface({
  isRecording,
  recordingDuration,
  isProcessingAudio,
  onStartRecording,
  onStopRecording,
}: Readonly<RecordingInterfaceProps>) {
  const isNearLimit = recordingDuration >= MAX_RECORDING_SECONDS - WARNING_SECONDS;
  return (
    <>
      <View style={styles.recordingVisualization}>
        <View style={[styles.recordingCircle, isRecording && styles.recordingActive]}>
          <Ionicons
            name={isRecording ? "stop" : "mic"}
            size={48}
            color={isRecording ? "white" : "#666"}
          />
        </View>
      </View>

      {isRecording && (
        <Text style={[styles.recordingTimer, isNearLimit && styles.recordingTimerWarning]}>
          {formatDuration(recordingDuration)}
        </Text>
      )}

      <Text style={styles.recordingMaxHint}>Max {formatDuration(MAX_RECORDING_SECONDS)}</Text>

      <Text style={styles.recordingInstruction}>
        {isRecording ? "Recording... Tap to stop" : "Tap to start recording"}
      </Text>

      <TouchableOpacity
        style={[styles.recordButton, isRecording && styles.recordButtonActive]}
        onPress={isRecording ? onStopRecording : onStartRecording}
        disabled={isProcessingAudio}
      >
        <Text style={[styles.recordButtonText, isRecording && styles.recordButtonTextActive]}>
          {isRecording ? "Stop Recording" : "Start Recording"}
        </Text>
      </TouchableOpacity>

      <Text style={styles.recordingGuidance}>
        Speak naturally. Include what you did, how you did it, and what you learned.
      </Text>
    </>
  );
}

interface PlaybackInterfaceProps {
  recordingUri: string;
  recordingDuration: number;
  isProcessingAudio: boolean;
  onRecordAgain: () => void;
  onSubmit: () => void;
}

function PlaybackInterface({
  recordingUri,
  recordingDuration,
  isProcessingAudio,
  onRecordAgain,
  onSubmit,
}: Readonly<PlaybackInterfaceProps>) {
  const player = useAudioPlayer(recordingUri);
  const status = useAudioPlayerStatus(player);
  const isPlaying = status.playing;

  // Releasing the player on unmount already stops audio; never call player
  // methods from a cleanup, or the native shared object may already be gone.
  React.useEffect(() => {
    if (isProcessingAudio) player.pause();
  }, [isProcessingAudio, player]);

  const togglePlayback = () => {
    if (isPlaying) {
      player.pause();
    } else if (status.duration > 0 && status.currentTime >= status.duration - 0.2) {
      void player.seekTo(0).then(() => player.play());
    } else {
      player.play();
    }
  };

  return (
    <>
      <View style={styles.playbackContainer}>
        <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
        <Text style={styles.playbackTitle}>Recording Complete!</Text>
        <Text style={styles.playbackDuration}>Duration: {formatDuration(recordingDuration)}</Text>
      </View>

      <TouchableOpacity style={styles.previewButton} onPress={togglePlayback}>
        <Ionicons name={isPlaying ? "pause-circle" : "play-circle"} size={28} color="#4ECDC4" />
        <Text style={styles.previewButtonText}>{isPlaying ? "Pause" : "Preview recording"}</Text>
      </TouchableOpacity>

      <View style={styles.voiceActions}>
        <TouchableOpacity style={styles.voiceActionButton} onPress={onRecordAgain}>
          <Text style={styles.voiceActionButtonText}>Record Again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.voiceActionButton, styles.voiceActionButtonPrimary]}
          onPress={onSubmit}
          disabled={isProcessingAudio}
        >
          <Text style={[styles.voiceActionButtonText, styles.voiceActionButtonTextPrimary]}>
            {isProcessingAudio ? "Processing..." : "Use Recording"}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
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
}: Readonly<VoiceRecordingModalProps>) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onCancel}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
              <Text style={styles.questionTitle}>Voice Response</Text>
              <Text style={styles.questionText}>{currentPrompt || "(No question loaded)"}</Text>

              <View style={styles.voiceRecordingContainer}>
                {recordingUri ? (
                  <PlaybackInterface
                    recordingUri={recordingUri}
                    recordingDuration={recordingDuration}
                    isProcessingAudio={isProcessingAudio}
                    onRecordAgain={onRecordAgain}
                    onSubmit={onSubmit}
                  />
                ) : (
                  <RecordingInterface
                    isRecording={isRecording}
                    recordingDuration={recordingDuration}
                    isProcessingAudio={isProcessingAudio}
                    onStartRecording={onStartRecording}
                    onStopRecording={onStopRecording}
                  />
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
    maxWidth: 450,
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
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
  recordingTimerWarning: {
    color: "#FF9800",
  },
  recordingMaxHint: {
    fontSize: 12,
    color: "#999",
    marginTop: 6,
    textAlign: "center",
  },
  recordingGuidance: {
    fontSize: 13,
    fontStyle: "italic",
    color: "#888",
    textAlign: "center",
    paddingHorizontal: 10,
    marginTop: 18,
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
  previewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  previewButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4ECDC4",
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
