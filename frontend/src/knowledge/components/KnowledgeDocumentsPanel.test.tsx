import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { detail, documents } from '../test-fixtures';
import { KnowledgeDocumentsPanel } from './KnowledgeDocumentsPanel';

const props = {
  search: '',
  onSearchChange: vi.fn(),
  documents,
  selectedDocumentId: 'doc-orders',
  onSelectDocument: vi.fn(),
  detail,
  detailLoading: false,
};

describe('KnowledgeDocumentsPanel', () => {
  it('shows a single schema heading and its columns without token diagnostics', () => {
    render(<KnowledgeDocumentsPanel {...props} />);
    expect(screen.getAllByRole('heading', { name: 'dbo.orders' })).toHaveLength(1);
    expect(screen.getByRole('columnheader', { name: 'Column' })).toBeInTheDocument();
    expect(screen.getByText('amount')).toBeInTheDocument();
    expect(screen.queryByText(/tokens/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'dbo.orders' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  it('selects a table without changing selection merely because search filters it out', async () => {
    const select = vi.fn();
    const user = userEvent.setup();
    render(
      <KnowledgeDocumentsPanel {...props} documents={[documents[1]!]} onSelectDocument={select} />,
    );
    expect(select).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'dbo.customers' }));
    expect(select).toHaveBeenCalledWith('doc-customers');
  });
  it('allows retrying a failed document load and clearing an empty search', async () => {
    const retry = vi.fn();
    const search = vi.fn();
    const user = userEvent.setup();
    render(
      <KnowledgeDocumentsPanel
        {...props}
        search="missing"
        documents={[]}
        detail={undefined}
        detailError
        onRetryDetail={retry}
        onSearchChange={search}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search).toHaveBeenCalledWith('');
  });
});
