import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors } from "../../styles/global";

interface InfoModalProps {
  visible: boolean;
  title?: string;
  body: string | string[];
  buttonLabel?: string;
  onContinue: () => void;
}

export function InfoModal({
  visible,
  title,
  body,
  buttonLabel = "Continue",
  onContinue,
}: Readonly<InfoModalProps>) {
  const paragraphs = Array.isArray(body) ? body : [body];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onContinue}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {title && <Text style={styles.title}>{title}</Text>}
          {paragraphs.map((p, i) => (
            <Text key={i} style={styles.body}>
              {p}
            </Text>
          ))}
          <TouchableOpacity style={styles.button} onPress={onContinue}>
            <Text style={styles.buttonText}>{buttonLabel}</Text>
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
