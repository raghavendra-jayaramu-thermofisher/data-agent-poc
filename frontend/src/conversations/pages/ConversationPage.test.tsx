import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../test/server';
import type { ManagedJob } from '../../jobs/types';

const manager = vi.hoisted(() => ({ jobs: [] as ManagedJob[], registerJob: vi.fn(async () => undefined), cancel: vi.fn(async () => undefined) }));
vi.mock('../../organizations/OrganizationProvider', () => ({ useOrganization: () => ({ activeOrganization: { id: 'org-1', name: 'Org', role: 'owner' } }) }));
vi.mock('../../jobs/JobManagerProvider', () => ({ useJobManager: () => ({ ...manager, activeJobs: manager.jobs.filter((entry) => entry.job.status === 'running' || entry.job.status === 'queued'), latestEvent: () => undefined, currentLabel: () => null, isLoading: false }) }));

import { ConversationPage } from './ConversationPage';

const conversation = { id: 'c1', organization_id: 'org-1', title: 'Revenue analysis', created_by: 'u1', model_profile_id: null, data_source_ids: ['ds1'], created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };
const source = { id: 'ds1', organization_id: 'org-1', name: 'Warehouse', kind: 'postgres', display_type: 'postgres', status: 'active', config: {}, created_by: 'u1', last_tested_at: null, last_error_code: null, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z', active_file: null };

function renderPage(state?: object) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[{ pathname: '/conversations/c1', state }]}><Routes><Route path="/conversations/:conversationId" element={<ConversationPage/>}/><Route path="/ask" element={<div>Ask page</div>}/></Routes></MemoryRouter></QueryClientProvider>);
  return client;
}

function baseHandlers(messageProvider: () => unknown[] = () => []) {
  server.use(
    http.get('http://localhost:8000/api/v1/conversations/c1', () => HttpResponse.json({ ...conversation, messages: [] })),
    http.get('http://localhost:8000/api/v1/conversations/c1/messages', () => HttpResponse.json(messageProvider())),
    http.get('http://localhost:8000/api/v1/conversations', () => HttpResponse.json([conversation])),
    http.get('http://localhost:8000/api/v1/data-sources', () => HttpResponse.json([source])),
    http.get('http://localhost:8000/api/v1/jobs/:jobId/execution', () => HttpResponse.json({ tools: [], sql: [], models: [], artifacts: [] })),
  );
}

describe('durable conversation workspace', () => {
  beforeEach(() => { manager.jobs = []; manager.registerJob.mockClear(); manager.cancel.mockClear(); });

  it('submits the pending first question once, renders the durable user ID immediately, and registers its global job', async () => {
    baseHandlers();
    let submissions = 0;
    server.use(http.post('http://localhost:8000/api/v1/conversations/c1/messages', async ({ request }) => {
      submissions += 1;
      expect(await request.json()).toEqual({ content: 'Why did revenue fall?', model_profile_id: null });
      return HttpResponse.json({ message_id: 'm-durable', job_id: 'j-chat' }, { status: 202 });
    }));
    renderPage({ pendingQuestion: 'Why did revenue fall?', modelProfileId: null });
    expect(await screen.findByText('Why did revenue fall?')).toBeInTheDocument();
    await waitFor(() => expect(manager.registerJob).toHaveBeenCalledWith('j-chat'));
    expect(submissions).toBe(1);
    expect(document.querySelector('[data-message-id="m-durable"]')).not.toBeNull();
  });

  it('refetches and renders the persisted assistant answer after query reconciliation', async () => {
    let completed = false;
    baseHandlers(() => completed ? [
      { id: 'm1', conversation_id: 'c1', role: 'user', content: 'Revenue?', job_id: 'j1', metadata: {}, created_at: '2026-08-24T12:00:00Z' },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', content: '**Revenue declined 8%.**', job_id: 'j1', metadata: {}, created_at: '2026-08-24T12:00:03Z' },
    ] : [{ id: 'm1', conversation_id: 'c1', role: 'user', content: 'Revenue?', job_id: 'j1', metadata: {}, created_at: '2026-08-24T12:00:00Z' }]);
    const client = renderPage();
    expect(await screen.findByText('Revenue?')).toBeInTheDocument();
    completed = true;
    await client.invalidateQueries({ queryKey: ['conversations', 'org-1', 'messages', 'c1'] });
    expect(await screen.findByText('Revenue declined 8%.')).toBeInTheDocument();
  });

  it('creates an independent durable job for a follow-up without waiting for an earlier answer', async () => {
    baseHandlers(() => [{ id: 'm1', conversation_id: 'c1', role: 'user', content: 'Initial question', job_id: 'j1', metadata: {}, created_at: '2026-08-24T12:00:00Z' }]);
    server.use(http.post('http://localhost:8000/api/v1/conversations/c1/messages', async ({ request }) => {
      expect(await request.json()).toEqual({ content: 'Now compare enterprise customers.', model_profile_id: null });
      return HttpResponse.json({ message_id: 'm-follow', job_id: 'j-follow' }, { status: 202 });
    }));
    renderPage();
    const user = userEvent.setup();
    const input = await screen.findByRole('textbox', { name: 'Ask a follow-up' });
    await user.type(input, 'Now compare enterprise customers.');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Now compare enterprise customers.')).toBeInTheDocument();
    await waitFor(() => expect(manager.registerJob).toHaveBeenCalledWith('j-follow'));
  });

  it('keeps a running analysis alive when live updates are reconnecting', async () => {
    baseHandlers();
    manager.jobs = [{
      job: { id: 'j1', organization_id: 'org-1', job_type: 'chat_query', status: 'running', requested_by: 'u1', conversation_id: 'c1', input: {}, result: null, attempt_count: 1, max_attempts: 3, cancel_requested_at: null, error_code: null, error_message: null, created_at: '2026-08-24T12:00:00Z', started_at: '2026-08-24T12:00:01Z', finished_at: null },
      events: [{ sequence: 2, event_type: 'sql.started', level: 'info', payload: {}, created_at: '2026-08-24T12:00:02Z' }],
      lastSeenSequence: 2,
      connectionState: 'reconnecting',
    }];
    renderPage();
    expect(await screen.findByText('Executing SQL…')).toBeInTheDocument();
    expect(screen.getByText(/backend job is still running/i)).toBeInTheDocument();
    expect(screen.queryByText(/analysis failed/i)).not.toBeInTheDocument();
  });

  it('shows a safe failed-job state without rendering hidden event payloads', async () => {
    baseHandlers();
    manager.jobs = [{
      job: { id: 'j1', organization_id: 'org-1', job_type: 'chat_query', status: 'failed', requested_by: 'u1', conversation_id: 'c1', input: {}, result: null, attempt_count: 1, max_attempts: 3, cancel_requested_at: null, error_code: 'QUERY_TIMEOUT', error_message: 'The query exceeded the allowed duration.', created_at: '2026-08-24T12:00:00Z', started_at: '2026-08-24T12:00:01Z', finished_at: '2026-08-24T12:00:05Z' },
      events: [{ sequence: 1, event_type: 'tool.started', level: 'info', payload: { hidden_prompt: 'SECRET_REASONING' }, created_at: '2026-08-24T12:00:01Z' }],
      lastSeenSequence: 1,
      connectionState: 'closed',
    }];
    renderPage();
    expect(await screen.findByText('Query timed out')).toBeInTheDocument();
    expect(screen.queryByText('SECRET_REASONING')).not.toBeInTheDocument();
  });
});
