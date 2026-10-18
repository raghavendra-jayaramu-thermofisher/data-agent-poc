import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { JobArtifact, SqlExecution } from '../../agent/api/execution-api';
import { AssistantResponseRenderer } from './AssistantResponseRenderer';

const artifactRenders = vi.hoisted(() => vi.fn());
vi.mock('../../agent/components/ArtifactRenderer', () => ({
  ArtifactRenderer: ({ artifacts }: { artifacts: JobArtifact[] }) => {
    artifactRenders();
    return <div data-testid="inline-chart">{artifacts[0]?.name}</div>;
  },
}));

describe('growing answer rendering', () => {
  it('keeps an existing artifact stable as text is appended and defers navigation', () => {
    artifactRenders.mockClear();
    const artifactId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const artifacts = [
      {
        id: artifactId,
        kind: 'chart',
        name: 'Orders by region',
        job_id: 'j1',
        source_sql_execution_id: 's1',
        payload: {},
        created_at: '',
      },
    ];
    const sql: SqlExecution[] = [];
    const sourceNames = { ds1: 'Warehouse' };
    const initial = `## Summary\n\nOrders increased.\n\n[[artifact:${artifactId}]]`;
    const props = { jobId: 'j1', artifacts, sql, dataSourceNames: sourceNames, streaming: true };
    const { rerender } = render(
      <MemoryRouter>
        <AssistantResponseRenderer {...props} markdown={initial} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('inline-chart')).toHaveTextContent('Orders by region');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <AssistantResponseRenderer
          {...props}
          markdown={initial + '\n\n## Detail\n\nNew findings arrived.'}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('New findings arrived.')).toBeInTheDocument();
    expect(artifactRenders).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/\[\[artifact/)).not.toBeInTheDocument();
  });
});
