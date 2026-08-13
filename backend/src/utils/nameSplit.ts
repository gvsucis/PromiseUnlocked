const NAME_PARTICLES = new Set([
  "van",
  "von",
  "de",
  "di",
  "da",
  "do",
  "dos",
  "la",
  "le",
  "du",
  "der",
  "den",
  "ten",
  "ter",
  "te",
  "van der",
  "van den",
  "van de",
  "van het",
  "von der",
  "von den",
  "de la",
  "de le",
  "della",
  "del",
  "dello",
  "dei",
  "degli",
]);

function isParticle(token: string): boolean {
  return NAME_PARTICLES.has(token.toLowerCase());
}

/**
 * Heuristic split of a full name into first/last, mirroring the client util in
 * `src/utils/format.ts` so the migration backfill matches the app's fallback.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { firstName: "", lastName: "" };
  if (tokens.length === 1) return { firstName: tokens[0]!, lastName: "" };
  if (tokens.length === 2) return { firstName: tokens[0]!, lastName: tokens[1]! };

  const secondToLast = tokens[tokens.length - 2]!.toLowerCase();
  const last = tokens[tokens.length - 1]!.toLowerCase();
  const combinedParticle = `${secondToLast} ${last}`;

  if (isParticle(secondToLast) || isParticle(combinedParticle)) {
    return { firstName: tokens.slice(0, -2).join(" "), lastName: tokens.slice(-2).join(" ") };
  }

  return { firstName: tokens.slice(0, -1).join(" "), lastName: tokens[tokens.length - 1]! };
}

export function combineFullName(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}
