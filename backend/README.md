
# Promise Unlocked Backend

This is the backend for the Promise Unlocked project, built with Node.js, TypeScript, Express, and Firebase Cloud Functions.

## Project Structure

```
backend/
    src/                # All TypeScript source files
        index.ts          # Firebase Functions entry point
        app.ts            # Express app (imported by index.ts)
        ...other files
    package.json        # Backend dependencies and scripts
    tsconfig.json       # TypeScript configuration
    firebase.json       # Firebase configuration
    .firebaserc         # Firebase project alias config
```

## Setup

1. **Install dependencies:**
     ```sh
     cd backend
     npm install
     ```

2. **Configure Firebase:**
     - Make sure you are logged in: `firebase login`
     - Link to your Firebase project:
         ```sh
         firebase use --add
         # Select: promise-unlocked-sign-up-888a0
         ```

3. **Development:**
     - Start the emulator:
         ```sh
         npm run serve
         ```
     - Run locally with hot reload:
         ```sh
         npm run dev
         ```

4. **Build:**
     ```sh
     npm run build
     ```

5. **Deploy to Firebase Functions:**
     ```sh
     npm run deploy
     # or
     firebase deploy --only functions
     ```

## Environment Variables
- Store secrets in `.env` or use Firebase environment config for production.

## Notes
- All backend code should be in `src/`.
- The Firebase Functions entry point is `src/index.ts`.
- Make sure your `.firebaserc` points to the correct project ID: `promise-unlocked-sign-up-888a0`.

---

For more, see the Firebase documentation: https://firebase.google.com/docs/functions

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