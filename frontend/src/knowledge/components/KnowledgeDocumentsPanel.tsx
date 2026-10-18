import { useEffect } from 'react';
import { Search, FileCode2, Table, BookOpen, X } from 'lucide-react';
import type { components } from '../../api/generated/schema';
import { PageState } from '../../components/PageState';
import { MarkdownDocument } from './MarkdownDocument';

type DocumentSummary = components['schemas']['KnowledgeDocumentSummary'];
type DocumentDetail = components['schemas']['KnowledgeDocumentResponse'];

type Props = {
  search: string;
  onSearchChange(value: string): void;
  documents: DocumentSummary[];
  totalCount?: number;
  selectedDocumentId: string | null;
  onSelectDocument(id: string): void;
  detail: DocumentDetail | undefined;
  detailLoading: boolean;
};

export function KnowledgeDocumentsPanel({
  search,
  onSearchChange,
  documents,
  totalCount,
  selectedDocumentId,
  onSelectDocument,
  detail,
  detailLoading,
}: Props) {
  // Auto-select first document if none is selected
  useEffect(() => {
    if (!selectedDocumentId && documents.length > 0) {
      onSelectDocument(documents[0].id);
    }
  }, [selectedDocumentId, documents, onSelectDocument]);

  const displayTotal = totalCount ?? documents.length;

  return (
    <div className="schema-explorer-grid">
      {/* Sidebar: Table Documents List */}
      <aside className="schema-sidebar">
        <div className="schema-search-box">
          <Search size={14} className="absolute left-2.5 text-[var(--db-text-muted)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search tables & views…"
            className="schema-search-input"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="schema-search-clear"
              title="Clear search"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>

        <div className="flex items-center justify-between px-1 pb-1.5 mb-1.5 border-b border-[var(--db-border-subtle)] text-[11px] font-semibold text-[var(--db-text-muted)] uppercase tracking-wider">
          <span>{search ? 'Filtered Results' : 'Schema Objects'}</span>
          <span className="font-mono text-[10px]">
            {search ? `${documents.length} of ${displayTotal}` : displayTotal}
          </span>
        </div>

        <div className="schema-items-list">
          {documents.map((document) => {
            const isSelected = selectedDocumentId === document.id;
            return (
              <button
                type="button"
                key={document.id}
                className={`schema-item-btn ${isSelected ? 'is-active' : ''}`}
                onClick={() => onSelectDocument(document.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Table
                    size={13}
                    className={isSelected ? 'text-[var(--db-primary)] shrink-0' : 'text-[var(--db-text-muted)] shrink-0'}
                  />
                  <span className="truncate font-medium">{document.title}</span>
                </div>
                <span className="schema-item-pill">
                  {document.estimated_tokens} tokens
                </span>
              </button>
            );
          })}

          {documents.length === 0 && (
            <div className="py-12 px-4 text-center">
              <p className="text-xs text-[var(--db-text-muted)] mb-2">No matching tables found.</p>
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="text-xs text-[var(--db-primary)] hover:underline font-medium"
                >
                  Clear search query
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main Document Reader */}
      <article className="schema-reader">
        {!selectedDocumentId ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--db-text-muted)]">
            <BookOpen size={36} className="text-[var(--db-border-default)] mb-3" />
            <strong className="text-sm text-[var(--db-text-primary)]">Select a schema object</strong>
            <p className="text-xs mt-1.5 max-w-sm">
              Click any table or view on the left to inspect column definitions, data types, indexes, and documentation.
            </p>
          </div>
        ) : detailLoading ? (
          <PageState title="Loading schema definition…" loading />
        ) : detail ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-[var(--db-border-subtle)]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-[var(--db-primary-soft)] text-[var(--db-primary)]">
                  <FileCode2 size={16} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[var(--db-text-primary)] leading-tight">
                    {detail.title}
                  </h2>
                  <span className="text-[11px] font-mono text-[var(--db-text-muted)]">
                    {detail.document_key}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2.5 py-1 bg-[var(--db-surface-muted)] text-[var(--db-text-secondary)] rounded-md font-medium border border-[var(--db-border-default)]">
                  {detail.estimated_tokens.toLocaleString()} estimated tokens
                </span>
              </div>
            </div>

            <div className="knowledge-document-view">
              <MarkdownDocument>{detail.content_markdown}</MarkdownDocument>
            </div>
          </div>
        ) : (
          <PageState title="Schema definition unavailable" />
        )}
      </article>
    </div>
  );
}
