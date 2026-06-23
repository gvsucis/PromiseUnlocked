import { normalizeUser } from "@/services/firestore";

const SEARCH_FIELDS = ["displayName", "fullName", "email", "schoolName"] as const;

/** Any object exposing (a subset of) the searchable participant fields. */
type SearchableRecord = Partial<Record<(typeof SEARCH_FIELDS)[number], unknown>>;

/**
 * Normalizes a raw `search` query param into a trimmed, lower-cased term.
 * Returns null when there is no usable search term.
 */
export function normalizeSearchTerm(search: unknown): string | null {
  if (typeof search !== "string") return null;
  const term = search.trim().toLowerCase();
  return term.length > 0 ? term : null;
}

/**
 * Case-insensitive substring match across a participant's searchable fields.
 * `term` must already be trimmed/lower-cased (see {@link normalizeSearchTerm}).
 */
export function matchesSearchTerm(record: SearchableRecord, term: string): boolean {
  return SEARCH_FIELDS.some((field) => {
    const value = record[field];
    return typeof value === "string" && value.toLowerCase().includes(term);
  });
}

/**
 * Maps participant docs to normalized users, filters by `term`, and orders them
 * newest-first by createdAt so search pagination matches the default listing order.
 */
export function searchParticipantDocs(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  term: string
): Record<string, unknown>[] {
  return docs
    .map((doc) => normalizeUser(doc) as Record<string, unknown>)
    .filter((user) => matchesSearchTerm(user, term))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

function toMillis(value: unknown): number {
  if (typeof value !== "string") return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}
