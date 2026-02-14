import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Animated,
  ScrollView,
  Alert,
  Dimensions,
  Image,
  TouchableOpacity,
} from 'react-native';
import {
  FAB,
  Card,
  Title,
  Paragraph,
  ActivityIndicator,
  Snackbar,
  TextInput,
  Button,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import { ImagePickerService } from '../services/imagePickerService';
import { GeminiService } from '../services/geminiService';
import ZoomableImageView from '../components/ZoomableImageView';
import ImageEditor from '../components/ImageEditor';

type FollowUpQuestionScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'FollowUpQuestion'
>;
type FollowUpQuestionScreenRouteProp = RouteProp<RootStackParamList, 'FollowUpQuestion'>;

interface Props {
  navigation: FollowUpQuestionScreenNavigationProp;
  route: FollowUpQuestionScreenRouteProp;
}

const { width, height } = Dimensions.get('window');

export default function FollowUpQuestionScreen({ navigation, route }: Props) {
  const { question, context } = route.params;

  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [inputMode, setInputMode] = useState<'none' | 'text' | 'voice' | 'image'>('none');
  const [textInput, setTextInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [zoomViewerVisible, setZoomViewerVisible] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [tempImageUri, setTempImageUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Animation values for FAB
  const animation = useRef(new Animated.Value(0)).current;
  const button1Animation = useRef(new Animated.Value(0)).current;
  const button2Animation = useRef(new Animated.Value(0)).current;
  const button3Animation = useRef(new Animated.Value(0)).current;
  const rotateAnimation = useRef(new Animated.Value(0)).current;

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;

    Animated.parallel([
      Animated.spring(animation, {
        toValue,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(rotateAnimation, {
        toValue,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.stagger(50, [
        Animated.spring(button1Animation, {
          toValue,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.spring(button2Animation, {
          toValue,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.spring(button3Animation, {
          toValue,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]),
    ]).start();

    setIsOpen(!isOpen);
  };

  const rotation = rotateAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const button1Style = {
    transform: [
      {
        translateX: button1Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -96],
        }),
      },
      {
        translateY: button1Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 0],
        }),
      },
      {
        scale: button1Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
      },
    ],
  };

  const button2Style = {
    transform: [
      {
        translateX: button2Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -68],
        }),
      },
      {
        translateY: button2Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -68],
        }),
      },
      {
        scale: button2Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
      },
    ],
  };

  const button3Style = {
    transform: [
      {
        translateX: button3Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 0],
        }),
      },
      {
        translateY: button3Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -96],
        }),
      },
      {
        scale: button3Animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
      },
    ],
  };

  // Handle image selection
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

  // Handle photo button press
  const handlePhotoPress = () => {
    toggleMenu();

    // Use setTimeout to ensure the FAB menu animation completes before showing Alert
    setTimeout(() => {
      setInputMode('image');

      // Show options to choose between camera and gallery
      Alert.alert(
        'Choose Image Source',
        'How would you like to add your image?',
        [
          {
            text: 'Take Photo',
            onPress: () => handleImageSelection(true, false), // Use camera
          },
          {
            text: 'Choose from Gallery',
            onPress: () => handleImageSelection(false, false), // Use gallery
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setInputMode('none'),
          },
        ],
        { cancelable: true, onDismiss: () => setInputMode('none') }
      );
    }, 300); // Wait for FAB animation to complete
  };

  // Handle voice button press
  const handleVoicePress = () => {
    toggleMenu();
    setInputMode('voice');
    navigation.navigate('VoiceAnalysis', { question, context });
  };

  // Handle text button press
  const handleTextPress = () => {
    toggleMenu();
    setInputMode('text');
  };

  // Submit text response
  const handleSubmitText = async () => {
    if (!textInput.trim()) {
      showSnackbar('Please enter a response');
      return;
    }

    setIsAnalyzing(true);
    try {
      // For text responses, we'll navigate to TextAnalysis screen with the question context
      // Or we could create a simple result showing the user's response
      Alert.alert(
        'Response Recorded',
        'Your response has been recorded. This feature will send your answer for AI analysis.',
        [
          {
            text: 'OK',
            onPress: () => {
              setTextInput('');
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Submit image response
  const handleSubmitImage = async () => {
    if (!selectedImage) {
      showSnackbar('Please select an image first');
      return;
    }

    setIsAnalyzing(true);
    try {
      // Analyze the image in the context of the follow-up question
      const result = await GeminiService.analyzeActionImage(selectedImage);

      if (result.success) {
        navigation.navigate('Result', { result });
      } else {
        Alert.alert('Analysis Failed', result.error || 'Failed to analyze image');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Question Card */}
        <Card style={styles.questionCard}>
          <Card.Content>
            <View style={styles.cardTitleContainer}>
              <MaterialIcons name="extension" size={24} color="#667eea" />
              <Title style={styles.cardTitle}>Follow-up Question</Title>
            </View>
            <Paragraph style={styles.questionText}>{question}</Paragraph>
          </Card.Content>
        </Card>

        {/* Text Input Mode */}
        {inputMode === 'text' && (
          <Card style={styles.inputCard}>
            <Card.Content>
              <View style={styles.cardTitleContainer}>
                <MaterialIcons name="edit" size={22} color="#667eea" />
                <Title style={styles.inputTitle}>Your Response</Title>
              </View>
              <TextInput
                mode="outlined"
                placeholder="Type your answer here..."
                value={textInput}
                onChangeText={setTextInput}
                multiline
                numberOfLines={6}
                style={styles.textInput}
                outlineColor="#6C5CE7"
                activeOutlineColor="#667eea"
                autoCorrect={true}
              />
              <Button
                mode="contained"
                onPress={handleSubmitText}
                loading={isAnalyzing}
                disabled={isAnalyzing || !textInput.trim()}
                style={styles.submitButton}
                buttonColor="#6C5CE7"
              >
                {isAnalyzing ? 'Analyzing...' : 'Submit Response'}
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* Image Input Mode */}
        {inputMode === 'image' && selectedImage && (
          <Card style={styles.inputCard}>
            <Card.Content>
              <View style={styles.cardTitleContainer}>
                <MaterialIcons name="photo-camera" size={22} color="#667eea" />
                <Title style={styles.inputTitle}>Selected Image</Title>
              </View>
              <TouchableOpacity onPress={() => setZoomViewerVisible(true)}>
                <Image source={{ uri: selectedImage }} style={styles.previewImage} />
              </TouchableOpacity>
              <View style={styles.imageActions}>
                <Button
                  mode="outlined"
                  onPress={() => setSelectedImage(null)}
                  style={styles.changeImageButton}
                  textColor="#6C5CE7"
                >
                  Change Image
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSubmitImage}
                  loading={isAnalyzing}
                  disabled={isAnalyzing}
                  style={styles.submitButton}
                  buttonColor="#6C5CE7"
                >
                  {isAnalyzing ? 'Analyzing...' : 'Submit Image'}
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Instructions when no input mode selected */}
        {inputMode === 'none' && (
          <Card style={styles.instructionCard}>
            <Card.Content>
              <Paragraph style={styles.instructionText}>
                Tap the + button below to choose how you'd like to respond:
              </Paragraph>
              <View style={styles.optionsList}>
                <View style={styles.optionItem}>
                  <MaterialIcons name="image" size={24} color="#FF6B6B" />
                  <Text style={styles.optionText}>Share a photo</Text>
                </View>
                <View style={styles.optionItem}>
                  <MaterialIcons name="mic" size={24} color="#4ECDC4" />
                  <Text style={styles.optionText}>Record your voice</Text>
                </View>
                <View style={styles.optionItem}>
                  <MaterialIcons name="chat-bubble" size={24} color="#45B7D1" />
                  <Text style={styles.optionText}>Type a response</Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <View style={styles.fabInner}>
          {/* Action Button 1 - Photo */}
          <Animated.View style={[styles.actionButton, button1Style]} pointerEvents="auto">
            <FAB
              icon={() => (
                <View style={styles.iconContainer}>
                  <MaterialIcons name="image" size={28} color="white" />
                </View>
              )}
              onPress={handlePhotoPress}
              style={[styles.fab, { backgroundColor: '#FF6B6B' }]}
              size="small"
            />
          </Animated.View>

          {/* Action Button 2 - Voice */}
          <Animated.View style={[styles.actionButton, button2Style]} pointerEvents="auto">
            <FAB
              icon={() => (
                <View style={styles.iconContainer}>
                  <MaterialIcons name="mic" size={28} color="white" />
                </View>
              )}
              onPress={handleVoicePress}
              style={[styles.fab, { backgroundColor: '#4ECDC4' }]}
              size="small"
            />
          </Animated.View>

          {/* Action Button 3 - Text */}
          <Animated.View style={[styles.actionButton, button3Style]} pointerEvents="auto">
            <FAB
              icon={() => (
                <View style={styles.iconContainer}>
                  <MaterialIcons name="chat-bubble" size={28} color="white" />
                </View>
              )}
              onPress={handleTextPress}
              style={[styles.fab, { backgroundColor: '#45B7D1' }]}
              size="small"
            />
          </Animated.View>

          {/* Main FAB */}
          <Animated.View style={[styles.mainFabWrapper, { transform: [{ rotate: rotation }] }]}>
            <FAB
              icon={() => (
                <View style={styles.iconContainer}>
                  <MaterialIcons name="add" size={32} color="white" />
                </View>
              )}
              onPress={toggleMenu}
              style={[styles.mainFab, { backgroundColor: '#6C5CE7' }]}
            />
          </Animated.View>
        </View>
      </View>

      {/* Image Editor Modal */}
      {showImageEditor && tempImageUri && (
        <ImageEditor
          imageUri={tempImageUri}
          onSave={handleImageEditorSave}
          onCancel={handleImageEditorCancel}
        />
      )}

      {/* Zoom Viewer Modal */}
      {zoomViewerVisible && selectedImage && (
        <ZoomableImageView
          imageUri={selectedImage}
          visible={zoomViewerVisible}
          onClose={() => setZoomViewerVisible(false)}
        />
      )}

      {/* Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  questionCard: {
    marginBottom: 20,
    elevation: 4,
    borderRadius: 12,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 10,
  },
  questionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  inputCard: {
    marginBottom: 20,
    elevation: 4,
    borderRadius: 12,
  },
  inputTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 10,
  },
  textInput: {
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  submitButton: {
    marginTop: 10,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 15,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  changeImageButton: {
    flex: 1,
    borderColor: '#6C5CE7',
  },
  instructionCard: {
    elevation: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  instructionText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
  },
  optionsList: {
    gap: 15,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingVertical: 8,
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    right: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabInner: {
    position: 'relative',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainFab: {
    position: 'absolute',
    margin: 0,
    elevation: 6,
  },
  mainFabWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    elevation: 6,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  snackbar: {
    backgroundColor: '#6C5CE7',
  },
});
