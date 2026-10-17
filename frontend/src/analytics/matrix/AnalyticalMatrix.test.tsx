import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fixture from '../../../../test-fixtures/matrix.json';
import hierarchy from '../../../../test-fixtures/matrix-hierarchy.json';
import { AnalyticalMatrix } from './AnalyticalMatrix';
import { parseMatrixArtifact } from './matrix-domain';

const { post, success } = vi.hoisted(() => ({ post: vi.fn(), success: vi.fn() }));
vi.mock('../../api/client', () => ({
  apiClient: { POST: post },
  withAuthRefresh: (request: () => unknown) => request(),
}));
vi.mock('../../components/notifications', () => ({ notifications: { success, error: vi.fn() } }));
const model = parseMatrixArtifact({
  id: 'matrix1',
  job_id: 'job1',
  kind: 'matrix',
  name: 'Orders',
  source_sql_execution_id: fixture.source_sql_execution_id,
  payload: fixture,
  created_at: '',
})!;

describe('AnalyticalMatrix', () => {
  beforeEach(() => {
    localStorage.clear();
    post.mockReset();
  });
  it('keeps its header actions visible when hidden and restores the expanded view', async () => {
    const user = userEvent.setup();
    render(<AnalyticalMatrix model={model} artifactId="matrix1" jobId="job1" dataSourceName="Warehouse" />);
    await user.click(screen.getByRole('button', { name: 'Expand North' }));
    await user.click(screen.getByRole('button', { name: 'Hide matrix' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Warehouse')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Matrix actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Matrix information' }));
    expect(within(screen.getByRole('dialog')).getByText('Warehouse')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close result information' }));
    expect(screen.getByRole('button', { name: 'Copy matrix' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Export matrix' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Expand matrix to full screen' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'View matrix' })).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: 'View matrix' }));
    expect(screen.getByText('Parts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse North' })).toBeInTheDocument();
  });
  it('expands and collapses nested column headers without changing SQL totals', async () => {
    const sensor = parseMatrixArtifact({
      id: 'sensor',
      job_id: 'job1',
      kind: 'matrix',
      name: 'Sensors',
      source_sql_execution_id: hierarchy.source_sql_execution_id,
      payload: hierarchy,
      created_at: '',
    })!;
    const user = userEvent.setup();
    render(<AnalyticalMatrix model={sensor} artifactId="sensor" jobId="job1" />);
    await user.click(screen.getByRole('button', { name: 'Collapse column 2026' }));
    expect(screen.queryByRole('columnheader', { name: '1' })).not.toBeInTheDocument();
    expect(screen.getAllByText('33.75').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Expand column 2026' }));
    expect(screen.getByRole('columnheader', { name: '1' })).toBeInTheDocument();
  });
  it('renders stepped rows, exact values, zero and blanks, and preserves expansion on reload', async () => {
    const user = userEvent.setup();
    const rendered = render(<AnalyticalMatrix model={model} artifactId="matrix1" jobId="job1" />);
    expect(screen.getAllByText('9,007,199,254,740,993.12')).toHaveLength(2);
    expect(screen.queryByText('Parts')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand North' }));
    expect(screen.getByText('Parts')).toBeInTheDocument();
    expect(screen.getByText('(Blank)')).toBeInTheDocument();
    const row = screen.getByRole('rowheader', { name: '(Blank)' }).closest('tr')!;
    expect(
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['0.10', '0', '', '']);
    rendered.unmount();
    render(<AnalyticalMatrix model={model} artifactId="matrix1" jobId="job1" />);
    expect(screen.getByRole('button', { name: 'Collapse North' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
  it('copies the current expansion projection and exports IDs/state, never caller-provided values', async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(<AnalyticalMatrix model={model} artifactId="matrix1" jobId="job1" />);
    await user.click(screen.getByRole('button', { name: 'Copy matrix' }));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('Grand total'));
    expect(write.mock.calls[0]![0]).not.toContain('Parts');
    post.mockRejectedValue(new Error('retry'));
    await user.click(screen.getByRole('button', { name: 'Export matrix' }));
    expect(post).toHaveBeenCalledWith(
      '/api/v1/jobs/{job_id}/artifacts/{artifact_id}/matrix/excel',
      expect.objectContaining({
        params: { path: { job_id: 'job1', artifact_id: 'matrix1' } },
        body: { collapsed_rows: expect.any(Array), collapsed_columns: [] },
      }),
    );
    expect(screen.getByRole('button', { name: 'Export matrix' })).toBeEnabled();
  });
});
