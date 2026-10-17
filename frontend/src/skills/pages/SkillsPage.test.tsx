import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillsPage } from './SkillsPage';

const state = vi.hoisted(() => ({ role: 'owner', items: [] as object[], create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock('../../organizations/OrganizationProvider', () => ({ useOrganization: () => ({ activeOrganization: { role: state.role } }) }));
vi.mock('../../components/notifications', () => ({ notifications: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../settings/hooks/useInstructions', () => ({
  useInstructions: () => ({ data: state.items }),
  useCreateInstruction: () => ({ mutateAsync: state.create }),
  useUpdateInstruction: () => ({ mutateAsync: state.update }),
  useDeleteInstruction: () => ({ mutateAsync: state.remove }),
}));
const template = { id: 's1', name: 'Retention', content: 'Use monthly cohorts', command: 'retention', enabled: true, is_default: false };

describe('Templates', () => {
  beforeEach(() => { state.role = 'owner'; state.items = []; vi.clearAllMocks(); });

  it('creates a template through the existing instructions API', async () => {
    render(<SkillsPage />);
    const user = userEvent.setup();
    expect(screen.getByRole('heading', { name: 'Templates' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New template' }));
    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0]!, 'Retention');
    await user.type(inputs[1]!, 'retention');
    await user.type(inputs[4]!, 'Use monthly cohorts');
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Retention', command: 'retention', content: 'Use monthly cohorts', enabled: true }));
  });

  it('preserves editing, disabling, defaulting and deleting existing templates', async () => {
    state.items = [template];
    render(<SkillsPage />);
    const user = userEvent.setup();
    expect(screen.getAllByText('/retention')).toHaveLength(2);
    await user.click(screen.getByTitle('Edit template'));
    expect(screen.getByRole('dialog', { name: 'Edit template' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Template enabled' }));
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(state.update).toHaveBeenCalledWith({ id: 's1', body: expect.objectContaining({ enabled: false }) });
    await user.click(screen.getByRole('button', { name: 'Make default' }));
    expect(state.update).toHaveBeenCalledWith({ id: 's1', body: { is_default: true, enabled: true } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByTitle('Delete template'));
    expect(state.remove).toHaveBeenCalledWith('s1');
  });

  it('allows members to view templates without management actions', () => {
    state.role = 'member'; state.items = [template];
    render(<SkillsPage />);
    expect(screen.getByText('Retention')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New template' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Edit template')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete template')).not.toBeInTheDocument();
  });
});
