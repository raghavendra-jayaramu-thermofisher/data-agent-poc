import { Button, Modal, Tooltip } from '@heroui/react';
import { BookOpen, Download, Plus, Search, Upload, X } from 'lucide-react';
import { useState } from 'react';
import type { components } from '../../api/generated/schema';
import { notifications } from '../../components/notifications';
import * as api from '../api/knowledge-api';
import { knowledgeMarkdown, saveKnowledgeZip } from '../knowledge-markdown';
import { AnnotationForm } from './AnnotationForm';
import { CopyIconButton } from './CopyIconButton';
import { AnnotationRow } from './AnnotationRow';
import { ImportKnowledgeModal } from './ImportKnowledgeModal';
import type { AnnotationValues } from '../schemas/annotation-schema';

type Annotation = components['schemas']['KnowledgeAnnotationResponse'];
type Props = {
  dataSourceId: string;
  sourceName: string;
  annotations: Annotation[];
  canManage: boolean;
  onCreate(values: AnnotationValues): Promise<void>;
  onUpdate(annotationId: string, content: string): Promise<void>;
  onDelete(annotationId: string): Promise<void>;
  onImported(): Promise<void> | void;
};

export function BusinessKnowledgePanel({
  dataSourceId,
  sourceName,
  annotations,
  canManage,
  onCreate,
  onUpdate,
  onDelete,
  onImported,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const visible = annotations.filter((item) =>
    (item.content + ' ' + (item.scope_key ?? '') + ' ' + item.scope_type)
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(knowledgeMarkdown(sourceName, annotations, new Date()));
      notifications.success(
        `Copied ${annotations.length} business knowledge note${annotations.length === 1 ? '' : 's'}`,
      );
    } catch {
      notifications.error('Unable to copy the business knowledge. Try again.');
    }
  };
  const exportAll = async () => {
    setExporting(true);
    try {
      saveKnowledgeZip(await api.exportAnnotations(dataSourceId), sourceName);
    } catch {
      notifications.error('Unable to export the business knowledge. Try again.');
    } finally {
      setExporting(false);
    }
  };
  const toggleOne = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="business-knowledge">
      <div className="business-knowledge-toolbar">
        <div className="knowledge-search db-icon-search" role="search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            className="db-icon-search__input"
            aria-label="Search business knowledge"
            placeholder="Search business knowledge…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button type="button" aria-label="Clear knowledge search" onClick={() => setSearch('')}>
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="business-knowledge-actions">
          <CopyIconButton
            label="Copy all business knowledge as Markdown"
            isDisabled={annotations.length === 0}
            onPress={() => void copyAll()}
          />
          <Tooltip delay={350}>
            <Button
              isIconOnly
              variant="secondary"
              aria-label="Export business knowledge as Markdown files"
              isDisabled={annotations.length === 0}
              isPending={exporting}
              onPress={() => void exportAll()}
            >
              <Download size={15} aria-hidden="true" />
            </Button>
            <Tooltip.Content>Export as Markdown files (.zip)</Tooltip.Content>
          </Tooltip>
          {canManage && (
            <Button variant="secondary" onPress={() => setIsImporting(true)}>
              <Upload size={14} aria-hidden="true" />
              Import
            </Button>
          )}
          {canManage && (
            <Button variant="primary" onPress={() => setIsAdding(true)}>
              <Plus size={14} aria-hidden="true" />
              Add knowledge
            </Button>
          )}
        </div>
      </div>
      <div className="annotation-list">
        {visible.map((annotation) => (
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
        {visible.length === 0 && (
          <div className="knowledge-empty">
            <BookOpen size={26} aria-hidden="true" />
            <h2>{search ? 'No matching business knowledge' : 'No business knowledge yet'}</h2>
            {search ? (
              <Button variant="secondary" onPress={() => setSearch('')}>
                Clear search
              </Button>
            ) : (
              <p>
                {canManage
                  ? 'Add definitions and reporting rules to guide your analyses.'
                  : 'Your workspace’s definitions and reporting rules will appear here.'}
              </p>
            )}
          </div>
        )}
      </div>
      {canManage && isImporting && (
        <ImportKnowledgeModal
          dataSourceId={dataSourceId}
          onClose={() => setIsImporting(false)}
          onImported={(result) => {
            setIsImporting(false);
            void onImported();
            const added = result.created + result.updated;
            notifications.success(
              `Imported ${added} note${added === 1 ? '' : 's'}` +
                (result.skipped ? `, skipped ${result.skipped}` : '') +
                (result.failed ? `, ${result.failed} failed` : ''),
            );
          }}
        />
      )}
      {canManage && isAdding && (
        <Modal.Backdrop
          isOpen
          isDismissable={!saving}
          isKeyboardDismissDisabled={saving}
          onOpenChange={(open) => {
            if (!open && !saving) setIsAdding(false);
          }}
          className="knowledge-modal-backdrop"
        >
          <Modal.Container size="lg" scroll="inside" className="knowledge-modal-container">
            <Modal.Dialog className="knowledge-modal" aria-label="Add business knowledge">
              <Modal.Header className="knowledge-modal-header">
                <Modal.Heading>Add business knowledge</Modal.Heading>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label="Close add knowledge"
                  isDisabled={saving}
                  onPress={() => setIsAdding(false)}
                >
                  <X size={18} aria-hidden="true" />
                </Button>
              </Modal.Header>
              <Modal.Body className="knowledge-modal-body">
                <AnnotationForm
                  onCancel={() => setIsAdding(false)}
                  onSubmit={async (values) => {
                    setSaving(true);
                    try {
                      await onCreate(values);
                      setIsAdding(false);
                    } finally {
                      setSaving(false);
                    }
                  }}
                />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </div>
  );
}
