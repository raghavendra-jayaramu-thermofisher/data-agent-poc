import type { ConversationMessage } from '../api/conversation-api';

/**
 * Each reply follows the latest message of its job that came before it: the question, or the
 * answers to clarifying questions when a paused analysis resumed.
 */
export function orderConversationTurns(messages: ConversationMessage[]): ConversationMessage[] {
  const userMessages = messages.filter((item) => item.role === 'user' && item.job_id);
  const start = (item: ConversationMessage) => {
    if (item.role !== 'assistant' || !item.job_id) return item.created_at;
    const replyAt = Date.parse(item.created_at);
    const prompt = userMessages
      .filter((user) => user.job_id === item.job_id && Date.parse(user.created_at) <= replyAt)
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
      .at(-1);
    return (
      prompt?.created_at ??
      userMessages.find((user) => user.job_id === item.job_id)?.created_at ??
      item.created_at
    );
  };
  return [...messages].sort((a, b) => {
    const order = Date.parse(start(a)) - Date.parse(start(b));
    if (order) return order;
    if (a.job_id && a.job_id === b.job_id && a.role !== b.role) return a.role === 'user' ? -1 : 1;
    return Date.parse(a.created_at) - Date.parse(b.created_at);
  });
}
