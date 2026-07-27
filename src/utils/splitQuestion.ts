export function splitQuestion(text: string): { compliment: string; question: string } {
  const qIndex = text.lastIndexOf("?");
  if (qIndex === -1) return { compliment: "", question: text };
  const beforeQ = text.slice(0, qIndex);
  const sentStart = Math.max(
    beforeQ.lastIndexOf(". "),
    beforeQ.lastIndexOf("! "),
    beforeQ.lastIndexOf(".\n"),
    beforeQ.lastIndexOf("!\n")
  );
  const boundary = sentStart === -1 ? 0 : sentStart + 2;
  return {
    compliment: text.slice(0, boundary).trim(),
    question: text.slice(boundary).trim(),
  };
}
