import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardWidget } from '../api/dashboard-api';
import { DashboardWidgetContent } from './DashboardWidgetContent';

vi.mock('echarts-for-react', () => ({ default: () => <div data-testid="echarts"/> }));

function base(type: string, payload: Record<string, unknown>, config: Record<string, unknown>): DashboardWidget {
  return { id: 'w1', dashboard_id: 'd1', data_source_id: 'ds1', title: 'Revenue', widget_type: type, question: 'Revenue?', sql_text: 'select month,revenue from x', visualization_config: config, layout_config: {}, created_from_job_id: 'j1', created_from_sql_execution_id: 's1', last_refresh_job_id: null, last_refreshed_at: null, enabled: true, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z', latest_artifact: { id: 'a1', kind: 'table', name: 'Revenue', created_at: '2026-08-24T12:00:00Z', payload } };
}
const table = { schema_version: 1, data_source_id: 'ds1', columns: ['month', 'revenue'], rows: [['Jan', 100000], ['Feb', 125000]], row_count: 2, truncated: false };

describe('DashboardWidgetContent', () => {
  it('renders metric and table widgets', () => {
    const { rerender } = render(<DashboardWidgetContent widget={base('metric', table, { field: 'revenue' })} dataSourceName="Warehouse"/>);
    expect(screen.getByText('100,000')).toBeInTheDocument();
    rerender(<DashboardWidgetContent widget={base('table', table, {})} dataSourceName="Warehouse"/>);
    expect(screen.getByRole('table', { name: 'Revenue' })).toBeInTheDocument();
  });

  it.each(['bar', 'line', 'area'] as const)('renders %s widgets through the shared ECharts layer', (type) => {
    render(<DashboardWidgetContent widget={base(type, table, { x_field: 'month', series: [{ field: 'revenue', label: 'Revenue' }] })} dataSourceName="Warehouse"/>);
    expect(screen.getByTestId('echarts')).toBeInTheDocument();
  });

  it('renders pie widgets through the shared ECharts layer', () => {
    render(<DashboardWidgetContent widget={base('pie', table, { category_field: 'month', value_field: 'revenue' })} dataSourceName="Warehouse"/>);
    expect(screen.getByTestId('echarts')).toBeInTheDocument();
  });

  it('contains an invalid widget locally rather than crashing the dashboard', () => {
    render(<DashboardWidgetContent widget={base('metric', table, { field: 'missing' })} dataSourceName="Warehouse"/>);
    expect(screen.getByText('Visualization unavailable')).toBeInTheDocument();
  });
});
