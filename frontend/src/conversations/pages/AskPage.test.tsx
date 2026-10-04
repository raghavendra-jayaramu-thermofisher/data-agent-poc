import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

const createConversation = vi.hoisted(() => vi.fn());
vi.mock('../../settings/hooks/useInstructions', () => ({ useInstructions: () => ({ data: [] }) }));

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ user: { display_name: 'Alex', email: 'alex@example.com' } }),
}));
vi.mock('../../organizations/OrganizationProvider', () => ({
  useOrganization: () => ({ activeOrganization: { id: 'org1' } }),
}));
vi.mock('../../data-sources/api/data-source-api', () => ({
  listDataSources: async () => [
    {
      id: 'ds1',
      organization_id: 'org1',
      name: 'Warehouse',
      kind: 'postgres',
      display_type: 'postgres',
      status: 'active',
      config: {},
      created_by: 'u1',
      last_tested_at: null,
      last_error_code: null,
      created_at: '2026-08-24T12:00:00Z',
      updated_at: '2026-08-24T12:00:00Z',
      active_file: null,
    },
  ],
}));
vi.mock('../../models/api/models-api', () => ({ listProfiles: async () => [] }));
vi.mock('../api/conversation-api', () => ({ createConversation }));

import { AskPage } from './AskPage';

describe('new analysis screen', () => {
  it('centers a personal welcome and fixes the chosen source when creating the conversation', async () => {
    createConversation.mockResolvedValue({ id: 'c1' });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/ask']}>
          <Routes>
            <Route path="/ask" element={<AskPage />} />
            <Route path="/conversations/:conversationId" element={<div>Conversation started</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Hi Alex')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'What would you like to know about your data?' }),
    ).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Ask a question' }), 'Show revenue');
    expect(screen.getByRole('button', { name: /warehouse/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send question' }));

    await waitFor(() =>
      expect(createConversation).toHaveBeenCalledWith({
        data_source_ids: ['ds1'],
        model_profile_id: null,
        title: 'Show revenue',
      }),
    );
    expect(await screen.findByText('Conversation started')).toBeInTheDocument();
  });
});
