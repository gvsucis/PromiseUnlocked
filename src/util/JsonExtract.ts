export default function extractJson(response: string): string | null {
  if (!response) return null;

  // Remove markdown code fences if present
  const cleaned = response.replaceAll(/```(?:json)?\s*/gi, "").replaceAll(/```\s*$/g, "");

  // Find JSON object by balanced braces
  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }

  // If no balanced braces found, return from first { to last }
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace > start) return cleaned.slice(start, lastBrace + 1);

  return null;
}
