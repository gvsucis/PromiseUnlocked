import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { WebView } from "react-native-webview";
import { MaterialIcons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { colors } from "../styles/global";

interface ArtifactPreviewModalProps {
  fileName: string;
  previewUrl: string;
  visible: boolean;
  onClose: () => void;
}

export default function ArtifactPreviewModal({
  fileName,
  previewUrl,
  visible,
  onClose,
}: Readonly<ArtifactPreviewModalProps>) {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleClose = () => {
    setLoading(true);
    setHasError(false);
    onClose();
  };

  const isPdf = previewUrl.includes(".pdf") || fileName.endsWith(".pdf");
  const viewerUrl = isPdf
    ? previewUrl
    : `https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color={colors.text.inverse} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {fileName}
          </Text>
          <View style={styles.closeButton} />
        </View>
        <View style={styles.body}>
          {loading && !hasError && (
            <ActivityIndicator size="large" color={colors.accent.sky} style={styles.loader} />
          )}
          {hasError ? (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={48} color={colors.text.secondary} />
              <Text style={styles.errorText}>Failed to load preview.</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleClose}>
                <Text style={styles.retryText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <WebView
              source={{ uri: viewerUrl }}
              onLoad={() => {
                setLoading(false);
                setHasError(false);
              }}
              onError={() => {
                setLoading(false);
                setHasError(true);
              }}
              style={styles.webview}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.base,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.accent.sky,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.inverse,
    textAlign: "center",
  },
  body: {
    flex: 1,
  },
  loader: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    zIndex: 1,
  },
  webview: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 12,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: colors.accent.sky,
    borderRadius: 8,
  },
  retryText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: "600",
  },
});
