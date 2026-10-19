import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { DataSourceDetailPage } from './DataSourceDetailPage';

const state = vi.hoisted(() => ({
  refetch: vi.fn(),
  source: {
    id: 's1',
    name: 'Sales',
    display_type: 'mssql',
    kind: 'mssql',
    config: {},
    status: 'error',
    created_at: '2026-10-04T00:00:00Z',
    last_tested_at: null,
    last_error_code: 'DATASOURCE_CONNECTION_TIMEOUT',
  },
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) =>
    queryKey.includes('schema')
      ? {
          isError: true,
          error: { message: 'The database connection timed out.' },
          refetch: state.refetch,
        }
      : { data: state.source },
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('../../organizations/OrganizationProvider', () => ({
  useOrganization: () => ({ activeOrganization: { id: 'org1', role: 'owner' } }),
}));
vi.mock('../../jobs/JobManagerProvider', () => ({
  useJobManager: () => ({ registerJob: vi.fn() }),
}));

describe('schema inspection failures', () => {
  it('shows the failure reason and retry instead of an empty schema', async () => {
    render(
      <MemoryRouter initialEntries={['/data-sources/s1']}>
        <Routes>
          <Route path="/data-sources/:dataSourceId" element={<DataSourceDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Unable to load schema')).toBeInTheDocument();
    expect(screen.getByText('The database connection timed out.')).toBeInTheDocument();
    expect(screen.queryByText('No tables were returned.')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry schema inspection' }));
    expect(state.refetch).toHaveBeenCalledOnce();
  });
});
