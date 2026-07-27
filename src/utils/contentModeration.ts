import { RegExpMatcher, englishDataset } from "obscenity";

// Built once for the app's lifetime — englishDataset.build() is expensive.
const profanityMatcher = new RegExpMatcher(englishDataset.build());

// Catch spaced/punctuated bypasses the dataset misses (e.g. "f u c k").
const REGEX_BYPASS_PATTERNS = [
  /\bf\s*[\W_]*u\s*[\W_]*c\s*[\W_]*k\b/i,
  /\bs\s*[\W_]*h\s*[\W_]*i\s*[\W_]*t\b/i,
  /\bb\s*[\W_]*i\s*[\W_]*t\s*[\W_]*c\s*[\W_]*h\b/i,
];

/** True if the answer text contains profanity we won't submit to the model. */
export function containsInappropriateLanguage(text: string): boolean {
  const trimmed = text.trim();
  return profanityMatcher.hasMatch(trimmed) || REGEX_BYPASS_PATTERNS.some((r) => r.test(trimmed));
}
