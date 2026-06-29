import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  Image,
  Modal,
  StatusBar,
  ScrollView,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { IconButton, Text, Button, Portal } from "react-native-paper";
import * as ImageManipulator from "expo-image-manipulator";

const CROP_ASPECTS = ["1:1", "4:3", "3:4", "16:9", "free"] as const;
type CropAspect = (typeof CROP_ASPECTS)[number];

const ASPECT_LABELS: Record<CropAspect, string> = {
  "1:1": "1:1",
  "4:3": "4:3",
  "3:4": "3:4",
  "16:9": "16:9",
  free: "Free",
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.2;
const OUTPUT_MAX_DIM = 1200;

interface ImageEditorProps {
  imageUri: string;
  onSave: (editedImageUri: string) => void;
  onCancel: () => void;
}

function cropWindowSize(
  containerW: number,
  containerH: number,
  aspect: CropAspect
): { width: number; height: number; left: number; top: number } {
  if (aspect === "free") return { width: containerW, height: containerH, left: 0, top: 0 };

  const [wR, hR] = aspect.split(":").map(Number);
  if (hR === 0) return { width: containerW, height: containerH, left: 0, top: 0 };
  const ratio = wR / hR;

  let w = containerW;
  let h = w / ratio;
  if (h > containerH) {
    h = containerH;
    w = h * ratio;
  }

  return {
    width: w,
    height: h,
    left: (containerW - w) / 2,
    top: (containerH - h) / 2,
  };
}

function CropOverlay({
  window,
  containerW,
  containerH,
}: Readonly<{
  window: { width: number; height: number; left: number; top: number };
  containerW: number;
  containerH: number;
}>) {
  const rightW = containerW - window.left - window.width;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.overlayBar, { top: 0, left: 0, right: 0, height: window.top }]} />
      <View
        style={[
          styles.overlayBar,
          { bottom: 0, left: 0, right: 0, height: containerH - window.top - window.height },
        ]}
      />
      <View
        style={[
          styles.overlayBar,
          { top: window.top, left: 0, width: window.left, height: window.height },
        ]}
      />
      {rightW > 0 && (
        <View
          style={[
            styles.overlayBar,
            { top: window.top, right: 0, width: rightW, height: window.height },
          ]}
        />
      )}
      <View
        style={[
          styles.overlayBorder,
          { top: window.top, left: window.left, width: window.width, height: window.height },
        ]}
      />
    </View>
  );
}

async function getImageSize(uri: string): Promise<{ width: number; height: number } | null> {
  // Image.getSize reads only the image header, so prefer it. Fall back to
  // manipulateAsync (which fully decodes the bitmap) only if that fails.
  try {
    return await new Promise((resolve, reject) => {
      Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
    });
  } catch {
    try {
      const info = await ImageManipulator.manipulateAsync(uri, []);
      return { width: info.width, height: info.height };
    } catch {
      return null;
    }
  }
}

export default function ImageEditor({ imageUri, onSave, onCancel }: Readonly<ImageEditorProps>) {
  const [cropAspect, setCropAspect] = useState<CropAspect>("1:1");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const scrollRef = useRef<ScrollView>(null);
  // Scroll offset only matters when computing the crop on save, so keep it in a
  // ref — driving it through state would re-render the editor on every frame.
  const scrollYRef = useRef(0);

  useEffect(() => {
    getImageSize(imageUri).then(setImageSize);
  }, [imageUri]);

  const cropWindow = useMemo(
    () =>
      containerSize.width
        ? cropWindowSize(containerSize.width, containerSize.height, cropAspect)
        : null,
    [containerSize, cropAspect]
  );

  const baseScale = useMemo(() => {
    if (!imageSize || !cropWindow) return 1;
    return Math.min(cropWindow.width / imageSize.width, cropWindow.height / imageSize.height);
  }, [imageSize, cropWindow]);

  const displayScale = baseScale * zoomLevel;
  const displayWidth = imageSize ? imageSize.width * displayScale : 0;
  const displayHeight = imageSize ? imageSize.height * displayScale : 0;

  const fitsVertically = containerSize.height > 0 && displayHeight <= containerSize.height;
  const imageInitTop = containerSize.height
    ? Math.max(0, (containerSize.height - displayHeight) / 2)
    : 0;
  // Horizontal is always center-cropped (no horizontal pan), so the image's
  // left edge is genuinely negative once it overflows the container — don't
  // clamp to 0 or the saved crop drifts off-center.
  const imageLeft = containerSize.width ? (containerSize.width - displayWidth) / 2 : 0;

  const zoomIn = () => setZoomLevel((prev) => Math.min(prev * ZOOM_STEP, MAX_ZOOM));
  const zoomOut = () => setZoomLevel((prev) => Math.max(prev / ZOOM_STEP, MIN_ZOOM));
  const resetView = () => {
    setZoomLevel(1);
    scrollYRef.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const onContainerLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!imageSize) {
        onSave(imageUri);
        return;
      }

      if (!cropWindow || cropAspect === "free") {
        const scale = Math.min(OUTPUT_MAX_DIM / imageSize.width, OUTPUT_MAX_DIM / imageSize.height);
        if (scale >= 1) {
          onSave(imageUri);
          return;
        }
        const w = Math.round(imageSize.width * scale);
        const h = Math.round(imageSize.height * scale);
        const edited = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: w, height: h } }],
          {
            compress: 0.82,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );
        onSave(edited.uri);
        return;
      }

      // When the image fits without scrolling, the ScrollView can't have a live
      // offset — ignore any stale value left over from a previous zoom level.
      const effScrollY = fitsVertically ? 0 : scrollYRef.current;
      const originX = Math.max(0, (cropWindow.left - imageLeft) / displayScale);
      const originY = Math.max(0, (effScrollY + cropWindow.top - imageInitTop) / displayScale);
      const cropW = Math.min(cropWindow.width / displayScale, imageSize.width - originX);
      const cropH = Math.min(cropWindow.height / displayScale, imageSize.height - originY);

      const actions: ImageManipulator.Action[] = [
        { crop: { originX, originY, width: cropW, height: cropH } },
      ];

      const maxDim = Math.max(cropW, cropH);
      if (maxDim > OUTPUT_MAX_DIM) {
        const rs = OUTPUT_MAX_DIM / maxDim;
        actions.push({ resize: { width: Math.round(cropW * rs), height: Math.round(cropH * rs) } });
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

          <View style={styles.imageContainer} onLayout={onContainerLayout}>
            <ScrollView
              ref={scrollRef}
              style={StyleSheet.absoluteFill}
              contentContainerStyle={[
                styles.scrollContent,
                fitsVertically ? styles.scrollCentered : styles.scrollTop,
              ]}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {displayWidth > 0 && (
                <ExpoImage
                  source={{ uri: imageUri }}
                  style={{ width: displayWidth, height: displayHeight }}
                  contentFit="contain"
                />
              )}
            </ScrollView>

            {cropWindow && cropAspect !== "free" && (
              <CropOverlay
                window={cropWindow}
                containerW={containerSize.width}
                containerH={containerSize.height}
              />
            )}
          </View>

          <View style={styles.controls}>
            <View style={styles.presetRow}>
              {CROP_ASPECTS.map((aspect) => (
                <Button
                  key={aspect}
                  mode={cropAspect === aspect ? "contained" : "outlined"}
                  compact
                  onPress={() => setCropAspect(aspect)}
                  style={styles.presetButton}
                >
                  {ASPECT_LABELS[aspect]}
                </Button>
              ))}
            </View>

            <View style={styles.zoomControls}>
              <IconButton
                icon="magnify-minus"
                size={24}
                onPress={zoomOut}
                iconColor="#1976D2"
                disabled={zoomLevel <= MIN_ZOOM}
              />
              <Text style={styles.zoomText}>{Math.round(zoomLevel * 100)}%</Text>
              <IconButton
                icon="magnify-plus"
                size={24}
                onPress={zoomIn}
                iconColor="#1976D2"
                disabled={zoomLevel >= MAX_ZOOM}
              />
            </View>

            <View style={styles.actionButtons}>
              <Button mode="outlined" onPress={resetView} style={styles.resetButton} icon="refresh">
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
            <Text style={styles.instructionText}>Drag to position • Use + / - to zoom</Text>
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
  overlayBar: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  overlayBorder: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
  },
  scrollCentered: {
    justifyContent: "center",
  },
  scrollTop: {
    justifyContent: "flex-start",
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
