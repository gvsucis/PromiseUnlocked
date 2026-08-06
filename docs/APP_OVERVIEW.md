# App Overview

An Expo (React Native) app that helps users discover their skills and interests by analyzing everyday activities in three ways:

- **Vision**: analyze a photo of what you're doing
- **Voice**: record and transcribe what you're doing
- **Text**: type a short description

All three paths are evaluated against a skills taxonomy, and results are presented on a unified Results screen and a Dashboard.

## Key features

- Welcome screen with animated FAB that fans out three actions (photo, mic, text)
- Image-based activity analysis via Gemini Vision
- Voice recording, transcription, and skill analysis via Gemini
- Text-based activity analysis with structured results
- Results screen shows activity insights, identified skills, categories, confidence, and growth opportunities
- Dashboard summarizes interests and frequently occurring skills
- Works in Expo Go (managed workflow, no native build required)

## Tech stack

- Expo SDK 54 (managed workflow)
- React Native, TypeScript
- React Navigation (Stack)
- react-native-paper (UI)
- @expo/vector-icons (Material Icons)
- expo-av (audio recording)
- expo-linear-gradient (visuals)
- expo-file-system (base64 image/audio handling)
- axios (networking)

## Project structure

```
TranscriptAnalyzer/
├── App.tsx
├── index.ts
├── src/
│   ├── components/
│   │   ├── ImageEditor.tsx
│   │   └── ZoomableImageView.tsx
│   ├── config/
│   │   ├── env.example.ts
│   │   └── env.ts
│   ├── screens/
│   │   ├── WelcomeScreen.tsx          # Animated FAB entry point
│   │   ├── HomeScreen.tsx             # Vision-based activity analysis
│   │   ├── ResultScreen.tsx           # Unified results renderer
│   │   ├── VoiceAnalysisScreen.tsx    # Voice record/transcribe/analyze
│   │   └── TextAnalysisScreen.tsx     # Text-based analysis
│   ├── services/
│   │   ├── geminiService.ts           # Gemini API integration
│   │   └── imagePickerService.ts
│   └── types/
│       ├── index.ts
│       └── navigation.ts
├── assets/
│   ├── icon.png
│   ├── splash-icon.png
│   └── ...
├── app.json
├── eas.json
├── package.json
└── tsconfig.json
```

## How it works

### Welcome screen (animated FAB)

A central FAB near the bottom-right opens three actions:
- **Photo**: pick or capture an image and analyze with Gemini Vision
- **Mic**: record audio, transcribe to text with Gemini, then analyze
- **Text**: type a short description for immediate analysis

### Vision analysis (`HomeScreen` → `geminiService.analyzeActionImage`)

Encodes the selected image to base64 and sends it to Gemini Vision with a prompt grounded in the skills taxonomy. Parses structured JSON (activity, primary skills, categories, insights, growth opportunities, confidence).

### Voice analysis (`VoiceAnalysisScreen` → `geminiService.transcribeAudio` → taxonomy analysis)

Uses `expo-av` to record audio, reads file as base64 with correct mime type, sends to Gemini for transcription, then analyzes the transcript against the taxonomy.

### Text analysis (`TextAnalysisScreen` → `geminiService.processTranscriptText`)

Sends the typed description and taxonomy prompt to Gemini, parses and renders the same structured result format.

### Results & Dashboard

`ResultScreen` renders either vision or transcript/text-based analyses. Identified skills and categories feed into the Dashboard to surface trends.

## Configuration details

- `src/config/env.ts`
  - `GEMINI_API_KEY`: Your API key (required)
  - `GEMINI_API_URL`: Defaults to Gemini 2.0 Flash generateContent endpoint
  - Image constraints: `MAX_IMAGE_SIZE`, `IMAGE_QUALITY`, `IMAGE_ASPECT_RATIO`
  - `REQUEST_TIMEOUT`: Network timeout in ms

Security tip: The sample uses a TypeScript config file for simplicity. For production, prefer secrets management (e.g., EAS secrets, server-side proxy) to avoid shipping keys in apps.

## Permissions

- Camera / Media Library: Select or capture photos for vision analysis
- Microphone: Record audio for voice analysis
- Network: Access Gemini APIs

Permissions are requested at runtime as needed.

## Troubleshooting

- **White screen or stale UI after changes** — Fully reload the app from Expo Dev Tools or clear Metro cache (`--clear`)
- **FAB not at expected position after hot reload** — Re-open the app (layout transforms can cache with hot reload)
- **Gemini errors (4xx/5xx)** — Verify API key validity and quota, ensure the model/endpoint is available in your region, try again
- **Audio transcription issues** — Make sure mic permissions are granted, speak clearly and keep recordings short while testing
- **Image analysis poor results** — Use a clear, well-lit image that focuses on the activity

## Roadmap

- Persist analysis history locally for richer Dashboard insights
- Improve result visualizations and badges
- Add offline-friendly drafts and background uploads
- Parameterize taxonomy for custom domains

## Acknowledgements

- Google Gemini for multimodal AI
- Expo, React Native, and the open-source community
