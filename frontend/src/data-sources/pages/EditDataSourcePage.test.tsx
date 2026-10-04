import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditDataSourcePage } from './EditDataSourcePage';

const state = vi.hoisted(() => ({
  role: 'owner',
  update: vi.fn(),
  test: vi.fn(),
  register: vi.fn(),
  invalidate: vi.fn(),
  remove: vi.fn(),
  source: {
    id: 's1',
    name: 'Sales Data',
    kind: 'postgres',
    display_type: 'postgres',
    status: 'active',
    config: {
      host: 'db',
      port: 5432,
      database: 'sales',
      schema_name: 'public',
      ssl_mode: 'prefer',
    },
  },
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: state.source }),
  useQueryClient: () => ({ invalidateQueries: state.invalidate, removeQueries: state.remove }),
}));
vi.mock('../../organizations/OrganizationProvider', () => ({
  useOrganization: () => ({ activeOrganization: { id: 'org1', role: state.role } }),
}));
vi.mock('../../jobs/JobManagerProvider', () => ({
  useJobManager: () => ({ registerJob: state.register }),
}));
vi.mock('../../components/notifications', () => ({
  notifications: { success: vi.fn(), info: vi.fn() },
}));
vi.mock('../api/data-source-api', () => ({
  getDataSource: vi.fn(),
  updateDataSource: state.update,
  testDataSource: state.test,
}));

function show() {
  render(
    <MemoryRouter initialEntries={['/data-sources/s1/edit']}>
      <Routes>
        <Route path="/data-sources/:dataSourceId/edit" element={<EditDataSourcePage />} />
        <Route path="/data-sources/:dataSourceId" element={<div>Source details</div>} />
        <Route path="/jobs/:jobId" element={<div>Connection test result</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('connection edit workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.role = 'owner';
    state.update.mockResolvedValue(state.source);
    state.test.mockResolvedValue({ job_id: 'j1' });
  });
  it('saves before starting and registering a test, then opens its result', async () => {
    show();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save & Test Connection' }));
    expect(await screen.findByText('Connection test result')).toBeInTheDocument();
    expect(state.update).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ name: 'Sales Data' }),
    );
    expect(state.test).toHaveBeenCalledWith('s1');
    expect(state.register).toHaveBeenCalledWith('j1');
    expect(state.update.mock.invocationCallOrder[0]).toBeLessThan(
      state.test.mock.invocationCallOrder[0]!,
    );
  });
  it('distinguishes saved changes from a test that could not start', async () => {
    state.test.mockRejectedValueOnce(new Error('Queue unavailable'));
    show();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save & Test Connection' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Changes saved, but the connection test could not be started: Queue unavailable',
    );
    expect(state.register).not.toHaveBeenCalled();
  });
  it('saves and clears cached schema after a connection edit without testing', async () => {
    show();
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Host' }), '.example.com');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Source details')).toBeInTheDocument();
    expect(state.remove).toHaveBeenCalled();
    expect(state.test).not.toHaveBeenCalled();
  });
  it('keeps editing restricted to owners and admins', () => {
    state.role = 'member';
    show();
    expect(screen.getByText('Permission required')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });
});
