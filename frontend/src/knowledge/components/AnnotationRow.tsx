import { AlertDialog, Button, Dropdown, Label } from '@heroui/react';
import { ChevronDown, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { AppError } from '../../api/errors';
import type { components } from '../../api/generated/schema';
import { MarkdownDocument } from './MarkdownDocument';

type Annotation = components['schemas']['KnowledgeAnnotationResponse'];
export function AnnotationRow({
  annotation,
  onUpdate,
  onDelete,
  canManage,
  isExpanded: expandedProp,
  onToggle,
}: {
  annotation: Annotation;
  onUpdate(content: string): Promise<void>;
  onDelete(): Promise<void>;
  canManage: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}) {
  const id = useId();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(annotation.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const expanded = expandedProp ?? internalExpanded;
  const title =
    annotation.title?.trim() ||
    annotation.content
      .trim()
      .split('\n')[0]
      ?.replace(/^[#*\x60\s-]+/, '')
      .replace(/[*\x60]+$/, '')
      .trim() ||
    'Business knowledge';
  const scope =
    (
      { datasource: 'Data source', table: 'Table', column: 'Column', metric: 'Metric' } as Record<
        string,
        string
      >
    )[annotation.scope_type] ?? 'Data source';
  function toggle() {
    if (onToggle) onToggle();
    else setInternalExpanded((value) => !value);
  }
  function startEdit() {
    setContent(annotation.content);
    setError(null);
    setEditing(true);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim()) {
      setError('Enter instructions before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onUpdate(content.trim());
      setEditing(false);
    } catch (error) {
      setError((error as AppError)?.message || 'Unable to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    setRemoving(true);
    setDeleteError(null);
    try {
      await onDelete();
      setDeleting(false);
    } catch (error) {
      setDeleteError(
        (error as AppError)?.message || 'Unable to delete this knowledge. Please try again.',
      );
    } finally {
      setRemoving(false);
    }
  }
  return (
    <>
      <article className="annotation-row">
        <div className="annotation-heading">
          <button
            className="annotation-toggle"
            type="button"
            aria-expanded={expanded || editing}
            aria-label={
              title + ', ' + scope + (annotation.scope_key ? ', ' + annotation.scope_key : '')
            }
            aria-controls={id + '-content'}
            onClick={toggle}
            disabled={editing}
          >
            <ChevronDown size={15} aria-hidden="true" />
            <span className="annotation-title" title={title}>
              {title}
            </span>
            <span className="annotation-scope">
              <span className="annotation-badge">{scope}</span>
              {annotation.scope_key && (
                <span className="annotation-scope-key" title={annotation.scope_key}>
                  {annotation.scope_key}
                </span>
              )}
            </span>
          </button>
          {canManage && (
            <Dropdown>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className="annotation-more"
                aria-label={'More actions for ' + title}
                isDisabled={saving || editing}
              >
                <MoreHorizontal size={17} aria-hidden="true" />
              </Button>
              <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu
                  aria-label={'Actions for ' + title}
                  onAction={(key) => {
                    if (key === 'edit') startEdit();
                    if (key === 'delete') {
                      setDeleteError(null);
                      setDeleting(true);
                    }
                  }}
                >
                  <Dropdown.Item id="edit" textValue="Edit knowledge">
                    <Pencil size={14} aria-hidden="true" />
                    <Label>Edit knowledge</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="delete" textValue="Delete knowledge" variant="danger">
                    <Trash2 size={14} aria-hidden="true" />
                    <Label>Delete knowledge</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
        </div>
        {(expanded || editing) && (
          <div id={id + '-content'}>
            {editing ? (
              <form className="annotation-edit-form" onSubmit={(event) => void save(event)}>
                <div className="knowledge-field">
                  <label htmlFor={id + '-instructions'}>Instructions</label>
                  <textarea
                    id={id + '-instructions'}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    disabled={saving}
                    rows={6}
                    maxLength={20000}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? id + '-error' : undefined}
                    required
                  />
                  {error && (
                    <p id={id + '-error'} role="alert" className="knowledge-inline-error">
                      {error}
                    </p>
                  )}
                </div>
                <div className="knowledge-form-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    isDisabled={saving}
                    onPress={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isPending={saving}>
                    Save changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="annotation-content knowledge-document-view">
                <MarkdownDocument>{annotation.content}</MarkdownDocument>
              </div>
            )}
          </div>
        )}
      </article>
      <AlertDialog.Backdrop
        isOpen={deleting}
        isDismissable={!removing}
        isKeyboardDismissDisabled={removing}
        onOpenChange={(open) => {
          if (!open && !removing) setDeleting(false);
        }}
      >
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog className="knowledge-delete-dialog">
            <AlertDialog.Header>
              <AlertDialog.Heading>Delete business knowledge?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>This removes these instructions from the data source. This can’t be undone.</p>
              {deleteError && (
                <p role="alert" className="knowledge-inline-error">
                  {deleteError}
                </p>
              )}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="secondary" isDisabled={removing} onPress={() => setDeleting(false)}>
                Cancel
              </Button>
              <Button variant="danger" isPending={removing} onPress={() => void remove()}>
                Delete knowledge
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}
