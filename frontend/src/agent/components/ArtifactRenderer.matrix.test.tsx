import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import fixture from '../../../../test-fixtures/matrix.json';
import { ArtifactRenderer } from './ArtifactRenderer';
import type { JobArtifact, SqlExecution } from '../api/execution-api';

const artifact: JobArtifact = {
  id: 'matrix-view',
  job_id: 'job1',
  kind: 'matrix',
  name: fixture.spec.title,
  source_sql_execution_id: fixture.source_sql_execution_id,
  payload: fixture,
  created_at: '',
};
const source: SqlExecution = {
  id: fixture.source_sql_execution_id,
  tool_execution_id: 'tool1',
  data_source_id: 'ds1',
  sql_text: 'SELECT verified_result',
  status: 'succeeded',
  row_count: fixture.source_row_count,
  truncated: false,
  columns: ['division', 'category', 'period', 'amount', 'units'],
  result_bytes: 1000,
  duration_ms: 1,
  error_code: null,
  error_message: null,
  started_at: '',
  finished_at: '',
};

describe('matrix artifact integration', () => {
  beforeEach(() => localStorage.clear());
  it('renders the matrix with provenance and no dashboard action', () => {
    render(
      <MemoryRouter>
        <ArtifactRenderer jobId="job1" artifacts={[artifact]} sql={[source]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('region', { name: fixture.spec.title })).toBeInTheDocument();
    expect(screen.getByText('North')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save to dashboard' })).not.toBeInTheDocument();
  });
  it('refuses to render a matrix backed by a truncated source', () => {
    render(
      <MemoryRouter>
        <ArtifactRenderer
          jobId="job1"
          artifacts={[artifact]}
          sql={[{ ...source, truncated: true }]}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText('North')).not.toBeInTheDocument();
    expect(screen.getByText(/output cannot be displayed safely/)).toBeInTheDocument();
  });
});
