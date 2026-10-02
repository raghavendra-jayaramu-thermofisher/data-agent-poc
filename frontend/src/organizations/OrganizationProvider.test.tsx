import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../test/server';
import { OrganizationProvider, useOrganization } from './OrganizationProvider';
import { getApiOrganizationId } from './organization-store';

vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));

const organizations = [
  { id: 'org-1', name: 'Alpha', slug: 'alpha', created_by: 'u1', role: 'owner', created_at: '2026-08-24T00:00:00Z', updated_at: '2026-08-24T00:00:00Z' },
  { id: 'org-2', name: 'Beta', slug: 'beta', created_by: 'u1', role: 'member', created_at: '2026-08-24T00:00:00Z', updated_at: '2026-08-24T00:00:00Z' },
];

function Probe() {
  const { activeOrganization, setActiveOrganization } = useOrganization();
  return <div><span>{activeOrganization?.name ?? 'none'}</span><button type="button" onClick={() => setActiveOrganization('org-2')}>Switch</button></div>;
}

describe('OrganizationProvider workspace isolation', () => {
  beforeEach(() => server.use(http.get('http://localhost:12201/api/v1/organizations', () => HttpResponse.json(organizations))));

  it('updates the request scope and clears organization-owned cached data on switch', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['data-sources', 'org-1', 'list'], [{ id: 'secret-from-alpha' }]);
    render(<QueryClientProvider client={queryClient}><OrganizationProvider><Probe/></OrganizationProvider></QueryClientProvider>);
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(getApiOrganizationId()).toBe('org-1');
    await userEvent.click(screen.getByRole('button', { name: 'Switch' }));
    expect(await screen.findByText('Beta')).toBeInTheDocument();
    await waitFor(() => expect(getApiOrganizationId()).toBe('org-2'));
    await waitFor(() => expect(queryClient.getQueryData(['data-sources', 'org-1', 'list'])).toBeUndefined());
  });
});
