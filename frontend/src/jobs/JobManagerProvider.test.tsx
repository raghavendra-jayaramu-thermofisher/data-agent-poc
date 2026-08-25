import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from '../api/types';
import type { JobEvent } from './types';
const api = vi.hoisted(() => ({ listJobs: vi.fn(), getJob: vi.fn(), cancelJob: vi.fn() }));
const stream = vi.hoisted(() => ({
    callbacks: new Map<string, {
        onEvent(event: JobEvent): void;
        onError(error: unknown): void;
        onOpen(): void;
    }>(),
    fn: vi.fn(async (options: {
        jobId: string;
    }) => {
        stream.callbacks.set(options.jobId, options as never);
        await new Promise<void>(() => undefined);
    }),
}));
vi.mock('../organizations/OrganizationProvider', () => ({ useOrganization: () => ({ activeOrganization: { id: 'org-1', name: 'Org', role: 'owner' } }) }));
vi.mock('./api/jobs-api', () => api);
vi.mock('./sse/job-stream', () => ({ streamJobEvents: stream.fn }));
import { JobManagerProvider, useJobManager } from './JobManagerProvider';
const baseJob: Job = { id: 'j1', organization_id: 'org-1', job_type: 'knowledge_generation', status: 'running', requested_by: 'u1', conversation_id: null, input: { data_source_id: 'ds1' }, result: null, attempt_count: 1, max_attempts: 3, cancel_requested_at: null, error_code: null, error_message: null, created_at: '2026-08-24T12:00:00Z', started_at: '2026-08-24T12:00:01Z', finished_at: null };
function Probe() {
    const manager = useJobManager();
    return <div><span data-testid="count">{manager.activeJobs.length}</span><span data-testid="event">{manager.latestEvent('j1')?.sequence ?? 0}</span><button onClick={() => void manager.cancel('j1')}>Cancel</button></div>;
}
function renderManager(ui: ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const rendered = render(<QueryClientProvider client={client}><JobManagerProvider>{ui}</JobManagerProvider></QueryClientProvider>);
    return { ...rendered, client };
}
describe('global job manager', () => {
    beforeEach(() => {
        api.listJobs.mockReset();
        api.getJob.mockReset();
        api.cancelJob.mockReset();
        stream.fn.mockClear();
        stream.callbacks.clear();
        api.listJobs.mockImplementation(async (status?: string) => status === 'running' ? [baseJob] : []);
        api.getJob.mockResolvedValue(baseJob);
        api.cancelJob.mockResolvedValue({ ...baseJob, status: 'cancelled', finished_at: '2026-08-24T12:00:05Z' });
    });
    it('restores active jobs and opens a single shared stream', async () => {
        renderManager(<Probe />);
        await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
        await waitFor(() => expect(stream.fn).toHaveBeenCalledTimes(1));
        expect(stream.fn.mock.calls[0][0].afterSequence).toBe(0);
    });
    it('deduplicates replayed events by sequence and treats disconnect as reconnecting, not failure', async () => {
        renderManager(<Probe />);
        await waitFor(() => expect(stream.callbacks.has('j1')).toBe(true));
        const cb = stream.callbacks.get('j1')!;
        const event: JobEvent = { sequence: 7, event_type: 'knowledge.schema.inspected', level: 'info', payload: {}, created_at: '2026-08-24T12:00:02Z' };
        act(() => { cb.onEvent(event); cb.onEvent(event); cb.onError(new Error('network')); });
        expect(screen.getByTestId('event')).toHaveTextContent('7');
        expect(screen.getByTestId('count')).toHaveTextContent('1');
    });
    it('invalidates durable conversation data when a chat job reaches a terminal event', async () => {
        const chatJob: Job = { ...baseJob, job_type: 'chat_query', conversation_id: 'c1', input: {}, status: 'running' };
        const completed: Job = { ...chatJob, status: 'succeeded', finished_at: '2026-08-24T12:00:05Z' };
        api.listJobs.mockImplementation(async (status?: string) => status === 'running' ? [chatJob] : []);
        api.getJob.mockResolvedValue(completed);
        const { client } = renderManager(<Probe />);
        client.setQueryData(['conversations', 'org-1', 'messages', 'c1'], [{ id: 'm1' }]);
        client.setQueryData(['jobs', 'org-1', 'execution', 'j1'], { tools: [], sql: [], models: [], artifacts: [] });
        await waitFor(() => expect(stream.callbacks.has('j1')).toBe(true));
        const cb = stream.callbacks.get('j1')!;
        act(() => cb.onEvent({ sequence: 9, event_type: 'job.completed', level: 'info', payload: {}, created_at: '2026-08-24T12:00:05Z' }));
        await waitFor(() => expect(client.getQueryState(['conversations', 'org-1', 'messages', 'c1'])?.isInvalidated).toBe(true));
        expect(client.getQueryState(['jobs', 'org-1', 'execution', 'j1'])?.isInvalidated).toBe(true);
    });

    it('invalidates dashboard queries when a dashboard refresh reaches a terminal event', async () => {
        const refreshJob: Job = { ...baseJob, job_type: 'dashboard_refresh', input: { dashboard_id: 'd1' }, status: 'running' };
        const completed: Job = { ...refreshJob, status: 'succeeded', finished_at: '2026-08-24T12:00:05Z' };
        api.listJobs.mockImplementation(async (status?: string) => status === 'running' ? [refreshJob] : []);
        api.getJob.mockResolvedValue(completed);
        const { client } = renderManager(<Probe />);
        client.setQueryData(['dashboards', 'org-1', 'detail', 'd1'], { id: 'd1' });
        await waitFor(() => expect(stream.callbacks.has('j1')).toBe(true));
        act(() => stream.callbacks.get('j1')!.onEvent({ sequence: 10, event_type: 'job.completed', level: 'info', payload: {}, created_at: '2026-08-24T12:00:05Z' }));
        await waitFor(() => expect(client.getQueryState(['dashboards', 'org-1', 'detail', 'd1'])?.isInvalidated).toBe(true));
    });

    it('cancels through the durable job API', async () => {
        renderManager(<Probe />);
        await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
        screen.getByRole('button', { name: 'Cancel' }).click();
        await waitFor(() => expect(api.cancelJob).toHaveBeenCalledWith('j1'));
    });
});
