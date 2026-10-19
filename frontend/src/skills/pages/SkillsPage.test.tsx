import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentInstruction } from '../../settings/api/instructions-api';
import { SkillsPage } from './SkillsPage';

const state = vi.hoisted(() => ({
  role: 'owner',
  items: [] as AgentInstruction[],
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../../organizations/OrganizationProvider', () => ({
  useOrganization: () => ({ activeOrganization: { role: state.role } }),
}));
vi.mock('../../components/notifications', () => ({
  notifications: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('../../settings/hooks/useInstructions', () => ({
  useInstructions: () => ({ data: state.items }),
  useCreateInstruction: () => ({ mutateAsync: state.create }),
  useUpdateInstruction: () => ({ mutateAsync: state.update }),
  useDeleteInstruction: () => ({ mutateAsync: state.remove }),
}));
const template: AgentInstruction = {
  id: 's1',
  name: 'Retention',
  description: 'Review monthly cohorts',
  content: 'Use monthly cohorts',
  command: 'retention',
  prompt_template: 'Review: {prompt}',
  enabled: true,
  is_default: false,
  organization_id: 'o1',
  created_by: 'u1',
  created_at: '',
  updated_at: '',
};

async function editRetention(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'More actions for Retention' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Edit template' }));
}

describe('Templates', () => {
  beforeEach(() => {
    state.role = 'owner';
    state.items = [];
    vi.resetAllMocks();
  });

  it('creates a template through the existing API using labeled fields', async () => {
    render(<SkillsPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New template' }));
    const dialog = screen.getByRole('dialog', { name: 'New template' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Template name' }), 'Retention');
    await user.type(within(dialog).getByRole('textbox', { name: 'Slash command' }), '/Retention');
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Instructions' }),
      'Use monthly cohorts',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Save template' }));
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Retention',
        command: 'retention',
        content: 'Use monthly cohorts',
        enabled: true,
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('validates required instructions and command syntax without losing the form', async () => {
    render(<SkillsPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New template' }));
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(screen.getByText('Enter a template name.')).toBeInTheDocument();
    expect(screen.getByText('Add instructions for this template.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Template name' })).toHaveFocus();
    await user.type(screen.getByRole('textbox', { name: 'Template name' }), 'My template');
    await user.type(screen.getByRole('textbox', { name: 'Instructions' }), 'Show the results.');
    await user.type(screen.getByRole('textbox', { name: 'Slash command' }), 'two words');
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(screen.getByText(/Spaces aren’t supported/)).toBeInTheDocument();
    expect(state.create).not.toHaveBeenCalled();
  });

  it('preserves editing and disabling existing templates', async () => {
    state.items = [template];
    render(<SkillsPage />);
    const user = userEvent.setup();
    await editRetention(user);
    expect(screen.getByRole('textbox', { name: 'Instructions' })).toHaveValue(template.content);
    await user.click(screen.getByRole('switch', { name: 'Template enabled' }));
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(state.update).toHaveBeenCalledWith({
      id: 's1',
      body: expect.objectContaining({
        enabled: false,
        command: 'retention',
        prompt_template: template.prompt_template,
      }),
    });
  });

  it('keeps a workspace default enabled and explains replacement', async () => {
    state.items = [{ ...template, id: 'default', name: 'Reporting rules', is_default: true }];
    render(<SkillsPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'New template' }));
    await user.click(screen.getByRole('switch', { name: 'Template enabled' }));
    await user.click(screen.getByRole('switch', { name: 'Workspace default' }));
    expect(screen.getByRole('switch', { name: 'Template enabled' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Template enabled' })).toBeDisabled();
    expect(screen.getByText(/Replaces “Reporting rules”/)).toBeInTheDocument();
  });

  it('retains entered values and shows the API message when saving fails', async () => {
    state.items = [template];
    state.update.mockRejectedValue({
      code: 'DUPLICATE',
      message: 'This slash command is already in use.',
    });
    render(<SkillsPage />);
    const user = userEvent.setup();
    await editRetention(user);
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This slash command is already in use.',
    );
    expect(screen.getByRole('textbox', { name: 'Template name' })).toHaveValue('Retention');
  });

  it('filters templates by name, description, and command and can clear an empty search', async () => {
    state.items = [
      template,
      {
        ...template,
        id: 's2',
        name: 'Weekly backlog',
        description: 'Review orders',
        command: 'weekly',
      },
    ];
    render(<SkillsPage />);
    const user = userEvent.setup();
    const search = screen.getByRole('searchbox', { name: 'Search templates' });
    await user.type(search, 'cohorts');
    expect(screen.getByRole('article', { name: 'Retention' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Weekly backlog' })).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, '/weekly');
    expect(screen.getByRole('article', { name: 'Weekly backlog' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Retention' })).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'does not exist');
    expect(screen.getByText('No matching templates')).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('search')).getByRole('button', { name: 'Clear search' }),
    );
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('supports default selection and confirms deletion through the action menu', async () => {
    state.items = [template];
    render(<SkillsPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'More actions for Retention' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Make workspace default' }));
    expect(state.update).toHaveBeenCalledWith({
      id: 's1',
      body: { is_default: true, enabled: true },
    });
    await user.click(screen.getByRole('button', { name: 'More actions for Retention' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete template' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete template?' });
    expect(state.remove).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Delete template' }));
    expect(state.remove).toHaveBeenCalledWith('s1');
  });

  it('shows title-only rows and lets members view instructions without management actions', async () => {
    state.role = 'member';
    state.items = [template];
    render(<SkillsPage />);
    expect(screen.getByRole('article', { name: 'Retention' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New template' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Retention' })).not.toBeInTheDocument();
    expect(screen.queryByText(template.description!)).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'More actions for Retention' }));
    expect(await screen.findByRole('menuitem', { name: 'View instructions' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Edit template' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete template' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'View instructions' }));
    const viewer = await screen.findByRole('dialog', { name: 'Template instructions: Retention' });
    expect(within(viewer).getByText(template.content)).toBeInTheDocument();
    expect(within(viewer).queryByRole('textbox')).not.toBeInTheDocument();
  });
});
