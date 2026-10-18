import { useState, useEffect } from 'react';
import { Button } from '@heroui/react';
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import type { components } from '../../api/generated/schema';
import { MarkdownDocument } from './MarkdownDocument';

type Annotation = components['schemas']['KnowledgeAnnotationResponse'];

export function AnnotationRow({
  annotation,
  onUpdate,
  onDelete,
  canManage,
  isExpanded: isExpandedProp,
  onToggle,
}: {
  annotation: Annotation;
  onUpdate(content: string): Promise<void>;
  onDelete(): Promise<void>;
  canManage: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(annotation.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExpanded = isExpandedProp !== undefined ? isExpandedProp : internalExpanded;

  const toggleExpanded = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  // Synchronize content whenever annotation prop updates
  useEffect(() => {
    setContent(annotation.content);
  }, [annotation.content]);

  const handleStartEdit = () => {
    setContent(annotation.content);
    setError(null);
    if (!isExpanded) {
      if (isExpandedProp !== undefined) {
        onToggle?.();
      } else {
        setInternalExpanded(true);
      }
    }
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setContent(annotation.content);
    setError(null);
    setEditing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Content is required.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onUpdate(content);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update annotation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewSnippet = annotation.content
    ? annotation.content.replace(/^[#*`\s-]+/, '').replace(/\n+/g, ' ').trim()
    : '';

  const scopeClass =
    annotation.scope_type === 'table'
      ? 'annotation-badge--table'
      : annotation.scope_type === 'column'
      ? 'annotation-badge--column'
      : annotation.scope_type === 'metric'
      ? 'annotation-badge--metric'
      : 'annotation-badge--datasource';

  return (
    <article
      className={`annotation-row transition-all duration-150 ${
        isExpanded || editing ? 'is-expanded' : 'is-collapsed'
      } ${editing ? 'is-editing' : ''}`}
    >
      <div
        className="annotation-heading cursor-pointer select-none group"
        onClick={toggleExpanded}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded || editing}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <ChevronDown
            size={16}
            className={`text-[var(--db-text-muted)] transition-transform duration-200 shrink-0 group-hover:text-[var(--db-primary)] ${
              isExpanded || editing ? 'rotate-180 text-[var(--db-primary)]' : ''
            }`}
          />
          <span className={`annotation-badge shrink-0 ${scopeClass}`}>
            {annotation.scope_type}
          </span>
          {annotation.scope_key ? (
            <span className="annotation-scope-key font-mono text-xs shrink-0">
              {annotation.scope_key}
            </span>
          ) : null}
          {!isExpanded && !editing ? (
            <span className="text-xs text-[var(--db-text-muted)] truncate min-w-0 pr-2 italic">
              {previewSnippet || 'Empty annotation'}
            </span>
          ) : null}
        </div>
        {canManage ? (
          <div
            className="row-actions flex items-center gap-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {editing ? (
              <Button size="sm" variant="ghost" className="annotation-btn-ghost" onPress={handleCancelEdit}>
                Cancel
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="annotation-btn-ghost" onPress={handleStartEdit}>
                <Pencil size={12} />
                <span>Edit</span>
              </Button>
            )}
            <ConfirmationDialog
              triggerLabel={
                <span className="inline-flex items-center gap-1">
                  <Trash2 size={12} />
                  <span>Delete</span>
                </span>
              }
              triggerVariant="ghost"
              triggerSize="sm"
              triggerClassName="annotation-btn-ghost is-danger"
              title="Delete business knowledge?"
              confirmLabel="Delete"
              onConfirm={() => void onDelete()}
            />
          </div>
        ) : null}
      </div>

      {(isExpanded || editing) && (
        editing ? (
          <form className="form-stack p-4" onSubmit={handleSave}>
            <div>
              <label className="block text-xs font-semibold text-[var(--db-text-primary)] mb-1.5">
                Content (Markdown supported)
              </label>
              <textarea
                className="w-full min-h-[220px] p-3 text-xs font-mono bg-[var(--db-surface)] border border-[var(--db-border-default)] rounded-md text-[var(--db-text-primary)] placeholder:text-[var(--db-text-muted)] outline-none focus:border-[var(--db-focus-ring)] focus:ring-1 focus:ring-[var(--db-focus-ring)]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={isSubmitting}
                rows={10}
                placeholder="Enter markdown knowledge content…"
                required
              />
              {error ? <p className="text-xs text-[var(--db-danger)] mt-1">{error}</p> : null}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" size="sm" variant="primary" isPending={isSubmitting}>
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onPress={handleCancelEdit} isDisabled={isSubmitting}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="annotation-content p-4 knowledge-document-view">
            <MarkdownDocument>{annotation.content}</MarkdownDocument>
          </div>
        )
      )}
    </article>
  );
}
