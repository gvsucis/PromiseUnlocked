/**
 * Session Manager
 * Tracks the active Firestore session ID in memory and AsyncStorage.
 * A session starts on the first interaction of a dialogue run and ends
 * when the user completes all 8 categories or resets.
 */

import { getJSONFromStorage, setJSONInStorage, removeFromStorage } from "../util/asyncStorage";
import { createSession, closeSession, getOrCreateUserId } from "./firebase/firestoreService";

const SESSION_ID_KEY = "@active_session_id";

let _activeSessionId: string | null = null;
let _userId: string | null = null;

export async function getUserId(): Promise<string> {
  if (_userId) return _userId;
  _userId = await getOrCreateUserId();
  return _userId;
}

export async function getActiveSessionId(): Promise<string | null> {
  if (_activeSessionId) return _activeSessionId;
  const stored = await getJSONFromStorage<string | null>(SESSION_ID_KEY, null);
  _activeSessionId = stored;
  return stored;
}

export async function startNewSession(): Promise<string> {
  const userId = await getUserId();
  const sessionId = await createSession(userId);
  _activeSessionId = sessionId;
  await setJSONInStorage(SESSION_ID_KEY, sessionId);
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
  await removeFromStorage(SESSION_ID_KEY);
}

export async function clearSessionState(): Promise<void> {
  _activeSessionId = null;
  await removeFromStorage(SESSION_ID_KEY);
}
