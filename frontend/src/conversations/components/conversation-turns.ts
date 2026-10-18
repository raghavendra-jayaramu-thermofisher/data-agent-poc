import type { ConversationMessage } from '../api/conversation-api';

export function orderConversationTurns(messages: ConversationMessage[]): ConversationMessage[] {
  const questions = new Map(
    messages
      .filter((item) => item.role === 'user' && item.job_id)
      .map((item) => [item.job_id, item]),
  );
  const start = (item: ConversationMessage) =>
    item.role === 'assistant' && item.job_id
      ? (questions.get(item.job_id)?.created_at ?? item.created_at)
      : item.created_at;
  return [...messages].sort((a, b) => {
    const order = Date.parse(start(a)) - Date.parse(start(b));
    if (order) return order;
    if (a.job_id && a.job_id === b.job_id && a.role !== b.role) return a.role === 'user' ? -1 : 1;
    return Date.parse(a.created_at) - Date.parse(b.created_at);
  });
}
