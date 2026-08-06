/**
 * Session Manager
 * Tracks the active Firestore session ID in memory and AsyncStorage.
 * A session starts on the first interaction of a dialogue run and ends
 * when the user completes all  categories or resets.
 */

import { getJSONFromStorage, setJSONInStorage, removeFromStorage } from "../utils/asyncStorage";
import { getScopedStorageKey, waitForAuthReady } from "./auth/authSessionService";
import {
  createSession,
  closeSession,
  getOrCreateUserId,
  getInProgressSession,
} from "./firebase/firestoreService";

const SESSION_ID_KEY = "@active_session_id";

let _activeSessionId: string | null = null;
let _activeSessionScope: string | null = null;
let _userId: string | null = null;
let _userScope: string | null = null;

async function getCurrentScope(): Promise<string> {
  const session = await waitForAuthReady();
  return session.uid ?? "signed_out";
}

export async function getUserId(): Promise<string> {
  const scope = await getCurrentScope();
  if (_userId && _userScope === scope) return _userId;
  _userId = await getOrCreateUserId();
  _userScope = scope;
  return _userId;
}

async function cacheActiveSession(sessionId: string, scope: string): Promise<void> {
  _activeSessionId = sessionId;
  _activeSessionScope = scope;
  const sessionStorageKey = await getScopedStorageKey(SESSION_ID_KEY);
  await setJSONInStorage(sessionStorageKey, sessionId);
}

/**
 * Resolve the user's active session ID.
 *
 * Firestore is the source of truth: a user has at most one in_progress session,
 * shared across every device, so we resolve it from Firestore before trusting
 * the local cache. When Firestore is reachable and reports no in_progress
 * session, the stale local pointer is cleared. Only when Firestore is
 * unreachable (offline / guest) do we fall back to the locally persisted ID.
 */
export async function getActiveSessionId(): Promise<string | null> {
  const scope = await getCurrentScope();
  if (_activeSessionId && _activeSessionScope === scope) return _activeSessionId;

  try {
    const userId = await getUserId();
    const remote = await getInProgressSession(userId);
    if (remote) {
      await cacheActiveSession(remote, scope);
      return remote;
    }
    // Firestore confirms no in_progress session — drop any stale local pointer.
    const sessionStorageKey = await getScopedStorageKey(SESSION_ID_KEY);
    await removeFromStorage(sessionStorageKey);
    _activeSessionId = null;
    _activeSessionScope = scope;
    return null;
  } catch {
    // Firestore unavailable — fall back to the locally persisted session ID.
    const sessionStorageKey = await getScopedStorageKey(SESSION_ID_KEY);
    const stored = await getJSONFromStorage<string | null>(sessionStorageKey, null);
    _activeSessionId = stored;
    _activeSessionScope = scope;
    return stored;
  }
}

export async function startNewSession(): Promise<string> {
  const userId = await getUserId();
  const sessionId = await createSession(userId);
  await cacheActiveSession(sessionId, await getCurrentScope());
  return sessionId;
}

export async function getOrStartSession(): Promise<string> {
  const existing = await getActiveSessionId();
  if (existing) return existing;
  return startNewSession();
}

export async function endSession(status: "completed" | "abandoned"): Promise<void> {
  const sessionId = await getActiveSessionId();
  if (!sessionId) return;

  const userId = await getUserId();
  await closeSession(userId, sessionId, status);

  _activeSessionId = null;
  _activeSessionScope = null;
  const sessionStorageKey = await getScopedStorageKey(SESSION_ID_KEY);
  await removeFromStorage(sessionStorageKey);
}

export async function clearSessionState(): Promise<void> {
  _activeSessionId = null;
  _activeSessionScope = null;
  const sessionStorageKey = await getScopedStorageKey(SESSION_ID_KEY);
  await removeFromStorage(sessionStorageKey);
}
