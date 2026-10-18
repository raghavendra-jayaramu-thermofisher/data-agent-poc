import { describe, expect, it } from 'vitest';
import type { JobArtifact, SqlExecution } from '../agent/api/execution-api';
import { combineCompatibleCharts, isCircularChart, normalizeChartArtifact } from './chart-domain';

const sql = (id: string, source: string): SqlExecution => ({
  id,
  tool_execution_id: `t-${id}`,
  data_source_id: source,
  sql_text: 'SELECT 1',
  status: 'succeeded',
  row_count: 2,
  truncated: false,
  columns: ['month', 'revenue'],
  result_bytes: 20,
  duration_ms: 5,
  error_code: null,
  error_message: null,
  started_at: '2026-08-24T12:00:00Z',
  finished_at: '2026-08-24T12:00:01Z',
});
function chart(id: string, sourceSql: string, payload: Record<string, unknown>): JobArtifact {
  return {
    id,
    job_id: 'j1',
    kind: 'chart',
    name: 'Revenue',
    payload,
    source_sql_execution_id: sourceSql,
    created_at: '2026-08-24T12:00:01Z',
  };
}
function linePayload(extra: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    renderer: 'frontend',
    chart_type: 'line',
    title: 'Revenue',
    encoding: {
      x: { field: 'month' },
      series: [{ field: 'revenue', label: 'Revenue', unit: 'USD' }],
    },
    data: [
      { month: 'Jan', revenue: '10.5' },
      { month: 'Feb', revenue: 20 },
    ],
    ...extra,
  };
}

function metricPayload(metrics: unknown, row: Record<string, unknown>) {
  return {
    schema_version: 1,
    renderer: 'frontend',
    chart_type: 'metric',
    title: 'Backlog',
    encoding: { metrics },
    data: [row],
  };
}
const normalizeMetric = (payload: Record<string, unknown>) =>
  normalizeChartArtifact(chart('m1', 's1', payload), sql('s1', 'ds1'), 'Warehouse');

describe('metric artifact normalization', () => {
  it('builds a primary card with comparison, supporting figures and numeric text values', () => {
    const model = normalizeMetric(
      metricPayload(
        [
          {
            field: 'backlog',
            label: 'Backlog value',
            format: 'currency',
            unit: 'P$',
            caption: 'Latest snapshot',
            icon: 'package',
            tone: 'warning',
            comparison_field: 'previous',
            comparison_label: 'vs previous week',
            polarity: 'lower_is_better',
            details: [{ field: 'lines', label: 'Open lines', format: 'count' }],
          },
          { field: 'quantity' },
        ],
        { backlog: '17552267.65356', previous: 17846061.87, lines: 17080, quantity: 1029962.2 },
      ),
    );
    expect(model?.chartType).toBe('metric');
    if (model?.chartType !== 'metric') throw new Error('expected a metric model');
    expect(model.metrics).toHaveLength(2);
    expect(model.metrics[0]).toMatchObject({
      field: 'backlog',
      label: 'Backlog value',
      format: 'currency',
      unit: 'P$',
      icon: 'package',
      tone: 'warning',
      value: 17552267.65356,
      polarity: 'lower_is_better',
      comparison: { field: 'previous', label: 'vs previous week', value: 17846061.87 },
      details: [{ field: 'lines', label: 'Open lines', format: 'count', value: 17080 }],
    });
    expect(model.metrics[1]).toMatchObject({
      field: 'quantity',
      label: 'quantity',
      format: 'number',
      tone: 'neutral',
      polarity: 'neutral',
      comparison: null,
      details: [],
    });
  });

  it('keeps a card when the comparison or a supporting figure is missing', () => {
    const model = normalizeMetric(
      metricPayload(
        [{ field: 'backlog', comparison_field: 'previous', details: [{ field: 'lines' }] }],
        { backlog: 10, previous: null, lines: null },
      ),
    );
    if (model?.chartType !== 'metric') throw new Error('expected a metric model');
    expect(model.metrics[0]!.comparison?.value).toBeNull();
    expect(model.metrics[0]!.details[0]!.value).toBeNull();
  });

  it.each([
    ['no metrics', []],
    ['more than six cards', Array.from({ length: 7 }, (_, index) => ({ field: `m${index}` }))],
    ['a repeated headline', [{ field: 'a' }, { field: 'a' }]],
    ['an unknown tone', [{ field: 'a', tone: 'purple' }]],
    ['an unknown icon', [{ field: 'a', icon: 'rocket' }]],
    ['an unknown format', [{ field: 'a', format: 'money' }]],
    ['an unknown polarity', [{ field: 'a', comparison_field: 'b', polarity: 'good' }]],
    [
      'too many supporting figures',
      [{ field: 'a', details: ['b', 'c', 'd', 'e', 'f'].map((field) => ({ field })) }],
    ],
    ['a supporting figure without a field', [{ field: 'a', details: [{}] }]],
  ])('rejects %s', (_name, metrics) => {
    const row = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, m0: 1 };
    expect(normalizeMetric(metricPayload(metrics, row))).toBeNull();
  });

  it('rejects a non-numeric headline, a missing column and a legacy single-value encoding', () => {
    expect(normalizeMetric(metricPayload([{ field: 'a' }], { a: 'n/a' }))).toBeNull();
    expect(normalizeMetric(metricPayload([{ field: 'a' }], { a: null }))).toBeNull();
    expect(normalizeMetric(metricPayload([{ field: 'a' }], { b: 1 }))).toBeNull();
    expect(
      normalizeMetric({
        ...metricPayload([], { revenue: 10 }),
        encoding: { value: { field: 'revenue' } },
      }),
    ).toBeNull();
  });
});

describe('chart artifact normalization', () => {
  it.each(['bar', 'line', 'area'] as const)(
    'accepts controlled %s field encodings and numeric strings',
    (chartType) => {
      const model = normalizeChartArtifact(
        chart('a1', 's1', { ...linePayload(), chart_type: chartType }),
        sql('s1', 'ds1'),
        'Warehouse',
      );
      expect(model?.chartType).toBe(chartType);
      if (model && !isCircularChart(model) && model.chartType !== 'metric') {
        expect(model.series[0]?.points[0]?.revenue).toBe(10.5);
      }
    },
  );

  it('accepts controlled pie encoding', () => {
    const model = normalizeChartArtifact(
      chart('a1', 's1', {
        schema_version: 1,
        renderer: 'frontend',
        chart_type: 'pie',
        title: 'Mix',
        encoding: { category: { field: 'segment' }, value: { field: 'revenue', label: 'Revenue' } },
        data: [
          { segment: 'A', revenue: 60 },
          { segment: 'B', revenue: 40 },
        ],
      }),
      sql('s1', 'ds1'),
      'Warehouse',
    );
    expect(model?.chartType).toBe('pie');
  });

  it('fails safely for arbitrary renderer/options and missing encoded fields', () => {
    expect(
      normalizeChartArtifact(
        chart('a1', 's1', {
          renderer: 'echarts',
          chart_type: 'line',
          option: { series: [{ type: 'custom' }] },
        }),
        sql('s1', 'ds1'),
        'Warehouse',
      ),
    ).toBeNull();
    expect(
      normalizeChartArtifact(
        chart('a2', 's1', {
          ...linePayload(),
          encoding: { x: { field: 'month' }, series: [{ field: 'missing' }] },
        }),
        sql('s1', 'ds1'),
        'Warehouse',
      ),
    ).toBeNull();
  });

  it('rejects multiple labels that reuse the same numeric series field', () => {
    const malformed = linePayload({
      encoding: {
        x: { field: 'month' },
        series: [
          { field: 'revenue', label: 'Credit Hold' },
          { field: 'revenue', label: 'Customer Hold' },
        ],
      },
    });
    expect(
      normalizeChartArtifact(chart('a1', 's1', malformed), sql('s1', 'ds1'), 'Warehouse'),
    ).toBeNull();
  });

  it('rejects cartesian data with repeated dimension values', () => {
    const malformed = linePayload({
      data: [
        { month: 'Jan', revenue: 10 },
        { month: 'Jan', revenue: 20 },
      ],
    });
    expect(
      normalizeChartArtifact(chart('a1', 's1', malformed), sql('s1', 'ds1'), 'Warehouse'),
    ).toBeNull();
  });

  it('rejects pie data with repeated categories and metrics with multiple rows', () => {
    const repeatedPie = {
      schema_version: 1,
      renderer: 'frontend',
      chart_type: 'pie',
      title: 'Mix',
      encoding: { category: { field: 'segment' }, value: { field: 'revenue' } },
      data: [
        { segment: 'A', revenue: 10 },
        { segment: 'A', revenue: 20 },
      ],
    };
    const multiRowMetric = {
      schema_version: 1,
      renderer: 'frontend',
      chart_type: 'metric',
      title: 'Revenue',
      encoding: { metrics: [{ field: 'revenue' }] },
      data: [{ revenue: 10 }, { revenue: 20 }],
    };
    expect(
      normalizeChartArtifact(chart('a1', 's1', repeatedPie), sql('s1', 'ds1'), 'Warehouse'),
    ).toBeNull();
    expect(
      normalizeChartArtifact(chart('a2', 's1', multiRowMetric), sql('s1', 'ds1'), 'Warehouse'),
    ).toBeNull();
  });

  it('preserves datasource provenance and combines only explicitly compatible multi-source series', () => {
    const first = normalizeChartArtifact(
      chart('a1', 's1', linePayload({ comparison_key: 'monthly-revenue' })),
      sql('s1', 'ds1'),
      'Primary DB',
    );
    const second = normalizeChartArtifact(
      chart('a2', 's2', linePayload({ comparison_key: 'monthly-revenue' })),
      sql('s2', 'ds2'),
      'Secondary DB',
    );
    const combined = combineCompatibleCharts([first!, second!]);
    expect(combined).toHaveLength(1);
    expect(combined[0]!.provenance.map((item) => item.dataSourceName)).toEqual([
      'Primary DB',
      'Secondary DB',
    ]);
    const combinedModel = combined[0];
    if (combinedModel && !isCircularChart(combinedModel) && combinedModel.chartType !== 'metric') {
      expect(combinedModel.series.map((item) => item.dataSourceName)).toEqual([
        'Primary DB',
        'Secondary DB',
      ]);
    }
  });

  it('does not silently merge multi-source results without an explicit comparison key', () => {
    const first = normalizeChartArtifact(
      chart('a1', 's1', linePayload()),
      sql('s1', 'ds1'),
      'Primary DB',
    );
    const second = normalizeChartArtifact(
      chart('a2', 's2', linePayload()),
      sql('s2', 'ds2'),
      'Secondary DB',
    );
    expect(combineCompatibleCharts([first!, second!])).toHaveLength(2);
  });

  it('normalizes donut data with the same SQL provenance as other charts', () => {
    const model = normalizeChartArtifact(
      chart('a1', 's1', {
        schema_version: 1,
        renderer: 'frontend',
        chart_type: 'donut',
        source_sql_execution_id: 's1',
        encoding: { category: { field: 'category' }, value: { field: 'sales' } },
        data: [
          { category: 'Services', sales: '60' },
          { category: 'Products', sales: 40 },
        ],
      }),
      sql('s1', 'ds1'),
      'Warehouse',
    );
    expect(model?.chartType).toBe('donut');
    if (model && isCircularChart(model)) {
      expect(model.points[0]?.sales).toBe(60);
      expect(model.provenance[0]?.executionId).toBe('s1');
    }
  });

  it.each([
    [-1, 10],
    [0, 0],
    [null, 10],
  ])('rejects invalid donut measurements %s, %s', (first, second) => {
    expect(
      normalizeChartArtifact(
        chart('a1', 's1', {
          schema_version: 1,
          renderer: 'frontend',
          chart_type: 'donut',
          encoding: { category: { field: 'category' }, value: { field: 'sales' } },
          data: [
            { category: 'Services', sales: first },
            { category: 'Products', sales: second },
          ],
        }),
        sql('s1', 'ds1'),
        'Warehouse',
      ),
    ).toBeNull();
  });

  it('defaults old bar artifacts and preserves new orientation and stacking', () => {
    const old = normalizeChartArtifact(
      chart('a1', 's1', linePayload({ chart_type: 'bar' })),
      sql('s1', 'ds1'),
      'Warehouse',
    );
    expect(old).toMatchObject({ orientation: 'vertical', stacked: false });
    const current = normalizeChartArtifact(
      chart(
        'a2',
        's1',
        linePayload({ chart_type: 'bar', orientation: 'horizontal', stacked: true }),
      ),
      sql('s1', 'ds1'),
      'Warehouse',
    );
    expect(current).toMatchObject({ orientation: 'horizontal', stacked: true });
  });

  it.each([
    { chart_type: 'bar', orientation: 'diagonal' },
    { chart_type: 'bar', orientation: ['horizontal'] },
    { chart_type: 'bar', stacked: 'true' },
    { chart_type: 'line', stacked: true },
    { chart_type: 'area', orientation: 'horizontal' },
  ])('rejects unsupported chart options %j', (extra) => {
    expect(
      normalizeChartArtifact(chart('a1', 's1', linePayload(extra)), sql('s1', 'ds1'), 'Warehouse'),
    ).toBeNull();
  });

  it('rejects stacks containing different measurement units', () => {
    expect(
      normalizeChartArtifact(
        chart(
          'a1',
          's1',
          linePayload({
            chart_type: 'bar',
            stacked: true,
            encoding: {
              x: { field: 'month' },
              series: [
                { field: 'revenue', unit: 'USD' },
                { field: 'orders', unit: 'orders' },
              ],
            },
            data: [{ month: 'Jan', revenue: 10, orders: 2 }],
          }),
        ),
        sql('s1', 'ds1'),
        'Warehouse',
      ),
    ).toBeNull();
  });

  it.each([{ orientation: 'horizontal' }, { stacked: true }])(
    'keeps charts with different presentation options separate',
    (options) => {
      const payload = linePayload({ chart_type: 'bar', comparison_key: 'monthly-sales' });
      const first = normalizeChartArtifact(
        chart('a1', 's1', payload),
        sql('s1', 'ds1'),
        'Source A',
      );
      const second = normalizeChartArtifact(
        chart('a2', 's2', { ...payload, ...options }),
        sql('s2', 'ds2'),
        'Source B',
      );
      expect(combineCompatibleCharts([first!, second!])).toHaveLength(2);
    },
  );
});
