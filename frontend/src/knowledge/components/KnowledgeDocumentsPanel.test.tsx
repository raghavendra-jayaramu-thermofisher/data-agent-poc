import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KnowledgeDocumentsPanel } from './KnowledgeDocumentsPanel';

describe('KnowledgeDocumentsPanel', () => {
  const documents = [
    {
      id: 'doc-1',
      document_type: 'table_schema' as const,
      document_key: 'dbo.orders',
      title: 'dbo.orders',
      metadata: {},
      estimated_tokens: 250,
      created_at: '2026-10-18T10:00:00Z',
    },
    {
      id: 'doc-2',
      document_type: 'table_schema' as const,
      document_key: 'dbo.customers',
      title: 'dbo.customers',
      metadata: {},
      estimated_tokens: 180,
      created_at: '2026-10-18T10:00:00Z',
    },
  ];

  it('auto-selects first document if none is selected', () => {
    const handleSelect = vi.fn();
    render(
      <KnowledgeDocumentsPanel
        search=""
        onSearchChange={vi.fn()}
        documents={documents}
        selectedDocumentId={null}
        onSelectDocument={handleSelect}
        detail={undefined}
        detailLoading={false}
      />
    );

    expect(handleSelect).toHaveBeenCalledWith('doc-1');
  });

  it('renders document items and calls onSelectDocument when clicked', async () => {
    const handleSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <KnowledgeDocumentsPanel
        search=""
        onSearchChange={vi.fn()}
        documents={documents}
        selectedDocumentId="doc-1"
        onSelectDocument={handleSelect}
        detail={undefined}
        detailLoading={false}
      />
    );

    expect(screen.getByText('dbo.orders')).toBeInTheDocument();
    expect(screen.getByText('dbo.customers')).toBeInTheDocument();

    await user.click(screen.getByText('dbo.customers'));
    expect(handleSelect).toHaveBeenCalledWith('doc-2');
  });

  it('displays schema document detail when selected', () => {
    const detail = {
      id: 'doc-1',
      document_type: 'table_schema' as const,
      document_key: 'dbo.orders',
      title: 'dbo.orders',
      metadata: {},
      estimated_tokens: 250,
      created_at: '2026-10-18T10:00:00Z',
      content_markdown: '# Table: dbo.orders\n\nColumns: id, total_amount',
    };

    render(
      <KnowledgeDocumentsPanel
        search=""
        onSearchChange={vi.fn()}
        documents={documents}
        selectedDocumentId="doc-1"
        onSelectDocument={vi.fn()}
        detail={detail}
        detailLoading={false}
      />
    );

    expect(screen.getByRole('heading', { name: 'dbo.orders' })).toBeInTheDocument();
    expect(screen.getByText('250 estimated tokens')).toBeInTheDocument();
    expect(screen.getByText('Columns: id, total_amount')).toBeInTheDocument();
  });
});
