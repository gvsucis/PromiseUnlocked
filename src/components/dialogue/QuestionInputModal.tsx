import React, { useState } from "react";
import {
  Modal,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  TextInput,
} from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";

export type InputMethod = "text" | "voice" | "image";

interface AltInputOption {
  method: Exclude<InputMethod, "text">;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
}

const ALT_INPUT_OPTIONS: AltInputOption[] = [
  { method: "voice", label: "Voice", icon: "mic", color: "#4ECDC4" },
  { method: "image", label: "Image", icon: "camera", color: "#FF6B6B" },
];

interface Props {
  visible: boolean;
  question: string;
  textValue?: string;
  onTextChange?: (text: string) => void;
  onSelectInputType: (method: Exclude<InputMethod, "text">) => void;
  onSubmitText: (text: string) => void;
  onClose: () => void;
  onBackdropDismiss?: () => void;
}

export function QuestionInputModal({
  visible,
  question,
  textValue: controlledText,
  onTextChange,
  onSelectInputType,
  onSubmitText,
  onClose,
  onBackdropDismiss,
}: Readonly<Props>) {
  const [internalText, setInternalText] = useState("");
  const textValue = controlledText ?? internalText;
  const setTextValue = onTextChange ?? setInternalText;

  const resetText = () => setTextValue("");

  const handleClose = () => {
    resetText();
    onClose();
  };

  const handleBackdropDismiss = () => {
    onBackdropDismiss?.();
  };

  const handleAltInput = (method: Exclude<InputMethod, "text">) => {
    resetText();
    onSelectInputType(method);
  };

  const handleSubmit = () => {
    if (!textValue.trim()) return;
    onSubmitText(textValue.trim());
    resetText();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleBackdropDismiss}
    >
      <TouchableWithoutFeedback onPress={handleBackdropDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.container}>
              <Text style={styles.heading}>Question</Text>
              <Text style={styles.question}>{question}</Text>

              <TextInput
                style={styles.textInput}
                placeholder="Type your answer..."
                placeholderTextColor="#aaa"
                multiline
                numberOfLines={5}
                value={textValue}
                onChangeText={setTextValue}
                textAlignVertical="top"
              />

              {/* Alt input options — right-aligned below text input */}
              <View style={styles.altInputRow}>
                {ALT_INPUT_OPTIONS.map(({ method, label, icon, color }) => (
                  <TouchableOpacity
                    key={method}
                    style={styles.altInputButton}
                    onPress={() => handleAltInput(method)}
                  >
                    <View style={[styles.altIconCircle, { backgroundColor: color }]}>
                      <Ionicons name={icon} size={18} color="white" />
                    </View>
                    <Text style={styles.altInputLabel}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, !textValue.trim() && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={!textValue.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.submitText}>Submit</Text>
                </TouchableOpacity>
              </View>
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
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#667eea",
    marginBottom: 10,
    fontFamily: "Avenir Next",
  },
  question: {
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 22,
    marginBottom: 14,
    textAlign: "center",
    color: "#1a1a2e",
    fontFamily: "Avenir Next",
  },
  textInput: {
    width: "100%",
    minHeight: 100,
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#222",
    backgroundColor: "#fafafa",
  },
  altInputRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: "100%",
    marginTop: 10,
    gap: 12,
  },
  altInputButton: {
    alignItems: "center",
  },
  altIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  altInputLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "600",
    color: "#555",
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 20,
    gap: 10,
    width: "100%",
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#4CAF50",
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#b0bec5",
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: "#667eea",
    fontWeight: "bold",
  },
});
