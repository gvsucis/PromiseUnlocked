/**
 * Conflict Resolution Modal
 *
 * Displays detected conflicts between new statements and existing facts,
 * allowing the user to clarify, update, or merge conflicting information.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { FactConflict } from "../../hooks/useMemoryConversation";

interface ConflictResolutionModalProps {
  visible: boolean;
  conflicts: FactConflict[];
  clarificationPrompt?: string;
  onResolve: (resolution: {
    conflictId: string;
    action: "update" | "reject" | "merge";
    correctedValue?: string;
    note?: string;
  }) => void;
  onDismiss: () => void;
  isProcessing?: boolean;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  visible,
  conflicts,
  clarificationPrompt,
  onResolve,
  onDismiss,
  isProcessing = false,
}) => {
  const [selectedConflict, setSelectedConflict] = useState<FactConflict | null>(null);
  const [correctedValue, setCorrectedValue] = useState("");
  const [note, setNote] = useState("");
  const [resolutionAction, setResolutionAction] = useState<"update" | "reject" | "merge" | null>(
    null
  );

  const handleResolve = () => {
    if (!selectedConflict || !resolutionAction) return;

    onResolve({
      conflictId: selectedConflict.id,
      action: resolutionAction,
      correctedValue: resolutionAction === "update" ? correctedValue : undefined,
      note: note || undefined,
    });

    // Reset state
    setSelectedConflict(null);
    setCorrectedValue("");
    setNote("");
    setResolutionAction(null);
  };

  const getConflictIcon = (severity: FactConflict["severity"]) => {
    switch (severity) {
      case "high":
        return <Ionicons name="alert-circle" size={24} color="#FF6B6B" />;
      case "medium":
        return <Ionicons name="information-circle" size={24} color="#FFA500" />;
      case "low":
        return <Ionicons name="help-circle" size={24} color="#4ECDC4" />;
    }
  };

  const getConflictTypeLabel = (type: FactConflict["conflictType"]) => {
    switch (type) {
      case "contradiction":
        return "Contradiction Detected";
      case "refinement":
        return "More Specific Information";
      case "clarification":
        return "Needs Clarification";
    }
  };

  if (!visible || conflicts.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Ionicons name="git-compare" size={28} color="#6366F1" />
            <Text style={styles.title}>Just Checking...</Text>
            <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {clarificationPrompt && (
              <View style={styles.promptBox}>
                <Text style={styles.promptText}>{clarificationPrompt}</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Detected Differences:</Text>

            {conflicts.map((conflict, index) => (
              <TouchableOpacity
                key={conflict.id}
                style={[
                  styles.conflictCard,
                  selectedConflict?.id === conflict.id && styles.conflictCardSelected,
                ]}
                onPress={() => {
                  setSelectedConflict(conflict);
                  setCorrectedValue(conflict.newValue);
                }}
              >
                <View style={styles.conflictHeader}>
                  {getConflictIcon(conflict.severity)}
                  <Text style={styles.conflictType}>
                    {getConflictTypeLabel(conflict.conflictType)}
                  </Text>
                  <Text style={styles.conflictNumber}>
                    {index + 1}/{conflicts.length}
                  </Text>
                </View>

                <View style={styles.factComparison}>
                  <View style={styles.factBox}>
                    <Text style={styles.factLabel}>Previously:</Text>
                    <Text style={styles.factText}>{conflict.existingFactStatement}</Text>
                  </View>

                  <Ionicons name="arrow-down" size={20} color="#666" style={styles.arrow} />

                  <View style={[styles.factBox, styles.factBoxNew]}>
                    <Text style={styles.factLabel}>Now saying:</Text>
                    <Text style={styles.factText}>{conflict.newValue}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {selectedConflict && (
              <View style={styles.resolutionSection}>
                <Text style={styles.sectionTitle}>How would you like to resolve this?</Text>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      resolutionAction === "update" && styles.actionButtonSelected,
                    ]}
                    onPress={() => setResolutionAction("update")}
                  >
                    <Ionicons
                      name="refresh"
                      size={20}
                      color={resolutionAction === "update" ? "#fff" : "#6366F1"}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        resolutionAction === "update" && styles.actionButtonTextSelected,
                      ]}
                    >
                      Update It
                    </Text>
                    <Text style={styles.actionButtonSubtext}>My info has changed</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      resolutionAction === "reject" && styles.actionButtonSelected,
                    ]}
                    onPress={() => setResolutionAction("reject")}
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={resolutionAction === "reject" ? "#fff" : "#6366F1"}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        resolutionAction === "reject" && styles.actionButtonTextSelected,
                      ]}
                    >
                      Keep Original
                    </Text>
                    <Text style={styles.actionButtonSubtext}>New info was a mistake</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      resolutionAction === "merge" && styles.actionButtonSelected,
                    ]}
                    onPress={() => setResolutionAction("merge")}
                  >
                    <Ionicons
                      name="git-merge"
                      size={20}
                      color={resolutionAction === "merge" ? "#fff" : "#6366F1"}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        resolutionAction === "merge" && styles.actionButtonTextSelected,
                      ]}
                    >
                      Both Are True
                    </Text>
                    <Text style={styles.actionButtonSubtext}>I do/have both</Text>
                  </TouchableOpacity>
                </View>

                {resolutionAction === "update" && (
                  <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>What's the correct information?</Text>
                    <TextInput
                      style={styles.textInput}
                      value={correctedValue}
                      onChangeText={setCorrectedValue}
                      placeholder="Enter the correct value..."
                      multiline
                    />
                  </View>
                )}

                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Add a note (optional):</Text>
                  <TextInput
                    style={styles.textInput}
                    value={note}
                    onChangeText={setNote}
                    placeholder="Any additional context..."
                    multiline
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.resolveButton,
                    (!resolutionAction || isProcessing) && styles.resolveButtonDisabled,
                  ]}
                  onPress={handleResolve}
                  disabled={!resolutionAction || isProcessing}
                >
                  {isProcessing ? (
                    <Text style={styles.resolveButtonText}>Resolving...</Text>
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.resolveButtonText}>Confirm Resolution</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginLeft: 12,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  promptBox: {
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1",
  },
  promptText: {
    fontSize: 15,
    color: "#4B5563",
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  conflictCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  conflictCardSelected: {
    borderColor: "#6366F1",
    backgroundColor: "#EEF2FF",
  },
  conflictHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  conflictType: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
    marginLeft: 8,
  },
  conflictNumber: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  factComparison: {
    gap: 8,
  },
  factBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  factBoxNew: {
    borderColor: "#6366F1",
    backgroundColor: "#F5F3FF",
  },
  factLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  factText: {
    fontSize: 14,
    color: "#1F2937",
    lineHeight: 20,
  },
  arrow: {
    alignSelf: "center",
    marginVertical: 4,
  },
  resolutionSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  actionButtonSelected: {
    backgroundColor: "#6366F1",
    borderColor: "#4F46E5",
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
    marginTop: 4,
  },
  actionButtonTextSelected: {
    color: "#fff",
  },
  actionButtonSubtext: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4B5563",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#1F2937",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minHeight: 60,
    textAlignVertical: "top",
  },
  resolveButton: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  resolveButtonDisabled: {
    backgroundColor: "#C7D2FE",
  },
  resolveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
