import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, ScrollView, Image, Modal, StatusBar } from 'react-native';
import { IconButton, Text, Button, Portal } from 'react-native-paper';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ImageEditorProps {
  imageUri: string;
  onSave: (editedImageUri: string) => void;
  onCancel: () => void;
}

export default function ImageEditor({ imageUri, onSave, onCancel }: ImageEditorProps) {
  const [scale, setScale] = useState(1);
  const scrollViewRef = useRef<ScrollView>(null);

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

  const rotateImage = () => {
    // For now, we'll just reset zoom as rotation requires more complex handling
    resetZoom();
  };

  const handleSave = () => {
    // For now, we'll save the current image as-is
    // In a full implementation, you might want to capture the current view
    onSave(imageUri);
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
              <IconButton icon="rotate-right" size={24} onPress={rotateImage} iconColor="#1976D2" />
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
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              onScroll={(event) => {
                // Update scale based on scroll view zoom
                const zoomScale = event.nativeEvent.zoomScale;
                if (zoomScale !== scale) {
                  setScale(zoomScale);
                }
              }}
              scrollEventThrottle={16}
            >
              <View style={styles.imageWrapper}>
                <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
              </View>
            </ScrollView>
          </View>

          <View style={styles.controls}>
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
              <Button mode="contained" onPress={handleSave} style={styles.saveButton} icon="check">
                Use This Image
              </Button>
            </View>
          </View>

          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              Pinch to zoom • Drag to pan • Adjust the image as needed
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  imageContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: screenWidth,
    height: screenHeight * 0.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  controls: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  zoomText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 20,
    color: '#1976D2',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resetButton: {
    flex: 1,
    marginRight: 8,
    borderColor: '#666',
  },
  saveButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#4CAF50',
  },
  instructions: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  instructionText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
});
