import type { StampInstance } from "@/services/stampQueries";

export const TIER_XP: Record<number, number> = { 1: 5, 2: 10, 3: 15, 4: 20 };
export const XP_EVENTS: Record<string, number> = {
  profile_completion: 20,
  artifact_upload: 10,
};

export interface XpBreakdownEntry {
  categoryId: string;
  category: string | null;
  xp: number;
}

export interface XpSummary {
  totalXp: number;
  stampXp: number;
  bonusXp: number;
  stampCount: number;
  breakdown: XpBreakdownEntry[];
}

export type XpStampInput = Pick<StampInstance, "stampName" | "categoryId" | "category" | "tier">;

function tierXp(tier: number | undefined): number {
  return TIER_XP[typeof tier === "number" ? Math.round(tier) : 1] ?? 5;
}

/** One unique stamp per (stampName, categoryId) at its highest tier. */
export function computeXp(stamps: XpStampInput[]): XpSummary {
  const best = new Map<string, XpStampInput>();
  for (const s of stamps) {
    const key = `${s.stampName}\u0000${s.categoryId}`;
    const prev = best.get(key);
    if (!prev || s.tier > prev.tier) best.set(key, s);
  }

  const breakdown = [...best.values()]
    .map((s) => ({ categoryId: s.categoryId, category: s.category ?? null, xp: tierXp(s.tier) }))
    .sort((a, b) => b.xp - a.xp || a.categoryId.localeCompare(b.categoryId));
  const stampXp = breakdown.reduce((sum, e) => sum + e.xp, 0);

  return { totalXp: stampXp, stampXp, bonusXp: 0, stampCount: breakdown.length, breakdown };
}
