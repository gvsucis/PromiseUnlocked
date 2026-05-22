/**
 * Extract and validate JSON from response text.
 * Handles markdown code fences and truncated/incomplete JSON.
 */
export default function extractJson(response: string): string | null {
  if (!response) return null;

  const cleaned = response
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```\s*$/, "")
    .trim();

  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  const candidate = sliceBalancedJson(cleaned, start);
  return tryParse(candidate) ? candidate : repairAndValidate(candidate);
}

function sliceBalancedJson(text: string, start: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return text.slice(start);
}

function repairAndValidate(jsonStr: string): string | null {
  const state = scanJsonState(jsonStr);
  let repaired = jsonStr;

  if (state.escaped) {
    // Truncated right after a backslash — add another backslash + quote
    // so the pair becomes a literal backslash and the string closes.
    repaired += '\\"';
  } else if (state.inString) {
    repaired += '"';
  }

  if (state.openBraces > 0) {
    repaired += "}".repeat(state.openBraces);
  }

  // Remove a trailing comma right before the final closing brace
  repaired = repaired.replace(/,\s*}$/, "}");

  return tryParse(repaired) ? repaired : null;
}

function scanJsonState(str: string): { inString: boolean; escaped: boolean; openBraces: number } {
  let inString = false;
  let escaped = false;
  let openBraces = 0;

  for (const ch of str) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") openBraces++;
    else if (ch === "}") openBraces--;
  }

  return { inString, escaped, openBraces };
}

function tryParse(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
