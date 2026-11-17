/** Read the context format already returned by the escalation API, including old threads. */
export function escalationContext(body: string): { question: string; answer: string } {
  const normalized = body.replace(/\r\n/g, "\n").trim();
  const question = normalized.replace(/^Câu hỏi mới từ chat:\s*\n?/, "");
  const separator = question.indexOf("\n\nCâu trả lời AI:");
  if (separator < 0) return { question, answer: "" };
  return {
    question: question.slice(0, separator).trim(),
    answer: question.slice(separator + "\n\nCâu trả lời AI:".length).trim(),
  };
}
