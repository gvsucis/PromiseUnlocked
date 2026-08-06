import * as ImageManipulator from "expo-image-manipulator";

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
}

export async function compressImage(uri: string, options: CompressOptions = {}): Promise<string> {
  const { maxDimension = 1280, quality = 0.72 } = options;

  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxDimension, height: maxDimension } }],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return result.uri;
  } catch {
    return uri;
  }
}
