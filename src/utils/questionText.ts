export function normalizeQuestion(question: string): string {
  let normalized = String(question).trim();
  while (normalized.startsWith('"')) {
    normalized = normalized.slice(1);
  }
  while (normalized.endsWith('"')) {
    normalized = normalized.slice(0, -1);
  }
  normalized = normalized.trim();
  normalized = normalized.replaceAll(/\s+/g, " ");

  if (!normalized.endsWith("?")) {
    while (normalized.endsWith(".") || normalized.endsWith("!")) {
      normalized = normalized.slice(0, -1);
    }
    normalized = `${normalized}?`;
  }

  return normalized;
}

export function isQuestionStrong(question: string): boolean {
  const normalized = question.trim();
  if (!normalized.endsWith("?")) return false;
  const words = normalized
    .replaceAll(/[?!.,]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < 8) return false;
  return /\b(what|how|why|where|when|who|which)\b/i.test(normalized);
}
