import * as ImagePicker from "expo-image-picker";
import { ImageUploadResult } from "../types";
import { CONFIG } from "../config/env";
import { compressImage } from "../utils/compressImage";

export class ImagePickerService {
  public static async requestPermissions(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();

    return status === "granted" && cameraStatus.status === "granted";
  }

  public static async pickImageFromGalleryWithOptions(
    allowEditing: boolean = false
  ): Promise<ImageUploadResult> {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: allowEditing,
        aspect: allowEditing ? CONFIG.IMAGE_ASPECT_RATIO : undefined,
        quality: CONFIG.IMAGE_QUALITY,
        allowsMultipleSelection: false,
      });

      if (!result?.canceled && result?.assets?.[0]) {
        // Convert to JPEG to ensure compatibility with Gemini API
        const jpegUri = await compressImage(result.assets[0].uri, {
          maxDimension: CONFIG.MAX_IMAGE_DIMENSION,
          quality: CONFIG.IMAGE_QUALITY,
        });

        return {
          success: true,
          imageUri: jpegUri,
        };
      } else {
        return {
          success: false,
          error: "No image selected",
        };
      }
    } catch (error) {
      console.error("Error picking image from gallery:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to pick image from gallery",
      };
    }
  }

  public static async takePhotoWithCamera(allowEdit: boolean = false): Promise<ImageUploadResult> {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: allowEdit,
        aspect: allowEdit ? CONFIG.IMAGE_ASPECT_RATIO : undefined,
        quality: CONFIG.IMAGE_QUALITY,
      });

      if (!result?.canceled && result?.assets?.[0]) {
        // Convert to JPEG to ensure compatibility with Gemini API
        const jpegUri = await compressImage(result.assets[0].uri, {
          maxDimension: CONFIG.MAX_IMAGE_DIMENSION,
          quality: CONFIG.IMAGE_QUALITY,
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
