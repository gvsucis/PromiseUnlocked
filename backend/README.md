# Promise Unlocked Backend

Node.js + TypeScript + Express + Firebase backend for the Promise Unlocked mobile app.

## Quick Start

```bash
cd backend
npm install
```

Copy the environment template:

```bash
cp .env.example .env
```

Make sure you have a Firebase service account key at `serviceAccountKey.json`.

### Run locally

```bash
# Standalone Express server with hot reload
npm run dev

# Or with Firebase emulators (functions, firestore, auth)
npm run dev:functions
```

The server starts at `http://localhost:4000`. Swagger docs are at `/api-docs`.

### Test

```bash
# Smoke tests (requires server running on localhost:4000)
npm test

# Or point at a different server
TEST_BASE_URL=http://localhost:4000 npm test
```

### Build & Deploy

```bash
npm run build
firebase deploy --only functions
```

## API Routes

All authenticated routes require a Firebase ID token in the `Authorization: Bearer <token>` header.

### Auth

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | No | Register with email, password, firstName, lastName |
| POST | `/api/auth/login` | No | Login, returns `idToken` |

### Participants

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/participants` | No | Create a new participant |
| GET | `/api/participants` | Yes | List participants (admin = all, user = self) |
| GET | `/api/participants/me` | Yes | Get authenticated user's profile |
| GET | `/api/participants/me/sessions` | Yes | List my sessions |
| GET | `/api/participants/me/sessions/:sessionId` | Yes | Get a specific session of mine |
| GET | `/api/participants/:uid` | Yes | Get participant by UID |
| DELETE | `/api/participants/:uid` | Yes | Delete participant (self or admin) |

### Sessions

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/participants/:pid/sessions` | Yes | List sessions for participant |
| GET | `/api/participants/:pid/sessions/:sid` | Yes | Get session by ID |

Query params for list: `status` (active|completed|cancelled), `limit` (max 100, default 20).

### Interactions

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/participants/:pid/sessions/:sid/interactions` | Yes | List interactions |
| GET | `/api/participants/:pid/sessions/:sid/interactions/:id` | Yes | Get interaction |
| GET | `/api/participants/me/sessions/:sid/interactions/me/:id` | Yes | Get my interaction (uses auth UID) |

Query param for list: `limit` (max 200, default 50).

### Chat

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/chat/respond` | Yes | Save response, generate embedding, return similar responses |

Body: `userId`, `skillId`, `responseText`, `question`.

### Profile Embeddings

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/profile-embeddings/upload` | Yes* | Upload PDF for embedding processing |
| GET | `/api/profile-embeddings/jobs/:jobId` | Yes* | Check job status |

\* Auth optional if `EMBEDDING_AUTH_OPTIONAL=true`.

Upload is `multipart/form-data` with `file` (PDF), optional `userId`/`email`, optional `text`.

### System

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/api-docs` | No | Swagger UI |

## Postman

Import `postman/PromiseUnlocked-API.postman_collection.json`. The Login request auto-saves the bearer token, and list requests auto-save IDs for chained requests.

## Project Structure

```
backend/
  src/
    api/           # Route definitions
    controllers/   # Request handlers
    services/      # Business logic + Firebase
    middleware/    # Auth middleware
    validation/    # Zod schemas
    workers/       # Background job workers
    test/          # Smoke tests
  postman/         # Postman collection
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 4000) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON |
| `EMBEDDING_AUTH_OPTIONAL` | Set `true` to skip auth on embedding routes |
