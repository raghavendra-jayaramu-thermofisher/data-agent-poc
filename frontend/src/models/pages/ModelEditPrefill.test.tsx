import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ModelProfileDetailPage } from './ModelProfileDetailPage';
import { ModelConnectionDetailPage } from './ModelConnectionDetailPage';
const state = vi.hoisted(() => ({
  updateProfile: vi.fn().mockResolvedValue({}),
  updateConnection: vi.fn().mockResolvedValue({}),
  profile: { id: 'p1', connection_id: 'c1', display_name: 'Saved Model', model_name: 'saved-model-id', enabled: true, is_default: true, settings: { temperature: 0.7, max_tokens: 8000 } },
  connection: { id: 'c1', name: 'Saved Provider', base_url: 'https://provider.example/v1', has_api_key: true, status: 'active' },
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryFn }: { queryFn: () => unknown }) => ({ data: queryFn(), refetch: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn() }),
}));
vi.mock('../../organizations/OrganizationProvider', () => ({ useOrganization: () => ({ activeOrganization: { id: 'org1', role: 'owner' } }) }));
vi.mock('../api/models-api', () => ({ getProfile: () => state.profile, getConnection: () => state.connection, listConnections: () => [state.connection], updateProfile: state.updateProfile, updateConnection: state.updateConnection }));
vi.mock('../../components/ConfirmationDialog', () => ({ ConfirmationDialog: () => null }));
function show(kind: 'profiles' | 'connections') {
  return render(<MemoryRouter initialEntries={[`/models/${kind}/1`]}><Routes><Route path="/models/profiles/:profileId" element={<ModelProfileDetailPage />} /><Route path="/models/connections/:connectionId" element={<ModelConnectionDetailPage />} /></Routes></MemoryRouter>);
}
describe('saved model edit values', () => {
  it('saves edits and allows optional settings to be cleared', async () => {
    const user = userEvent.setup();
    show('profiles');
    await user.clear(screen.getByLabelText('Display Name'));
    await user.type(screen.getByLabelText('Display Name'), 'Updated Model');
    await user.clear(screen.getByLabelText('Temperature'));
    await user.click(screen.getByRole('button', { name: 'Save Profile Changes' }));
    await waitFor(() => expect(state.updateProfile).toHaveBeenCalledWith('p1', expect.objectContaining({ display_name: 'Updated Model', model_name: 'saved-model-id', settings: { max_tokens: 8000 } })));
  });
  it('saves the prefilled connection while preserving its stored key', async () => {
    const user = userEvent.setup();
    show('connections');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(state.updateConnection).toHaveBeenCalledWith('c1', { name: 'Saved Provider', base_url: 'https://provider.example/v1', clear_api_key: false }));
  });
  it('prefills the model profile inputs', () => {
    show('profiles');
    expect(screen.getByLabelText('Display Name')).toHaveValue('Saved Model');
    expect(screen.getByLabelText('Model Identifier')).toHaveValue('saved-model-id');
    expect(screen.getByLabelText('Temperature')).toHaveValue(0.7);
    expect(screen.getByLabelText('Max Tokens')).toHaveValue(8000);
  });
  it('prefills the connection name and endpoint while leaving the replacement key empty', () => {
    show('connections');
    expect(screen.getByLabelText('Connection Name')).toHaveValue('Saved Provider');
    expect(screen.getByLabelText('Base URL')).toHaveValue('https://provider.example/v1');
    expect(screen.getByLabelText('Replace API Key')).toHaveValue('');
  });
});
