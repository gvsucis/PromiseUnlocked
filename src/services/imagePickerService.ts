import * as ImagePicker from "expo-image-picker";
import { ImageUploadResult } from "../types";
import { compressImage } from "../utils/compressImage";

const MAX_IMAGE_DIMENSION = 1024;
const IMAGE_QUALITY = 0.8;
const IMAGE_ASPECT_RATIO: [number, number] = [4, 3];

export class ImagePickerService {
  public static async requestPermissions(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();

    return status === "granted" && cameraStatus.status === "granted";
  }

  public static async pickImageFromGalleryWithOptions(
    allowEditing: boolean = false,
    aspect: [number, number] = IMAGE_ASPECT_RATIO
  ): Promise<ImageUploadResult> {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: allowEditing,
        aspect: allowEditing ? aspect : undefined,
        quality: IMAGE_QUALITY,
        allowsMultipleSelection: false,
      });

      if (!result?.canceled && result?.assets?.[0]) {
        // Convert to JPEG to ensure compatibility with Gemini API
        const jpegUri = await compressImage(result.assets[0].uri, {
          maxDimension: MAX_IMAGE_DIMENSION,
          quality: IMAGE_QUALITY,
        });

        return {
          success: true,
          imageUri: jpegUri,
        };
      } else {
        return { success: false };
      }
    } catch (error) {
      console.error("Error picking image from gallery:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to pick image from gallery",
      };
    }
  }

  public static async takePhotoWithCamera(
    allowEdit: boolean = false,
    aspect: [number, number] = IMAGE_ASPECT_RATIO
  ): Promise<ImageUploadResult> {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: allowEdit,
        aspect: allowEdit ? aspect : undefined,
        quality: IMAGE_QUALITY,
      });

      if (!result?.canceled && result?.assets?.[0]) {
        // Convert to JPEG to ensure compatibility with Gemini API
        const jpegUri = await compressImage(result.assets[0].uri, {
          maxDimension: MAX_IMAGE_DIMENSION,
          quality: IMAGE_QUALITY,
        });

        return {
          success: true,
          imageUri: jpegUri,
        };
      } else {
        return {
          success: false,
          error: "No photo taken",
        };
      }
    } catch (error) {
      console.error("Error taking photo with camera:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to take photo",
      };
    }
  }
}
