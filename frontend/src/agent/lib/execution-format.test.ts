import { describe, expect, it } from 'vitest';
import { formatCost, safeSummaryEntries, sanitizeOperationalText, summarizeUsage } from './execution-format';

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

describe('model cost', () => {
  it('keeps small costs visible and shows larger costs in cents', () => {
    expect(formatCost(0.0016)).toBe('$0.0016');
    expect(formatCost(12.345)).toBe('$12.35');
    expect(formatCost(null)).toBe('—');
  });

  it('totals priced calls and counts calls that have tokens but no price', () => {
    expect(
      summarizeUsage([
        { input_tokens: 1000, output_tokens: 100, cost: 0.003 },
        { input_tokens: 500, output_tokens: 50, cost: 0.001 },
        { input_tokens: 200, output_tokens: 20, cost: null },
        { input_tokens: null, output_tokens: null, cost: null },
      ]),
    ).toEqual({ calls: 4, inputTokens: 1700, outputTokens: 170, cost: 0.004, unpricedCalls: 1 });
  });

  it('reports no cost when no call is priced', () => {
    expect(summarizeUsage([{ input_tokens: 10, output_tokens: 2, cost: null }]).cost).toBeNull();
  });
});
