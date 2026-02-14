import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ImageUploadResult } from '../types';
import { CONFIG } from '../config/env';

export class ImagePickerService {
  /**
   * Convert any image to JPEG format to ensure compatibility with Gemini API.
   * iPhone camera photos are often in HEIC format which Gemini doesn't support.
   */
  private static async convertToJpeg(imageUri: string): Promise<string> {
    try {
      console.log('Converting image to JPEG format:', imageUri);

      // Try to manipulate and convert to JPEG with aggressive compression to reduce tokens
      try {
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          imageUri,
          [
            // Resize to max 1024px on longest side to significantly reduce token usage
            {
              resize: {
                width: CONFIG.MAX_IMAGE_DIMENSION,
                height: CONFIG.MAX_IMAGE_DIMENSION,
              },
            },
          ],
          {
            compress: CONFIG.IMAGE_QUALITY, // 0.6 for good balance of quality and token usage
            format: ImageManipulator.SaveFormat.JPEG, // Force JPEG format
          }
        );

        console.log('Image converted to JPEG:', manipulatedImage.uri);
        return manipulatedImage.uri;
      } catch (manipulationError) {
        // If manipulation fails, try with just the URI (fallback for compatibility)
        console.warn('Image manipulation failed, returning original URI:', manipulationError);
        return imageUri;
      }
    } catch (error) {
      console.error('Error converting image to JPEG:', error);
      throw new Error('Failed to convert image to JPEG format');
    }
  }
  public static async requestPermissions(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();

    return status === 'granted' && cameraStatus.status === 'granted';
  }

  public static async pickImageFromGalleryWithOptions(
    allowEditing: boolean = false
  ): Promise<ImageUploadResult> {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: allowEditing,
        aspect: allowEditing ? CONFIG.IMAGE_ASPECT_RATIO : undefined,
        quality: CONFIG.IMAGE_QUALITY,
        allowsMultipleSelection: false,
      });

      console.log('Image picker result:', JSON.stringify(result, null, 2));

      if (!result?.canceled && result?.assets?.[0]) {
        // Convert to JPEG to ensure compatibility with Gemini API
        const jpegUri = await this.convertToJpeg(result.assets[0].uri);

        return {
          success: true,
          imageUri: jpegUri,
        };
      } else {
        return {
          success: false,
          error: 'No image selected',
        };
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pick image from gallery',
      };
    }
  }

  public static async takePhotoWithCamera(): Promise<ImageUploadResult> {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false, // Disable editing to allow full image capture
        quality: CONFIG.IMAGE_QUALITY,
      });

      console.log('Camera result:', JSON.stringify(result, null, 2));

      if (!result?.canceled && result?.assets?.[0]) {
        // Convert to JPEG to ensure compatibility with Gemini API
        const jpegUri = await this.convertToJpeg(result.assets[0].uri);

        return {
          success: true,
          imageUri: jpegUri,
        };
      } else {
        return {
          success: false,
          error: 'No photo taken',
        };
      }
    } catch (error) {
      console.error('Error taking photo with camera:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to take photo',
      };
    }
  }
}
