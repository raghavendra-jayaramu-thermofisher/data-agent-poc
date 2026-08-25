export function deriveConversationTitle(question: string): string {
  const normalized = question.replace(/\s+/g, ' ').trim();
  return normalized.length <= 120 ? normalized : `${normalized.slice(0, 117)}…`;
}
