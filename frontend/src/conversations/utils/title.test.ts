import { describe, expect, it } from 'vitest';
import { deriveConversationTitle } from './title';

describe('conversation titles', () => {
  it('normalizes whitespace and bounds generated titles', () => {
    expect(deriveConversationTitle('  Monthly\n revenue   trend? ')).toBe('Monthly revenue trend?');
    expect(deriveConversationTitle('x'.repeat(300))).toHaveLength(120);
  });
});
