# Promise Unlocked

An Expo (React Native) app that analyzes everyday activities against a skills taxonomy using Vision, Voice, and Text — powered by Google Gemini.

## Quick Start

```bash
# Prerequisites: Node.js 18+, Expo Go (physical device)

# 1. Install dependencies
npm install

# 2. Configure Gemini API key
cp src/config/env.example.ts src/config/env.ts
# Edit src/config/env.ts and paste your key from https://aistudio.google.com/app/apikey

# 3. Start the dev server
npx expo start

# 4. Scan QR code with Expo Go (iOS/Android) or press i/a/w for simulator
```

## Project Structure

- `src/` — React Native app (screens, components, services)
- `backend/` — Firebase Cloud Function API (Express + TypeScript)
- `docs/` — Detailed guides

## Documentation

| Guide | Description |
|---|---|
| [App Overview](docs/APP_OVERVIEW.md) | Features, how it works, tech stack, configuration, troubleshooting |
| [Setup Instructions](docs/SETUP_INSTRUCTIONS.md) | Step-by-step setup with alternatives and device tips |
| [Backend API](docs/BACKEND.md) | Deployment, API routes, environment variables |
| [EAS TestFlight](docs/EAS_TESTFLIGHT.md) | Building and submitting to TestFlight |

## License

MIT
