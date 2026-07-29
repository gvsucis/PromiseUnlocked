export function toMillis(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }
  if (value && typeof value === "object") {
    const t = value as { toDate?: () => Date; _seconds?: number };
    if (typeof t.toDate === "function") return t.toDate().getTime();
    if (typeof t._seconds === "number") return t._seconds * 1000;
  }
  return 0;
}
