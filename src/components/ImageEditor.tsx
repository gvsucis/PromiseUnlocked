import React, { useState, useRef } from "react";
import { View, StyleSheet, Dimensions, ScrollView, Image, Modal, StatusBar } from "react-native";
import { IconButton, Text, Button, Portal } from "react-native-paper";
import * as ImageManipulator from "expo-image-manipulator";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface ImageEditorProps {
  imageUri: string;
  onSave: (editedImageUri: string) => void;
  onCancel: () => void;
}

export default function ImageEditor({ imageUri, onSave, onCancel }: Readonly<ImageEditorProps>) {
  const [scale, setScale] = useState(1);
  const [resizePreset, setResizePreset] = useState<"original" | "large" | "medium" | "small">(
    "large"
  );
  const [isSaving, setIsSaving] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const presetPreviewScale: Record<"original" | "large" | "medium" | "small", number> = {
    original: 1.15,
    large: 1,
    medium: 0.85,
    small: 0.7,
  };

  const effectivePreviewScale = scale * presetPreviewScale[resizePreset];

  const resetZoom = () => {
    setScale(1);
    scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: true });
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev * 1.2, 3));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev / 1.2, 0.5));
  };

  const resolveTargetWidth = (): number | null => {
    if (resizePreset === "original") return null;
    if (resizePreset === "large") return 1400;
    if (resizePreset === "medium") return 1100;
    return 800;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const actions: ImageManipulator.Action[] = [];

      const targetWidth = resolveTargetWidth();
      if (targetWidth !== null) {
        actions.push({ resize: { width: targetWidth } });
      }

      if (actions.length === 0) {
        onSave(imageUri);
        return;
      }

      const edited = await ImageManipulator.manipulateAsync(imageUri, actions, {
        compress: 0.82,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      onSave(edited.uri);
    } catch {
      onSave(imageUri);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Portal>
      <Modal
        visible={true}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onCancel}
      >
        <StatusBar hidden />
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerText}>Edit Image</Text>
            <View style={styles.headerButtons}>
              <IconButton icon="close" size={24} onPress={onCancel} iconColor="#f44336" />
            </View>
          </View>

          <View style={styles.imageContainer}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              maximumZoomScale={3}
              minimumZoomScale={0.5}
              horizontal
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              onScroll={(event) => {
                const zoomScale = event.nativeEvent.zoomScale;
                if (
                  typeof zoomScale === "number" &&
                  Number.isFinite(zoomScale) &&
                  zoomScale !== scale
                ) {
                  setScale(zoomScale);
                }
              }}
              scrollEventThrottle={16}
            >
              <View
                style={[
                  styles.imageWrapper,
                  {
                    width: screenWidth * 0.9 * Math.max(0.5, effectivePreviewScale),
                    height: screenHeight * 0.58 * Math.max(0.5, effectivePreviewScale),
                  },
                ]}
              >
                <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
              </View>
            </ScrollView>
          </View>

          <View style={styles.controls}>
            <View style={styles.presetRow}>
              <Button
                mode={resizePreset === "original" ? "contained" : "outlined"}
                compact
                onPress={() => setResizePreset("original")}
                style={styles.presetButton}
              >
                Original
              </Button>
              <Button
                mode={resizePreset === "large" ? "contained" : "outlined"}
                compact
                onPress={() => setResizePreset("large")}
                style={styles.presetButton}
              >
                Large
              </Button>
              <Button
                mode={resizePreset === "medium" ? "contained" : "outlined"}
                compact
                onPress={() => setResizePreset("medium")}
                style={styles.presetButton}
              >
                Medium
              </Button>
              <Button
                mode={resizePreset === "small" ? "contained" : "outlined"}
                compact
                onPress={() => setResizePreset("small")}
                style={styles.presetButton}
              >
                Small
              </Button>
            </View>

            <View style={styles.zoomControls}>
              <IconButton
                icon="magnify-minus"
                size={24}
                onPress={zoomOut}
                iconColor="#1976D2"
                disabled={scale <= 0.5}
              />
              <Text style={styles.zoomText}>{Math.round(scale * 100)}%</Text>
              <IconButton
                icon="magnify-plus"
                size={24}
                onPress={zoomIn}
                iconColor="#1976D2"
                disabled={scale >= 3}
              />
            </View>

            <View style={styles.actionButtons}>
              <Button mode="outlined" onPress={resetZoom} style={styles.resetButton} icon="refresh">
                Reset
              </Button>
              <Button
                mode="contained"
                onPress={handleSave}
                style={styles.saveButton}
                icon="check"
                loading={isSaving}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Use This Image"}
              </Button>
            </View>
          </View>

          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              Use + / - to zoom • Choose output size before saving
            </Text>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1976D2",
  },
  headerButtons: {
    flexDirection: "row",
  },
  imageContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imageWrapper: {
    width: screenWidth * 0.9,
    height: screenHeight * 0.58,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  controls: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  presetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 6,
  },
  presetButton: {
    flex: 1,
  },
  zoomControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  zoomText: {
    fontSize: 16,
    fontWeight: "bold",
    marginHorizontal: 20,
    color: "#1976D2",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resetButton: {
    flex: 1,
    marginRight: 8,
    borderColor: "#666",
  },
  saveButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: "#4CAF50",
  },
  instructions: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  instructionText: {
    textAlign: "center",
    color: "#666",
    fontSize: 14,
  },
});
