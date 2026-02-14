import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Modal, ScrollView, StatusBar, Image } from 'react-native';
import { IconButton, Portal, Text } from 'react-native-paper';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ZoomableImageViewProps {
  imageUri: string;
  visible: boolean;
  onClose: () => void;
}

export default function ZoomableImageView({ imageUri, visible, onClose }: ZoomableImageViewProps) {
  const [scale, setScale] = useState(1);

  const resetZoom = () => {
    setScale(1);
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev * 1.5, 3));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev / 1.5, 0.5));
  };

  return (
    <Portal>
      <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
        <StatusBar hidden />
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerText}>Transcript Viewer</Text>
            <View style={styles.headerButtons}>
              <IconButton icon="magnify-plus" size={24} onPress={zoomIn} iconColor="#fff" />
              <IconButton icon="magnify-minus" size={24} onPress={zoomOut} iconColor="#fff" />
              <IconButton icon="refresh" size={24} onPress={resetZoom} iconColor="#fff" />
              <IconButton icon="close" size={24} onPress={onClose} iconColor="#fff" />
            </View>
          </View>

          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            maximumZoomScale={3}
            minimumZoomScale={0.5}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.imageContainer, { transform: [{ scale }] }]}>
              <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.instructions}>
              Pinch to zoom • Scroll to pan • Use buttons to zoom in/out
            </Text>
            <Text style={styles.scaleText}>Zoom: {Math.round(scale * 100)}%</Text>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  headerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: screenWidth,
    height: screenHeight * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: screenWidth,
    height: screenHeight * 0.7,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  instructions: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 8,
  },
  scaleText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.6,
  },
});
