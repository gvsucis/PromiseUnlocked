// Example environment configuration. Copy to env.ts and fill in real values.

export const CONFIG = {
  // Google Gemini API Configuration
  GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY',
  GEMINI_API_URL: "https://generativelanguage.googleapis.com/v1beta/models",
  TEXT_MODEL:
  "gemini-2.5-flash",

  // Image Processing Configuration
  MAX_IMAGE_SIZE: 4 * 1024 * 1024,
  IMAGE_QUALITY: 0.8,
  IMAGE_ASPECT_RATIO: [4, 3] as [number, number],

  // API Configuration
  REQUEST_TIMEOUT: 30000,
};

export const validateConfig = (): boolean => {
  if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    return false;
  }
  return true;
};

export const getGeminiApiKey = (): string => {
  if (!validateConfig()) {
    throw new Error('Gemini API key not configured. Please set your API key in src/config/env.ts');
  }
  return CONFIG.GEMINI_API_KEY;
};


