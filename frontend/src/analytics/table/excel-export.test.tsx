import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantMarkdown } from '../../conversations/components/AssistantMarkdown';
import { AnalyticalTable } from './AnalyticalTable';
import { ExcelExportButton } from './ExcelExportButton';
import { downloadExcel, excelTableFromModel } from './excel-export';
import { rowsFromPositional } from './table-domain';
import { notifications } from '../../components/notifications';

vi.mock('./excel-export', async (original) => ({ ...await original<typeof import('./excel-export')>(), downloadExcel: vi.fn() }));
vi.mock('../../components/notifications', () => ({ notifications: { success: vi.fn(), error: vi.fn() } }));

const model = {
  columns: ['customer', 'amount', 'active', 'details'],
  columnLabels: { amount: 'Backlog value (P$)' },
  rows: rowsFromPositional(['customer', 'amount', 'active', 'details'], [
    ['Alice', 1234.5678, true, { region: 'Japan' }],
    ['Bob', null, false, null],
    ['=SUM(A1:A2)', -42, true, ['one', 'two']],
  ]),
  rowCount: 3, truncated: false,
};

beforeEach(() => vi.clearAllMocks());

describe('Excel table export', () => {
  it('exports original values, column labels, all rows and truncation state', () => {
    expect(excelTableFromModel(model, 'Orders')).toEqual({
      title: 'Orders', headers: ['Customer', 'Backlog value (P$)', 'Active', 'Details'],
      rows: [['Alice', 1234.5678, true, '{"region":"Japan"}'], ['Bob', null, false, null], ['=SUM(A1:A2)', -42, true, '["one","two"]']],
      truncated: false,
    });
  });

  it('exports all rows from the expanded table even when search filters the view', async () => {
    const user = userEvent.setup();
    render(<AnalyticalTable model={model} label="Orders" />);
    await user.click(screen.getByRole('button', { name: 'Expand table to full screen' }));
    await user.type(screen.getByPlaceholderText('Search across all columns…'), 'Alice');
    await user.click(screen.getAllByRole('button', { name: 'Export to Excel' }).at(-1)!);
    await waitFor(() => expect(downloadExcel).toHaveBeenCalledWith(excelTableFromModel(model, 'Orders')));
  });

  it('exports each Markdown table with clean text and the nearest heading', async () => {
    const user = userEvent.setup();
    render(<AssistantMarkdown content={'## KPI Summary\n\n| KPI | Value |\n| --- | --- |\n| **Backlog** | P$19.51M |\n\n## Orders\n\n| ID |\n| --- |\n| 00123 |'} />);
    const buttons = screen.getAllByRole('button', { name: 'Export to Excel' });
    await user.click(buttons[0]!);
    expect(downloadExcel).toHaveBeenLastCalledWith({ title: 'KPI Summary', headers: ['KPI', 'Value'], rows: [['Backlog', 'P$19.51M']], truncated: false });
    await user.click(buttons[1]!);
    expect(downloadExcel).toHaveBeenLastCalledWith({ title: 'Orders', headers: ['ID'], rows: [['00123']], truncated: false });
  });

  it('prevents duplicate exports and lets a failed download be retried', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(downloadExcel).mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; })).mockResolvedValue({ truncated: false });
    const user = userEvent.setup();
    render(<ExcelExportButton getTable={() => excelTableFromModel(model, 'Orders')} />);
    await user.dblClick(screen.getByRole('button', { name: 'Export to Excel' }));
    expect(downloadExcel).toHaveBeenCalledOnce();
    await act(async () => reject(new Error('Network failed')));
    expect(notifications.error).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Export to Excel' }));
    expect(downloadExcel).toHaveBeenCalledTimes(2);
  });
});
