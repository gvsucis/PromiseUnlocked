import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";

interface LoadingModalProps {
  visible: boolean;
  message: string;
}

// Plain overlay instead of a native <Modal>: iOS can't transition two modals at
// once, so a native modal here would make the question modal fail to present.
export function LoadingModal({ visible, message }: Readonly<LoadingModalProps>) {
  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalLoadingText}>{message}</Text>
        <ActivityIndicator size="large" color="#667eea" style={styles.modalSpinner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    elevation: 1000,
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
