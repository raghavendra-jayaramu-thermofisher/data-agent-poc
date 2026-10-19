import { AlertDialog, Button } from '@heroui/react';
import { LayoutTemplate, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
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
import type { AgentInstruction, InstructionCreate } from '../../settings/api/instructions-api';
import { TemplateCard } from '../components/TemplateCard';
import { TemplateEditor } from '../components/TemplateEditor';
import './templates.css';

export function SkillsPage() {
  const { activeOrganization } = useOrganization();
  const canManage = hasAdminRole(activeOrganization?.role);
  const query = useInstructions();
  const createMutation = useCreateInstruction();
  const updateMutation = useUpdateInstruction();
  const deleteMutation = useDeleteInstruction();
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AgentInstruction | null>(null);
  const [deletingItem, setDeletingItem] = useState<AgentInstruction | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (query.isLoading) return <PageLoading label="Loading templates…" />;
  if (query.isError)
    return (
      <PageError
        title="Unable to load templates"
        message={(query.error as Error).message}
        retry={() => void query.refetch()}
      />
    );

  const instructions = query.data ?? [];
  const term = search.trim().toLocaleLowerCase();
  const visible = instructions
    .filter(
      (item) =>
        !term ||
        [item.name, item.description, item.command ? '/' + item.command : null].some((value) =>
          value?.toLocaleLowerCase().includes(term),
        ),
    )
    .sort((a, b) => Number(b.is_default) - Number(a.is_default));
  const currentDefault = instructions.find((item) => item.is_default);
  const saving = Boolean(createMutation.isPending || updateMutation.isPending);

  function openEditor(item: AgentInstruction | null = null) {
    setEditingItem(item);
    setEditorOpen(true);
  }

  async function save(body: InstructionCreate) {
    if (!canManage || saving) return;
    if (editingItem) await updateMutation.mutateAsync({ id: editingItem.id, body });
    else await createMutation.mutateAsync(body);
    notifications.success(editingItem ? 'Template updated.' : 'Template created.');
    setEditorOpen(false);
  }

  async function makeDefault(item: AgentInstruction) {
    if (!canManage || saving) return;
    try {
      await updateMutation.mutateAsync({ id: item.id, body: { is_default: true, enabled: true } });
      notifications.success('“' + item.name + '” is now the workspace default.');
    } catch (error) {
      notifications.error((error as AppError).message || 'Unable to update the workspace default.');
    }
  }

  async function remove() {
    if (!canManage || !deletingItem || deleteMutation.isPending) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(deletingItem.id);
      notifications.success('Template deleted.');
      setDeletingItem(null);
    } catch (error) {
      setDeleteError(
        (error as AppError).message || 'Unable to delete this template. Please try again.',
      );
    }
  }

  return (
    <section className="templates-page" aria-labelledby="templates-title">
      <header className="templates-page-header" data-can-manage={canManage}>
        <div className="templates-heading">
          <h1 id="templates-title">Templates</h1>
          <span
            className="templates-count"
            role="status"
            aria-label={visible.length + ' of ' + instructions.length + ' templates'}
          >
            {term ? visible.length + ' / ' : ''}
            {instructions.length}
          </span>
        </div>
        <div className="templates-search db-icon-search" role="search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            className="db-icon-search__input"
            aria-label="Search templates"
            placeholder="Search templates…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        {canManage && (
          <Button variant="primary" className="templates-new-button" onPress={() => openEditor()}>
            <Plus size={16} aria-hidden="true" />
            New template
          </Button>
        )}
      </header>
      {instructions.length === 0 ? (
        <div className="templates-empty">
          <div className="templates-empty-icon">
            <LayoutTemplate size={25} aria-hidden="true" />
          </div>
          <h2>Your analysis, with a head start</h2>
          <p>
            Save instructions you use often, from reporting rules to the way you want an analysis
            presented.
          </p>
          {canManage ? (
            <Button variant="primary" onPress={() => openEditor()}>
              <Plus size={16} aria-hidden="true" />
              Create a template
            </Button>
          ) : (
            <p>Ask a workspace admin to create your first template.</p>
          )}
        </div>
      ) : visible.length === 0 ? (
        <div className="templates-empty templates-empty--search">
          <Search size={24} aria-hidden="true" />
          <h2>No matching templates</h2>
          <p>Try a different name, description, or slash command.</p>
          <Button variant="secondary" onPress={() => setSearch('')}>
            Clear search
          </Button>
        </div>
      ) : (
        <div className="templates-list" aria-label="Templates">
          {visible.map((item) => (
            <TemplateCard
              key={item.id}
              item={item}
              canManage={canManage}
              busy={saving || Boolean(deleteMutation.isPending)}
              onEdit={() => openEditor(item)}
              onMakeDefault={() => void makeDefault(item)}
              onDelete={() => {
                setDeleteError(null);
                setDeletingItem(item);
              }}
            />
          ))}
        </div>
      )}
      {editorOpen && (
        <TemplateEditor
          item={editingItem}
          currentDefault={currentDefault}
          saving={saving}
          onSave={save}
          onClose={() => setEditorOpen(false)}
        />
      )}
      <AlertDialog.Backdrop
        isOpen={Boolean(deletingItem)}
        isDismissable={!deleteMutation.isPending}
        isKeyboardDismissDisabled={Boolean(deleteMutation.isPending)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeletingItem(null);
        }}
      >
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog className="template-delete-dialog">
            <AlertDialog.Header>
              <AlertDialog.Heading>Delete template?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                <strong>{deletingItem?.name}</strong> will be removed from this workspace. This
                can’t be undone.
              </p>
              {deleteError && (
                <p role="alert" className="template-field-error">
                  {deleteError}
                </p>
              )}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                variant="secondary"
                isDisabled={deleteMutation.isPending}
                onPress={() => setDeletingItem(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                isPending={deleteMutation.isPending}
                onPress={() => void remove()}
              >
                Delete template
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </section>
  );
}
