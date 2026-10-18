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
    <div className="bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded-lg p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-[var(--db-border-subtle)]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-[var(--db-primary-soft)] text-[var(--db-primary)]">
            <BookOpen size={16} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--db-text-primary)] m-0 leading-tight">
              Business Knowledge Annotations
            </h2>
            <p className="text-xs text-[var(--db-text-muted)] mt-0.5">
              Domain business context, metrics, and definitions provided to guide AI queries.
            </p>
          </div>
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-[var(--db-on-primary)] text-xs font-semibold rounded-md transition-colors cursor-pointer ml-1 shadow-2xs"
            >
              {isAdding ? <X size={13} /> : <Plus size={13} />}
              <span>{isAdding ? 'Close Form' : 'Add Knowledge'}</span>
            </button>
          )}
        </div>
      </div>

      {canManage && isAdding && (
        <div className="mb-5 pb-5 border-b border-[var(--db-border-subtle)] bg-[var(--db-surface)] p-4 rounded-lg border border-[var(--db-border-default)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[var(--db-text-primary)] uppercase tracking-wider">
              Add New Business Knowledge
            </h3>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-[var(--db-text-muted)] hover:text-[var(--db-text-primary)]"
            >
              <X size={14} />
            </button>
          </div>
          <AnnotationForm
            onSubmit={async (values) => {
              await onCreate(values);
              setIsAdding(false);
            }}
          />
        </div>
      )}

      <div className="annotation-list space-y-2.5">
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
        {annotations.length === 0 && !isAdding ? (
          <div className="text-center py-12 text-[var(--db-text-muted)]">
            <BookOpen size={32} className="mx-auto text-[var(--db-border-default)] mb-2.5" />
            <p className="text-xs font-medium text-[var(--db-text-primary)]">No business annotations added yet</p>
            <p className="text-[11px] text-[var(--db-text-muted)] mt-0.5">
              Annotations help the LLM understand company terminology, fiscal year calculations, and table nuances.
            </p>
            {canManage && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-[var(--db-on-primary)] rounded text-xs font-semibold"
              >
                <Plus size={13} />
                <span>Add Knowledge Annotation</span>
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
