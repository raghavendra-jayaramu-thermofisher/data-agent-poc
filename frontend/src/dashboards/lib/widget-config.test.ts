import { describe, expect, it } from 'vitest';
import type { ExecutionTrace } from '../../agent/api/execution-api';
import { buildWidgetCreate, findSaveSource, validateWidgetMapping } from './widget-config';
import type { SaveWidgetValues } from '../schemas/dashboard-schemas';

const trace: ExecutionTrace = {
  tools: [], models: [], sql: [], artifacts: [
    { id: 'table', job_id: 'j1', kind: 'table', name: 'Data', source_sql_execution_id: 's1', payload: { schema_version: 1, data_source_id: 'ds1', columns: ['month', 'revenue', 'orders'], rows: [['Jan', 10, 2]], row_count: 1, truncated: false }, created_at: '2026-08-24T12:00:00Z' },
    { id: 'chart', job_id: 'j1', kind: 'chart', name: 'Revenue', source_sql_execution_id: 's1', payload: { schema_version: 1, renderer: 'frontend', chart_type: 'line', encoding: { x: { field: 'month' }, series: [{ field: 'revenue' }] }, data: [{ month: 'Jan', revenue: 10 }] }, created_at: '2026-08-24T12:00:00Z' },
  ],
};

function values(widgetType: SaveWidgetValues['widgetType']): SaveWidgetValues {
  return { dashboardId: 'd1', widgetType, title: '', metricField: 'revenue', xField: 'month', valueField: 'revenue', categoryField: 'month' };
}

describe('dashboard widget configuration', () => {
  it('derives chart defaults from a persisted chart but validates against its table source', () => {
    const source = findSaveSource(trace, 'chart', 's1');
    expect(source?.defaultWidgetType).toBe('line');
    expect(source?.defaults).toMatchObject({ xField: 'month', valueField: 'revenue' });
    expect(source?.columns).toEqual(['month', 'revenue', 'orders']);
  });

  it.each(['metric', 'table', 'bar', 'line', 'area', 'pie'] as const)('builds a valid create contract for %s widgets', (widgetType) => {
    const body = buildWidgetCreate(values(widgetType), 'j1', 's1');
    expect(body.widget_type).toBe(widgetType);
    expect(body.source_job_id).toBe('j1');
    expect(body.source_sql_execution_id).toBe('s1');
  });

  it('rejects invalid field mappings before the backend performs authoritative validation', () => {
    expect(validateWidgetMapping({ ...values('metric'), metricField: 'missing' }, ['month', 'revenue'])).toMatch(/metric field/i);
    expect(validateWidgetMapping({ ...values('bar'), xField: 'month', valueField: 'month' }, ['month', 'revenue'])).toMatch(/different/i);
    expect(validateWidgetMapping({ ...values('pie'), categoryField: 'month', valueField: 'missing' }, ['month', 'revenue'])).toMatch(/value field/i);
  });
});
