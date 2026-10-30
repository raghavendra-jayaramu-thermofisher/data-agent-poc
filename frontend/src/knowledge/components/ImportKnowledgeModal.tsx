import { Button, Modal } from '@heroui/react';
import { Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { AppError } from '../../api/errors';
import type { components } from '../../api/generated/schema';
import * as api from '../api/knowledge-api';

type Result = components['schemas']['KnowledgeImportResponse'];
type Duplicate = api.ImportOptions['onDuplicate'];

const STATUS_LABEL = {
  created: 'New',
  updated: 'Replace existing',
  skipped: 'Skip',
  error: 'Cannot import',
} as const;
const SCOPE_LABEL: Record<string, string> = {
  datasource: 'Data source',
  table: 'Table',
  column: 'Column',
  metric: 'Metric',
};

type Props = {
  dataSourceId: string;
  onClose(): void;
  onImported(result: Result): void;
};

/** Pick Markdown files, review what each one would do, then import. */
export function ImportKnowledgeModal({ dataSourceId, onClose, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [onDuplicate, setOnDuplicate] = useState<Duplicate>('skip');
  const [preview, setPreview] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(nextFiles: File[], duplicate: Duplicate, dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.importAnnotations(dataSourceId, nextFiles, {
        onDuplicate: duplicate,
        dryRun,
      });
      if (dryRun) setPreview(result);
      else onImported(result);
    } catch (caught) {
      setError((caught as AppError)?.message || 'Unable to read these files. Please try again.');
      if (dryRun) setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  function choose(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    setFiles(chosen);
    setPreview(null);
    if (chosen.length) void run(chosen, onDuplicate, true);
  }
  function changeDuplicate(value: Duplicate) {
    setOnDuplicate(value);
    if (files.length) void run(files, value, true);
  }
  const importable = (preview?.created ?? 0) + (preview?.updated ?? 0);

  return (
    <Modal.Backdrop
      isOpen
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      className="knowledge-modal-backdrop"
    >
      <Modal.Container size="lg" scroll="inside" className="knowledge-modal-container">
        <Modal.Dialog
          className="knowledge-modal knowledge-import-modal"
          aria-label="Import knowledge"
        >
          <Modal.Header className="knowledge-modal-header">
            <Modal.Heading>Import knowledge from Markdown</Modal.Heading>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label="Close import"
              isDisabled={busy}
              onPress={onClose}
            >
              <X size={18} aria-hidden="true" />
            </Button>
          </Modal.Header>
          <Modal.Body className="knowledge-modal-body">
            <p className="knowledge-field-help">
              Each file needs front matter with <code>scope</code> (datasource, table, column or
              metric) and, except for datasource, a <code>key</code>. <code>title</code> is
              optional.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".md,text/markdown"
              multiple
              hidden
              aria-label="Markdown files"
              onChange={(event) => {
                choose(event.target.files);
                event.target.value = '';
              }}
            />
            <div className="knowledge-import-picker">
              <Button
                variant="secondary"
                isDisabled={busy}
                onPress={() => inputRef.current?.click()}
              >
                <Upload size={14} aria-hidden="true" />
                {files.length ? 'Choose different files' : 'Choose Markdown files'}
              </Button>
              {files.length > 0 && (
                <span>
                  {files.length} file{files.length === 1 ? '' : 's'} selected
                </span>
              )}
            </div>
            <fieldset className="knowledge-import-duplicates" disabled={busy}>
              <legend>If a note with the same scope, key and title exists</legend>
              <label>
                <input
                  type="radio"
                  name="on-duplicate"
                  checked={onDuplicate === 'skip'}
                  onChange={() => changeDuplicate('skip')}
                />
                Skip it
              </label>
              <label>
                <input
                  type="radio"
                  name="on-duplicate"
                  checked={onDuplicate === 'replace'}
                  onChange={() => changeDuplicate('replace')}
                />
                Replace its content
              </label>
            </fieldset>
            {error && (
              <p className="knowledge-inline-error" role="alert">
                {error}
              </p>
            )}
            {preview && (
              <table className="knowledge-import-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Title</th>
                    <th>Applies to</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((item) => (
                    <tr key={item.filename} data-status={item.status}>
                      <td>{item.filename}</td>
                      <td>{item.title ?? '—'}</td>
                      <td>
                        {item.scope_type
                          ? (SCOPE_LABEL[item.scope_type] ?? item.scope_type) +
                            (item.scope_key ? ` · ${item.scope_key}` : '')
                          : '—'}
                      </td>
                      <td>
                        {STATUS_LABEL[item.status]}
                        {item.message ? ` — ${item.message}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="knowledge-import-actions">
              <Button variant="secondary" isDisabled={busy} onPress={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                isDisabled={importable === 0}
                isPending={busy && !!preview}
                onPress={() => void run(files, onDuplicate, false)}
              >
                {importable ? `Import ${importable} note${importable === 1 ? '' : 's'}` : 'Import'}
              </Button>
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
