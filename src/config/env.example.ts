// Example environment configuration.
// Copy this file to env.ts and fill in your real values, or use EXPO_PUBLIC_* environment variables.

export const CONFIG = {
  // Google Gemini API Configuration
  GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY || "YOUR_GEMINI_API_KEY",
  GEMINI_API_URL: "https://generativelanguage.googleapis.com/v1beta/models",
  TEXT_MODEL: "gemini-2.5-flash-lite",

  // Image Processing Configuration
  MAX_IMAGE_SIZE: 4 * 1024 * 1024,
  MAX_IMAGE_DIMENSION: 1024,
  IMAGE_QUALITY: 0.8,
  IMAGE_ASPECT_RATIO: [4, 3] as [number, number],

  // Timeout for backend API calls (ms)
  REQUEST_TIMEOUT: 60000,

  // FIREBASE
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "YOUR_FIREBASE_API_KEY",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "your-app.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "your-app",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "your-app.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "YOUR_APP_ID",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "YOUR_MEASUREMENT_ID",

  // GOOGLE AUTH (OAuth client IDs)
  GOOGLE_IOS_CLIENT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
  GOOGLE_ANDROID_CLIENT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
  GOOGLE_EXPO_CLIENT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ||
    "YOUR_EXPO_CLIENT_ID.apps.googleusercontent.com",

  // BACKEND API
  API_BASE_URL:
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.REACT_NATIVE_API_BASE_URL ||
    "http://localhost:4000",
};

export const validateConfig = (): boolean => {
  if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
    return false;
  }
  return true;
};

export const getGeminiApiKey = (): string => {
  if (!validateConfig()) {
    throw new Error("Gemini API key not configured. Please set your API key in src/config/env.ts");
  }
  return CONFIG.GEMINI_API_KEY;
};
