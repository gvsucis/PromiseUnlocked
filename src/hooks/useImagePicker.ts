import { useCallback } from "react";
import { Alert } from "react-native";
import { ImagePickerService } from "../services/imagePickerService";

export function useImagePicker() {
  const pickImage = useCallback(async (useCamera: boolean): Promise<string | null> => {
    try {
      const hasPermissions = await ImagePickerService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert("Permissions Required", "Camera and photo library permissions are required.");
        return null;
      }

      const result = useCamera
        ? await ImagePickerService.takePhotoWithCamera()
        : await ImagePickerService.pickImageFromGalleryWithOptions(false);

      if (result.success && result.imageUri) {
        return result.imageUri;
      }

      if (result.error) {
        Alert.alert("Error", result.error);
      }
      return null;
    } catch (err) {
      console.error("Error picking image:", err);
      Alert.alert("Error", "An error occurred while selecting image");
      return null;
    }
  }, []);

  return { pickImage };
}
