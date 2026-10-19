import { BookOpen, Search, Table, X } from 'lucide-react';
import type { components } from '../../api/generated/schema';
import { PageError, PageLoading } from '../../components/PageState';
import { MarkdownDocument } from './MarkdownDocument';

type Props = {
  search: string;
  onSearchChange(value: string): void;
  documents: components['schemas']['KnowledgeDocumentSummary'][];
  selectedDocumentId: string | null;
  onSelectDocument(id: string): void;
  detail: components['schemas']['KnowledgeDocumentResponse'] | undefined;
  detailLoading: boolean;
  detailError?: boolean;
  onRetryDetail?(): void;
};

function displayContent(detail: NonNullable<Props['detail']>) {
  const heading = /^\s*#{1,3}\s+([^\n]+)\r?\n/.exec(detail.content_markdown);
  const name = heading?.[1]?.replace(/^(?:table|view):?\s+/i, '').trim();
  return heading && (name === detail.title || name === detail.document_key)
    ? detail.content_markdown.slice(heading[0].length).trimStart()
    : detail.content_markdown;
}

export function KnowledgeDocumentsPanel({
  search,
  onSearchChange,
  documents,
  selectedDocumentId,
  onSelectDocument,
  detail,
  detailLoading,
  detailError,
  onRetryDetail,
}: Props) {
  return (
    <div className="schema-explorer-grid">
      <aside className="schema-sidebar" aria-label="Tables and views">
        <div className="schema-sidebar-tools">
          <div className="knowledge-search db-icon-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              className="db-icon-search__input"
              aria-label="Search tables and views"
              placeholder="Search tables and views…"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            {search && (
              <button
                type="button"
                aria-label="Clear table search"
                onClick={() => onSearchChange('')}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div className="schema-items-list">
          {documents.map((document) => (
            <button
              type="button"
              key={document.id}
              className="schema-item-btn"
              aria-pressed={selectedDocumentId === document.id}
              title={document.title}
              onClick={() => onSelectDocument(document.id)}
            >
              <Table size={14} aria-hidden="true" />
              <span>{document.title}</span>
            </button>
          ))}
          {documents.length === 0 && (
            <div className="schema-no-results">
              <p>{search ? 'No matching tables or views.' : 'No tables or views available.'}</p>
              {search && (
                <button type="button" onClick={() => onSearchChange('')}>
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
      <article className="schema-reader" aria-label="Schema details">
        {!selectedDocumentId ? (
          <div className="knowledge-empty">
            <BookOpen size={26} aria-hidden="true" />
            <h2>Choose a table or view</h2>
          </div>
        ) : detailLoading ? (
          <PageLoading label="Loading schema…" />
        ) : detailError ? (
          <PageError title="Unable to load this schema" retry={onRetryDetail} />
        ) : detail ? (
          <>
            <header className="schema-reader-header">
              <Table size={15} aria-hidden="true" />
              <h2>{detail.title}</h2>
            </header>
            <div className="knowledge-document-view schema-document">
              <MarkdownDocument>{displayContent(detail)}</MarkdownDocument>
            </div>
          </>
        ) : (
          <PageError title="Schema unavailable" retry={onRetryDetail} />
        )}
      </article>
    </div>
  );
}
