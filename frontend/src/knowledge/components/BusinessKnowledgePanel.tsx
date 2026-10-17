import { useState } from 'react';
import { BookOpen, ChevronsUpDown, Plus, X } from 'lucide-react';
import type { components } from '../../api/generated/schema';
import { AnnotationForm } from './AnnotationForm';
import { AnnotationRow } from './AnnotationRow';
import type { AnnotationValues } from '../schemas/annotation-schema';

type Annotation = components['schemas']['KnowledgeAnnotationResponse'];

type Props = {
  annotations: Annotation[];
  canManage: boolean;
  onCreate(values: AnnotationValues): Promise<void>;
  onUpdate(annotationId: string, content: string): Promise<void>;
  onDelete(annotationId: string): Promise<void>;
};

export function BusinessKnowledgePanel({
  annotations,
  canManage,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  const allExpanded = annotations.length > 0 && expandedIds.size === annotations.length;

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(annotations.map((a) => a.id)));
    }
  };

  const toggleOne = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="detail-panel my-6 bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded-xl p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-[var(--db-border-subtle)]">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-[var(--db-primary)]" />
          <h2 className="text-base font-semibold text-[var(--db-text-primary)] m-0">Business Knowledge Annotations</h2>
        </div>
        <div className="flex items-center gap-2">
          {annotations.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex items-center gap-1 text-xs text-[var(--db-primary)] hover:text-[var(--db-primary-hover)] font-medium px-2 py-1 rounded hover:bg-[var(--db-primary-soft)] transition-colors cursor-pointer"
            >
              <ChevronsUpDown size={13} />
              <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
            </button>
          )}
          <span className="text-xs font-mono px-2 py-0.5 bg-[var(--db-surface-muted)] text-[var(--db-text-secondary)] rounded font-medium border border-[var(--db-border-default)]">
            {annotations.length} annotation{annotations.length === 1 ? '' : 's'}
          </span>
          {canManage && (
            <button
              type="button"
              onClick={() => setIsAdding((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-[var(--db-on-primary)] text-xs font-semibold rounded transition-colors cursor-pointer ml-1"
            >
              {isAdding ? <X size={12} /> : <Plus size={12} />}
              <span>{isAdding ? 'Close form' : 'Add Knowledge'}</span>
            </button>
          )}
        </div>
      </div>

      {canManage && isAdding && (
        <div className="mb-6 pb-6 border-b border-[var(--db-border-subtle)] bg-[var(--db-surface)] p-4 rounded-lg border">
          <h3 className="text-xs font-semibold text-[var(--db-text-secondary)] uppercase tracking-wider mb-3">
            Add New Business Knowledge
          </h3>
          <AnnotationForm
            onSubmit={async (values) => {
              await onCreate(values);
              setIsAdding(false);
            }}
          />
        </div>
      )}

      <div className="annotation-list space-y-3">
        {annotations.map((annotation) => (
          <AnnotationRow
            key={annotation.id}
            annotation={annotation}
            canManage={canManage}
            isExpanded={expandedIds.has(annotation.id)}
            onToggle={() => toggleOne(annotation.id)}
            onUpdate={(content) => onUpdate(annotation.id, content)}
            onDelete={() => onDelete(annotation.id)}
          />
        ))}
        {annotations.length === 0 ? (
          <div className="text-center py-10 text-[var(--db-text-muted)]">
            <BookOpen size={28} className="mx-auto text-[var(--db-border-default)] mb-2" />
            <p className="text-xs">No business annotations added yet.</p>
            {canManage && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="mt-2 text-xs text-[var(--db-primary)] font-semibold hover:underline"
              >
                + Add the first business knowledge item
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
