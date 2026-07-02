import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors } from "../../styles/global";

interface SensitiveExperienceModalProps {
  visible: boolean;
  onContinue: () => void;
}

export function SensitiveExperienceModal({ visible, onContinue }: SensitiveExperienceModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onContinue}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.body}>
            We recognize that this experience may have been difficult.
          </Text>
          <Text style={styles.body}>Thank you for sharing something personal.</Text>
          <Text style={styles.body}>
            Significant life experiences can shape resilience, empathy, perspective, and personal
            growth. Based on what you've shared, we've identified a new experience in your profile.
          </Text>
          <TouchableOpacity style={styles.button} onPress={onContinue}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
  },
  body: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 10,
    lineHeight: 20,
    textAlign: "center",
  },
  button: {
    marginTop: 10,
    backgroundColor: colors.accent.sky,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
