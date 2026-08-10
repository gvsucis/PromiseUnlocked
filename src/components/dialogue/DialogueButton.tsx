import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from "react-native";
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
        style={styles.attachButton}
        onPress={() => d.startAddDetailQuestion(props.stamp, props.region)}
        disabled={busy}
        activeOpacity={0.85}
      >
        <View style={styles.attachIconBadge}>
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="add" size={22} color="#fff" />
          )}
        </View>
        <View style={styles.attachTextGroup}>
          <Text style={styles.attachButtonText}>{busy ? "Analyzing..." : "Add Detail"}</Text>
        </View>
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
  const hasStarted = d.interactions.length > 0 || d.mappedCategories.length > 0;
  return (
    <TouchableOpacity
      style={styles.startButton}
      onPress={() => void (hasPendingQuestion ? d.reopenPendingQuestion() : d.startNewQuestion())}
      disabled={busy}
      activeOpacity={0.8}
    >
      <MaterialIcons name="play-arrow" size={28} color="white" style={styles.startButtonIcon} />
      <Text style={styles.startButtonText}>{hasStarted ? "Continue" : "Start"}</Text>
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
  attachButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",

    position: "relative",

    backgroundColor: colors.accent.magenta,
    borderRadius: 16,
    paddingVertical: 22,
    marginTop: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,

    width: 280,
  },
  attachIconBadge: {
    position: "absolute",
    left: 12,

    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.22)",

    alignItems: "center",
    justifyContent: "center",
  },
  attachTextGroup: {
    alignItems: "center",
  },
  attachButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
});
