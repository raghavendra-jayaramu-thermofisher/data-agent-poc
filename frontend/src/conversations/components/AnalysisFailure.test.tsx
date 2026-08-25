import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Job } from '../../api/types';
import { AnalysisFailure } from './AnalysisFailure';

const base: Job = { id: 'j1', organization_id: 'org-1', job_type: 'chat_query', status: 'failed', requested_by: 'u1', conversation_id: 'c1', input: {}, result: null, attempt_count: 1, max_attempts: 3, cancel_requested_at: null, error_code: null, error_message: null, created_at: '2026-08-24T12:00:00Z', started_at: '2026-08-24T12:00:01Z', finished_at: '2026-08-24T12:00:02Z' };

describe('analysis failure states', () => {
  it('distinguishes cancelled jobs from failures', () => {
    render(<AnalysisFailure job={{ ...base, status: 'cancelled' }}/>);
    expect(screen.getByText('Analysis cancelled')).toBeInTheDocument();
  });
  it('maps timeout and SQL safety codes to useful categories', () => {
    const { rerender } = render(<AnalysisFailure job={{ ...base, error_code: 'QUERY_TIMEOUT' }}/>);
    expect(screen.getByText('Query timed out')).toBeInTheDocument();
    rerender(<AnalysisFailure job={{ ...base, error_code: 'SQL_SAFETY_REJECTED' }}/>);
    expect(screen.getByText('SQL rejected for safety')).toBeInTheDocument();
  });
});
