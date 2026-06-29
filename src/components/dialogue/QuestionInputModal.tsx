import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Text } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/styles/global";

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
  /** Pre-fills the input when the modal opens (uncontrolled mode only). */
  seedText?: string;
  onSelectInputType: (method: Exclude<InputMethod, "text">) => void;
  onSubmitText: (text: string) => void;
  onSubmitTextAndImage?: (text: string, imageUri: string) => void;
  attachedImageUri?: string | null;
  onAttachImage?: () => void;
  onRemoveAttachedImage?: () => void;
  onClose: () => void;
  onBackdropDismiss?: () => void;
  onNewQuestion?: () => void;
  onNewTopic?: () => void;
}

export function QuestionInputModal({
  visible,
  question,
  textValue: controlledText,
  onTextChange,
  seedText,
  onSelectInputType,
  onSubmitText,
  onSubmitTextAndImage,
  attachedImageUri,
  onAttachImage,
  onRemoveAttachedImage,
  onClose,
  onBackdropDismiss,
  onNewQuestion,
  onNewTopic,
}: Readonly<Props>) {
  const [internalText, setInternalText] = useState("");
  const textValue = controlledText ?? internalText;
  const setTextValue = onTextChange ?? setInternalText;

  // Uncontrolled mode: seed the input from `seedText` only when a new question
  // opens, so reopening the same question keeps the in-progress draft.
  const seededQuestionRef = useRef<string | null>(null);
  useEffect(() => {
    if (visible && controlledText === undefined && seededQuestionRef.current !== question) {
      setInternalText(seedText ?? "");
      seededQuestionRef.current = question;
    }
  }, [visible, question, seedText, controlledText]);

  const resetText = () => {
    setTextValue("");
  };

  const handleClose = () => {
    resetText();
    onClose();
  };

  const handleBackdropDismiss = () => {
    onBackdropDismiss?.();
  };

  const handleAltInput = (method: Exclude<InputMethod, "text">) => {
    if (method === "image" && onSubmitTextAndImage && onAttachImage) {
      onAttachImage();
      return;
    }
    resetText();
    onSelectInputType(method);
  };

  const handleSubmit = () => {
    if (!textValue.trim() && !attachedImageUri) return;
    if (attachedImageUri && textValue.trim() && onSubmitTextAndImage) {
      onSubmitTextAndImage(textValue.trim(), attachedImageUri);
      resetText();
      return;
    }
    if (!textValue.trim()) return;
    onSubmitText(textValue.trim());
    resetText();
  };

  const hasContent = textValue.trim().length > 0 || !!attachedImageUri;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleBackdropDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={handleBackdropDismiss}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.container}>
                <TouchableOpacity style={styles.closeIconButton} onPress={handleClose}>
                  <Ionicons name="close-circle" size={28} color="#FF6B6B" />
                </TouchableOpacity>
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

                {attachedImageUri && (
                  <View style={styles.imagePreviewRow}>
                    <Image source={{ uri: attachedImageUri }} style={styles.imagePreview} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => onRemoveAttachedImage?.()}
                    >
                      <Ionicons name="close-circle" size={22} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Alt input options — right-aligned below text input */}
                <View style={styles.altInputRow}>
                  {ALT_INPUT_OPTIONS.map(({ method, label, icon, color }) => (
                    <TouchableOpacity
                      key={method}
                      style={styles.altInputButton}
                      onPress={() => handleAltInput(method)}
                    >
                      <View style={[styles.altIconCircle, { backgroundColor: color }]}>
                        <Ionicons name={icon} size={20} color="white" />
                      </View>
                      <Text style={styles.altInputLabel}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.newQuestionButton}
                    onPress={() => {
                      onNewQuestion?.();
                      handleClose();
                    }}
                  >
                    <Text style={styles.newQuestionText}>Skip</Text>
                  </TouchableOpacity>
                  {onNewTopic && (
                    <TouchableOpacity
                      style={styles.newTopicButton}
                      onPress={() => {
                        onNewTopic();
                        handleClose();
                      }}
                    >
                      <Text style={styles.newTopicText}>New Region</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.submitButton, !hasContent && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={!hasContent}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.submitText}>Submit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
    fontSize: 13,
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
  imagePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    width: "100%",
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  removeImageButton: {
    marginLeft: 8,
  },
  closeIconButton: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
  },
  newQuestionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.accent.sky,
    alignItems: "center",
    justifyContent: "center",
  },
  newQuestionText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  newTopicButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#e8e0ff",
    alignItems: "center",
    justifyContent: "center",
  },
  newTopicText: {
    color: "#7c4dff",
    fontWeight: "bold",
    fontSize: 12,
  },
});
