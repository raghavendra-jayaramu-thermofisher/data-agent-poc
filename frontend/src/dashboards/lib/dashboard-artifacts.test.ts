import { describe, expect, it } from 'vitest';
import type { DashboardWidget } from '../api/dashboard-api';
import { chartModelForWidget, metricValue, tableModelForWidget } from './dashboard-artifacts';

function widget(type: string, latest: Record<string, unknown>, config: Record<string, unknown> = {}): DashboardWidget {
  return { id: 'w1', dashboard_id: 'd1', data_source_id: 'ds1', title: 'Revenue', widget_type: type, question: 'Revenue?', sql_text: 'select month,revenue from x', visualization_config: config, layout_config: {}, created_from_job_id: 'j1', created_from_sql_execution_id: 's-original', last_refresh_job_id: 'jr1', last_refreshed_at: '2026-08-24T12:05:00Z', enabled: true, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:05:00Z', latest_artifact: latest };
}
const tableLatest = { id: 'a1', kind: 'table', name: 'Revenue', created_at: '2026-08-24T12:05:00Z', payload: { schema_version: 1, data_source_id: 'ds1', columns: ['month', 'revenue'], rows: [['Jan', 10], ['Feb', 20]], row_count: 2, truncated: false } };

describe('dashboard persisted artifact adapters', () => {
  it('renders metric and table widgets from the persisted table artifact', () => {
    expect(metricValue(widget('metric', tableLatest, { field: 'revenue' }))).toEqual({ field: 'revenue', value: 10 });
    expect(tableModelForWidget(widget('table', tableLatest))?.rowCount).toBe(2);
  });

  it('constructs a chart from a source table before the first chart refresh', () => {
    const chart = chartModelForWidget(widget('line', tableLatest, { x_field: 'month', series: [{ field: 'revenue', label: 'Revenue' }] }), 'Warehouse');
    expect(chart?.chartType).toBe('line');
  });

  it('accepts a refreshed chart whose payload points at the new refresh SQL execution', () => {
    const latest = { id: 'chart2', kind: 'chart', name: 'Revenue', created_at: '2026-08-24T12:05:00Z', payload: { schema_version: 1, renderer: 'frontend', source_sql_execution_id: 's-refresh', chart_type: 'bar', title: 'Revenue', encoding: { x: { field: 'month' }, series: [{ field: 'revenue', label: 'Revenue' }] }, data: [{ month: 'Jan', revenue: 10 }] } };
    expect(chartModelForWidget(widget('bar', latest), 'Warehouse')?.chartType).toBe('bar');
  });
});
