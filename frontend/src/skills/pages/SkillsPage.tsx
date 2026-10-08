import { useState } from 'react';
import {
  LayoutTemplate,
  Terminal,
  Plus,
  Trash2,
  Edit2,
  Star,
  X,
  AlertCircle,
} from 'lucide-react';
import type { AppError } from '../../api/errors';
import { PageError, PageLoading } from '../../components/PageState';
import { notifications } from '../../components/notifications';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { hasAdminRole } from '../../settings/components/AdminSettingsGate';
import {
  useCreateInstruction,
  useDeleteInstruction,
  useInstructions,
  useUpdateInstruction,
} from '../../settings/hooks/useInstructions';
import type {
  AgentInstruction,
  InstructionCreate,
  InstructionUpdate,
} from '../../settings/api/instructions-api';

type FormState = {
  name: string;
  description: string;
  command: string;
  prompt_template: string;
  content: string;
  is_default: boolean;
  enabled: boolean;
};

const emptyFormState: FormState = {
  name: '',
  description: '',
  command: '',
  prompt_template: '',
  content: '',
  is_default: false,
  enabled: true,
};

export function SkillsPage() {
  const { activeOrganization } = useOrganization();
  const canManage = hasAdminRole(activeOrganization?.role);
  const query = useInstructions();
  const createMutation = useCreateInstruction();
  const updateMutation = useUpdateInstruction();
  const deleteMutation = useDeleteInstruction();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AgentInstruction | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyFormState);
  const [formError, setFormError] = useState<string | null>(null);

  if (query.isLoading) return <PageLoading label="Loading templates…" />;
  if (query.isError) {
    return (
      <PageError
        title="Unable to load templates"
        message={(query.error as Error).message}
        retry={() => void query.refetch()}
      />
    );
  }

  const instructions = query.data ?? [];

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData(emptyFormState);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: AgentInstruction) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description ?? '',
      command: item.command ?? '',
      prompt_template: item.prompt_template ?? '',
      content: item.content,
      is_default: item.is_default,
      enabled: item.enabled,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleMakeDefault = async (item: AgentInstruction) => {
    if (!canManage) return;
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        body: { is_default: true, enabled: true },
      });
      notifications.success(`"${item.name}" is now the workspace default template.`);
    } catch (err) {
      notifications.error((err as AppError).message || 'Failed to update default template');
    }
  };

  const handleDelete = async (item: AgentInstruction) => {
    if (!canManage) return;
    if (
      !window.confirm(
        `Are you sure you want to delete template "${item.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(item.id);
      notifications.success(`Template "${item.name}" deleted.`);
    } catch (err) {
      notifications.error((err as AppError).message || 'Failed to delete template');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setFormError(null);

    const trimmedName = formData.name.trim();
    const trimmedContent = formData.content.trim();
    const trimmedCommand = formData.command.trim().replace(/^\/+/, '').toLowerCase();

    if (!trimmedName) {
      setFormError('Template name is required.');
      return;
    }
    if (!trimmedContent) {
      setFormError('Template instructions are required.');
      return;
    }

    try {
      if (editingItem) {
        const body: InstructionUpdate = {
          name: trimmedName,
          description: formData.description.trim() || null,
          command: trimmedCommand || null,
          prompt_template: formData.prompt_template.trim() || null,
          content: trimmedContent,
          is_default: formData.is_default,
          enabled: formData.enabled,
        };
        await updateMutation.mutateAsync({ id: editingItem.id, body });
        notifications.success(`Template "${trimmedName}" updated.`);
      } else {
        const body: InstructionCreate = {
          name: trimmedName,
          description: formData.description.trim() || null,
          command: trimmedCommand || null,
          prompt_template: formData.prompt_template.trim() || null,
          content: trimmedContent,
          is_default: formData.is_default,
          enabled: formData.enabled,
        };
        await createMutation.mutateAsync(body);
        notifications.success(`Template "${trimmedName}" created.`);
      }
      setModalOpen(false);
    } catch (err) {
      setFormError((err as AppError).message || 'Failed to save template.');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-[#DAD5CD] gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#252127]">Templates</h1>
          <p className="text-xs text-[#625C64]">
            Set an always-on workspace template, or create command templates invoked with slash commands (e.g.{' '}
            <code className="text-[#4B123F] font-mono font-semibold">/retention</code>) for on-demand
            specialized analysis.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4B123F] hover:bg-[#3F0E35] text-[#FFF9FD] rounded text-xs font-semibold transition-colors shrink-0"
          >
            <Plus size={14} />
            <span>New Template</span>
          </button>
        )}
      </div>

      {/* Instructions list */}
      {instructions.length === 0 ? (
        <div className="p-8 text-center bg-[#FBFAF7] border border-[#DAD5CD] rounded-lg">
          <LayoutTemplate size={28} className="mx-auto mb-2 text-[#8B848C]" />
          <h3 className="text-sm font-semibold text-[#252127] mb-1">No templates configured</h3>
          <p className="text-xs text-[#625C64] max-w-md mx-auto mb-4">
            Add custom instructions to guide the data assistant on company-wide metric definitions,
            fiscal calendar rules, or create slash commands for quick analytical tasks.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4B123F] hover:bg-[#3F0E35] text-[#FFF9FD] rounded text-xs font-semibold transition-colors"
            >
              <Plus size={14} />
              <span>Create First Template</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {instructions.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-lg border transition-all ${
                item.is_default
                  ? 'bg-[#FDFBF7] border-[#D4A373]/50 shadow-xs'
                  : 'bg-[#FFFDFC] border-[#DAD5CD] hover:border-[#8B848C]/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-sm font-semibold text-[#252127]">{item.name}</h3>

                    {item.is_default && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                        <Star size={11} className="fill-current" /> Always-on · Workspace Default
                      </span>
                    )}

                    {item.command && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#F4E8F0] text-[#4B123F] border border-[#E9D5E5]">
                        <Terminal size={11} /> /{item.command}
                      </span>
                    )}

                    {!item.enabled && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#EAE7E1] text-[#8B848C]">
                        Disabled
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-xs text-[#625C64] mb-2">{item.description}</p>
                  )}

                  {item.prompt_template && (
                    <div className="text-[11px] font-mono text-[#625C64] bg-[#F0EEE9] px-2 py-1 rounded inline-block mb-2 max-w-full truncate">
                      Template: {item.prompt_template}
                    </div>
                  )}

                  <div className="mt-1">
                    <details className="text-xs text-[#625C64] group">
                      <summary className="cursor-pointer text-[#4B123F] hover:underline font-medium list-none flex items-center gap-1 select-none">
                        <span>View Template Instructions</span>
                      </summary>
                      <pre className="mt-2 p-3 bg-[#FBFAF7] border border-[#DAD5CD] rounded text-xs font-mono text-[#252127] whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {item.content}
                      </pre>
                    </details>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!item.is_default && item.enabled && (
                      <button
                        type="button"
                        onClick={() => handleMakeDefault(item)}
                        title="Set as workspace default"
                        className="px-2 py-1 text-[11px] font-medium text-[#4B123F] hover:bg-[#F4E8F0] rounded border border-[#DAD5CD] transition-colors"
                      >
                        Make Default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      title="Edit template"
                      className="p-1.5 text-[#625C64] hover:text-[#252127] hover:bg-[#EAE7E1] rounded transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      title="Delete template"
                      className="p-1.5 text-[#8B848C] hover:text-[#A84545] hover:bg-[#F7E7E5] rounded transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div
            className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="instruction-modal-title"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DAD5CD]">
              <div className="flex items-center gap-2">
                <LayoutTemplate size={16} className="text-[#4B123F]" />
                <h3 id="instruction-modal-title" className="text-sm font-semibold text-[#252127]">
                  {editingItem ? 'Edit Template' : 'New Template'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-[#8B848C] hover:text-[#252127] rounded transition-colors"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div
                  className="flex items-center gap-2 p-3 bg-[#F7E7E5] border border-[#E8B4B4] rounded text-xs text-[#A84545]"
                  role="alert"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#252127] mb-1">
                  Template Name <span className="text-[#A84545]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Workspace Default or Cohort Retention Guidelines"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-[#FBFAF7] border border-[#DAD5CD] rounded focus:border-[#4B123F] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#252127] mb-1">
                    Slash Command <span className="text-[#8B848C] font-normal">(Optional)</span>
                  </label>
                  <div className="flex items-center">
                    <span className="px-2 py-1.5 bg-[#EAE7E1] border border-r-0 border-[#DAD5CD] rounded-l text-xs font-mono text-[#625C64]">
                      /
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. retention"
                      value={formData.command}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          command: e.target.value.replace(/^\/+/, '').toLowerCase(),
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs font-mono bg-[#FBFAF7] border border-[#DAD5CD] rounded-r focus:border-[#4B123F] focus:outline-hidden"
                    />
                  </div>
                  <p className="text-[11px] text-[#8B848C] mt-1">
                    Enables typing <code className="font-mono">/command</code> in the chat input.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#252127] mb-1">
                    Description <span className="text-[#8B848C] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Short summary shown in autocomplete"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-[#FBFAF7] border border-[#DAD5CD] rounded focus:border-[#4B123F] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#252127] mb-1">
                  Prompt Template <span className="text-[#8B848C] font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Perform a cohort retention analysis for: {prompt}"
                  value={formData.prompt_template}
                  onChange={(e) => setFormData({ ...formData, prompt_template: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-[#FBFAF7] border border-[#DAD5CD] rounded focus:border-[#4B123F] focus:outline-hidden"
                />
                <p className="text-[11px] text-[#8B848C] mt-1">
                  Wraps the user query. Use <code className="font-mono">{'{prompt}'}</code> as the placeholder for the additional text.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#252127] mb-1">
                  Template Instructions <span className="text-[#A84545]">*</span>
                </label>
                <textarea
                  required
                  rows={8}
                  placeholder={`Write the instructions provided to the AI model...
- Exclude internal test emails ending in @example.com
- Fiscal year begins October 1st
- Always format currency in USD`}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full p-3 text-xs font-mono bg-[#FBFAF7] border border-[#DAD5CD] rounded focus:border-[#4B123F] focus:outline-hidden leading-relaxed"
                />
              </div>

              <div className="pt-2 space-y-2 border-t border-[#DAD5CD]/60">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_default: e.target.checked,
                        enabled: e.target.checked ? true : formData.enabled,
                      })
                    }
                    className="rounded border-[#DAD5CD] text-[#4B123F] focus:ring-[#4B123F]"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-[#252127]">Set as Workspace Default (always-on)</span>
                    <span className="text-[#625C64] block">
                      Always applied to every query asked in this workspace. Only one template can be the workspace default.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    disabled={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="rounded border-[#DAD5CD] text-[#4B123F] focus:ring-[#4B123F]"
                  />
                  <span className="text-xs font-medium text-[#252127]">
                    Template Enabled
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#DAD5CD]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#625C64] hover:bg-[#EAE7E1] rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-1.5 text-xs font-semibold bg-[#4B123F] hover:bg-[#3F0E35] text-[#FFF9FD] rounded transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

