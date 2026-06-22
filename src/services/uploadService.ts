import { auth } from "../config/firebase";
import { CONFIG } from "../config/env";

export interface UploadResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function uploadImage(params: {
  endpoint: string;
  imageUri: string;
  fileField?: string;
  fields?: Record<string, string>;
}): Promise<UploadResult> {
  const { endpoint, imageUri, fileField = "file", fields = {} } = params;

  try {
    const formData = new FormData();

    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }

    formData.append(fileField, {
      uri: imageUri,
      name: `upload_${Date.now()}.jpg`,
      type: "image/jpeg",
    } as unknown as Blob);

    const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: body.error || `Upload failed (${response.status})`,
      };
    }

    return { success: true, data: body.data ?? body };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}

export async function uploadMultipleImages(params: {
  endpoint: string;
  imageUris: string[];
  fileField?: string;
  fields?: Record<string, string>;
}): Promise<UploadResult> {
  const { endpoint, imageUris, fileField = "files", fields = {} } = params;

  try {
    const formData = new FormData();

    for (const [key, value] of Object.entries(fields)) {
      formData.append(key, value);
    }

    for (let i = 0; i < imageUris.length; i++) {
      formData.append(fileField, {
        uri: imageUris[i],
        name: `upload_${i}_${Date.now()}.jpg`,
        type: "image/jpeg",
      } as unknown as Blob);
    }

    const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        error: body.error || `Upload failed (${response.status})`,
      };
    }

    return { success: true, data: body.data ?? body };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}
