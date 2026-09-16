import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManagedJob } from '../../jobs/types';
import { AnalysisProgress } from './AnalysisProgress';

const managedJob: ManagedJob = {
  job: {
    id: 'job-1',
    organization_id: 'org-1',
    job_type: 'chat_query',
    status: 'running',
    requested_by: 'user-1',
    conversation_id: 'conversation-1',
    input: {},
    result: null,
    attempt_count: 1,
    max_attempts: 3,
    cancel_requested_at: null,
    error_code: null,
    error_message: null,
    created_at: '2026-09-16T12:00:00.000Z',
    started_at: '2026-09-16T12:00:02.000Z',
    finished_at: null,
  },
  events: [
    { sequence: 1, event_type: 'job.queued', level: 'info', payload: {}, created_at: '2026-09-16T12:00:00.000Z' },
    { sequence: 2, event_type: 'job.started', level: 'info', payload: {}, created_at: '2026-09-16T12:00:02.000Z' },
    { sequence: 3, event_type: 'agent.started', level: 'info', payload: {}, created_at: '2026-09-16T12:00:03.000Z' },
    { sequence: 4, event_type: 'sql.started', level: 'info', payload: {}, created_at: '2026-09-16T12:00:05.000Z' },
  ],
  lastSeenSequence: 4,
  connectionState: 'connected',
};

describe('AnalysisProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T12:00:08.000Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('shows event progress and updates elapsed time every second', () => {
    render(<AnalysisProgress managedJob={managedJob} onCancel={() => undefined} />);

    expect(screen.getByText('Analyzing your data')).toBeInTheDocument();
    expect(screen.getByText('Executing SQL…')).toBeInTheDocument();
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getByLabelText('8 seconds elapsed')).toHaveTextContent('8s');

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByLabelText('10 seconds elapsed')).toHaveTextContent('10s');
  });

  it('uses a clear stop action and prevents repeated cancellation', () => {
    const onCancel = vi.fn(async () => undefined);
    render(<AnalysisProgress managedJob={managedJob} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Stopping…' })).toBeDisabled();
  });
});
