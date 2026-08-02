const QUESTION_WORDS =
  /\b(?:what|how|why|when|where|who|can|could|would|tell|describe|do|does|did|is|are|was|were|have|has|had)\b/i;

function splitAt(index: number, text: string) {
  return { compliment: text.slice(0, index).trim(), question: text.slice(index).trim() };
}

export function splitQuestion(text: string): { compliment: string; question: string } {
  const qIndex = text.lastIndexOf("?");
  if (qIndex === -1) return { compliment: "", question: text };
  const beforeQ = text.slice(0, qIndex);

  const sentEnd = [...beforeQ.matchAll(/[.!](?:\s|$)/g)].at(-1);
  if (sentEnd) return splitAt(sentEnd.index + 1, text);

  const lastColon = beforeQ.lastIndexOf(":");

  if (lastColon !== -1) {
    const firstWord = text
      .slice(lastColon + 1)
      .split(/\s+/)
      .find(Boolean);
    if (firstWord && QUESTION_WORDS.test(firstWord))
      return {
        compliment: text.slice(0, lastColon).trim(),
        question: text.slice(lastColon + 1).trim(),
      };
  }

  const lastComma = beforeQ.lastIndexOf(",");
  if (lastComma !== -1) {
    const firstWord = beforeQ
      .slice(lastComma + 1)
      .split(/\s+/)
      .find(Boolean)
      ?.toLowerCase();
    if (
      firstWord &&
      !/^(and|or|but|so|nor|yet|for)$/.test(firstWord) &&
      QUESTION_WORDS.test(firstWord)
    )
      return {
        compliment: text.slice(0, lastComma + 1).trim(),
        question: text.slice(lastComma + 1).trim(),
      };
  }

  return { compliment: "", question: text };
}
