# Transcript Analyzer

An Expo (React Native) app that helps users discover their skills and interests by analyzing everyday activities in three ways:

- Vision: analyze a photo of what you’re doing
- Voice: record and transcribe what you’re doing
- Text: type a short description

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
- firebase (authentication)

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

## Setup

1. Requirements

- Node.js 18+
- npm or yarn
- Expo CLI (optional – you can use `npx expo`)

2. Install dependencies

- From the project root, install packages using your preferred package manager.

3. Configure Gemini

- Copy `src/config/env.example.ts` to `src/config/env.ts`
- Add `FIREBASE_API_KEY`: Firebase Web API key (Project Settings → General → Web API Key)
- Replace `GEMINI_API_KEY` with your key from Google AI Studio
- Keep `GEMINI_API_URL` as provided unless you have a custom endpoint

Note: Do not check real API keys into source control for production. Consider environment-based configuration for release builds.

## Run

- Start the Expo dev server and open the app in Expo Go on your device (or simulators via the Expo menu).

Common scripts (if present in `package.json`):

- `start`: Launch Metro bundler
- `ios`: Open iOS simulator
- `android`: Open Android emulator
- `web`: Open web preview

## How it works

1. Welcome screen (animated FAB)

- A central FAB near the bottom-right opens three actions:
  - Photo: pick or capture an image and analyze with Gemini Vision
  - Mic: record audio, transcribe to text with Gemini, then analyze
  - Text: type a short description for immediate analysis

2. Vision analysis (`HomeScreen` → `geminiService.analyzeActionImage`)

- Encodes the selected image to base64 and sends it to Gemini Vision with a prompt grounded in the skills taxonomy
- Parses structured JSON (activity, primary skills, categories, insights, growth opportunities, confidence)

3. Voice analysis (`VoiceAnalysisScreen` → `geminiService.transcribeAudio` → taxonomy analysis)

- Uses `expo-av` to record audio
- Reads file as base64 with correct mime type
- Sends to Gemini for transcription, then analyzes the transcript against the taxonomy

4. Text analysis (`TextAnalysisScreen` → `geminiService.processTranscriptText`)

- Sends the typed description and taxonomy prompt to Gemini
- Parses and renders the same structured result format

5. Results & Dashboard

- `ResultScreen` renders either vision or transcript/text-based analyses
- Identified skills and categories feed into the Dashboard to surface trends

## Configuration details

- `src/config/env.ts`
  - `FIREBASE_API_KEY`: Your Firebase Web API key (required)
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

- White screen or stale UI after changes

  - Fully reload the app from Expo Dev Tools or clear Metro cache (`--clear`)

- FAB not at expected position after hot reload

  - Re-open the app (layout transforms can cache with hot reload)

- Gemini errors (4xx/5xx)

  - Verify API key validity and quota
  - Ensure the model/endpoint is available in your region
  - Try again; the service includes a basic fallback to a compatible model if configured

- Audio transcription issues

  - Make sure mic permissions are granted
  - Speak clearly and keep recordings short while testing

- Image analysis poor results
  - Use a clear, well-lit image that focuses on the activity

## Roadmap

- Persist analysis history locally for richer Dashboard insights
- Improve result visualizations and badges
- Add offline-friendly drafts and background uploads
- Parameterize taxonomy for custom domains

## License

MIT

## Acknowledgements

- Google Gemini for multimodal AI
- Expo, React Native, and the open-source community
