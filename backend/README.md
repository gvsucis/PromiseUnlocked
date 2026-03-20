# Backend README

## Overview

This backend provides API endpoints and Firestore integration for the PromiseUnlocked mobile app. It manages user sessions, interactions, authentication, and category mapping, and is designed to run both in production (Firebase) and locally using the Firebase Emulator Suite.

---

## Key Features

-   **Firestore Integration:** Handles sessions, interactions, users, and category mappings.
-   **Authentication:** Uses Firebase Auth for secure endpoints.
-   **Session & Interaction Management:** Tracks user sessions and logs all interactions.
-   **Mirrored Writes:** AsyncStorage is the primary store on the client; Firestore receives mirrored writes.
-   **Emulator Support:** Can run locally with the Firebase Emulator Suite for development/testing.
-   **Logging:** Errors are logged to the console for debugging.

---

## Directory Structure

-   `src/api/` — Express API endpoints (e.g., `interactions.ts`, `auth.ts`)
-   `src/services/` — Firestore, session, and storage logic
-   `src/types/` — TypeScript types for Firestore records and requests
-   `logs/` — (Optional) Directory for backend logs

---

## Firestore Collections

-   `users` — User profiles
-   `sessions` — Session records (userId, topic, status, startedAt, endedAt, metadata)
-   `interactions` — Interaction records (sessionId, userId, type, payload, createdAt)

### Indexes

-   Composite index on `interactions`: `sessionId` (asc), `createdAt` (asc)
-   See `firestore.indexes.json` in the project root

---

## Running Locally with Emulator

1.  Install Firebase CLI: `npm install -g firebase-tools`
2.  Start emulators:
    
    ```sh
    firebase emulators:start --only firestore,auth --project demo-backend
    ```
    
3.  Access Emulator UI: [http://127.0.0.1:4001/](http://127.0.0.1:4001/)

### Notes

-   Emulator data is separate from production. Import or seed data as needed.
-   Without `firebase.json` and Firestore rules, all reads/writes are allowed by default.

---

## Deployment

-   Deploy indexes: `firebase deploy --only firestore:indexes`
-   Deploy functions/endpoints as needed (see Firebase documentation)

---

## Error Logging

-   Errors are logged to the console with timestamps (see `src/util/logToFile.ts`).

---

## Additional Resources

-   [Firebase Emulator Suite Docs](https://firebase.google.com/docs/emulator-suite)
-   [Firestore Indexes](https://firebase.google.com/docs/firestore/query-data/indexing)
-   [Project README](../README.md)

---

## Contact

For questions or issues, contact the project maintainer.