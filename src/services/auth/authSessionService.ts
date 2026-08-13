import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { getJSONFromStorage, setJSONInStorage } from "../../utils/asyncStorage";
import { getInProgressSession } from "../firebase/firestoreService";
import type { AppAuthSession } from "../../types/auth";
import type { UserDocument } from "../../types/firestore";
import { fetchMyStamps, deriveMappedCategories } from "../stampSyncService";
import { setScopedStorageUid } from "../storageScopeService";
import { combineFullName } from "../../utils/format";

const AUTH_SESSION_STORAGE_KEY = "@app_auth_session";

const DEFAULT_SESSION: AppAuthSession = {
  uid: null,
  mode: "loading",
  email: null,
  displayName: null,
};

let currentSession: AppAuthSession = DEFAULT_SESSION;
let bootstrapPromise: Promise<AppAuthSession> | null = null;
let authListenerInitialized = false;
let lastHydratedUid: string | null = null;

const subscribers = new Set<(session: AppAuthSession) => void>();

async function setSignedOutSession(): Promise<AppAuthSession> {
  const signedOutSession = buildSession(null);
  emitSession(signedOutSession);
  await persistSession(signedOutSession);
  return signedOutSession;
}

async function handleAuthenticatedUser(user: User): Promise<AppAuthSession> {
  const nextSession = buildSession(user);

  // Warm the local passport cache from Firestore before emitting the session.
  if (user.uid !== lastHydratedUid) {
    lastHydratedUid = user.uid;
    setScopedStorageUid(user.uid);
    await hydratePassportMappings(user.uid);
  }

  // Back local-only stamps up so authenticated data survives device wipes.
  void backfillLocalStampsToFirestore(user.uid).catch(() => {});

  emitSession(nextSession);
  await persistSession(nextSession);

  // Don't block on remote sync work.
  void syncUserDocument(user).catch((error) => {
    console.warn("[AuthSession] Failed to sync user document:", error);
  });

  // One-time migration: old user-level passport → session-scoped
  void (async () => {
    try {
      const uid = user.uid;
      const oldSnapshot = await getDocs(collection(db, "participants", uid, "skillPassport"));
      if (oldSnapshot.empty) return;

      const migrationSessionRef = doc(collection(db, "participants", uid, "sessions"));
      const now = serverTimestamp();

      await setDoc(migrationSessionRef, {
        userId: uid,
        topic: "migration",
        status: "completed",
        startedAt: now,
        completedAt: now,
        totalInteractions: 0,
        categoriesMappedCount: oldSnapshot.size,
        categoriesMapped: oldSnapshot.docs
          .map((d) => d.data().category as string | undefined)
          .filter(Boolean),
      });

      let count = 0;
      for (const oldDoc of oldSnapshot.docs) {
        const data = oldDoc.data();
        if (!data.category) continue;
        const newRef = doc(
          db,
          "participants",
          uid,
          "sessions",
          migrationSessionRef.id,
          "skillPassport",
          oldDoc.id
        );
        await setDoc(newRef, data);
        await deleteDoc(oldDoc.ref);
        count++;
      }

      // Re-hydrate so local cache picks up session-scoped data
      await hydratePassportMappings(uid);
      if (__DEV__)
        console.log(
          `[AuthSession] Migrated ${count} passport entries to session ${migrationSessionRef.id}`
        );
    } catch (err) {
      console.warn("[AuthSession] Passport migration skipped:", err);
    }
  })();

  return nextSession;
}

export async function hydratePassportMappings(uid: string): Promise<void> {
  try {
    const mappedCategoriesKey = `@mappedCategories:${uid}`;
    const existing = await getJSONFromStorage<Record<string, unknown>[]>(mappedCategoriesKey, []);
    const stamps = await fetchMyStamps();
    const mapped = deriveMappedCategories(stamps);
    for (const entry of mapped) {
      const prev = existing.find(
        (e) => (e as Record<string, unknown>).categoryId === entry.categoryId
      ) as Record<string, unknown> | undefined;
      if (prev?.justification) {
        entry.justification = prev.justification as string;
      }
    }
    await setJSONInStorage(mappedCategoriesKey, mapped);
    if (__DEV__)
      console.log(`[AuthSession] Hydrated ${mapped.length} passport mappings from all sessions`);
  } catch (error) {
    console.warn("[AuthSession] Failed to hydrate passport mappings:", error);
  }
}

/**
 * Push all local AsyncStorage stamps to Firestore passport docs.
 * Idempotent — runs on each authenticated login.
 */
async function backfillLocalStampsToFirestore(uid: string): Promise<void> {
  try {
    const mappedCategoriesKey = `@mappedCategories:${uid}`;
    const entries = await getJSONFromStorage<Record<string, unknown>[]>(mappedCategoriesKey, []);
    if (entries.length === 0) return;

    // Only back into an existing in_progress session; never mint a new one.
    const sessionId = await getInProgressSession(uid);
    if (!sessionId) {
      if (__DEV__) console.log("[AuthSession] Skipping backfill — no in_progress session");
      return;
    }

    let count = 0;
    for (const entry of entries) {
      const categoryId = entry.categoryId as string | undefined;
      const stamps = entry.unlockedStamps as
        | Array<{ name: string; timesUnlocked: number; tier?: number }>
        | undefined;
      if (!categoryId || !stamps?.length) continue;

      const unlockedStamps = stamps.reduce<Record<string, { timesUnlocked: number; tier: number }>>(
        (acc, s) => ({ ...acc, [s.name]: { timesUnlocked: s.timesUnlocked, tier: s.tier ?? 1 } }),
        {}
      );

      await setDoc(
        doc(db, "participants", uid, "sessions", sessionId, "skillPassport", categoryId),
        { unlockedStamps },
        { merge: true }
      );
      count++;
    }

    if (__DEV__) console.log(`[AuthSession] Backfilled ${count} categories to Firestore`);
  } catch {
    // Best-effort; hydrated AsyncStorage is the source of truth
  }
}

function buildSession(user: User | null): AppAuthSession {
  if (!user) {
    return {
      uid: null,
      mode: "signed_out",
      email: null,
      displayName: null,
    };
  }

  return {
    uid: user.uid,
    mode: "authenticated",
    email: user.email ?? null,
    displayName: user.displayName ?? user.email?.split("@")[0] ?? null,
  };
}

function syncScopedStorageUid(session: AppAuthSession): void {
  setScopedStorageUid(session.uid);
}

async function persistSession(session: AppAuthSession): Promise<void> {
  try {
    await setJSONInStorage(AUTH_SESSION_STORAGE_KEY, session);
  } catch (error) {
    console.warn("[AuthSession] Failed to persist auth session:", error);
  }
}

function emitSession(session: AppAuthSession): void {
  currentSession = session;
  syncScopedStorageUid(session);
  if (session.mode !== "loading") {
    bootstrapPromise = null;
  }
  for (const subscriber of subscribers) {
    subscriber(session);
  }
}

async function syncUserDocument(user: User): Promise<void> {
  const userRef = doc(db, "participants", user.uid);
  const userDoc: Partial<UserDocument> = {
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    lastActiveAt: serverTimestamp(),
  };

  try {
    await setDoc(userRef, userDoc, { merge: true });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (code === "permission-denied" || code === "firestore/permission-denied") {
      console.warn("[AuthSession] Skipping user doc sync due to Firestore permissions.");
      return;
    }

    throw error;
  }
}

async function handleAuthState(user: User | null): Promise<AppAuthSession> {
  if (!user) {
    return setSignedOutSession();
  }

  return handleAuthenticatedUser(user);
}

function initializeAuthListener(): void {
  if (authListenerInitialized) {
    return;
  }

  authListenerInitialized = true;
  onAuthStateChanged(auth, (user) => {
    void handleAuthState(user).catch((error) => {
      console.error("[AuthSession] Failed to process auth state:", error);
      const fallback = buildSession(user);
      emitSession(fallback);
      void persistSession(fallback);
    });
  });
}

export async function bootstrapAuthSession(): Promise<AppAuthSession> {
  initializeAuthListener();

  if (currentSession.mode !== "loading") {
    return currentSession;
  }

  if (bootstrapPromise !== null) {
    return bootstrapPromise;
  }

  bootstrapPromise = new Promise<AppAuthSession>((resolve) => {
    const unsubscribe = subscribeToAuthSession((session) => {
      if (session.mode !== "loading") {
        unsubscribe();
        resolve(session);
      }
    });

    setTimeout(() => {
      if (currentSession.mode !== "loading") {
        unsubscribe();
        return;
      }
      unsubscribe();
      console.warn("[AuthSession] Auth bootstrap timed out — falling back to signed-out");
      const fallback: AppAuthSession = {
        uid: null,
        mode: "signed_out",
        email: null,
        displayName: null,
      };
      emitSession(fallback);
      resolve(fallback);
    }, 8000);
  });

  return bootstrapPromise;
}

export function subscribeToAuthSession(listener: (session: AppAuthSession) => void): () => void {
  subscribers.add(listener);
  listener(currentSession);
  return () => {
    subscribers.delete(listener);
  };
}

export function getCurrentAuthSession(): AppAuthSession {
  return currentSession;
}

export async function waitForAuthReady(): Promise<AppAuthSession> {
  if (currentSession.mode !== "loading") {
    return currentSession;
  }

  return bootstrapAuthSession();
}

/**
 * Resolve once the session reports `authenticated`. Callers (sign-in screens)
 * use this to hold navigation until the auth listener has emitted, so the next
 * screen never mounts while the session still looks like a signed-out user.
 */
export async function waitForAuthenticated(): Promise<AppAuthSession> {
  if (currentSession.mode === "authenticated") {
    return currentSession;
  }

  return new Promise<AppAuthSession>((resolve) => {
    const unsubscribe = subscribeToAuthSession((session) => {
      if (session.mode === "authenticated") {
        unsubscribe();
        resolve(session);
      }
    });
  });
}

export async function getScopedStorageKey(baseKey: string): Promise<string> {
  await waitForAuthReady();
  return (await import("../storageScopeService")).getScopedStorageKey(baseKey);
}

export async function signInWithEmail(email: string, password: string) {
  await waitForAuthReady();
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUpWithEmail(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string
) {
  await waitForAuthReady();

  const normalizedEmail = email.trim();

  const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

  const fullName = combineFullName(firstName ?? "", lastName ?? "");
  if (fullName) {
    await updateProfile(userCredential.user, { displayName: fullName });
  }

  // Persist split first/last at signup; merge stops later syncs clobbering them.
  if (firstName?.trim() || lastName?.trim()) {
    const userRef = doc(db, "participants", userCredential.user.uid);
    await setDoc(
      userRef,
      {
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        fullName: fullName || null,
        displayName: fullName || null,
      },
      { merge: true }
    );
  }

  void syncUserDocument(userCredential.user).catch(() => {});

  return userCredential;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}
