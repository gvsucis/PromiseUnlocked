import extractJson from "./JsonExtract";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function toRequiredString(value: unknown): string {
  return toOptionalString(value) ?? "";
}

export function parseJsonFromGeneratedText<T>(text: string): T | null {
  const jsonString = extractJson(text);
  if (!jsonString) return null;

  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return null;
  }
}
