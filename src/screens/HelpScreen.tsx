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
} from "react-native";

import { useAuth } from "../context/AuthContext";

import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { colors, typography, spacing, radius, globalStyles } from "../styles/global";
import { dialogueBridgeRef } from "../screens/DialogueDashboardScreen";

export default function HelpScreen() {
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const insets = useSafeAreaInsets();

  const handleReset = () => {
    dialogueBridgeRef.current?.handleReset?.();
  };

  const { session, logoutToGuest } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      "Switch to Guest",
      "You will keep this account's saved progress, and the app will continue in guest mode.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => {
            logoutToGuest()
              .then(() => {
                /* no navigation needed from Help */
              })
              .catch(() => Alert.alert("Error", "Failed to switch to guest mode."));
          },
        },
      ]
    );
  };

  const handleSubmit = () => {
    Alert.alert("Bug Report Submitted", "Thank you for helping us improve the app.");

    setLocation("");
    setDescription("");
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
                color={colors.accent.coral}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReset} style={styles.floatingButton}>
              <MaterialIcons name="refresh" size={24} color={colors.accent.coral} />
            </TouchableOpacity>
          </View>

          {/* Header floated over banner bottom */}
          <View style={styles.headerBlock}>
            <View style={styles.headerRow}>
              <MaterialIcons name="error-outline" size={32} color={colors.accent.coral} />
              <Text style={styles.title}>Report an Issue</Text>
            </View>
            <Text style={styles.subtitle}>
              Help us improve the app by sharing bugs or unexpected behavior.
            </Text>
          </View>

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

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitText}>Submit Report</Text>
          </TouchableOpacity>
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

  submitButton: {
    backgroundColor: colors.accent.coral,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    alignItems: "center",
  },

  submitText: {
    ...typography.buttonPrimary,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    flexGrow: 1,
    justifyContent: "center",
  },
  bannerClip: {
    marginHorizontal: -spacing.md,
    height: 120,
    overflow: "hidden",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  banner: {
    width: 900,
    height: 900,
    borderRadius: 450,
    backgroundColor: colors.accent.coral,
    position: "absolute",
    top: -900 + 120,
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
});
