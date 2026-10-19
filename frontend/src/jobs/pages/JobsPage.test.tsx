import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from '../../api/types';
import { JobsPage } from './JobsPage';

const state = vi.hoisted(() => ({
  jobs: [] as Job[],
  managed: [] as { job: Job }[],
  cancel: vi.fn(),
  filter: vi.fn(),
}));
vi.mock('../../organizations/OrganizationProvider', () => ({
  useOrganization: () => ({ activeOrganization: { id: 'org1', role: 'owner' } }),
}));
vi.mock('../JobManagerProvider', () => ({
  useJobManager: () => ({
    jobs: state.managed,
    currentLabel: () => 'Retrieving the data…',
    cancel: state.cancel,
  }),
}));
vi.mock('../hooks/useJobs', () => ({
  useJobs: (status: string | undefined, limit: number) => {
    state.filter(status, limit);
    return {
      data: state.jobs,
      refetch: vi.fn(),
      isFetching: false,
      isLoading: false,
      isError: false,
    };
  },
}));
vi.mock('../../data-sources/api/data-source-api', () => ({
  listDataSources: async () => [{ id: 's1', name: 'Sales warehouse' }],
}));
const time = '2026-10-18T00:00:00Z';
function job(id: string, job_type: string, status: string): Job {
  return {
    id,
    job_type,
    status,
    organization_id: 'org1',
    requested_by: 'u1',
    input: {},
    result: null,
    conversation_id: null,
    attempt_count: 1,
    max_attempts: 3,
    error_code: null,
    error_message: null,
    cancel_requested_at: null,
    created_at: time,
    started_at: time,
    finished_at: time,
    duration_ms: 3000,
  };
}
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <JobsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  state.jobs = [
    { ...job('j1', 'chat_query', 'succeeded'), input: { question: 'Show regional backlog' } },
    {
      ...job('j2', 'datasource_test', 'failed'),
      input: { data_source_id: 's1' },
      error_message: 'Connection timed out.',
    },
    job('j3', 'knowledge_generation', 'running'),
  ];
  state.managed = [];
  state.cancel.mockResolvedValue(undefined);
});
describe('Jobs screen', () => {
  it('uses readable job names and searches questions and data-source names', async () => {
    const user = userEvent.setup();
    show();
    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeInTheDocument();
    expect(screen.getByText('Data analysis')).toBeInTheDocument();
    expect(screen.getByText('Schema refresh')).toBeInTheDocument();
    const search = screen.getByRole('searchbox', { name: 'Search jobs' });
    await user.type(search, 'regional');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Show regional backlog')).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'Sales warehouse');
    expect(await screen.findByText('Connection test')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });
  it('sends the backend status value when the Completed filter is selected', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('tab', { name: 'Completed' }));
    expect(state.filter).toHaveBeenLastCalledWith('succeeded', 100);
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Data analysis')).toBeInTheDocument();
  });
  it('uses live status updates over stale list records', () => {
    state.managed = [{ job: { ...state.jobs[2]!, status: 'succeeded' } }];
    show();
    const row = screen.getByText('Schema refresh').closest('article')!;
    expect(within(row).getByText('Completed')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /More actions/ })).not.toBeInTheDocument();
  });
  it('keeps cancel failures visible and leaves the running job available', async () => {
    state.cancel.mockRejectedValueOnce({ message: 'The job could not be cancelled.' });
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: 'More actions for Schema refresh' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancel job' }));
    expect(state.cancel).toHaveBeenCalledWith('j3');
    expect(await screen.findByRole('alert')).toHaveTextContent('The job could not be cancelled.');
    expect(screen.getByText('Schema refresh')).toBeInTheDocument();
  });
});
