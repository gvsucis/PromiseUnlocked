import { test } from "node:test";
import assert from "node:assert/strict";
import { computeXp, XP_EVENTS } from "../src/services/xpRules";
import type { XpStampInput } from "../src/services/xpRules";

function stamp(
  stampName: string,
  categoryId: string,
  tier: number,
  category?: string
): XpStampInput {
  return { stampName, categoryId, tier, category: category ?? null };
}

test("computeXp is zero for no stamps", () => {
  const result = computeXp([]);
  assert.equal(result.totalXp, 0);
  assert.equal(result.stampCount, 0);
  assert.deepEqual(result.breakdown, []);
});

test("computeXp maps tiers to points and sums unique stamps", () => {
  const result = computeXp([
    stamp("Leadership", "leadership", 2),
    stamp("Coding", "stem", 1),
    stamp("Music", "creative", 4),
  ]);
  assert.equal(result.stampXp, 10 + 5 + 20);
  assert.equal(result.stampCount, 3);
  assert.deepEqual(
    result.breakdown.map((b) => b.categoryId),
    ["creative", "leadership", "stem"]
  );
});

test("computeXp falls back to tier 1 for unknown tiers", () => {
  const result = computeXp([stamp("Coding", "stem", 9), stamp("Music", "creative", 0)]);
  assert.equal(result.stampXp, 10);
});

test("computeXp dedupes by (stampName, categoryId) at the highest tier", () => {
  const result = computeXp([
    stamp("Coding", "stem", 1, "STEM"),
    stamp("Coding", "stem", 3, "STEM"),
    stamp("Coding", "stem", 2, "STEM"),
    stamp("Leadership", "leadership", 3, "Leadership"),
  ]);
  assert.equal(result.stampCount, 2);
  assert.equal(result.stampXp, 15 + 15); // upgraded 1→3 worth 15 total, not 5+10+15
});

test("XP_EVENTS defines the bonus awards", () => {
  assert.equal(XP_EVENTS.profile_completion, 20);
  assert.equal(XP_EVENTS.artifact_upload, 10);
});
