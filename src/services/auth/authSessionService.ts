import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  QueryDocumentSnapshot,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { getJSONFromStorage, setJSONInStorage } from "../../utils/asyncStorage";
import { DEFAULT_TIER } from "../../config/stampConstants";
import { getInProgressSession } from "../firebase/firestoreService";
import type { AppAuthSession, PassportEntry } from "../../types/auth";
import type { UserDocument } from "../../types/firestore";

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

const subscribers = new Set<(session: AppAuthSession) => void>();

async function setSignedOutSession(): Promise<AppAuthSession> {
  const signedOutSession = buildSession(null);
  emitSession(signedOutSession);
  await persistSession(signedOutSession);
  return signedOutSession;
}

async function handleAuthenticatedUser(user: User): Promise<AppAuthSession> {
  const nextSession = buildSession(user);

  // Restore passport mappings from Firestore to AsyncStorage before emitting
  // the session, so screens (Passport, DialogueDashboard) see the data on mount.
  await hydratePassportMappings(user.uid);

  // Push any local-only stamps to Firestore so authenticated data survives
  // device wipes.
  void backfillLocalStampsToFirestore(user.uid).catch(() => {});

  emitSession(nextSession);
  await persistSession(nextSession);

  // Keep auth transitions snappy by not blocking on remote sync work.
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

type StampEntry = {
  name: string;
  category: string;
  categoryId: string;
  timesUnlocked: number;
  tier?: number;
};

function mergeStamps(
  local: StampEntry[] | undefined,
  remote:
    | Record<
        string,
        { timesUnlocked?: number; tier?: number; category?: string; categoryId?: string }
      >
    | undefined,
  parentCategory: string,
  parentCategoryId: string
): StampEntry[] | undefined {
  const localByName = new Map((local ?? []).map((s) => [s.name, s]));
  const remoteEntries = Object.entries(remote ?? {}).map(([name, e]) => ({
    name,
    timesUnlocked: e.timesUnlocked ?? 1,
    tier: e.tier,
    category: e.category ?? parentCategory,
    categoryId: e.categoryId ?? parentCategoryId,
  }));
  const remoteByName = new Map(remoteEntries.map((s) => [s.name, s]));

  const merged = [...new Set([...localByName.keys(), ...remoteByName.keys()])].map((name) => {
    const l = localByName.get(name);
    const r = remoteByName.get(name);
    return {
      name,
      category: l?.category || r?.category || parentCategory,
      categoryId: l?.categoryId || r?.categoryId || parentCategoryId,
      timesUnlocked: Math.max(l?.timesUnlocked ?? 0, r?.timesUnlocked ?? 1),
      tier: Math.max(l?.tier ?? DEFAULT_TIER, r?.tier ?? DEFAULT_TIER),
    };
  });

  return merged.length > 0 ? merged : undefined;
}

export async function hydratePassportMappings(uid: string): Promise<void> {
  try {
    const mappedCategoriesKey = `@mappedCategories:${uid}`;
    const existing = await getJSONFromStorage<unknown[]>(mappedCategoriesKey, []);

    const snapshot = await fetchPassportSnapshot(uid, existing.length);
    if (snapshot === null) return;

    // Session exists but Firestore passport is empty — clear stale local data
    if (snapshot === "empty") {
      if (existing.length > 0) {
        await setJSONInStorage(mappedCategoriesKey, []);
      }
      return;
    }

    const existingMap = new Map(
      (existing as Array<Record<string, unknown>>).map((e) => [e.category, e])
    );

    const filtered = snapshot.docs
      .map((d) => mergePassportDoc(d, existingMap))
      .filter(Boolean) as Record<string, unknown>[];

    await setJSONInStorage(mappedCategoriesKey, filtered);
    if (__DEV__)
      console.log(`[AuthSession] Hydrated ${filtered.length} passport mappings from Firestore`);
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

    // Only back local stamps into an existing in_progress session. Never mint a
    // new session here — that would resurrect a completed passport the user has
    // already moved on from.
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

function resolveCategory(
  doc: { id: string; ref: Parameters<typeof setDoc>[0] },
  rawCategory: string | undefined
): string | null {
  if (rawCategory) return rawCategory;
  const recovered = doc.id
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  if (!recovered) return null;
  void setDoc(doc.ref, { category: recovered }, { merge: true }).catch(() => {});
  return recovered;
}

function mergePassportDoc(
  d: QueryDocumentSnapshot,
  existingMap: Map<unknown, Record<string, unknown>>
): PassportEntry | null {
  const data = d.data();
  const category = resolveCategory(d, data.category as string | undefined);
  if (!category) return null;

  const categoryId = (data.categoryId as string) ?? d.id;
  const existingEntry = existingMap.get(category);
  const firestoreMappings = data.mappings as Array<{ justification?: string }> | undefined;

  return {
    category,
    categoryId,
    justification:
      (typeof existingEntry?.justification === "string" ? existingEntry.justification : null) ??
      firestoreMappings?.at(-1)?.justification ??
      "",
    dateIdentified:
      typeof existingEntry?.dateIdentified === "string"
        ? existingEntry.dateIdentified
        : (data.firstMappedAt?.toDate?.() ?? new Date()).toISOString(),
    timesMapped: Math.max(
      Number(existingEntry?.timesMapped ?? 0),
      (data.totalMappings as number | undefined) ?? 1
    ),
    unlockedStamps: mergeStamps(
      existingEntry?.unlockedStamps as StampEntry[] | undefined,
      data.unlockedStamps as
        | Record<
            string,
            { timesUnlocked?: number; tier?: number; category?: string; categoryId?: string }
          >
        | undefined,
      category,
      categoryId
    ),
  };
}

function logHydrate(message: string): void {
  if (__DEV__) console.log(message);
}

/** Read the passport docs for a known session. "empty" means clear local. */
async function readPassportDocs(uid: string, sessionId: string, existingCount: number) {
  const passportRef = collection(db, "participants", uid, "sessions", sessionId, "skillPassport");
  const snapshot = await getDocs(passportRef);
  if (!snapshot.empty) return snapshot;
  logHydrate(
    existingCount > 0
      ? `[AuthSession] Firestore passport empty, clearing ${existingCount} stale local mappings`
      : "[AuthSession] No passport mappings found in Firestore or local"
  );
  return "empty" as const;
}

async function fetchPassportSnapshot(uid: string, existingCount: number) {
  // Resolve the shared in_progress session straight from Firestore so every
  // device hydrates from the same passport. A read failure (offline / guest)
  // returns null so we keep local data; a confirmed "no session" clears it.
  let sessionId: string | null;
  try {
    sessionId = await getInProgressSession(uid);
  } catch (fsError) {
    console.warn("[AuthSession] Session lookup failed for hydrate, keeping local data:", fsError);
    return null;
  }

  if (!sessionId) {
    logHydrate(
      existingCount > 0
        ? `[AuthSession] No in_progress session, clearing ${existingCount} stale local mappings`
        : "[AuthSession] No in_progress session and no local mappings"
    );
    return "empty" as const;
  }

  try {
    return await readPassportDocs(uid, sessionId, existingCount);
  } catch (fsError) {
    console.warn("[AuthSession] Firestore read failed for hydrate, keeping local data:", fsError);
    return null;
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
  const session = await waitForAuthReady();
  const scope = session.uid ? session.uid : "signed_out";
  return `${baseKey}:${scope}`;
}

export async function signInWithEmail(email: string, password: string) {
  await waitForAuthReady();
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  await waitForAuthReady();

  const normalizedEmail = email.trim();

  const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

  if (displayName) {
    await updateProfile(userCredential.user, { displayName });
    void syncUserDocument(userCredential.user).catch(() => {});
  }

  return userCredential;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}
