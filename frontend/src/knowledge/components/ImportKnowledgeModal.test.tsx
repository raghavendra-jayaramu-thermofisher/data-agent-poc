import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../api/knowledge-api';
import { ImportKnowledgeModal } from './ImportKnowledgeModal';

vi.mock('../api/knowledge-api', () => ({ importAnnotations: vi.fn() }));

const response = (dryRun: boolean) => ({
  dry_run: dryRun,
  created: 1,
  updated: 0,
  skipped: 0,
  failed: 1,
  items: [
    {
      filename: 'rules.md',
      status: 'created' as const,
      title: 'Rules',
      scope_type: 'table',
      scope_key: 'dbo.orders',
      message: null,
    },
    {
      filename: 'bad.md',
      status: 'error' as const,
      title: null,
      scope_type: null,
      scope_key: null,
      message: 'Front matter is missing.',
    },
  ],
});

describe('ImportKnowledgeModal', () => {
  beforeEach(() => vi.mocked(api.importAnnotations).mockReset());

  it('previews the chosen files, then imports only after confirmation', async () => {
    vi.mocked(api.importAnnotations)
      .mockResolvedValueOnce(response(true))
      .mockResolvedValueOnce(response(false));
    const onImported = vi.fn();
    render(<ImportKnowledgeModal dataSourceId="ds-1" onClose={vi.fn()} onImported={onImported} />);
    const files = [
      new File(['x'], 'rules.md', { type: 'text/markdown' }),
      new File(['y'], 'bad.md', { type: 'text/markdown' }),
    ];

    fireEvent.change(screen.getByLabelText('Markdown files'), { target: { files } });

    expect(
      await screen.findByText('Front matter is missing.', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText('Table · dbo.orders')).toBeInTheDocument();
    expect(api.importAnnotations).toHaveBeenCalledWith('ds-1', files, {
      onDuplicate: 'skip',
      dryRun: true,
    });
    expect(onImported).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Import 1 note' }));

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    expect(api.importAnnotations).toHaveBeenLastCalledWith('ds-1', files, {
      onDuplicate: 'skip',
      dryRun: false,
    });
  });

  it('previews again when the duplicate choice changes', async () => {
    vi.mocked(api.importAnnotations).mockResolvedValue(response(true));
    render(<ImportKnowledgeModal dataSourceId="ds-1" onClose={vi.fn()} onImported={vi.fn()} />);
    const files = [new File(['x'], 'rules.md')];
    fireEvent.change(screen.getByLabelText('Markdown files'), { target: { files } });
    await screen.findByText('Rules');

    fireEvent.click(screen.getByLabelText('Replace its content'));

    await waitFor(() =>
      expect(api.importAnnotations).toHaveBeenLastCalledWith('ds-1', files, {
        onDuplicate: 'replace',
        dryRun: true,
      }),
    );
  });
});
