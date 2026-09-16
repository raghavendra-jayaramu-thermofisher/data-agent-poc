import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Job } from '../../api/types';
import { AnalysisFailure } from './AnalysisFailure';

const base: Job = {
  id: 'j1',
  organization_id: 'org-1',
  job_type: 'chat_query',
  status: 'failed',
  requested_by: 'u1',
  conversation_id: 'c1',
  input: {},
  result: null,
  attempt_count: 1,
  max_attempts: 3,
  cancel_requested_at: null,
  error_code: null,
  error_message: null,
  created_at: '2026-08-24T12:00:00Z',
  started_at: '2026-08-24T12:00:01Z',
  finished_at: '2026-08-24T12:00:02Z',
};

function renderFailure(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('analysis failure states', () => {
  it('renders cancelled jobs as a neutral stopped state', () => {
    renderFailure(<AnalysisFailure job={{ ...base, status: 'cancelled' }} />);
    expect(screen.getByText('Analysis stopped')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('analysis-outcome--stopped');
  });

  it('maps timeout and SQL safety codes to useful warning states', () => {
    const { rerender } = renderFailure(
      <AnalysisFailure job={{ ...base, error_code: 'QUERY_TIMEOUT' }} />,
    );
    expect(screen.getByText('This analysis took too long')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('analysis-outcome--warning');

    rerender(
      <MemoryRouter>
        <AnalysisFailure job={{ ...base, error_code: 'SQL_SAFETY_REJECTED' }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('This request could not be run safely')).toBeInTheDocument();
  });

  it('does not expose raw backend errors in the conversation', () => {
    renderFailure(
      <AnalysisFailure
        job={{
          ...base,
          error_code: 'AGENT_EXECUTION_FAILED',
          error_message: 'provider stack trace',
        }}
      />,
    );

    expect(screen.getByRole('alert')).toHaveClass('analysis-outcome--danger');
    expect(screen.getByText('We could not complete this analysis')).toBeInTheDocument();
    expect(screen.queryByText('provider stack trace')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute('href', '/jobs/j1');
  });
});
