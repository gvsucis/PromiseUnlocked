import React from "react";
import { Modal, View, TouchableOpacity, TouchableWithoutFeedback, StyleSheet } from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";

export type InputMethod = "text" | "voice" | "image";

interface InputOption {
  method: InputMethod;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
}

const INPUT_OPTIONS: InputOption[] = [
  { method: "text", label: "Text", icon: "chatbubble", color: "#45B7D1" },
  { method: "voice", label: "Voice", icon: "mic", color: "#4ECDC4" },
  { method: "image", label: "Image", icon: "camera", color: "#FF6B6B" },
];

interface Props {
  visible: boolean;
  question: string;
  onSelectInputType: (method: InputMethod) => void;
  onClose: () => void;
}

export function QuestionInputModal({ visible, question, onSelectInputType, onClose }: Readonly<Props>) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.container}>
              <Text style={styles.heading}>Question</Text>
              <Text style={styles.question}>{question}</Text>
              <Text style={styles.subtitle}>Choose how you want to answer:</Text>
              <View style={styles.inputRow}>
                {INPUT_OPTIONS.map(({ method, label, icon, color }) => (
                  <TouchableOpacity
                    key={method}
                    style={styles.inputButton}
                    onPress={() => onSelectInputType(method)}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: color }]}>
                      <Ionicons name={icon} size={32} color="white" />
                    </View>
                    <Text style={styles.inputLabel}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    alignItems: "center",
  },
  heading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#667eea",
    marginBottom: 10,
  },
  question: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    color: "#222",
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 18,
    color: "#555",
    textAlign: "center",
  },
  inputRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  inputButton: {
    alignItems: "center",
    marginHorizontal: 12,
    padding: 15,
    borderRadius: 15,
    backgroundColor: "#f8f8f8",
    flex: 1,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  inputLabel: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  cancelButton: {
    marginTop: 24,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  cancelText: {
    color: "#667eea",
    fontWeight: "bold",
  },
});
