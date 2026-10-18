import { describe, expect, it } from 'vitest';
import type { ExecutionTrace } from '../../agent/api/execution-api';
import {
  buildWidgetCreate,
  buildVisualizationConfig,
  findSaveSource,
  validateWidgetMapping,
  widgetValuesFromConfig,
} from './widget-config';
import type { DashboardWidget } from '../api/dashboard-api';
import type { SaveWidgetValues } from '../schemas/dashboard-schemas';
import comboFixture from '../../../../test-fixtures/combo-chart.json';
import { chartModelForWidget } from './dashboard-artifacts';

const trace: ExecutionTrace = {
  tools: [],
  models: [],
  sql: [],
  artifacts: [
    {
      id: 'table',
      job_id: 'j1',
      kind: 'table',
      name: 'Data',
      source_sql_execution_id: 's1',
      payload: {
        schema_version: 1,
        data_source_id: 'ds1',
        columns: ['month', 'revenue', 'orders'],
        rows: [['Jan', 10, 2]],
        row_count: 1,
        truncated: false,
      },
      created_at: '2026-08-24T12:00:00Z',
    },
    {
      id: 'chart',
      job_id: 'j1',
      kind: 'chart',
      name: 'Revenue',
      source_sql_execution_id: 's1',
      payload: {
        schema_version: 1,
        renderer: 'frontend',
        chart_type: 'line',
        encoding: { x: { field: 'month' }, series: [{ field: 'revenue' }] },
        data: [{ month: 'Jan', revenue: 10 }],
      },
      created_at: '2026-08-24T12:00:00Z',
    },
  ],
};

function values(widgetType: SaveWidgetValues['widgetType']): SaveWidgetValues {
  return {
    dashboardId: 'd1',
    widgetType,
    title: '',
    metricField: 'revenue',
    xField: 'month',
    valueField: 'revenue',
    categoryField: 'month',
  };
}

describe('dashboard widget configuration', () => {
  it('preserves combo roles, units, scales and labels through save, edit and refresh rendering', () => {
    const columns = Object.keys(comboFixture.data[0]!);
    const source = findSaveSource(
      {
        ...trace,
        artifacts: [
          {
            ...trace.artifacts![0]!,
            payload: {
              ...trace.artifacts![0]!.payload,
              columns,
              rows: comboFixture.data.map((row) =>
                columns.map((column) => (row as Record<string, unknown>)[column]),
              ),
            },
          },
          { ...trace.artifacts![1]!, payload: { ...comboFixture, source_sql_execution_id: 's1' } },
        ],
      },
      'chart',
      's1',
    )!;
    expect(source.defaultWidgetType).toBe('combo');
    const mapping = { ...values('bar'), widgetType: source.defaultWidgetType, ...source.defaults };
    expect(validateWidgetMapping(mapping, columns)).toBeNull();
    const saved = buildWidgetCreate(mapping, 'j1', 's1');
    expect(saved.visualization_config!.series).toEqual(comboFixture.encoding.series);
    const widget: DashboardWidget = {
      id: 'widget1',
      widget_type: 'combo',
      visualization_config: saved.visualization_config!,
      title: comboFixture.title,
      data_source_id: 'ds1',
      sql_text: 'SELECT fixture',
      dashboard_id: 'd1',
      created_from_job_id: 'j1',
      enabled: true,
      last_refresh_job_id: null,
      last_refreshed_at: null,
      layout_config: {},
      question: null,
      created_from_sql_execution_id: 's1',
      created_at: '',
      updated_at: '',
      latest_artifact: {
        id: 'latest',
        kind: 'chart',
        source_sql_execution_id: 's1',
        created_at: '2026-10-17T00:00:00Z',
        payload: { ...comboFixture, source_sql_execution_id: 's1' },
      },
    };
    const editable = widgetValuesFromConfig(widget);
    expect(buildVisualizationConfig(editable)).toEqual(saved.visualization_config);
    const chart = chartModelForWidget(widget, 'Warehouse');
    expect(chart?.chartType).toBe('combo');
    if (chart?.chartType !== 'combo') throw new Error('Expected combo');
    expect(chart.series.map((item) => item.axis)).toEqual([
      'primary',
      'primary',
      'secondary',
      'secondary',
    ]);
    expect(chart.secondaryYLabel).toBe('Fulfilment (%)');
  });
  it('derives chart defaults from a persisted chart but validates against its table source', () => {
    const source = findSaveSource(trace, 'chart', 's1');
    expect(source?.defaultWidgetType).toBe('line');
    expect(source?.defaults).toMatchObject({ xField: 'month', valueField: 'revenue' });
    expect(source?.columns).toEqual(['month', 'revenue', 'orders']);
  });

  it('defaults a saved metric widget to the first metric card of a persisted metric group', () => {
    const metricChart = {
      ...trace.artifacts![1]!,
      payload: {
        schema_version: 1,
        renderer: 'frontend',
        chart_type: 'metric',
        source_sql_execution_id: 's1',
        encoding: { metrics: [{ field: 'orders' }, { field: 'revenue' }] },
        data: [{ orders: 3, revenue: 10 }],
      },
    };
    const source = findSaveSource(
      { ...trace, artifacts: [trace.artifacts![0]!, metricChart] },
      'chart',
      's1',
    );
    expect(source?.defaultWidgetType).toBe('metric');
    expect(source?.defaults.metricField).toBe('orders');
  });

  it.each(['metric', 'table', 'bar', 'line', 'area', 'pie', 'donut'] as const)(
    'builds a valid create contract for %s widgets',
    (widgetType) => {
      const body = buildWidgetCreate(values(widgetType), 'j1', 's1');
      expect(body.widget_type).toBe(widgetType);
      expect(body.source_job_id).toBe('j1');
      expect(body.source_sql_execution_id).toBe('s1');
    },
  );

  it('rejects invalid field mappings before the backend performs authoritative validation', () => {
    expect(
      validateWidgetMapping({ ...values('metric'), metricField: 'missing' }, ['month', 'revenue']),
    ).toMatch(/metric field/i);
    expect(
      validateWidgetMapping({ ...values('bar'), xField: 'month', valueField: 'month' }, [
        'month',
        'revenue',
      ]),
    ).toMatch(/different/i);
    expect(
      validateWidgetMapping({ ...values('pie'), categoryField: 'month', valueField: 'missing' }, [
        'month',
        'revenue',
      ]),
    ).toMatch(/value field/i);
  });

  it('preserves every series, orientation and stacking when saving and editing a chart', () => {
    const chart = trace.artifacts![1]!;
    const series = [
      { field: 'online', label: 'Online sales' },
      { field: 'store', label: 'Store sales' },
    ];
    const source = findSaveSource(
      {
        ...trace,
        artifacts: [
          {
            ...trace.artifacts![0]!,
            payload: {
              ...trace.artifacts![0]!.payload,
              columns: ['month', 'online', 'store'],
              rows: [['Jan', 60, 40]],
            },
          },
          {
            ...chart,
            payload: {
              ...chart.payload,
              chart_type: 'bar',
              orientation: 'horizontal',
              stacked: true,
              encoding: { x: { field: 'month' }, series },
            },
          },
        ],
      },
      'chart',
      's1',
    );
    const saved = buildWidgetCreate({ ...values('bar'), ...source!.defaults }, 'j1', 's1');
    expect(
      validateWidgetMapping({ ...values('bar'), ...source!.defaults }, source!.columns),
    ).toBeNull();
    expect(saved.visualization_config).toMatchObject({
      orientation: 'horizontal',
      stacked: true,
      series,
    });
    const editable = widgetValuesFromConfig({
      widget_type: 'bar',
      visualization_config: saved.visualization_config,
    } as DashboardWidget);
    expect(buildVisualizationConfig(editable)).toEqual(saved.visualization_config);
  });

  it('saves donut category/value mapping and rejects duplicate series', () => {
    const saved = buildWidgetCreate(values('donut'), 'j1', 's1');
    expect(saved.visualization_config).toEqual({
      category_field: 'month',
      value_field: 'revenue',
      value_label: 'revenue',
    });
    expect(
      validateWidgetMapping(
        { ...values('bar'), series: [{ field: 'revenue' }, { field: 'revenue' }] },
        ['month', 'revenue'],
      ),
    ).toMatch(/different value field/i);
  });
});
