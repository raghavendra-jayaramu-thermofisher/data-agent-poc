import { Search, FileCode2, Table, BookOpen } from 'lucide-react';
import type { components } from '../../api/generated/schema';
import { PageState } from '../../components/PageState';
import { MarkdownDocument } from './MarkdownDocument';

type DocumentSummary = components['schemas']['KnowledgeDocumentSummary'];
type DocumentDetail = components['schemas']['KnowledgeDocumentResponse'];

type Props = {
  search: string;
  onSearchChange(value: string): void;
  documents: DocumentSummary[];
  selectedDocumentId: string | null;
  onSelectDocument(id: string): void;
  detail: DocumentDetail | undefined;
  detailLoading: boolean;
};

export function KnowledgeDocumentsPanel({
  search,
  onSearchChange,
  documents,
  selectedDocumentId,
  onSelectDocument,
  detail,
  detailLoading,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 my-6">
      {/* Sidebar: Table Documents List */}
      <aside className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg p-3 shadow-xs flex flex-col h-[520px]">
        <div className="relative mb-3">
          <Search size={13} className="absolute left-2.5 top-2.5 text-[#8B848C]" />
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Filter table schemas…"
            className="w-full h-8 pl-8 pr-2.5 bg-[#FBFAF7] border border-[#DAD5CD] rounded text-xs text-[#252127] placeholder:text-[#8B848C] outline-none focus:border-[#9A4D86]"
          />
        </div>

        <div className="text-[11px] font-semibold text-[#8B848C] uppercase tracking-wider px-1 pb-1 mb-1 border-b border-[#E7E3DC] flex items-center justify-between">
          <span>Table Schemas</span>
          <span>{documents.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {documents.map((document) => {
            const isSelected = selectedDocumentId === document.id;
            return (
              <button
                type="button"
                key={document.id}
                className={`w-full text-left p-2 rounded transition-colors flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-[#F4E8F0] border border-[#9A4D86]/30 text-[#4B123F]'
                    : 'hover:bg-[#F0EEE9] text-[#252127] border border-transparent'
                }`}
                onClick={() => onSelectDocument(document.id)}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Table size={13} className={isSelected ? 'text-[#4B123F] shrink-0' : 'text-[#8B848C] shrink-0'} />
                  <strong className="text-xs truncate font-medium">{document.title}</strong>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#EAE7E1] text-[#625C64] rounded shrink-0">
                  {document.estimated_tokens} tokens
                </span>
              </button>
            );
          })}

          {documents.length === 0 && (
            <p className="text-xs text-[#8B848C] text-center py-10">No matching schemas.</p>
          )}
        </div>
      </aside>

      {/* Main Document Reader */}
      <article className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg p-5 shadow-xs overflow-y-auto h-[520px]">
        {!selectedDocumentId ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#8B848C]">
            <BookOpen size={36} className="text-[#DAD5CD] mb-2" />
            <strong className="text-sm text-[#252127]">Select a schema document</strong>
            <p className="text-xs mt-1 max-w-sm">
              Click any table schema on the left to inspect column definitions, data types, indexes, and LLM documentation.
            </p>
          </div>
        ) : detailLoading ? (
          <PageState title="Loading document…" loading />
        ) : detail ? (
          <>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E7E3DC]">
              <div className="flex items-center gap-2">
                <FileCode2 size={18} className="text-[#4B123F]" />
                <h2 className="text-base font-semibold text-[#252127]">{detail.title}</h2>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 bg-[#F0EEE9] text-[#625C64] rounded font-medium border border-[#DAD5CD]">
                {detail.estimated_tokens} estimated tokens
              </span>
            </div>
            <MarkdownDocument>{detail.content_markdown}</MarkdownDocument>
          </>
        ) : (
          <PageState title="Document unavailable" />
        )}
      </article>
    </div>
  );
}
