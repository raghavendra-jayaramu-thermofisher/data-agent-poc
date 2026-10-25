import { describe, expect, it } from 'vitest';
import { knowledgeMarkdown } from './knowledge-markdown';

const note = (id: string, scope_type: string, scope_key: string | null, content: string) => ({
  id,
  knowledge_base_id: 'kb1',
  scope_type,
  scope_key,
  content,
  created_by: 'u1',
  created_at: '2026-10-25T00:00:00Z',
  updated_at: '2026-10-25T00:00:00Z',
});

describe('knowledgeMarkdown', () => {
  it('copies every note unchanged, grouped in the order the agent reads them', () => {
    const text = knowledgeMarkdown(
      'Warehouse',
      [
        note('1', 'column', 'dbo.orders.status', 'Status codes\n\nO = open'),
        note('2', 'table', 'dbo.orders', '# Order rules\n\n---\nOne row per order.'),
        note('3', 'datasource', null, '  Fiscal calendar\nStarts in January.  '),
        note('4', 'metric', 'Backlog', 'Backlog\nOpen order value.'),
        note('5', 'datasource', null, 'Formatting rules'),
      ],
      new Date(2026, 9, 25),
    );
    expect(text).toBe(
      [
        '# Business knowledge: Warehouse\n\n5 notes · copied 25 Oct 2026\n',
        '---\n\nApplies to: Data source\n\nFiscal calendar\nStarts in January.\n',
        '---\n\nApplies to: Data source\n\nFormatting rules\n',
        '---\n\nApplies to: Metric · Backlog\n\nBacklog\nOpen order value.\n',
        '---\n\nApplies to: Table · dbo.orders\n\n# Order rules\n\n---\nOne row per order.\n',
        '---\n\nApplies to: Column · dbo.orders.status\n\nStatus codes\n\nO = open\n',
      ].join('\n'),
    );
  });
});
