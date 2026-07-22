import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useDialogue } from "../../context/DialogueProvider";
import { colors } from "../../styles/global";

type DialogueButtonProps =
  | { variant: "dashboard" }
  | { variant: "tab" }
  | { variant: "region"; region: string }
  | { variant: "addDetail"; stamp: string; region: string };

export function DialogueButton(props: DialogueButtonProps) {
  const d = useDialogue();
  const busy = d.uiState !== "idle";

  if (props.variant === "tab") {
    return (
      <TouchableOpacity onPress={() => void d.forceNewQuestion()} activeOpacity={0.7}>
        <MaterialIcons name="add-circle-outline" size={48} color={colors.text.muted} />
      </TouchableOpacity>
    );
  }

  if (props.variant === "addDetail") {
    return (
      <TouchableOpacity
        style={styles.generateButton}
        onPress={() => d.startAddDetailQuestion(props.stamp, props.region)}
        disabled={busy}
        activeOpacity={0.8}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <MaterialIcons name="auto-awesome" size={20} color="#fff" />
        )}
        <Text style={styles.generateButtonText}>{busy ? "Loading..." : "Add Detail"}</Text>
      </TouchableOpacity>
    );
  }

  if (props.variant === "region") {
    return (
      <TouchableOpacity
        style={styles.generateButton}
        onPress={() => void d.generateQuestionForRegion(props.region)}
        disabled={busy}
        activeOpacity={0.8}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <MaterialIcons name="auto-awesome" size={20} color="#fff" />
        )}
        <Text style={styles.generateButtonText}>{busy ? "Exploring..." : "Explore region"}</Text>
      </TouchableOpacity>
    );
  }

  const hasPendingQuestion = !!d.currentPrompt && !d.showQuestionInputModal;
  return (
    <TouchableOpacity
      style={styles.startButton}
      onPress={() => void (hasPendingQuestion ? d.reopenPendingQuestion() : d.startNewQuestion())}
      disabled={busy}
      activeOpacity={0.8}
    >
      <MaterialIcons name="play-arrow" size={28} color="white" style={styles.startButtonIcon} />
      <Text style={styles.startButtonText}>{hasPendingQuestion ? "Continue" : "Start"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent.teal,
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
  startButtonIcon: { marginRight: 8 },
  startButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold", letterSpacing: 0.5 },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent.sky,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 24,
    gap: 10,
  },
  generateButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
