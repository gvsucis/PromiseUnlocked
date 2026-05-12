/**
 * Extract and validate JSON from response text
 * Handles incomplete/truncated JSON gracefully by:
 * 1. Removing markdown code fences
 * 2. Finding balanced braces
 * 3. Completing truncated JSON objects
 */
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

  // If no balanced braces found (incomplete JSON):
  // Return from first { to last }, then try to complete it
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace > start) {
    let jsonStr = cleaned.slice(start, lastBrace + 1);
    // Ensure proper closing
    try {
      JSON.parse(jsonStr);
      return jsonStr; // Already valid
    } catch {
      // Try to complete by adding missing closing braces
      const unclosedBraces = jsonStr.split("{").length - 1 - jsonStr.split("}").length;
      if (unclosedBraces > 0) {
        jsonStr += "}".repeat(unclosedBraces);
        try {
          JSON.parse(jsonStr);
          return jsonStr;
        } catch {
          return cleaned.slice(start, lastBrace + 1); // Return partially extracted
        }
      }
    }
    return jsonStr;
  }

  return null;
}
