import type { ConversationMessage } from './api/conversation-api';

export type ClarificationOption = {
  label: string;
  description?: string | null;
  is_other?: boolean;
};
export type ClarificationQuestion = {
  id: string;
  kind: 'choice' | 'text';
  prompt: string;
  multiple?: boolean;
  required?: boolean;
  options?: ClarificationOption[];
  placeholder?: string | null;
  /** The optional "Anything else" box the server adds to every card. */
  is_extra?: boolean;
};
export type ClarificationRequest = { reason: string; questions: ClarificationQuestion[] };
export type ClarificationAnswer = {
  question_id: string;
  selected?: string[];
  other_text?: string | null;
  text?: string | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** The agent's questions on an assistant message, or null for ordinary answers. */
export function clarificationRequest(message: ConversationMessage): ClarificationRequest | null {
  const request = record(message.metadata?.clarification);
  if (message.role !== 'assistant' || !request || !Array.isArray(request.questions)) return null;
  const questions = request.questions.filter(
    (item): item is ClarificationQuestion =>
      Boolean(record(item)) &&
      typeof item.id === 'string' &&
      typeof item.prompt === 'string' &&
      (item.kind === 'choice' || item.kind === 'text'),
  );
  return questions.length
    ? { reason: typeof request.reason === 'string' ? request.reason : '', questions }
    : null;
}

/** Answers recorded on the user message that answered `questionMessageId`. */
export function clarificationAnswers(
  messages: ConversationMessage[],
  questionMessageId: string,
): ClarificationAnswer[] | null {
  const reply = messages.find(
    (message) =>
      message.role === 'user' && message.metadata?.answers_message_id === questionMessageId,
  );
  const answers = reply?.metadata?.clarification_answers;
  return Array.isArray(answers) ? (answers as ClarificationAnswer[]) : null;
}

/** Client-side checks that mirror the server, so most mistakes are shown before submitting. */
export function answerErrors(
  request: ClarificationRequest,
  answers: Record<string, ClarificationAnswer>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const question of request.questions) {
    const answer = answers[question.id];
    const required = question.required !== false;
    if (question.kind === 'text') {
      if (required && !answer?.text?.trim()) errors[question.id] = 'An answer is required.';
      continue;
    }
    const selected = answer?.selected ?? [];
    const other = question.options?.find((option) => option.is_other)?.label;
    if (required && !selected.length) errors[question.id] = 'Choose an option.';
    else if (other && selected.includes(other) && !answer?.other_text?.trim())
      errors[question.id] = "Describe your answer for 'Other'.";
  }
  return errors;
}
