# Promise Unlocked Backend

Node.js 22 + TypeScript + Express + Firebase backend for the Promise Unlocked mobile app.

Deployed as a Firebase Cloud Function (`api`) with a Firestore-triggered function (`verifyProof`).

## Quick Start

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` with your credentials. See [Environment Variables](#environment-variables) below.

```bash
# Standalone Express server with hot reload
npm run dev

# Or with Firebase emulators (functions, firestore, auth)
npm run dev:functions
```

The server starts at `http://localhost:4000`. Swagger docs are at `/api-docs`.

## Deployment

### Prerequisites

1. **Firebase Blaze plan** (required for outbound networking to Gemini API + Cloud Functions with external access).
2. **APIs enabled** in your GCP project:
   - Cloud Functions
   - Cloud Firestore
   - Cloud Storage
   - Secret Manager API
3. **Firebase CLI** logged in:
   ```bash
   firebase login
   ```
4. **Firebase project linked** (currently set to `promise-unlocked-for-sure`):
   ```bash
   firebase use promise-unlocked-for-sure
   ```

### Firebase Secrets (required before first deploy)

The backend uses `defineSecret` for sensitive values. Create them once:

```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set CLIENT_FIREBASE_API_KEY
```

Values are stored in Google Cloud Secret Manager and injected as environment variables at runtime. You must grant the Cloud Functions service account access when prompted.

### Firestore Vector Index

The PDF embedding search requires a Firestore vector index. Create it in the Firebase Console:

- **Collection path**: `user_file_embeddings/{uid}/embeddings`
- **Vector field**: `embedding`
- **Dimensions**: `768`
- **Distance metric**: `COSINE`
- **Filter fields**: _(none)_

Without this index, the search endpoint returns empty results with a silent warning.

### Build & Deploy

```bash
npm run build
npm run deploy
```

This compiles TypeScript, rewrites `@/` path aliases to relative imports, and deploys all Cloud Functions to the linked Firebase project.

### Deployed Endpoints

| Function       | Trigger                        | URL pattern                                      |
| -------------- | ------------------------------ | ------------------------------------------------ |
| `api`          | HTTPS                          | `https://api-{project}.run.app`                  |
| `verifyProof`  | Firestore doc create           | `proof_verification_jobs/{jobId}`                |

The `api` function URL can be found via:

```bash
firebase functions:list
```

## API Routes

All authenticated routes require a Firebase ID token in the `Authorization: Bearer <token>` header.

### Auth

| Method | Route                | Auth | Description                                        |
| ------ | -------------------- | ---- | -------------------------------------------------- |
| POST   | `/api/auth/register` | No   | Register with email, password, firstName, lastName |
| POST   | `/api/auth/login`    | No   | Login, returns `idToken`                           |

### Participants

| Method | Route                                      | Auth | Description                                  |
| ------ | ------------------------------------------ | ---- | -------------------------------------------- |
| POST   | `/api/participants`                        | No   | Create a new participant                     |
| GET    | `/api/participants`                        | Yes  | List participants (admin = all, user = self) |
| GET    | `/api/participants/me`                     | Yes  | Get authenticated user's profile             |
| GET    | `/api/participants/me/sessions`            | Yes  | List my sessions                             |
| GET    | `/api/participants/me/sessions/:sessionId` | Yes  | Get a specific session of mine               |
| GET    | `/api/participants/:uid`                   | Yes  | Get participant by UID                       |
| DELETE | `/api/participants/:uid`                   | Yes  | Delete participant (self or admin)           |

### Sessions

| Method | Route                                  | Auth | Description                   |
| ------ | -------------------------------------- | ---- | ----------------------------- |
| GET    | `/api/participants/:pid/sessions`      | Yes  | List sessions for participant |
| GET    | `/api/participants/:pid/sessions/:sid` | Yes  | Get session by ID             |

Query params for list: `status` (active|completed|cancelled), `limit` (max 100, default 20).

### Interactions

| Method | Route                                                    | Auth | Description                        |
| ------ | -------------------------------------------------------- | ---- | ---------------------------------- |
| GET    | `/api/participants/:pid/sessions/:sid/interactions`      | Yes  | List interactions                  |
| GET    | `/api/participants/:pid/sessions/:sid/interactions/:id`  | Yes  | Get interaction                    |
| GET    | `/api/participants/me/sessions/:sid/interactions/me/:id` | Yes  | Get my interaction (uses auth UID) |

Query param for list: `limit` (max 200, default 50).

### Chat

| Method | Route               | Auth | Description                                                 |
| ------ | ------------------- | ---- | ----------------------------------------------------------- |
| POST   | `/api/chat/respond` | Yes  | Save response, generate embedding, return similar responses |

Body: `userId`, `skillId`, `responseText`, `question`.

### Profile Embeddings

| Method | Route                                 | Auth | Description                             |
| ------ | ------------------------------------- | ---- | --------------------------------------- |
| POST   | `/api/profile-embeddings/upload`      | Yes  | Upload PDF for embedding processing     |
| GET    | `/api/profile-embeddings/list`        | Yes  | List uploaded embeddings for auth user  |
| GET    | `/api/profile-embeddings/context/:id` | Yes  | Get a single embedding record by ID     |
| POST   | `/api/profile-embeddings/search`      | Yes  | Semantic search across uploaded PDFs    |

Upload is `multipart/form-data` with `file` (PDF) and optional `userId`/`uid`/`email` to upload on behalf of another user. Guest/anonymous callers are rejected.

Search body: `{ "query": string, "limit"?: number }`.

### System

| Method | Route       | Auth | Description  |
| ------ | ----------- | ---- | ------------ |
| GET    | `/health`   | No   | Health check |
| GET    | `/api-docs` | No   | Swagger UI   |

## Environment Variables

Set these in `.env` for local development. For production, use Firebase Secrets (see [Firebase Secrets](#firebase-secrets-required-before-first-deploy) above) and Firebase environment config.

### Required

| Variable                          | Description                                          |
| --------------------------------- | ---------------------------------------------------- |
| `CLIENT_FIREBASE_API_KEY`         | Firebase Web API key (used by auth middleware)       |
| `GEMINI_API_KEY`                  | Gemini API key (embedding + proof verification)      |
| `APP_FIREBASE_STORAGE_BUCKET`     | GCS bucket name (e.g. `project-id.firebasestorage.app`) |

### Optional

| Variable                        | Default                    | Description                                         |
| ------------------------------- | -------------------------- | --------------------------------------------------- |
| `APP_PORT`                      | `4000`                     | Local dev server port                               |
| `GEMINI_EMBEDDING_MODEL`        | `gemini-embedding-2`       | Embedding model name (must match between write/search) |
| `RATE_LIMIT_WINDOW_MS`          | `60000`                    | Rate limit window in ms                             |
| `RATE_LIMIT_MAX_REQUESTS`       | `120`                      | Max requests per window                             |
| `CORS_ORIGIN`                   | `*` (all origins)          | Comma-separated allowed CORS origins                |

### Firebase Admin SDK

In Cloud Functions, the Admin SDK auto-configures via Application Default Credentials. For local dev, the SDK loads the service account JSON file at `backend/promise-unlocked-for-sure-firebase-adminsdk-fbsvc-fb7e582d9b.json`. Keep this file out of version control (already in `.gitignore`).

## Project Structure

```
backend/
  src/
    api/            # Route definitions
    controllers/    # Request handlers
    services/       # Business logic + Firebase
    middleware/     # Auth middleware
    validation/     # Zod schemas
    workers/        # Utility functions (text extraction, embedding)
    test/           # Smoke tests
    functions/      # Firestore-triggered Cloud Functions
    app.ts          # Express app setup
    index.ts        # Firebase Functions entry point
    server.ts       # Local dev server entry point
  postman/          # Postman collection
  dist/             # Compiled output (gitignored, generated by build)
```

## Test

```bash
# Smoke tests (requires server running on localhost:4000)
npm test

# Or point at a different server
TEST_BASE_URL=http://localhost:4000 npm test
```

## Build

```bash
npm run build
```

Uses `tsc` + `tsc-alias` to compile TypeScript and rewrite `@/` path aliases to relative imports in `dist/`.

## Postman

Import `postman/PromiseUnlocked-API.postman_collection.json`. The Login request auto-saves the bearer token, and list requests auto-save IDs for chained requests.
