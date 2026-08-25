import { describe, expect, it } from 'vitest';
import { safeSummaryEntries, sanitizeOperationalText } from './execution-format';

describe('safe execution summaries', () => {
  it('removes secret/private-reasoning-shaped keys before rendering', () => {
    const entries = safeSummaryEntries({ table: 'orders', password: 'hidden', hidden_prompt: 'secret', chain_of_thought: 'private', row_count: 12 });
    expect(entries).toEqual([['table', 'orders'], ['row count', '12']]);
    expect(JSON.stringify(entries)).not.toContain('hidden');
    expect(JSON.stringify(entries)).not.toContain('private');
  });

  it('limits operational errors to one bounded line', () => {
    expect(sanitizeOperationalText('Safe message\nTraceback: secret internals')).toBe('Safe message');
  });
});
