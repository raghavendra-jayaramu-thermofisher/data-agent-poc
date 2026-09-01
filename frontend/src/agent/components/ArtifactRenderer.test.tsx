import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JobArtifact, SqlExecution } from '../api/execution-api';
import { ArtifactRenderer } from './ArtifactRenderer';

vi.mock('echarts-for-react', () => ({
  default: ({ option, onEvents }: { option: unknown; onEvents?: Record<string, (event: unknown) => void> }) => <div>
    <div data-testid="echarts" data-option={JSON.stringify(option)}/>
    {onEvents?.click ? <button type="button" onClick={() => onEvents.click({ seriesId: 'chart-output:revenue:0', data: { month: 'Feb', revenue: 20 } })}>Select chart point</button> : null}
  </div>,
}));

const sql: SqlExecution[] = [{ id: 's1', tool_execution_id: 't1', data_source_id: 'ds1', sql_text: 'select month,revenue from x', status: 'succeeded', row_count: 2, truncated: false, columns: ['month', 'revenue'], result_bytes: 10, duration_ms: 2, error_code: null, error_message: null, started_at: '2026-08-24T12:00:00Z', finished_at: '2026-08-24T12:00:01Z' }];
function a(id: string, kind: string, payload: Record<string, unknown>): JobArtifact { return { id, job_id: 'j1', kind, name: id, source_sql_execution_id: kind === 'text' ? null : 's1', payload, created_at: '2026-08-24T12:00:01Z' }; }

const artifacts = [
  a('table-output', 'table', { schema_version: 1, data_source_id: 'ds1', columns: ['month', 'revenue'], rows: [['Jan', 10], ['Feb', 20]], row_count: 2, truncated: false, display: 'expanded' }),
  a('chart-output', 'chart', { schema_version: 1, renderer: 'frontend', chart_type: 'bar', title: 'Revenue', source_sql_execution_id: 's1', encoding: { x: { field: 'month' }, series: [{ field: 'revenue', label: 'Revenue' }] }, data: [{ month: 'Jan', revenue: 10 }, { month: 'Feb', revenue: 20 }] }),
  a('answer-copy', 'text', { schema_version: 1, markdown: 'Same answer' }),
  a('future-artifact', 'future_kind', { schema_version: 1 }),
];

describe('ArtifactRenderer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders charts and tables as first-class chat artifacts, skips duplicate answer text, and contains malformed future kinds', () => {
    render(<MemoryRouter><ArtifactRenderer jobId="j1" artifacts={artifacts} sql={sql} dataSourceNames={{ ds1: 'Warehouse' }} excludeTextMarkdown="Same answer"/></MemoryRouter>);
    expect(screen.getByTestId('echarts')).toBeInTheDocument();
    expect(screen.getByText('table-output')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'table-output' })).toBeInTheDocument();
    expect(screen.queryByText('Same answer')).not.toBeInTheDocument();
    expect(screen.getByText('Unsupported artifact')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Save to dashboard' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'View SQL' }).length).toBeGreaterThan(0);
  });

  it('turns a selected chart point into an ordinary visible chat follow-up', async () => {
    const followUp = vi.fn(async () => undefined);
    render(<MemoryRouter><ArtifactRenderer jobId="j1" artifacts={[artifacts[1]!]} sql={sql} dataSourceNames={{ ds1: 'Warehouse' }} onFollowUp={followUp}/></MemoryRouter>);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Select chart point' }));
    expect(screen.getByText('Feb')).toBeInTheDocument();
    expect(screen.getByText(/Revenue: 20/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Explain' }));
    expect(followUp).toHaveBeenCalledWith('Explain Revenue for month Feb, including the main reasons behind this result.');
  });

  it('switches chart presentation locally and toggles the accessible data view inside the same analytical message', async () => {
    render(<MemoryRouter><ArtifactRenderer jobId="j1" artifacts={[artifacts[1]!]} sql={sql} dataSourceNames={{ ds1: 'Warehouse' }}/></MemoryRouter>);
    const user = userEvent.setup();
    expect(JSON.parse(screen.getByTestId('echarts').getAttribute('data-option') ?? '{}').series[0].type).toBe('bar');
    await user.click(screen.getByRole('button', { name: 'Line' }));
    expect(JSON.parse(screen.getByTestId('echarts').getAttribute('data-option') ?? '{}').series[0].type).toBe('line');
    await user.click(screen.getByRole('button', { name: 'Data' }));
    expect(screen.getByRole('table', { name: 'Revenue data' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Chart' }));
    expect(screen.getByTestId('echarts')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View SQL' }));
    expect(screen.getByLabelText('SQL query')).toHaveTextContent('select month,revenue from x');
  });

  it('fails an arbitrary chart config locally rather than handing it to ECharts', () => {
    render(<MemoryRouter><ArtifactRenderer jobId="j1" artifacts={[a('bad', 'chart', { schema_version: 1, renderer: 'frontend', chart_type: 'custom', option: { renderItem: 'arbitrary' } })]} sql={sql}/></MemoryRouter>);
    expect(screen.getByText('Chart unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('echarts')).not.toBeInTheDocument();
  });
});

it('does not silently save only one source from a combined multi-source chart', () => {
  const sql2: SqlExecution = { ...sql[0]!, id: 's2', data_source_id: 'ds2' };
  const first = a('chart-1', 'chart', { schema_version: 1, renderer: 'frontend', chart_type: 'line', title: 'Revenue', comparison_key: 'monthly-revenue', source_sql_execution_id: 's1', encoding: { x: { field: 'month' }, series: [{ field: 'revenue', label: 'Revenue', unit: 'USD' }] }, data: [{ month: 'Jan', revenue: 10 }] });
  const second: JobArtifact = { ...a('chart-2', 'chart', { schema_version: 1, renderer: 'frontend', chart_type: 'line', title: 'Revenue', comparison_key: 'monthly-revenue', source_sql_execution_id: 's2', encoding: { x: { field: 'month' }, series: [{ field: 'revenue', label: 'Revenue', unit: 'USD' }] }, data: [{ month: 'Jan', revenue: 20 }] }), source_sql_execution_id: 's2' };
  render(<MemoryRouter><ArtifactRenderer jobId="j1" artifacts={[first, second]} sql={[...sql, sql2]} dataSourceNames={{ ds1: 'Source A', ds2: 'Source B' }}/></MemoryRouter>);
  expect(screen.getByText(/Combined multi-source views remain separate when saved/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save to dashboard' })).not.toBeInTheDocument();
});
