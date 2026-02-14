import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Button, Card, Title, Paragraph, ActivityIndicator, Snackbar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';

import { ImagePickerService } from '../services/imagePickerService';
import { GeminiService } from '../services/geminiService';
import { AnalysisResult } from '../types';
import ZoomableImageView from '../components/ZoomableImageView';
import ImageEditor from '../components/ImageEditor';

// Using shared RootStackParamList

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }: Props) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [zoomViewerVisible, setZoomViewerVisible] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [tempImageUri, setTempImageUri] = useState<string | null>(null);

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const handleImageSelection = async (useCamera: boolean, allowEditing: boolean = false) => {
    try {
      const hasPermissions = await ImagePickerService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert(
          'Permissions Required',
          'Camera and photo library permissions are required to use this feature.'
        );
        return;
      }

      let result;
      if (useCamera) {
        result = await ImagePickerService.takePhotoWithCamera();
      } else {
        result = await ImagePickerService.pickImageFromGalleryWithOptions(allowEditing);
      }

      if (result.success && result.imageUri) {
        setTempImageUri(result.imageUri);
        // Only show image editor if no editing was done in picker
        setShowImageEditor(!allowEditing);
        if (allowEditing) {
          setSelectedImage(result.imageUri);
          showSnackbar('Image selected successfully!');
        }
      } else {
        showSnackbar(result.error || 'Failed to select image');
      }
    } catch (error) {
      showSnackbar('An error occurred while selecting image');
    }
  };

  const handleImageEditorSave = (editedImageUri: string) => {
    setSelectedImage(editedImageUri);
    setShowImageEditor(false);
    setTempImageUri(null);
    showSnackbar('Image ready for analysis!');
  };

  const handleImageEditorCancel = () => {
    setShowImageEditor(false);
    setTempImageUri(null);
  };

  const handleAnalyzeTranscript = async () => {
    if (!selectedImage) {
      showSnackbar('Please select an image first');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await GeminiService.analyzeActionImage(selectedImage);

      if (result.success) {
        navigation.navigate('Result', { result });
      } else {
        console.log('Analysis failed with error:', result.error);
        console.log('Raw response:', result.rawResponse);

        let errorMessage = result.error || 'Failed to analyze transcript.';

        // Provide more specific error messages
        if (result.error?.includes('404')) {
          errorMessage =
            'API endpoint not found. Please check your internet connection and try again.';
        } else if (result.error?.includes('413') || result.error?.includes('too large')) {
          errorMessage = 'Image is too large. Please try with a smaller image.';
        } else if (result.error?.includes('401') || result.error?.includes('403')) {
          errorMessage = 'API key error. Please check your configuration.';
        } else if (result.error?.includes('Network Error')) {
          errorMessage = 'Network connection error. Please check your internet connection.';
        }

        Alert.alert(
          'Analysis Failed',
          errorMessage + '\n\nPlease try again with a clearer image.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTestApiConnection = async () => {
    setIsAnalyzing(true);
    try {
      const result = await GeminiService.testApiConnection();

      if (result.success) {
        Alert.alert('API Test Successful', 'Connection to Gemini API is working properly.', [
          { text: 'OK' },
        ]);
      } else {
        Alert.alert('API Test Failed', result.error || 'Failed to connect to Gemini API.', [
          { text: 'OK' },
        ]);
      }
    } catch (error) {
      Alert.alert('Test Error', 'An unexpected error occurred during API test.', [{ text: 'OK' }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    showSnackbar('Image cleared');
  };

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.gradient}>
        <View style={styles.content}>
          <Card style={styles.card}>
            <Card.Content>
              <Title style={styles.title}>Activity Analyzer</Title>
              <Paragraph style={styles.subtitle}>
                Upload a photo of an activity or action to analyze it using our skills taxonomy
                framework and discover what skills are being developed.
              </Paragraph>
            </Card.Content>
          </Card>

          <Card style={styles.imageCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Upload Activity Image</Title>

              {selectedImage ? (
                <View style={styles.imageContainer}>
                  <TouchableOpacity onPress={() => setZoomViewerVisible(true)}>
                    <Image source={{ uri: selectedImage }} style={styles.image} />
                  </TouchableOpacity>
                  <View style={styles.imageButtons}>
                    <Button
                      mode="outlined"
                      onPress={() => setZoomViewerVisible(true)}
                      style={styles.viewButton}
                      icon="magnify"
                    >
                      View Full Size
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => {
                        setTempImageUri(selectedImage);
                        setShowImageEditor(true);
                      }}
                      style={styles.editButton}
                      icon="pencil"
                    >
                      Edit Image
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={clearImage}
                      style={styles.clearButton}
                      textColor="#f44336"
                      icon="delete"
                    >
                      Clear Image
                    </Button>
                  </View>
                </View>
              ) : (
                <View style={styles.uploadContainer}>
                  <Paragraph style={styles.uploadText}>
                    Choose how you'd like to upload your transcript:{'\n'}• Choose Full Image:
                    Select entire image without cropping{'\n'}• Choose & Crop: Select and crop image
                    in picker{'\n'}• Take Photo: Capture new photo with camera
                  </Paragraph>

                  <View style={styles.buttonContainer}>
                    <Button
                      mode="contained"
                      onPress={() => handleImageSelection(false, false)}
                      style={[styles.button, styles.galleryButton]}
                      icon="image"
                    >
                      Choose Full Image
                    </Button>

                    <Button
                      mode="contained"
                      onPress={() => handleImageSelection(false, true)}
                      style={[styles.button, styles.galleryCropButton]}
                      icon="crop"
                    >
                      Choose & Crop
                    </Button>

                    <Button
                      mode="contained"
                      onPress={() => handleImageSelection(true, false)}
                      style={[styles.button, styles.cameraButton]}
                      icon="camera"
                    >
                      Take Photo
                    </Button>
                  </View>
                </View>
              )}

              {selectedImage && (
                <Button
                  mode="contained"
                  onPress={handleAnalyzeTranscript}
                  disabled={isAnalyzing}
                  style={styles.analyzeButton}
                  icon={isAnalyzing ? undefined : 'brain'}
                >
                  {isAnalyzing ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Paragraph style={styles.loadingText}>Analyzing activity...</Paragraph>
                    </View>
                  ) : (
                    'Analyze Activity'
                  )}
                </Button>
              )}

              <Button
                mode="outlined"
                onPress={() => navigation.navigate('Blue')}
                style={[styles.testButton, { marginTop: 8 }]}
                icon="arrow-right"
              >
                Go to Blue Page
              </Button>

              <Button
                mode="outlined"
                onPress={() => navigation.navigate('Dashboard')}
                style={styles.testButton}
                icon="view-dashboard"
              >
                View Dashboard
              </Button>

              <Button
                mode="outlined"
                onPress={handleTestApiConnection}
                disabled={isAnalyzing}
                style={styles.testButton}
                icon="wifi-check"
              >
                Test API Connection
              </Button>
            </Card.Content>
          </Card>

          <Card style={styles.infoCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>How it works</Title>
              <Paragraph style={styles.infoText}>
                1. Take a photo or select an image of your academic transcript{'\n'}
                2. Our AI will analyze the image and extract course information{'\n'}
                3. View detailed results including grades, GPA, and course details{'\n'}
                4. All data is processed securely and not stored
              </Paragraph>
            </Card.Content>
          </Card>
        </View>
      </LinearGradient>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>

      <ZoomableImageView
        imageUri={selectedImage || ''}
        visible={zoomViewerVisible}
        onClose={() => setZoomViewerVisible(false)}
      />

      {showImageEditor && tempImageUri && (
        <ImageEditor
          imageUri={tempImageUri}
          onSave={handleImageEditorSave}
          onCancel={handleImageEditorCancel}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  gradient: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 4,
  },
  title: {
    textAlign: 'center',
    color: '#1976D2',
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginTop: 8,
  },
  imageCard: {
    marginBottom: 16,
    elevation: 4,
  },
  sectionTitle: {
    color: '#1976D2',
    marginBottom: 16,
  },
  uploadContainer: {
    alignItems: 'center',
  },
  uploadText: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    marginVertical: 8,
    paddingVertical: 8,
  },
  galleryButton: {
    backgroundColor: '#4CAF50',
  },
  galleryCropButton: {
    backgroundColor: '#9C27B0',
  },
  cameraButton: {
    backgroundColor: '#FF9800',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  image: {
    width: width - 80,
    height: (width - 80) * 0.75,
    borderRadius: 8,
    marginBottom: 16,
  },
  clearButton: {
    borderColor: '#f44336',
  },
  imageButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  viewButton: {
    borderColor: '#2196F3',
    marginBottom: 8,
  },
  editButton: {
    borderColor: '#FF9800',
    marginBottom: 8,
  },
  analyzeButton: {
    backgroundColor: '#2196F3',
    marginTop: 16,
    paddingVertical: 8,
  },
  testButton: {
    marginTop: 8,
    paddingVertical: 8,
    borderColor: '#666',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    marginLeft: 8,
  },
  infoCard: {
    marginBottom: 16,
    elevation: 4,
  },
  infoText: {
    color: '#666',
    lineHeight: 20,
  },
  snackbar: {
    backgroundColor: '#333',
  },
});
