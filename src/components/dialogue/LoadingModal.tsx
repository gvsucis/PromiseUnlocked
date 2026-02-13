import React from "react";
import { Modal, View, Text, ActivityIndicator, StyleSheet } from "react-native";

interface LoadingModalProps {
  visible: boolean;
  message: string;
}

export function LoadingModal({ visible, message }: LoadingModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalLoadingText}>{message}</Text>
          <ActivityIndicator
            size="large"
            color="#667eea"
            style={styles.modalSpinner}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 30,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
  },
  modalLoadingText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 20,
    textAlign: "center",
  },
  modalSpinner: {
    marginTop: 10,
  },
});
