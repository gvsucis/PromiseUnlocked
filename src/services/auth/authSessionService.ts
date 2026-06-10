import {
  EmailAuthProvider,
  User,
  createUserWithEmailAndPassword,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { collection, doc, getDocs, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import {
  getJSONFromStorage,
  removeManyFromStorage,
  setJSONInStorage,
} from "../../utils/asyncStorage";
import type { AppAuthSession } from "../../types/auth";
import type { UserDocument } from "../../types/firestore";

const AUTH_SESSION_STORAGE_KEY = "@app_auth_session";
const SCOPED_STORAGE_KEYS = [
  "@active_session_id",
  "@mappedCategories",
  "@userInteractions",
  "@dialogue_active_state",
] as const;
const GLOBAL_USER_STORAGE_KEYS = [
  "@user_identified_skills",
  "userProgress",
  "@firestore_user_id",
] as const;

const DEFAULT_SESSION: AppAuthSession = {
  uid: null,
  mode: "loading",
  isAnonymous: false,
  email: null,
  displayName: null,
};

let currentSession: AppAuthSession = DEFAULT_SESSION;
let bootstrapPromise: Promise<AppAuthSession> | null = null;
let authListenerInitialized = false;
let resolvingAnonymousUser = false;

const subscribers = new Set<(session: AppAuthSession) => void>();

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code?: unknown }).code);
  }
  return undefined;
}

async function setSignedOutSession(): Promise<AppAuthSession> {
  const signedOutSession = buildSession(null);
  emitSession(signedOutSession);
  await persistSession(signedOutSession);
  return signedOutSession;
}

async function handleAuthenticatedUser(
  user: User,
  previousSession: AppAuthSession
): Promise<AppAuthSession> {
  const nextSession = buildSession(user);
  const shouldClearPreviousLocalData =
    previousSession.mode !== "loading" &&
    previousSession.uid !== null &&
    previousSession.uid !== nextSession.uid;

  // Restore passport mappings from Firestore to AsyncStorage before emitting
  // the session, so screens (Passport, DialogueDashboard) see the data on mount.
  if (!user.isAnonymous) {
    await hydratePassportMappings(user.uid);
  }

  emitSession(nextSession);
  await persistSession(nextSession);

  if (shouldClearPreviousLocalData) {
    const previousUid = previousSession.uid;
    if (previousUid) {
      void clearLocalDataForUid(previousUid).catch((error) => {
        console.warn("[AuthSession] Failed to clear previous local user data:", error);
      });
    }
  }

  // Keep auth transitions snappy by not blocking on remote sync work.
  void syncUserDocument(user).catch((error) => {
    console.warn("[AuthSession] Failed to sync user document:", error);
  });

  return nextSession;
}

async function hydratePassportMappings(uid: string): Promise<void> {
  try {
    const passportRef = collection(db, "participants", uid, "skillPassport");
    const snapshot = await getDocs(passportRef);
    if (snapshot.empty) return;

    const mappedCategoriesKey = `@mappedCategories:${uid}`;
    const existing = await getJSONFromStorage<unknown[]>(mappedCategoriesKey, []);

    if (existing.length >= snapshot.size) return;

    const mappedCategories: {
      category: string;
      justification: string;
      dateIdentified: string;
      timesMapped: number;
      unlockedStamps?: Array<{ name: string; timesUnlocked: number }>;
    }[] = [];
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const category = data.category as string | undefined;
      if (!category) return;

      const unlockedStamps: { name: string; timesUnlocked: number }[] = [];
      const rawStamps = data.unlockedStamps as
        | Record<string, { timesUnlocked?: number }>
        | undefined;
      if (rawStamps) {
        for (const [name, entry] of Object.entries(rawStamps)) {
          unlockedStamps.push({ name, timesUnlocked: entry.timesUnlocked ?? 1 });
        }
      }

      mappedCategories.push({
        category,
        justification: "",
        dateIdentified: (data.firstMappedAt?.toDate?.() ?? new Date()).toISOString(),
        timesMapped: (data.totalMappings as number) ?? 1,
        unlockedStamps: unlockedStamps.length > 0 ? unlockedStamps : undefined,
      });
    });

    await setJSONInStorage(mappedCategoriesKey, mappedCategories);
    console.log(
      `[AuthSession] Hydrated ${mappedCategories.length} passport mappings from Firestore`
    );
  } catch (error) {
    console.warn("[AuthSession] Failed to hydrate passport mappings:", error);
  }
}

async function clearLocalDataForUid(uid: string): Promise<void> {
  const scopedKeys = SCOPED_STORAGE_KEYS.map((key) => `${key}:${uid}`);
  await removeManyFromStorage([...scopedKeys, ...GLOBAL_USER_STORAGE_KEYS]);
}

function buildSession(user: User | null): AppAuthSession {
  if (!user) {
    return {
      uid: null,
      mode: "signed_out",
      isAnonymous: false,
      email: null,
      displayName: null,
    };
  }

  return {
    uid: user.uid,
    mode: user.isAnonymous ? "guest" : "authenticated",
    isAnonymous: user.isAnonymous,
    email: user.email ?? null,
    displayName: user.displayName ?? user.email?.split("@")[0] ?? null,
  };
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
    lastActiveAt: serverTimestamp() as unknown as Timestamp,
    isAnonymous: user.isAnonymous,
  };

  if (user.isAnonymous) {
    userDoc.createdAt = serverTimestamp() as unknown as Timestamp;
  }

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
  const previousSession = currentSession;

  if (!user) {
    if (!resolvingAnonymousUser) {
      resolvingAnonymousUser = true;
      try {
        await signInAnonymously(auth);
        return currentSession;
      } catch (error) {
        const code = getErrorCode(error);
        if (code === "auth/admin-restricted-operation") {
          // Anonymous auth is disabled for this Firebase project.
          return setSignedOutSession();
        }
        throw error;
      } finally {
        resolvingAnonymousUser = false;
      }
    }

    if (currentSession.mode === "loading") {
      return currentSession;
    }

    return setSignedOutSession();
  }

  return handleAuthenticatedUser(user, previousSession);
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

export async function getScopedStorageKey(baseKey: string): Promise<string> {
  const session = await waitForAuthReady();
  const scope = session.uid ? session.uid : "signed_out";
  return `${baseKey}:${scope}`;
}

export async function continueAsGuest(): Promise<void> {
  initializeAuthListener();

  const currentUser = auth.currentUser;

  if (currentUser?.isAnonymous) {
    return;
  }

  if (currentUser) {
    await signOut(auth);
  }

  try {
    await signInAnonymously(auth);
  } catch (error) {
    const code = getErrorCode(error);
    if (code === "auth/admin-restricted-operation") {
      await setSignedOutSession();
      return;
    }
    throw error;
  }
}

export async function signInWithEmail(email: string, password: string) {
  await waitForAuthReady();
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUpWithEmail(email: string, password: string) {
  await waitForAuthReady();

  const normalizedEmail = email.trim();
  const currentUser = auth.currentUser;

  if (currentUser?.isAnonymous) {
    const credential = EmailAuthProvider.credential(normalizedEmail, password);
    try {
      return await linkWithCredential(currentUser, credential);
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : undefined;

      // Email belongs to an existing account — sign in directly instead.
      if (code === "auth/email-already-in-use") {
        return signInWithEmailAndPassword(auth, normalizedEmail, password);
      }

      throw error;
    }
  }

  return createUserWithEmailAndPassword(auth, normalizedEmail, password);
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logoutToGuest(): Promise<void> {
  await continueAsGuest();
}

const GUEST_EXPIRY_KEY = "@guest_session_expiry";
const GUEST_EXPIRY_MS = 60_000;

export async function saveGuestSessionTimestamp(): Promise<void> {
  try {
    await setJSONInStorage(GUEST_EXPIRY_KEY, Date.now());
  } catch {
    // Not critical — silently ignore.
  }
}

export async function clearExpiredGuestDataIfNeeded(): Promise<void> {
  try {
    const session = getCurrentAuthSession();
    if (session.mode !== "guest" || !session.uid) return;

    const lastActive = await getJSONFromStorage<number>(GUEST_EXPIRY_KEY, 0);
    if (Date.now() - lastActive < GUEST_EXPIRY_MS) return;

    await clearLocalDataForUid(session.uid);
  } catch {
    // Not critical — silently ignore.
  }
}
