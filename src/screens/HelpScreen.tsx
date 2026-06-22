import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";

import { useAuth } from "../context/AuthContext";

import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { colors, typography, spacing, radius, globalStyles } from "../styles/global";
import { useDialogue } from "../context/DialogueContext";
import { useLogout } from "../hooks/useLogout";
import { ImagePickerService } from "../services/imagePickerService";
import { uploadMultipleImages } from "../services/uploadService";

const MAX_IMAGES = 3;

export default function HelpScreen() {
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const insets = useSafeAreaInsets();

  const { session } = useAuth();
  const { reset } = useDialogue();
  const { confirmAndLogout } = useLogout();

  const handleLogout = () => {
    confirmAndLogout();
  };

  const pickImages = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert("Limit Reached", `You can upload a maximum of ${MAX_IMAGES} images.`);
      return;
    }

    try {
      const hasPermissions = await ImagePickerService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert("Permissions Required", "Photo library permissions are required.");
        return;
      }

      const result = await ImagePickerService.pickImageFromGalleryWithOptions(false);

      if (result.success && result.imageUri) {
        setImages((prev) => [...prev, result.imageUri!]);
      }
    } catch (err) {
      console.error("Error picking image:", err);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!location) {
      Alert.alert("Missing Field", "Please select where you noticed the issue.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Missing Field", "Please describe the issue.");
      return;
    }

    setIsSubmitting(true);

    const result = await uploadMultipleImages({
      endpoint: "/help/report",
      imageUris: images,
      fileField: "images",
      fields: { location, description: description.trim() },
    });

    if (!result.success) {
      Alert.alert("Submission Failed", result.error || "Could not submit your report.");
      setIsSubmitting(false);
      return;
    }

    Alert.alert("Report Submitted", "Thank you for helping us improve the app.", [
      {
        text: "OK",
        onPress: () => {
          setLocation("");
          setDescription("");
          setImages([]);
        },
      },
    ]);
    setIsSubmitting(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[globalStyles.screen, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.floatingButtons} pointerEvents="box-none">
            <TouchableOpacity onPress={handleLogout} style={styles.floatingButton}>
              <MaterialIcons
                name={session.mode === "authenticated" ? "logout" : "person"}
                size={24}
                color={colors.status.error}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={reset} style={styles.floatingButton}>
              <MaterialIcons name="refresh" size={24} color={colors.status.error} />
            </TouchableOpacity>
          </View>

          <View style={styles.headerBlock}>
            <View style={styles.headerRow}>
              <MaterialIcons name="error" size={32} color={colors.accent.coral} />
              <Text style={styles.title}>Report an Issue</Text>
            </View>
            <Text style={styles.subtitle}>
              Help us improve the app by sharing bugs or unexpected behavior.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Where did you notice the issue?</Text>

            <View style={styles.optionContainer}>
              {["Chat", "Dashboard", "Profile", "Other"].map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.option, location === item && styles.optionSelected]}
                  onPress={() => setLocation(item)}
                >
                  <Text style={[styles.optionText, location === item && styles.optionTextSelected]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Please describe the issue</Text>

            <TextInput
              style={styles.textArea}
              multiline
              value={description}
              onChangeText={setDescription}
              placeholder="Tell us what happened..."
              textAlignVertical="top"
            />

            <Text style={styles.label}>Screenshots (optional, max {MAX_IMAGES})</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imageThumbWrap}>
                  <Image source={{ uri }} style={styles.imageThumb} />
                  <TouchableOpacity
                    style={styles.imageRemoveBtn}
                    onPress={() => removeImage(index)}
                  >
                    <MaterialIcons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < MAX_IMAGES && (
                <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
                  <MaterialIcons name="add" size={28} color={colors.accent.coral} />
                  <Text style={styles.addImageLabel}>Add</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.subtle,
  },

  title: {
    ...typography.screenTitle,
  },

  subtitle: {
    ...typography.bodyMuted,
    marginBottom: spacing.lg,
  },

  label: {
    ...typography.cardTitle,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },

  optionContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  option: {
    borderWidth: 1,
    borderColor: "#d9d9d9",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },

  optionSelected: {
    backgroundColor: "#fff1ee",
    borderColor: colors.accent.coral,
  },

  optionText: {
    color: colors.text.secondary,
  },

  optionTextSelected: {
    color: colors.accent.coral,
    fontWeight: "600",
  },

  textArea: {
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    minHeight: 150,
    padding: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.background.subtle,
  },

  imageRow: {
    flexDirection: "row",
    marginTop: spacing.sm,
  },

  imageThumbWrap: {
    position: "relative",
    marginRight: 10,
  },

  imageThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: colors.background.subtle,
  },

  imageRemoveBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },

  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border.subtle,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.subtle,
  },

  addImageLabel: {
    fontSize: 11,
    color: colors.accent.coral,
    marginTop: 2,
  },

  submitButton: {
    backgroundColor: colors.accent.coral,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    alignItems: "center",
  },

  submitButtonDisabled: {
    opacity: 0.6,
  },

  submitText: {
    ...typography.buttonPrimary,
  },

  scrollContent: {
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.subtle,
    paddingBottom: spacing.xl,
    flexGrow: 1,
    justifyContent: "center",
  },

  headerBlock: {
    marginBottom: spacing.lg,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },

  floatingButtons: {
    position: "absolute",
    top: 2,
    right: 16,
    flexDirection: "row",
    gap: 8,
    zIndex: 10,
  },

  floatingButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  formCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginTop: spacing.sm,
  },
});
