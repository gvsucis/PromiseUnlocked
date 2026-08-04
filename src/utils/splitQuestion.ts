const QUESTION_WORDS =
  /\b(?:what|how|why|when|where|who|can|could|would|tell|describe|do|does|did|is|are|was|were|have|has|had)\b/i;

const MAX_COMPLIMENT_WORDS = 40;

function splitAt(index: number, text: string) {
  return { compliment: text.slice(0, index).trim(), question: text.slice(index).trim() };
}

function startsWithQuestionWord(text: string): boolean {
  const firstWord = text.split(/\s+/).find(Boolean);
  return !!firstWord && QUESTION_WORDS.test(firstWord);
}

function splitSentenceCompliment(
  text: string,
  beforeQ: string
): ReturnType<typeof splitQuestion> | null {
  const boundaries = [...beforeQ.matchAll(/[.!](?=\s)/g)].map((m) => m.index + 1);
  for (let i = boundaries.length - 1; i >= 0; i--) {
    const idx = boundaries[i];
    const questionPart = text.slice(idx).trim();
    if (!startsWithQuestionWord(questionPart)) continue;
    const complement = text.slice(0, idx).trim();
    if (complement.split(/\s+/).length > MAX_COMPLIMENT_WORDS) continue;
    return splitAt(idx, text);
  }
  return null;
}

function splitColon(text: string, beforeQ: string): ReturnType<typeof splitQuestion> | null {
  const lastColon = beforeQ.lastIndexOf(":");
  if (lastColon === -1 || !startsWithQuestionWord(text.slice(lastColon + 1))) return null;
  return {
    compliment: text.slice(0, lastColon).trim(),
    question: text.slice(lastColon + 1).trim(),
  };
}

function splitComma(text: string, beforeQ: string): ReturnType<typeof splitQuestion> | null {
  const lastComma = beforeQ.lastIndexOf(",");
  if (lastComma === -1) return null;
  const firstWord = beforeQ
    .slice(lastComma + 1)
    .split(/\s+/)
    .find(Boolean)
    ?.toLowerCase();
  if (!firstWord || /^(and|or|but|so|nor|yet|for)$/.test(firstWord)) return null;
  if (!QUESTION_WORDS.test(firstWord)) return null;
  return {
    compliment: text.slice(0, lastComma + 1).trim(),
    question: text.slice(lastComma + 1).trim(),
  };
}

export function splitQuestion(text: string): { compliment: string; question: string } {
  const qIndex = text.lastIndexOf("?");
  if (qIndex === -1) return { compliment: "", question: text };
  const beforeQ = text.slice(0, qIndex);

  const sentenceSplit = splitSentenceCompliment(text, beforeQ);
  if (sentenceSplit) return sentenceSplit;

  const colonSplit = splitColon(text, beforeQ);
  if (colonSplit) return colonSplit;

  const commaSplit = splitComma(text, beforeQ);
  if (commaSplit) return commaSplit;

  return { compliment: "", question: text };
}
