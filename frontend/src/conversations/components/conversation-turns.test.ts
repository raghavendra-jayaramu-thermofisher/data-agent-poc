import { describe, expect, it } from 'vitest';
import type { ConversationMessage } from '../api/conversation-api';
import { orderConversationTurns } from './conversation-turns';

describe('conversation turn ordering', () => {
  it('keeps each answer with its question when later questions arrived before it', () => {
    const message = (id: string, role: string, job_id: string | null, second: number) =>
      ({
        id,
        role,
        job_id,
        content: id,
        conversation_id: 'c1',
        metadata: {},
        created_at: new Date(1700000000000 + second * 1000).toISOString(),
      }) as ConversationMessage;
    const messages = [
      message('q1', 'user', 'j1', 0),
      message('q2', 'user', 'j2', 1),
      message('a1', 'assistant', 'j1', 2),
      message('a2', 'assistant', 'j2', 3),
      message('legacy', 'user', null, 4),
    ];
    expect(orderConversationTurns(messages).map((item) => item.id)).toEqual([
      'q1',
      'a1',
      'q2',
      'a2',
      'legacy',
    ]);
    expect(messages.map((item) => item.id)).toEqual(['q1', 'q2', 'a1', 'a2', 'legacy']);
  });
});
