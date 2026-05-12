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
import { doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { removeManyFromStorage, setJSONInStorage } from "../../utils/asyncStorage";
import type { AppAuthSession } from "../../types/auth";
import type { UserDocument } from "../../types/firestore";

const AUTH_SESSION_STORAGE_KEY = "@app_auth_session";
const SCOPED_STORAGE_KEYS = [
  "@active_session_id",
  "@mappedCategories",
  "@userInteractions",
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

  await setDoc(userRef, userDoc, { merge: true });
}

async function handleAuthState(user: User | null): Promise<AppAuthSession> {
  const previousSession = currentSession;

  if (!user) {
    if (!resolvingAnonymousUser) {
      resolvingAnonymousUser = true;
      try {
        await signInAnonymously(auth);
        return currentSession;
      } finally {
        resolvingAnonymousUser = false;
      }
    }

    if (currentSession.mode === "loading") {
      return currentSession;
    }

    const signedOutSession = buildSession(null);
    emitSession(signedOutSession);
    await persistSession(signedOutSession);
    return signedOutSession;
  }

  const nextSession = buildSession(user);
  const shouldClearPreviousLocalData =
    previousSession.mode !== "loading" &&
    previousSession.uid !== null &&
    previousSession.uid !== nextSession.uid;

  if (shouldClearPreviousLocalData) {
    try {
      const previousUid = previousSession.uid;
      if (previousUid) {
        await clearLocalDataForUid(previousUid);
      }
    } catch (error) {
      console.warn("[AuthSession] Failed to clear previous local user data:", error);
    }
  }

  await syncUserDocument(user);
  emitSession(nextSession);
  await persistSession(nextSession);
  return nextSession;
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
  await waitForAuthReady();

  if (auth.currentUser?.isAnonymous) {
    return;
  }

  emitSession(DEFAULT_SESSION);
  await signOut(auth);
  await bootstrapAuthSession();
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

      // If the email is already in use, attempt to sign into that account.
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
  emitSession(DEFAULT_SESSION);
  await signOut(auth);
  await bootstrapAuthSession();
}
