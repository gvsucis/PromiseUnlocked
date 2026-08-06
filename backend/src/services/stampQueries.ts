import type {
  CollectionReference,
  Query,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import {
  db,
  participantSessionsCollection,
  participantPassportCollection,
  participantSessionInteractionsCollection,
} from "@/services/firestore";

/**
 * Stamp query service — the deep module behind every admin stamp view.
 *
 * In Firestore a stamp is not a first-class document: it is an entry inside a
 * `skillPassport/{categoryId}` doc's `unlockedStamps` map, nested under
 * `participants/{uid}/sessions/{sessionId}`. Every admin view needs the same
 * three things hidden here: cross-participant traversal (via a `skillPassport`
 * collection-group query), flattening those maps into stamp rows, and joining a
 * stamp back to the interaction that justified it. Callers cross this interface;
 * they never see the traversal or the map shape.
 */

export interface StampInstance {
  stampName: string;
  category: string | null;
  categoryId: string;
  tier: number;
  timesUnlocked: number;
  firstUnlockedAt: string | null;
  lastUnlockedAt: string | null;
  participantId: string;
  sessionId: string;
}

export interface CategoryStampSummary {
  category: string | null;
  stampInstances: number;
  distinctStamps: number;
  totalUnlocks: number;
  participants: number;
  sessions: number;
}

export interface StampEvidence {
  stamp: StampInstance | null;
  interactions: Array<{
    id: string;
    sequenceIndex: number | null;
    question: string | null;
    answer: string | null;
    justification: string;
    mappingOutcome: string | null;
    mappedCategory: string | null;
    specificStamp: string | null;
    timestamp: string | null;
  }>;
}

/** Dependencies, injectable so tests can drive the service with an in-memory fake. */
export interface StampQueryDeps {
  passportGroup: () => Query;
  sessionsOf: (uid: string) => Query;
  passportOf: (uid: string, sessionId: string) => CollectionReference;
  interactionsOf: (uid: string, sessionId: string) => Query;
}

const defaultDeps: StampQueryDeps = {
  passportGroup: () => db.collectionGroup("skillPassport"),
  sessionsOf: (uid) => participantSessionsCollection(uid),
  passportOf: (uid, sessionId) => participantPassportCollection(uid, sessionId),
  interactionsOf: (uid, sessionId) => participantSessionInteractionsCollection(uid, sessionId),
};

function toIso(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof ts === "string") return ts;
  if (typeof ts === "number") return new Date(ts).toISOString();
  if (typeof ts === "object") {
    const t = ts as { toDate?: unknown; _seconds?: unknown };
    if (typeof t.toDate === "function") return (t.toDate as () => Date)().toISOString();
    if (typeof t._seconds === "number") return new Date(t._seconds * 1000).toISOString();
  }
  return null;
}

/** Recover `{ participantId, sessionId }` from a `skillPassport` doc's path. */
function provenanceOf(doc: QueryDocumentSnapshot): { participantId: string; sessionId: string } {
  // path: participants/{uid}/sessions/{sessionId}/skillPassport/{categoryId}
  const sessionDoc = doc.ref.parent.parent; // sessions/{sessionId}
  const participantDoc = sessionDoc?.parent.parent; // participants/{uid}
  return {
    sessionId: sessionDoc?.id ?? "",
    participantId: participantDoc?.id ?? "",
  };
}

/** Flatten one passport doc's `unlockedStamps` map into stamp rows. */
function flattenPassportDoc(
  doc: QueryDocumentSnapshot,
  provenance: { participantId: string; sessionId: string }
): StampInstance[] {
  const data = doc.data();
  const category = (data?.category as string | undefined) ?? null;
  const unlocked = (data?.unlockedStamps as Record<string, Record<string, unknown>> | undefined) ?? {};
  return Object.entries(unlocked).map(([stampName, entry]) => ({
    stampName,
    category,
    categoryId: doc.id,
    tier: typeof entry?.tier === "number" ? entry.tier : 1,
    timesUnlocked: typeof entry?.timesUnlocked === "number" ? entry.timesUnlocked : 0,
    firstUnlockedAt: toIso(entry?.firstUnlockedAt),
    lastUnlockedAt: toIso(entry?.lastUnlockedAt),
    participantId: provenance.participantId,
    sessionId: provenance.sessionId,
  }));
}

export function createStampQueries(deps: StampQueryDeps = defaultDeps) {
  /** #1 — every stamp a participant has earned, across all their sessions. */
  async function listStampsForParticipant(participantId: string): Promise<StampInstance[]> {
    const sessionsSnapshot = await deps.sessionsOf(participantId).get();
    const perSession = await Promise.all(
      sessionsSnapshot.docs.map(async (sDoc) => {
        const passportSnapshot = await deps.passportOf(participantId, sDoc.id).get();
        return passportSnapshot.docs.flatMap((pDoc) =>
          flattenPassportDoc(pDoc, { participantId, sessionId: sDoc.id })
        );
      })
    );
    return perSession.flat();
  }

  /** #2 — every stamp earned within a single session. */
  async function listStampsForSession(
    participantId: string,
    sessionId: string
  ): Promise<StampInstance[]> {
    const passportSnapshot = await deps.passportOf(participantId, sessionId).get();
    return passportSnapshot.docs.flatMap((pDoc) =>
      flattenPassportDoc(pDoc, { participantId, sessionId })
    );
  }

  /** #3 — platform-wide counts grouped by category (collection-group query). */
  async function summarizeByCategory(): Promise<CategoryStampSummary[]> {
    const snapshot = await deps.passportGroup().get();
    const byCategory = new Map<
      string,
      {
        category: string | null;
        instances: number;
        stampNames: Set<string>;
        totalUnlocks: number;
        participants: Set<string>;
        sessions: Set<string>;
      }
    >();

    for (const doc of snapshot.docs) {
      const provenance = provenanceOf(doc);
      const stamps = flattenPassportDoc(doc, provenance);
      const first = stamps[0];
      if (!first) continue;
      const category = first.category;
      const key = category ?? "(uncategorized)";
      let bucket = byCategory.get(key);
      if (!bucket) {
        bucket = {
          category,
          instances: 0,
          stampNames: new Set(),
          totalUnlocks: 0,
          participants: new Set(),
          sessions: new Set(),
        };
        byCategory.set(key, bucket);
      }
      for (const stamp of stamps) {
        bucket.instances += 1;
        bucket.stampNames.add(stamp.stampName);
        bucket.totalUnlocks += stamp.timesUnlocked;
        if (stamp.participantId) bucket.participants.add(stamp.participantId);
        if (stamp.sessionId) bucket.sessions.add(stamp.sessionId);
      }
    }

    return Array.from(byCategory.values())
      .map((b) => ({
        category: b.category,
        stampInstances: b.instances,
        distinctStamps: b.stampNames.size,
        totalUnlocks: b.totalUnlocks,
        participants: b.participants.size,
        sessions: b.sessions.size,
      }))
      .sort((a, b) => b.stampInstances - a.stampInstances);
  }

  /** #4 — every stamp instance under one category, across all participants. */
  async function listStampsInCategory(category: string): Promise<StampInstance[]> {
    const snapshot = await deps.passportGroup().where("category", "==", category).get();
    return snapshot.docs.flatMap((doc) => flattenPassportDoc(doc, provenanceOf(doc)));
  }

  /** #5 — a stamp plus the interaction(s) (question / answer / justification) behind it. */
  async function getStampEvidence(
    participantId: string,
    sessionId: string,
    stampName: string
  ): Promise<StampEvidence> {
    const sessionStamps = await listStampsForSession(participantId, sessionId);
    const stamp = sessionStamps.find((s) => s.stampName === stampName) ?? null;
    const category = stamp?.category ?? null;

    const interactionsSnapshot = await deps
      .interactionsOf(participantId, sessionId)
      .orderBy("timestamp", "asc")
      .get();

    const matched = interactionsSnapshot.docs.filter((iDoc) => {
      const d = iDoc.data();
      if (d.specificStamp && d.specificStamp === stampName) return true;
      if (!d.specificStamp && category && d.mappedCategory === category) return true;
      return false;
    });

    return {
      stamp,
      interactions: matched.map((iDoc) => {
        const d = iDoc.data();
        return {
          id: iDoc.id,
          sequenceIndex: typeof d.sequenceIndex === "number" ? d.sequenceIndex : null,
          question: d.question ?? null,
          answer: d.answer ?? null,
          justification: d.justification ?? "",
          mappingOutcome: d.mappingOutcome ?? null,
          mappedCategory: d.mappedCategory ?? null,
          specificStamp: d.specificStamp ?? null,
          timestamp: toIso(d.timestamp),
        };
      }),
    };
  }

  return {
    listStampsForParticipant,
    listStampsForSession,
    summarizeByCategory,
    listStampsInCategory,
    getStampEvidence,
  };
}

export const stampQueries = createStampQueries();
