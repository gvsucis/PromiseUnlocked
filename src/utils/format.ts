export function formatPhone(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

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

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { firstName: "", lastName: "" };
  if (tokens.length === 1) return { firstName: tokens[0], lastName: "" };
  if (tokens.length === 2) return { firstName: tokens[0], lastName: tokens[1] };

  // For 3+ tokens, check if second-to-last is a particle
  const secondToLast = tokens.at(-2)?.toLowerCase() ?? "";
  const last = tokens.at(-1)?.toLowerCase() ?? "";
  const combinedParticle = `${secondToLast} ${last}`;

  if (isParticle(secondToLast) || isParticle(combinedParticle)) {
    // Include particle in lastName: "van der Berg" -> firstName="van", lastName="der Berg"
    // Common convention: particle goes with lastName
    const firstName = tokens.slice(0, -2).join(" ");
    const lastName = tokens.slice(-2).join(" ");
    return { firstName, lastName };
  }

  // Default: all but last token as firstName
  return { firstName: tokens.slice(0, -1).join(" "), lastName: tokens.at(-1) ?? "" };
}

export function combineFullName(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}
