import { useState } from 'react';
import { Alert } from 'react-native';
import { ImagePickerService } from '../services/imagePickerService';
import { GeminiService } from '../services/geminiService';
import { INITIAL_PROMPT } from '../services/categoryTaxonomyService';
import { DialogueState } from './useDialogueState';

interface UseImageHandlingProps {
  dialogueState: DialogueState;
  mapAnswerToCategory: (question: string, answer: string) => Promise<void>;
}

export function useImageHandling({ dialogueState, mapAnswerToCategory }: UseImageHandlingProps) {
  const {
    setCurrentPrompt,
    currentPrompt,
    prefetchedQuestion,
    setPrefetchedQuestion,
    setUiState,
    setError,
    mappedCategories,
    setLoadingMessage,
    setSavedQuestion,
  } = dialogueState;

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [tempImageUri, setTempImageUri] = useState<string | null>(null);
  const [zoomViewerVisible, setZoomViewerVisible] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  const handleImageInputPress = async () => {
    setError('');

    // Get the question
    if (mappedCategories.length === 0) {
      setCurrentPrompt(INITIAL_PROMPT);
      setSavedQuestion(INITIAL_PROMPT);
    } else if (prefetchedQuestion) {
      setCurrentPrompt(prefetchedQuestion);
      setSavedQuestion(prefetchedQuestion);
      setPrefetchedQuestion(null);
    } else {
      console.error('No question available when image input was selected');
      setError('No question available. Please try again.');
      return;
    }

    // Show image source selection dialog
    Alert.alert(
      'Choose Image Source',
      'How would you like to add your image?',
      [
        {
          text: 'Take Photo',
          onPress: () => handleImageSelection(true), // Use camera
        },
        {
          text: 'Choose from Gallery',
          onPress: () => handleImageSelection(false), // Use gallery
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleImageSelection = async (useCamera: boolean) => {
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
        result = await ImagePickerService.pickImageFromGalleryWithOptions(false);
      }

      if (result.success && result.imageUri) {
        setTempImageUri(result.imageUri);
        setShowImageEditor(true);
      } else if (result.error) {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while selecting image');
    }
  };

  const handleImageEditorSave = (editedImageUri: string) => {
    setSelectedImage(editedImageUri);
    setShowImageEditor(false);
    setTempImageUri(null);
    setUiState('answering'); // Show the answer modal with image preview
  };

  const handleImageEditorCancel = () => {
    setShowImageEditor(false);
    setTempImageUri(null);
    setUiState('idle');
  };

  const handleSubmitImage = async () => {
    if (!selectedImage || !currentPrompt) {
      Alert.alert('Error', 'Missing image or question');
      return;
    }

    setIsAnalyzingImage(true);
    setUiState('loading');
    setLoadingMessage('Analyzing your image response...');

    try {
      // Analyze the image with Gemini
      const analysisResult = await GeminiService.analyzeActionImage(selectedImage);

      if (!analysisResult.success || !analysisResult.rawResponse) {
        throw new Error(analysisResult.error || 'Failed to analyze image');
      }

      // Use the image analysis description as the answer
      const answer = analysisResult.rawResponse;

      // Clear image state
      setSelectedImage(null);

      // Map the answer to a category
      await mapAnswerToCategory(currentPrompt, answer);
    } catch (error) {
      console.error('Error processing image:', error);
      Alert.alert('Error', 'Failed to process image. Please try again.');
      setUiState('idle');
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  return {
    selectedImage,
    showImageEditor,
    tempImageUri,
    zoomViewerVisible,
    isAnalyzingImage,
    handleImageInputPress,
    handleImageSelection,
    handleImageEditorSave,
    handleImageEditorCancel,
    handleSubmitImage,
    removeImage,
    setSelectedImage,
    setZoomViewerVisible,
  };
}
