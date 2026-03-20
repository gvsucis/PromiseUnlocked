# Firebase Storage Technical Review for Stakeholders

- **Project:** PromiseUnlocked (Mobile App)
- **Document Type:** Technical Review and Implementation Proposal
- **Status:** Draft for stakeholder review
- **Date:** 2026-03-06

## 1. Purpose

This document reviews Firebase Storage in the PromiseUnlocked mobile app and outlines a secure, scalable target approach for stakeholder approval.

## 2. Executive Summary

- Firebase Storage is configured in both application environment settings and Firebase initialization.
- No active Firebase Storage upload/download/delete operations are currently implemented in the app code paths.
- Current image/audio flows are processed locally and sent directly to Gemini APIs as base64 payloads.
- There are no repository-managed Firebase Storage Rules files yet.
- A controlled rollout is recommended to introduce Firebase Storage safely, with privacy controls, retention policies, and cost guardrails.

## 3. Business Drivers for Firebase Storage

Potential reasons to activate Firebase Storage:

- Preserve user-submitted media for traceability and review workflows.
- Enable asynchronous and resumable uploads for unstable network conditions.
- Support auditable processing pipelines (raw media, processed derivatives, generated artifacts).
- Enable controlled retention for product analytics and model quality review.
- Reduce direct payload size pressure on AI API calls by referencing stored assets in backend workflows.

## 4. Proposed Target Architecture

### 4.1 High-Level Architecture

- Mobile app uploads approved media assets to Firebase Storage under user-scoped paths.
- Metadata is stored in Firestore and linked to existing session model.
- An optional Cloud Functions pipeline can validate uploads, create derivatives, and enforce retention.
- Gemini processing can remain client-driven initially, then move to server-side processing if stronger key isolation is required.

### 4.2 Recommended Storage Path Conventions

Use deterministic and user-scoped object paths:

- `participants/{uid}/sessions/{sessionId}/images/{assetId}.jpg`
- `participants/{uid}/sessions/{sessionId}/audio/{assetId}.m4a`
- `participants/{uid}/sessions/{sessionId}/derived/{assetId}.json`

Naming guidelines:

- `assetId` should be collision-safe (for example, timestamp + random suffix or UUID).
- Include extension based on validated MIME type.
- Do not include user email or other PII in object path names.

### 4.3 Firestore Metadata Companion (Recommended)

Add a metadata collection under existing user scope:

- `participants/{uid}/media/{assetId}`

Suggested fields:

- `sessionId: string`
- `mediaType: "image" | "audio" | "derived"`
- `storagePath: string`
- `contentType: string`
- `sizeBytes: number`
- `status: "uploaded" | "processing" | "processed" | "failed" | "deleted"`
- `createdAt: serverTimestamp`
- `expiresAt: Timestamp` (if retention policy applies)

## 5. Current Firestore Database Schema

Current Firestore structure used by the app:

```text
participants/{userId}
participants/{userId}/sessions/{sessionId}
participants/{userId}/sessions/{sessionId}/interactions/{interactionId}
participants/{userId}/skillPassport/{categoryId}
participants/{userId}/identifiedSkills/{skillId}
```

Key document models:

- `participants/{userId}`
  - `email`, `displayName`, `createdAt`, `lastActiveAt`, `isAnonymous`
- `participants/{userId}/sessions/{sessionId}`
  - `startedAt`, `completedAt`, `status`, `totalInteractions`, `weakFitCount`, `categoriesMappedCount`, `categoriesMapped`
- `participants/{userId}/sessions/{sessionId}/interactions/{interactionId}`
  - `sequenceIndex`, `question`, `answer`, `inputMethod`, `mappedCategory`, `isWeakFit`, `isAlreadyMapped`, `justification`, `timestamp`
- `participants/{userId}/skillPassport/{categoryId}`
  - `category`, `firstMappedAt`, `lastMappedAt`, `totalMappings`, `mappings[]`
- `participants/{userId}/identifiedSkills/{skillId}`
  - `skill`, `category`, `source`, `confidence`, `dateIdentified`, `sessionId`

### 5.1 Current Implementation Write Flow

The app currently writes Firestore data through `src/services/firebase/firestoreService.ts` using a write-through model alongside AsyncStorage.

Implementation characteristics:

- Writes are fire-and-forget (errors are logged and not thrown to the UI layer).
- AsyncStorage remains the UI source of truth if Firestore writes fail.
- Session existence is checked and created on demand by `ensureSessionDocument(...)`.

Current save/update operations:

- `getOrCreateUserId()`
  - Auth: `signInAnonymously(auth)` if no cached/stored user id exists.
  - Writes: `participants/{userId}` via `setDoc(..., { merge: true })` with `createdAt`, `lastActiveAt`, and `isAnonymous`.

- `createSession(userId)`
  - Writes: `participants/{userId}/sessions/{sessionId}` via `setDoc(...)`.
  - Payload: initial session state (`status`, counters, arrays, `startedAt`).

- `saveInteraction(userId, sessionId, interaction)`
  - Writes interaction doc: `participants/{userId}/sessions/{sessionId}/interactions/{interactionId}` via `setDoc(...)`.
  - Updates session doc: increments `totalInteractions`, sets `lastActiveAt`, and conditionally increments `weakFitCount` using `increment(...)`.

- `savePassportMapping(userId, sessionId, interactionId, category, justification)`
  - Writes/merges passport doc: `participants/{userId}/skillPassport/{categoryId}` via `setDoc(..., { merge: true })`.
  - Uses transforms: `totalMappings: increment(1)` and `mappings: arrayUnion(...)`.
  - Updates session doc: increments `categoriesMappedCount` and appends `categoriesMapped` via `arrayUnion(category)`.

- `saveIdentifiedSkillToFirestore(userId, skill, category, source, confidence, sessionId)`
  - Writes: `participants/{userId}/identifiedSkills/{skillId}` via `setDoc(...)`.
  - Payload includes `confidence` (nullable), `source`, and `dateIdentified`.

- `saveIdentifiedSkillsToFirestore(...)`
  - Batch behavior: loops skills and writes each one through `saveIdentifiedSkillToFirestore(...)` using `Promise.all(...)`.

- `closeSession(userId, sessionId, status)`
  - Merges status update into `participants/{userId}/sessions/{sessionId}` with `completedAt: serverTimestamp()`.

### 5.2 Detailed Firestore Write Schema

Notes:

- Timestamps are written with `serverTimestamp()`.
- Counters and arrays are updated with Firestore transforms such as `increment(...)` and `arrayUnion(...)`.

#### Participant Document

Path:

- `participants/{userId}`

Written by:

- `getOrCreateUserId()` with `setDoc(..., { merge: true })`

Schema:

```ts
{
  email: string | null;
  displayName: string | null;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  isAnonymous: boolean;
}
```

Example:

```json
{
  "email": null,
  "displayName": null,
  "createdAt": "<serverTimestamp>",
  "lastActiveAt": "<serverTimestamp>",
  "isAnonymous": true
}
```

#### Session Document

Path:

- `participants/{userId}/sessions/{sessionId}`

Written by:

- `createSession()`
- `closeSession()`
- `saveInteraction()`
- `savePassportMapping()`

Schema:

```ts
{
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  status: "in_progress" | "completed" | "abandoned";
  totalInteractions: number;
  weakFitCount: number;
  categoriesMappedCount: number;
  categoriesMapped: string[];
  lastActiveAt?: Timestamp;
}
```

Initial example:

```json
{
  "startedAt": "<serverTimestamp>",
  "completedAt": null,
  "status": "in_progress",
  "totalInteractions": 0,
  "weakFitCount": 0,
  "categoriesMappedCount": 0,
  "categoriesMapped": []
}
```

Update examples:

```json
{
  "status": "completed",
  "completedAt": "<serverTimestamp>"
}
```

```json
{
  "totalInteractions": "increment(1)",
  "lastActiveAt": "<serverTimestamp>",
  "weakFitCount": "increment(1)"
}
```

```json
{
  "categoriesMappedCount": "increment(1)",
  "categoriesMapped": "arrayUnion(category)"
}
```

#### Interaction Document

Path:

- `participants/{userId}/sessions/{sessionId}/interactions/{interactionId}`

Written by:

- `saveInteraction()`

Schema:

```ts
{
  sequenceIndex: number;
  question: string;
  answer: string;
  inputMethod: "text" | "voice" | "image";
  mappedCategory: string | null;
  isWeakFit: boolean;
  isAlreadyMapped: boolean;
  justification: string;
  timestamp: Timestamp;
}
```

Example:

```json
{
  "sequenceIndex": 3,
  "question": "Tell me about a time you led a project.",
  "answer": "I led a 5-person team to build an app...",
  "inputMethod": "voice",
  "mappedCategory": "Leadership",
  "isWeakFit": false,
  "isAlreadyMapped": false,
  "justification": "Demonstrates leadership and coordination.",
  "timestamp": "<serverTimestamp>"
}
```

#### Skill Passport Document

Path:

- `participants/{userId}/skillPassport/{categoryId}`

Where `categoryId` is generated as:

- `category.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()`

Written by:

- `savePassportMapping()` with `setDoc(..., { merge: true })`

Schema:

```ts
{
  category: string;
  firstMappedAt: Timestamp;
  lastMappedAt: Timestamp;
  totalMappings: number;
  mappings: Array<{
    sessionId: string;
    interactionId: string;
    justification: string;
    timestamp: Timestamp;
  }>;
}
```

Example write payload:

```json
{
  "category": "Leadership",
  "firstMappedAt": "<serverTimestamp>",
  "lastMappedAt": "<serverTimestamp>",
  "totalMappings": "increment(1)",
  "mappings": "arrayUnion({ sessionId, interactionId, justification, timestamp: <serverTimestamp> })"
}
```

#### Identified Skill Document

Path:

- `participants/{userId}/identifiedSkills/{skillId}`

Where `skillId` is generated as:

- `${normalizedSkill}-${generateId()}`
- `normalizedSkill = skill.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()`

Written by:

- `saveIdentifiedSkillToFirestore()`
- `saveIdentifiedSkillsToFirestore()` delegates to the single-skill writer

Schema:

```ts
{
  skill: string;
  category: string;
  source: "text" | "voice" | "image";
  confidence: number | null;
  dateIdentified: Timestamp;
  sessionId: string | null;
}
```

Example:

```json
{
  "skill": "Conflict Resolution",
  "category": "Interpersonal",
  "source": "text",
  "confidence": 0.92,
  "dateIdentified": "<serverTimestamp>",
  "sessionId": "1700000000000-abc1234"
}
```

#### Firestore Rules Planning Hints

- Restrict all `participants/{userId}/**` access to authenticated user `request.auth.uid == userId`.
- Validate enum values for `status`, `inputMethod`, and `source`.
- Validate numeric ranges for `confidence` (for example, `0 <= confidence <= 1` when not null).
- Validate array element types in `categoriesMapped` and `mappings`.

## 6. Security and Compliance Controls

### 6.1 Access Model

- Require authenticated access for all Storage operations.
- Enforce strict user ownership in rules: only `request.auth.uid == uid` may read/write own assets.
- Block all public reads by default.

### 6.2 Recommended Firebase Storage Rules (Baseline)

```txt
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /participants/{uid}/sessions/{sessionId}/{folder}/{fileName} {
      allow read, write: if request.auth != null
                         && request.auth.uid == uid
                         && folder.matches('images|audio|derived');
    }

    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

Additional constraints to add during implementation:

- Content type allow-list (for example, `image/jpeg`, `audio/mp4`).
- Max upload size limits.
- Optional file name validation pattern.

### 6.3 Data Governance

- Define retention by media type (for example, 7 days for raw uploads and 30 days for derived artifacts).
- Implement scheduled deletion workflow for expired objects.
- Gate any long-term storage behind explicit user consent.
- Log access and deletion operations for audit readiness.

## 7. Performance and Scalability

- Use compressed media before upload (already partially in place for images).
- Prefer resumable uploads for large files or poor connectivity.
- Store metadata in Firestore for fast querying, not by listing storage folders.
- Use lifecycle automation for cleanup to avoid storage growth.

---

**Recommendation:** Proceed with a controlled Firebase Storage rollout with strict security rules and privacy controls before scaling media persistence.