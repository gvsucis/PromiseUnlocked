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
import {
  QueryDocumentSnapshot,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import {
  getJSONFromStorage,
  removeManyFromStorage,
  setJSONInStorage,
} from "../../utils/asyncStorage";
import { DEFAULT_TIER } from "../../config/stampConstants";
import { getErrorCode } from "../../utils/errorUtils";
import { getActiveSessionId } from "../sessionManager";
import { createSession, getInProgressSession } from "../firebase/firestoreService";
import type { AppAuthSession, PassportEntry } from "../../types/auth";
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

  // Only migrate when upgrading from guest to authenticated.
  // Prevent clearing the authenticated user's AsyncStorage on logout.
  const isUpgradeFromGuestToAuth = previousSession.mode === "guest" && !user.isAnonymous;

  if (shouldClearPreviousLocalData && isUpgradeFromGuestToAuth && previousSession.uid) {
    await migrateOrClearGuestData(previousSession.uid, nextSession.uid!);
  }

  // Restore passport mappings from Firestore to AsyncStorage before emitting
  // the session, so screens (Passport, DialogueDashboard) see the data on mount.
  if (!user.isAnonymous) {
    await hydratePassportMappings(user.uid);
  }

  // Push any local-only stamps to Firestore so authenticated data survives
  // device wipes. Runs after hydration so Firestore-wins data is preserved.
  if (!user.isAnonymous) {
    void backfillLocalStampsToFirestore(user.uid).catch(() => {});
  }

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
      if (!user.isAnonymous) {
        await hydratePassportMappings(uid);
      }
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
    const sessionId = await getActiveSessionId();
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

async function clearLocalDataForUid(uid: string): Promise<void> {
  const scopedKeys = SCOPED_STORAGE_KEYS.map((key) => `${key}:${uid}`);
  await removeManyFromStorage([...scopedKeys, ...GLOBAL_USER_STORAGE_KEYS]);
}

async function migrateOrClearGuestData(oldUid: string, newUid: string): Promise<void> {
  try {
    // 1. Try pre-saved pending migration data (saved before auth switch)
    const PENDING_KEY = "@_pending_migration";
    const pending = await getJSONFromStorage<{
      oldUid: string;
      data: Record<string, unknown>[];
    } | null>(PENDING_KEY, null);
    let entries: Record<string, unknown>[] = [];
    if (pending?.oldUid === oldUid && pending.data.length > 0) {
      entries = pending.data;
      // Clean up the pending key using a write (empty object) instead of separate remove
      await setJSONInStorage(PENDING_KEY, null);
      if (__DEV__)
        console.log(
          `[AuthSession] Pending migration: found ${entries.length} mappings for old UID ${oldUid}`
        );
    }

    // 2. Fallback: check scoped AsyncStorage under the old UID
    if (entries.length === 0) {
      const key = `@mappedCategories:${oldUid}`;
      entries = await getJSONFromStorage<Record<string, unknown>[]>(key, []);
    }

    // 3. Final fallback: try Firestore under the old UID in case AsyncStorage
    //    was already cleared by a prior failed migration attempt.
    if (entries.length === 0) {
      try {
        const oldPassportRef = collection(db, "participants", oldUid, "skillPassport");
        const snapshot = await getDocs(oldPassportRef);
        entries = snapshot.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const firstMapped = data.firstMappedAt as { toDate?: () => Date } | undefined;
          const mappings = data.mappings as Array<{ justification?: string }> | undefined;
          return {
            category: data.category as string,
            timesMapped: (data.totalMappings as number) ?? 1,
            justification: mappings?.at(-1)?.justification ?? "",
            dateIdentified: firstMapped?.toDate?.().toISOString() ?? new Date().toISOString(),
            unlockedStamps: data.unlockedStamps
              ? Object.entries(
                  data.unlockedStamps as Record<string, { timesUnlocked?: number }>
                ).map(([name, s]) => ({ name, timesUnlocked: s.timesUnlocked ?? 1 }))
              : [],
          };
        });
        if (__DEV__)
          console.log(
            `[AuthSession] Firestore fallback: found ${entries.length} mappings under old guest UID`
          );
      } catch (fsError) {
        console.warn("[AuthSession] Firestore fallback read also failed:", fsError);
      }
    }

    if (entries.length > 0) {
      // Create a dedicated migration session under the new UID
      const migrationSessionId = await createSession(newUid).catch(() => {
        return `migrated-${Date.now()}`;
      });

      await Promise.all(
        entries.map(async (entry) => {
          const category = entry.category as string;
          if (!category) return;
          const categoryId = category.replaceAll(/[^a-zA-Z0-9]/g, "_").toLowerCase();
          const unlockedStamps = (
            entry.unlockedStamps as Array<{ name: string; timesUnlocked: number }> | undefined
          )?.reduce<Record<string, { timesUnlocked: number }>>(
            (acc, s) => ({ ...acc, [s.name]: { timesUnlocked: s.timesUnlocked } }),
            {}
          );
          await setDoc(
            doc(
              db,
              "participants",
              newUid,
              "sessions",
              migrationSessionId,
              "skillPassport",
              categoryId
            ),
            {
              category,
              categoryId,
              firstMappedAt: serverTimestamp(),
              lastMappedAt: serverTimestamp(),
              totalMappings: (entry.timesMapped as number) ?? 1,
              unlockedStamps: unlockedStamps ?? {},
              mappings: entry.justification
                ? [
                    {
                      sessionId: migrationSessionId,
                      interactionId: "",
                      justification: entry.justification as string,
                      timestamp: Timestamp.now(),
                    },
                  ]
                : [],
            }
          );
        })
      );
      if (__DEV__)
        console.log(
          `[AuthSession] Migrated ${entries.length} passport mappings from ${oldUid} to ${newUid}`
        );
    }

    // Only clear old local data once writes have all succeeded.
    await clearLocalDataForUid(oldUid);
  } catch (error) {
    console.warn(
      "[AuthSession] Failed to migrate passport data — keeping local data intact:",
      error
    );
  }
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
    lastActiveAt: serverTimestamp(),
    isAnonymous: user.isAnonymous,
  };

  if (user.isAnonymous) {
    userDoc.createdAt = serverTimestamp();
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
        isAnonymous: false,
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
const GUEST_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
