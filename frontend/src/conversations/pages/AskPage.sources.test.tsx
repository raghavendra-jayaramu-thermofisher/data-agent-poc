import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { preferences } from '../../lib/preferences';
import { AskPage } from './AskPage';

const state = vi.hoisted(() => ({ orgId: 'org1', userId: 'u1', sources: [] as { id: string; name: string; status: string; display_type: string }[] }));
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: state.userId, email: 'user@example.com' } }) }));
vi.mock('../../organizations/OrganizationProvider', () => ({ useOrganization: () => ({ activeOrganization: { id: state.orgId } }) }));
vi.mock('../../settings/hooks/useInstructions', () => ({ useInstructions: () => ({ data: [] }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: ({ queryKey }: { queryKey: string[] }) => ({ data: queryKey[0] === 'data-sources' ? state.sources : [], isLoading: false, isError: false }) }));

function showPage() { return render(<MemoryRouter><AskPage /></MemoryRouter>); }
const warehouse = { id: 'ds1', name: 'Warehouse', status: 'active', display_type: 'postgres' };
const sales = { ...warehouse, id: 'ds2', name: 'Sales' };

describe('Ask source defaults', () => {
  beforeEach(() => { state.orgId = 'org1'; state.userId = 'u1'; state.sources = [warehouse]; });

  it('automatically selects the only active source and enables sending', async () => {
    state.sources = [warehouse, { ...sales, status: 'inactive' }];
    showPage();
    expect(screen.getByRole('button', { name: 'Warehouse' })).toBeInTheDocument();
    await userEvent.setup().type(screen.getByRole('textbox', { name: 'Ask a question' }), 'Revenue?');
    expect(screen.getByRole('button', { name: 'Send question' })).toBeEnabled();
  });

  it('remembers multiple selections when a new chat is mounted', async () => {
    state.sources = [warehouse, sales];
    showPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Select data source' }));
    await user.click(screen.getByRole('button', { name: /Warehouse.*postgres/ }));
    await user.click(screen.getByRole('button', { name: /Sales.*postgres/ }));
    cleanup();
    showPage();
    expect(screen.getByRole('button', { name: '2 sources' })).toBeInTheDocument();
    cleanup();
    state.orgId = 'org2';
    showPage();
    expect(screen.getByRole('button', { name: 'Select data source' })).toBeInTheDocument();
    cleanup();
    state.orgId = 'org1'; state.userId = 'u2';
    showPage();
    expect(screen.getByRole('button', { name: 'Select data source' })).toBeInTheDocument();
  });

  it('filters unavailable remembered sources and handles no active sources', () => {
    preferences.set('askDataSourceIdsByScope', { [JSON.stringify(['u1', 'org1'])]: ['ds1', 'removed'] });
    state.sources = [warehouse, sales];
    const page = showPage();
    expect(screen.getByRole('button', { name: 'Warehouse' })).toBeInTheDocument();
    state.sources = [];
    page.rerender(<MemoryRouter><AskPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Select data source' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled();
  });

  it('isolates remembered tables by user and workspace and restores them when a source is reselected', async () => {
    const scope = JSON.stringify(['u1', 'org1']);
    preferences.set('askDataSourceIdsByScope', { [scope]: ['ds1'] });
    preferences.set('askTableSelectionsByScope', {
      [scope]: [
        { data_source_id: 'ds1', mode: 'selected', tables: [{ schema: 'dbo', name: 'orders' }] },
        { data_source_id: 'removed', mode: 'selected', tables: [{ schema: 'dbo', name: 'old_table' }] },
      ],
    });
    state.sources = [warehouse, sales];
    showPage();
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Tables: orders' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Warehouse' }));
    await user.click(screen.getByRole('button', { name: /Warehouse.*postgres/ }));
    await user.click(screen.getByRole('button', { name: /Sales.*postgres/ }));
    await user.click(document.body);
    expect(screen.getByRole('button', { name: 'Tables: All tables' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sales' }));
    await user.click(screen.getByRole('button', { name: /Sales.*postgres/ }));
    await user.click(screen.getByRole('button', { name: /Warehouse.*postgres/ }));
    await user.click(document.body);
    expect(screen.getByRole('button', { name: 'Tables: orders' })).toBeInTheDocument();
    cleanup();
    state.sources = [warehouse];
    state.orgId = 'org2';
    showPage();
    expect(screen.getByRole('button', { name: 'Tables: All tables' })).toBeInTheDocument();
    cleanup();
    state.orgId = 'org1'; state.userId = 'u2';
    showPage();
    expect(screen.getByRole('button', { name: 'Tables: All tables' })).toBeInTheDocument();
    cleanup();
    state.userId = 'u1';
    showPage();
    expect(screen.getByRole('button', { name: 'Tables: orders' })).toBeInTheDocument();
  });
});
