/**
 * Firestore Service
 * Write-through layer alongside AsyncStorage.
 * Writes are executed through a queue. Failures are logged and rethrown so
 * the queue can retry when the app returns to the foreground.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  arrayUnion,
  increment,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { db, auth } from "../../config/firebase";
import { setJSONInStorage } from "../../utils/asyncStorage";
import { waitForAuthReady } from "../auth/authSessionService";
import type {
  SessionDocument,
  InteractionDocument,
  IdentifiedSkillDocument,
  InteractionMappingOutcome,
} from "../../types/firestore";

const USER_ID_STORAGE_KEY = "@firestore_user_id";
type InputMethod = "text" | "voice" | "image";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function cacheUserId(userId: string): Promise<void> {
  _cachedUserId = userId;
  try {
    await setJSONInStorage(USER_ID_STORAGE_KEY, userId);
  } catch (storageError) {
    console.warn("[Firestore] Failed to persist user id:", storageError);
  }
}

//
// User identity (anonymous auth until real auth is wired up)
//

let _cachedUserId: string | null = null;
const _verifiedSessionDocs = new Set<string>();

function makeSessionKey(userId: string, sessionId: string): string {
  return `${userId}:${sessionId}`;
}

function buildInitialSessionDoc(): SessionDocument {
  return {
    startedAt: serverTimestamp() as unknown as Timestamp,
    completedAt: null,
    status: "in_progress",
    totalInteractions: 0,
    weakFitCount: 0,
    alreadyMappedCount: 0,
    categoriesMappedCount: 0,
    categoriesMapped: [],
  };
}

async function ensureSessionDocument(userId: string, sessionId: string): Promise<void> {
  const key = makeSessionKey(userId, sessionId);
  if (_verifiedSessionDocs.has(key)) {
    return;
  }

  const sessionRef = doc(db, "participants", userId, "sessions", sessionId);
  const snapshot = await getDoc(sessionRef);

  if (!snapshot.exists()) {
    await setDoc(sessionRef, buildInitialSessionDoc());
  }

  _verifiedSessionDocs.add(key);
}

async function ensureFirebaseUserForWrites(): Promise<string> {
  const currentUid = auth.currentUser?.uid;
  if (currentUid) {
    return currentUid;
  }

  try {
    const credential = await signInAnonymously(auth);
    if (credential.user?.uid) {
      return credential.user.uid;
    }
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "unknown";
    const writeAuthError = new Error(
      `No Firebase auth user is available for Firestore writes. (auth code: ${code})`
    ) as Error & { code?: string; authCode?: string };
    writeAuthError.code =
      code === "auth/admin-restricted-operation"
        ? "app/anonymous-auth-disabled"
        : "app/firestore-auth-unavailable";
    writeAuthError.authCode = code;
    throw writeAuthError;
  }

  throw new Error("No Firebase auth user is available for Firestore writes.");
}

export async function getOrCreateUserId(): Promise<string> {
  await waitForAuthReady();

  if (_cachedUserId && auth.currentUser?.uid === _cachedUserId) {
    return _cachedUserId;
  }

  const resolvedUid = await ensureFirebaseUserForWrites();
  await cacheUserId(resolvedUid);
  return resolvedUid;
}

//
// Session writes
//

export async function createSession(userId: string): Promise<string> {
  const sessionId = generateId();
  try {
    const sessionRef = doc(db, "participants", userId, "sessions", sessionId);
    const sessionDoc = buildInitialSessionDoc();
    await setDoc(sessionRef, sessionDoc);
    _verifiedSessionDocs.add(makeSessionKey(userId, sessionId));
  } catch (err) {
    console.error("[Firestore] Failed to create session:", err);
    throw err;
  }
  return sessionId;
}

export async function closeSession(
  userId: string,
  sessionId: string,
  status: "completed" | "abandoned"
): Promise<void> {
  try {
    await ensureSessionDocument(userId, sessionId);
    const sessionRef = doc(db, "participants", userId, "sessions", sessionId);
    await setDoc(
      sessionRef,
      {
        status,
        completedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("[Firestore] Failed to close session:", err);
  }
}

//
// Interaction writes
//

export async function saveInteraction(
  userId: string,
  sessionId: string,
  interactionId: string | null,
  interaction: {
    sequenceIndex: number;
    question: string;
    answer: string;
    inputMethod: InputMethod;
    mappingOutcome: InteractionMappingOutcome;
    mappedCategory: string | null;
    isWeakFit: boolean;
    isAlreadyMapped: boolean;
    justification: string;
    matchedToCategory: string | null;
    matchedToSequenceIndex: number | null;
  }
): Promise<string> {
  const resolvedInteractionId = interactionId ?? generateId();
  try {
    await ensureSessionDocument(userId, sessionId);

    const interactionRef = doc(
      db,
      "participants",
      userId,
      "sessions",
      sessionId,
      "interactions",
      resolvedInteractionId
    );
    const interactionDoc: InteractionDocument = {
      ...interaction,
      timestamp: serverTimestamp() as unknown as Timestamp,
    };
    await setDoc(interactionRef, interactionDoc);

    const sessionRef = doc(db, "participants", userId, "sessions", sessionId);
    const sessionUpdate: Record<string, unknown> = {
      totalInteractions: increment(1),
      lastActiveAt: serverTimestamp(),
    };
    if (interaction.isWeakFit) {
      sessionUpdate.weakFitCount = increment(1);
    }
    if (interaction.isAlreadyMapped) {
      sessionUpdate.alreadyMappedCount = increment(1);
    }
    await setDoc(sessionRef, sessionUpdate, { merge: true });

    console.log("[Firestore] Interaction saved", {
      userId,
      sessionId,
      interactionId: resolvedInteractionId,
      sequenceIndex: interaction.sequenceIndex,
    });
  } catch (err) {
    console.error("[Firestore] Failed to save interaction:", err);
    throw err;
  }
  return resolvedInteractionId;
}

//
// Skill passport writes
//

export async function savePassportMapping(
  userId: string,
  sessionId: string,
  interactionId: string,
  category: string,
  justification: string
): Promise<void> {
  try {
    await ensureSessionDocument(userId, sessionId);

    const categoryId = category.replaceAll(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const passportRef = doc(db, "participants", userId, "skillPassport", categoryId);

    const mapping = {
      sessionId,
      interactionId,
      justification,
      // Field transforms are not allowed inside arrayUnion payloads.
      timestamp: Timestamp.now(),
    };

    await setDoc(
      passportRef,
      {
        category,
        firstMappedAt: serverTimestamp(),
        lastMappedAt: serverTimestamp(),
        totalMappings: increment(1),
        mappings: arrayUnion(mapping),
      },
      { merge: true }
    );

    const sessionRef = doc(db, "participants", userId, "sessions", sessionId);
    await setDoc(
      sessionRef,
      {
        categoriesMappedCount: increment(1),
        categoriesMapped: arrayUnion(category),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("[Firestore] Failed to save passport mapping:", err);
    throw err;
  }
}

//
// Identified skill writes
//

export async function saveIdentifiedSkillToFirestore(
  userId: string,
  skill: string,
  category: string,
  source: InputMethod,
  confidence: number | undefined,
  sessionId: string | null
): Promise<void> {
  try {
    const skillId = `${skill.replaceAll(/[^a-zA-Z0-9]/g, "_").toLowerCase()}-${generateId()}`;
    const skillRef = doc(db, "participants", userId, "identifiedSkills", skillId);
    const skillDoc: IdentifiedSkillDocument = {
      skill,
      category,
      source,
      confidence: confidence ?? null,
      dateIdentified: serverTimestamp() as unknown as Timestamp,
      sessionId,
    };
    await setDoc(skillRef, skillDoc);
  } catch (err) {
    console.error("[Firestore] Failed to save identified skill:", err);
    throw err;
  }
}

export async function saveIdentifiedSkillsToFirestore(
  userId: string,
  skills: string[],
  categories: string[],
  source: InputMethod,
  sessionId: string | null
): Promise<void> {
  await Promise.all(
    skills.map((skill, i) =>
      saveIdentifiedSkillToFirestore(
        userId,
        skill,
        categories[i] ?? "Unknown",
        source,
        undefined,
        sessionId
      )
    )
  );
}

export interface SessionCategoryStats {
  sessionId: string;
  perCategory: Record<
    string,
    {
      mappedNew: number;
      mappedRepeat: number;
      totalMappedEvents: number;
    }
  >;
  totals: {
    mappedNew: number;
    mappedRepeat: number;
    totalMappedEvents: number;
  };
}

export async function getSessionCategoryStats(
  userId: string,
  sessionId: string
): Promise<SessionCategoryStats> {
  const interactionsRef = collection(
    db,
    "participants",
    userId,
    "sessions",
    sessionId,
    "interactions"
  );

  const snapshot = await getDocs(interactionsRef);
  const stats: SessionCategoryStats = {
    sessionId,
    perCategory: {},
    totals: {
      mappedNew: 0,
      mappedRepeat: 0,
      totalMappedEvents: 0,
    },
  };

  snapshot.forEach((interactionDoc) => {
    const data = interactionDoc.data() as Partial<InteractionDocument>;
    const category = data.mappedCategory;
    if (!category) {
      return;
    }

    const outcome = data.mappingOutcome;
    if (outcome !== "mapped" && outcome !== "already_mapped") {
      return;
    }

    if (!stats.perCategory[category]) {
      stats.perCategory[category] = {
        mappedNew: 0,
        mappedRepeat: 0,
        totalMappedEvents: 0,
      };
    }

    if (outcome === "mapped") {
      stats.perCategory[category].mappedNew += 1;
      stats.totals.mappedNew += 1;
    } else {
      stats.perCategory[category].mappedRepeat += 1;
      stats.totals.mappedRepeat += 1;
    }

    stats.perCategory[category].totalMappedEvents += 1;
    stats.totals.totalMappedEvents += 1;
  });

  return stats;
}
