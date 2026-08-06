import { auth } from "../config/firebase";
import { CONFIG } from "../config/env";
import * as FileSystem from "expo-file-system/legacy";

export interface UploadResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface MultipartUploadResponse {
  status: number;
  body: string;
}

export function parseJsonBody(body: string): Record<string, any> {
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function uploadMultipartFile(params: {
  endpoint: string;
  fileUri: string;
  fileField?: string;
  mimeType?: string;
  fields?: Record<string, string>;
  headers?: Record<string, string>;
}): Promise<MultipartUploadResponse> {
  const { endpoint, fileUri, fileField = "file", mimeType, fields, headers } = params;
  const result = await FileSystem.uploadAsync(`${CONFIG.API_BASE_URL}${endpoint}`, fileUri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: fileField,
    ...(mimeType ? { mimeType } : {}),
    ...(fields && Object.keys(fields).length > 0 ? { parameters: fields } : {}),
    headers: headers ?? (await getAuthHeaders()),
  });

  return { status: result.status, body: result.body };
}

export async function uploadImage(params: {
  endpoint: string;
  imageUri: string;
  fileField?: string;
  fields?: Record<string, string>;
}): Promise<UploadResult> {
  const { endpoint, imageUri, fileField = "file", fields = {} } = params;

  try {
    const { status, body } = await uploadMultipartFile({
      endpoint,
      fileUri: imageUri,
      fileField,
      fields,
      mimeType: "image/jpeg",
    });

    const parsed = parseJsonBody(body);

    if (status < 200 || status >= 300) {
      return {
        success: false,
        error: parsed.error || `Upload failed (${status})`,
      };
    }

    return {
      success: true,
      data: parsed.data ?? parsed,
    };
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

    const body = (await response.json().catch(() => ({}))) as Record<string, any>;

    if (!response.ok) {
      return {
        success: false,
        error: body.error || `Upload failed (${response.status})`,
      };
    }

    return {
      success: true,
      data: body.data ?? body,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}
export async function uploadPDF(params: {
  endpoint: string;
  pdfUri: string;
  fileField?: string;
  fields?: Record<string, string>;
}): Promise<UploadResult> {
  const { endpoint, pdfUri, fileField = "file", fields = {} } = params;

  try {
    const { status, body } = await uploadMultipartFile({
      endpoint,
      fileUri: pdfUri,
      fileField,
      fields,
      mimeType: "application/pdf",
    });

    const parsed = parseJsonBody(body);

    if (status < 200 || status >= 300) {
      return {
        success: false,
        error: parsed.error || `Upload failed (${status})`,
      };
    }

    return {
      success: true,
      data: parsed.data ?? parsed,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}
// export async function handleFileUpload
