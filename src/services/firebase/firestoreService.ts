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
  writeBatch,
  arrayUnion,
  increment,
  serverTimestamp,
  query,
  where,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../../config/firebase";
import { randomUUID } from "expo-crypto";
import { setJSONInStorage } from "../../utils/asyncStorage";
import type {
  SessionDocument,
  InteractionDocument,
  IdentifiedSkillDocument,
  InteractionMappingOutcome,
} from "../../types/firestore";
import type { NoMapReason } from "../../types/gemini";

const USER_ID_STORAGE_KEY = "@firestore_user_id";
type InputMethod = "text" | "voice" | "image";

/**
 * Firebase persistence is reserved for authenticated users.
 * Every client-side Firestore write goes through this gate.
 */
export function canWriteToFirestore(): boolean {
  return Boolean(auth.currentUser);
}

function generateId(): string {
  return randomUUID();
}

async function cacheUserId(userId: string): Promise<void> {
  _cachedUserId = userId;
  try {
    await setJSONInStorage(USER_ID_STORAGE_KEY, userId);
  } catch (storageError) {
    console.warn("[Firestore] Failed to persist user id:", storageError);
  }
}

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
  if (!currentUid) {
    throw new Error("No Firebase auth user is available for Firestore writes.");
  }
  return currentUid;
}

export async function getOrCreateUserId(): Promise<string> {
  const { waitForAuthReady } = await import("../auth/authSessionService");
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

export async function getSessionStatus(
  userId: string,
  sessionId: string
): Promise<"in_progress" | "completed" | "abandoned" | null> {
  try {
    const sessionRef = doc(db, "participants", userId, "sessions", sessionId);
    const snapshot = await getDoc(sessionRef);
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    return (data?.status as "in_progress" | "completed" | "abandoned") ?? null;
  } catch {
    return null;
  }
}

/**
 * Find the user's current in_progress session, if any.
 * A user has at most one in_progress session at a time, shared across every
 * device, so Firestore — not local storage — is the source of truth for which
 * session is active. Returns null when there is no in_progress session, and
 * rethrows on read failure so callers can distinguish "none" from "offline".
 */
export async function getInProgressSession(userId: string): Promise<string | null> {
  const sessionsRef = collection(db, "participants", userId, "sessions");
  const q = query(sessionsRef, where("status", "==", "in_progress"), limit(1));
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : snapshot.docs[0].id;
}

export async function fetchSessionInteractions(
  userId: string,
  sessionId: string
): Promise<InteractionDocument[]> {
  try {
    const interactionsRef = collection(
      db,
      "participants",
      userId,
      "sessions",
      sessionId,
      "interactions"
    );
    const snapshot = await getDocs(interactionsRef);
    return snapshot.docs.map((doc) => doc.data() as InteractionDocument);
  } catch {
    return [];
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
    categoryId: string | null;
    isWeakFit: boolean;
    isAlreadyMapped: boolean;
    justification: string;
    noMapReason?: string;
    specificStamp?: string;
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
      sequenceIndex: interaction.sequenceIndex,
      question: interaction.question,
      answer: interaction.answer,
      inputMethod: interaction.inputMethod,
      mappingOutcome: interaction.mappingOutcome,
      mappedCategory: interaction.mappedCategory,
      categoryId: interaction.categoryId,
      isWeakFit: interaction.isWeakFit,
      isAlreadyMapped: interaction.isAlreadyMapped,
      justification: interaction.justification,
      noMapReason: (interaction.noMapReason ?? "") as NoMapReason,
      specificStamp: interaction.specificStamp ?? null,
      matchedToCategory: interaction.matchedToCategory,
      matchedToSequenceIndex: interaction.matchedToSequenceIndex,
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
  categoryId: string,
  justification: string,
  specificStamp?: string
): Promise<void> {
  if (!canWriteToFirestore()) return;
  try {
    await ensureSessionDocument(userId, sessionId);

    const passportRef = doc(
      db,
      "participants",
      userId,
      "sessions",
      sessionId,
      "skillPassport",
      categoryId
    );

    const mapping: {
      sessionId: string;
      interactionId: string;
      justification: string;
      specificStamp?: string | null;
      categoryId?: string | null;
      timestamp: Timestamp;
    } = {
      sessionId,
      interactionId,
      justification,
      specificStamp: specificStamp ?? null,
      categoryId,
      // Field transforms are not allowed inside arrayUnion payloads.
      timestamp: Timestamp.now(),
    };

    await setDoc(
      passportRef,
      {
        category,
        categoryId,
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

/**
 * Save a stamp unlock to the per-session skillPassport doc and to the
 * participant-level skillsPassport/summary aggregate. Uses increment for
 * atomic counter updates.
 */
export async function saveStampUnlock(
  userId: string,
  sessionId: string,
  categoryId: string,
  stampName: string,
  tier: number = 1,
  categoryName?: string
): Promise<void> {
  try {
    const passportRef = doc(
      db,
      "participants",
      userId,
      "sessions",
      sessionId,
      "skillPassport",
      categoryId
    );

    const existing = await getDoc(passportRef);
    const data = existing.data();
    const hasStamp =
      data?.unlockedStamps &&
      typeof data.unlockedStamps === "object" &&
      stampName in data.unlockedStamps;

    const summaryRef = doc(db, "participants", userId, "skillsPassport", "summary");
    const summaryDoc = await getDoc(summaryRef);
    const summaryData = summaryDoc.data();
    const hasCategorySummary = summaryData?.categorySummaries?.[categoryId] != null;

    // The summary aggregates across sessions, so its increment/first-set decision
    // must look at the summary doc, not the session-local unlockedStamps.
    const hasStampInSummary =
      summaryData?.stamps &&
      typeof summaryData.stamps === "object" &&
      stampName in summaryData.stamps;

    const summaryStampEntry = hasStampInSummary
      ? {
          timesUnlocked: increment(1),
          lastUnlockedAt: serverTimestamp(),
          tier,
          categoryId,
          stampName,
          sessionId,
          ...(categoryName ? { category: categoryName } : {}),
        }
      : {
          timesUnlocked: 1,
          firstUnlockedAt: serverTimestamp(),
          lastUnlockedAt: serverTimestamp(),
          tier,
          categoryId,
          stampName,
          sessionId,
          ...(categoryName ? { category: categoryName } : {}),
        };

    const batch = writeBatch(db);
    batch.set(
      passportRef,
      {
        categoryId,
        unlockedStamps: {
          [stampName]: hasStamp
            ? { timesUnlocked: increment(1), lastUnlockedAt: serverTimestamp(), tier, categoryId }
            : {
                timesUnlocked: 1,
                firstUnlockedAt: serverTimestamp(),
                lastUnlockedAt: serverTimestamp(),
                tier,
                categoryId,
              },
        },
      },
      { merge: true }
    );
    batch.set(
      summaryRef,
      {
        stamps: {
          [stampName]: summaryStampEntry,
        },
      },
      { merge: true }
    );
    if (categoryName) {
      batch.set(
        summaryRef,
        {
          categorySummaries: {
            [categoryId]: {
              category: categoryName,
              categoryId,
              totalMappings: increment(1),
              lastMappedAt: serverTimestamp(),
              ...(hasCategorySummary ? {} : { firstMappedAt: serverTimestamp() }),
            },
          },
        },
        { merge: true }
      );
    }
    await batch.commit();
  } catch (err) {
    console.error("[Firestore] Failed to save stamp unlock:", err);
    throw err;
  }
}

export async function fetchPassportMappings(
  userId: string,
  sessionId: string
): Promise<{ category: string; categoryId: string; firstMappedAt: Date; totalMappings: number }[]> {
  try {
    const passportRef = collection(
      db,
      "participants",
      userId,
      "sessions",
      sessionId,
      "skillPassport"
    );
    const snapshot = await getDocs(passportRef);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        category: (data.category as string) ?? doc.id,
        categoryId: (data.categoryId as string) ?? doc.id,
        firstMappedAt: data.firstMappedAt?.toDate?.() ?? new Date(),
        totalMappings: (data.totalMappings as number) ?? 1,
      };
    });
  } catch (err) {
    console.error("[Firestore] Failed to fetch passport mappings:", err);
    return [];
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
