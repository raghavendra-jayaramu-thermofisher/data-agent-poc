import { describe, expect, it } from 'vitest';
import { messageSchema, newConversationSchema } from './conversation-schemas';

describe('conversation validation', () => {
  it('requires one to ten data sources and a non-empty question', () => {
    expect(newConversationSchema.safeParse({ question: 'Revenue?', dataSourceIds: [], modelProfileId: null }).success).toBe(false);
    const ids = Array.from({ length: 11 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    expect(newConversationSchema.safeParse({ question: 'Revenue?', dataSourceIds: ids, modelProfileId: null }).success).toBe(false);
    expect(newConversationSchema.safeParse({ question: 'Revenue?', dataSourceIds: [ids[0]], modelProfileId: null }).success).toBe(true);
  });

  it('rejects blank follow-ups', () => {
    expect(messageSchema.safeParse({ question: '   ' }).success).toBe(false);
  });
});
