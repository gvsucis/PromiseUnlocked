import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/services/firestore";
import { stampQueries } from "@/services/stampQueries";
import { computeXp, XP_EVENTS } from "@/services/xpRules";
import type { XpStampInput, XpSummary } from "@/services/xpRules";

export { computeXp, TIER_XP, XP_EVENTS } from "@/services/xpRules";
export type { XpBreakdownEntry, XpSummary } from "@/services/xpRules";

interface SummaryStampEntry {
  stampName: string;
  category?: string;
  categoryId?: string;
  tier?: number;
}

/**
 * Stamp XP inputs from the client-maintained aggregate summary doc — O(1) read.
 * Falls back to the per-session scan when the summary doesn't exist yet.
 */
async function listStampInputs(uid: string): Promise<XpStampInput[]> {
  const summaryRef = db
    .collection("participants")
    .doc(uid)
    .collection("skillsPassport")
    .doc("summary");
  const summary = await summaryRef.get();
  const stamps = summary.data()?.stamps as Record<string, SummaryStampEntry> | undefined;

  if (stamps && Object.keys(stamps).length > 0) {
    return Object.values(stamps).map((s) => ({
      stampName: s.stampName,
      categoryId: s.categoryId ?? "",
      category: s.category ?? null,
      tier: s.tier ?? 1,
    }));
  }

  return stampQueries.listStampsForParticipant(uid);
}

async function getBonusXp(uid: string): Promise<number> {
  const snapshot = await db.collection("participants").doc(uid).collection("xpEvents").get();
  return snapshot.docs.reduce(
    (sum, doc) => sum + (typeof doc.data().xp === "number" ? doc.data().xp : 0),
    0
  );
}

export async function getParticipantXp(uid: string): Promise<XpSummary> {
  const [stamps, bonusXp] = await Promise.all([
    listStampInputs(uid),
    getBonusXp(uid),
  ]);
  const summary = computeXp(stamps);
  return { ...summary, bonusXp, totalXp: summary.stampXp + bonusXp };
}

/** Verify the event actually happened before granting the bonus. */
async function canClaimEvent(uid: string, eventType: string): Promise<boolean> {
  if (eventType === "profile_completion") {
    const profile = await db.collection("participants").doc(uid).get();
    const data = profile.data();
    const metadata = data?.metadata as Record<string, unknown> | undefined;
    return Boolean(data?.fullName && data?.photoURL && metadata?.demographicsComplete === true);
  }
  if (eventType === "artifact_upload") {
    const snapshot = await db.collection("users").doc(uid).collection("artifacts").limit(1).get();
    return !snapshot.empty;
  }
  return true;
}

/** Idempotent: an existing event doc means the award was already granted. */
export async function claimXpEvent(
  uid: string,
  eventType: string
): Promise<{ xp: number; awarded: boolean }> {
  const xp = XP_EVENTS[eventType];
  if (!xp) throw new Error(`Unknown XP event "${eventType}"`);

  if (!(await canClaimEvent(uid, eventType))) return { xp, awarded: false };

  const eventRef = db.collection("participants").doc(uid).collection("xpEvents").doc(eventType);

  return db.runTransaction(async (txn) => {
    const doc = await txn.get(eventRef);
    if (doc.exists) return { xp, awarded: false };
    txn.set(eventRef, { eventType, xp, awardedAt: FieldValue.serverTimestamp() });
    return { xp, awarded: true };
  });
}
