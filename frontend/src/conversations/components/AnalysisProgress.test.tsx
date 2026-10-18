import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
    {
      sequence: 1,
      event_type: 'job.queued',
      level: 'info',
      payload: {},
      created_at: '2026-09-16T12:00:00.000Z',
    },
    {
      sequence: 2,
      event_type: 'job.started',
      level: 'info',
      payload: {},
      created_at: '2026-09-16T12:00:02.000Z',
    },
    {
      sequence: 3,
      event_type: 'agent.started',
      level: 'info',
      payload: {},
      created_at: '2026-09-16T12:00:03.000Z',
    },
    {
      sequence: 4,
      event_type: 'sql.started',
      level: 'info',
      payload: {},
      created_at: '2026-09-16T12:00:05.000Z',
    },
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

  it('shows only the current step by default and updates elapsed time without expanding logs', () => {
    render(<AnalysisProgress managedJob={managedJob} onCancel={() => undefined} />);

    expect(screen.getByText('Retrieving the data…')).toBeInTheDocument();
    expect(screen.queryByText('Waiting to start')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Analysis activity' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show analysis activity' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
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

  it('expands the full event history, preserving repeated labels and fixed event times', () => {
    const completedSqlJob: ManagedJob = {
      ...managedJob,
      events: [
        ...managedJob.events,
        {
          sequence: 5,
          event_type: 'sql.completed',
          level: 'info',
          payload: { sql_execution_id: 'sql-1', duration_ms: 53 },
          created_at: '2026-09-16T12:00:05.100Z',
        },
        {
          sequence: 6,
          event_type: 'tool.completed',
          level: 'info',
          payload: { tool_execution_id: 'tool-1' },
          created_at: '2026-09-16T12:00:05.200Z',
        },
        {
          sequence: 7,
          event_type: 'sql.started',
          level: 'info',
          payload: {},
          created_at: '2026-09-16T12:00:06.000Z',
        },
        {
          sequence: 8,
          event_type: 'finalization.started',
          level: 'info',
          payload: {},
          created_at: '2026-09-16T12:00:07.000Z',
        },
      ],
      lastSeenSequence: 8,
    };

    render(<AnalysisProgress managedJob={completedSqlJob} onCancel={() => undefined} />);

    expect(screen.getByRole('status')).toHaveTextContent('Putting your answer together…');
    fireEvent.click(screen.getByRole('button', { name: 'Show analysis activity' }));
    const history = screen.getByRole('region', { name: 'Analysis activity' });
    expect(within(history).getAllByRole('listitem')).toHaveLength(8);
    expect(within(history).getAllByText('Retrieving the data…')).toHaveLength(2);
    expect(within(history).getByText('Waiting to start')).toBeInTheDocument();
    expect(within(history).getByText('Data retrieved').closest('li')).toHaveTextContent('5s');

    act(() => vi.advanceTimersByTime(5000));
    expect(within(history).getByText('Data retrieved').closest('li')).toHaveTextContent('5s');
    fireEvent.click(screen.getByRole('button', { name: 'Hide analysis activity' }));
    expect(screen.queryByRole('region', { name: 'Analysis activity' })).not.toBeInTheDocument();
  });

  it('follows real incoming steps without inventing an answer preparation phase', () => {
    const { rerender } = render(
      <AnalysisProgress managedJob={managedJob} onCancel={() => undefined} />,
    );
    rerender(
      <AnalysisProgress
        managedJob={{
          ...managedJob,
          events: [
            ...managedJob.events,
            {
              sequence: 5,
              event_type: 'sql.completed',
              level: 'info',
              payload: {},
              created_at: '2026-09-16T12:00:06.000Z',
            },
          ],
        }}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Data retrieved');
    expect(screen.queryByText('Preparing answer…')).not.toBeInTheDocument();
  });

  it('handles a queued job without events', () => {
    render(
      <AnalysisProgress
        managedJob={{ ...managedJob, job: { ...managedJob.job, status: 'queued' }, events: [] }}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Waiting to start');
    fireEvent.click(screen.getByRole('button', { name: 'Show analysis activity' }));
    expect(screen.getByText('Waiting for activity…')).toBeInTheDocument();
  });

  it('offers retry after cancellation fails', async () => {
    const onCancel = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    render(<AnalysisProgress managedJob={managedJob} onCancel={onCancel} />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Stop' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not stop the analysis');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Stop' })));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('includes unrecognized events without displaying raw payloads', () => {
    render(
      <AnalysisProgress
        managedJob={{
          ...managedJob,
          events: [
            {
              sequence: 1,
              event_type: 'internal.trace',
              level: 'info',
              payload: { secret: 'private-value' },
              created_at: managedJob.job.created_at,
            },
          ],
        }}
        onCancel={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show analysis activity' }));
    expect(within(screen.getByRole('region', { name: 'Analysis activity' })).getByText('Working on your request…')).toBeInTheDocument();
    expect(screen.queryByText('private-value')).not.toBeInTheDocument();
  });
});
