import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors } from "../../styles/global";

interface CrisisSupportModalProps {
  visible: boolean;
  onContinue: () => void;
}

export function CrisisSupportModal({ visible, onContinue }: CrisisSupportModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onContinue}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Need Support?</Text>
          <Text style={styles.body}>
            We noticed that your message may relate to self-harm, suicide, or a personal crisis.
          </Text>
          <Text style={styles.body}>
            If you're in immediate danger or considering harming yourself, please contact emergency
            services or call/text 988 for immediate support.
          </Text>
          <Text style={styles.body}>
            If this was not your intent, you can continue using the app normally.
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
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 10,
    lineHeight: 20,
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
