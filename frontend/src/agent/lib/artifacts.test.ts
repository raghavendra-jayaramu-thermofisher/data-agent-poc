import { describe, expect, it } from 'vitest';
import type { JobArtifact } from '../api/execution-api';
import { parseTableArtifact, parseTextArtifact } from './artifacts';

function artifact(kind: string, payload: Record<string, unknown>): JobArtifact {
  return { id: 'a1', job_id: 'j1', kind, name: null, payload, source_sql_execution_id: kind === 'table' ? 's1' : null, created_at: '2026-08-24T12:00:00Z' };
}

describe('artifact parsing', () => {
  it('maps positional table rows to named analytical cells and preserves truncation', () => {
    const parsed = parseTableArtifact(artifact('table', { schema_version: 1, data_source_id: 'ds1', columns: ['month', 'revenue'], rows: [['Jan', 10], ['Feb', 20]], row_count: 2, truncated: true }));
    expect(parsed?.rows[1]?.values).toEqual({ month: 'Feb', revenue: 20 });
    expect(parsed?.truncated).toBe(true);
    expect(parsed?.dataSourceId).toBe('ds1');
  });

  it('rejects malformed positional rows instead of guessing a table shape', () => {
    expect(parseTableArtifact(artifact('table', { schema_version: 1, columns: ['x'], rows: [{ x: 1 }] }))).toBeNull();
  });

  it('parses versioned Markdown text artifacts only', () => {
    expect(parseTextArtifact(artifact('text', { schema_version: 1, markdown: '**Answer**' }))).toEqual({ markdown: '**Answer**' });
    expect(parseTextArtifact(artifact('text', { markdown: '**Answer**' }))).toBeNull();
  });
});
