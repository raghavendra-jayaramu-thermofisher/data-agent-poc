import { describe, expect, it } from 'vitest';
import fixture from '../../../test-fixtures/combo-chart.json';
import { buildChartOption } from './build-chart-option';
import { combineCompatibleCharts, normalizeChartArtifact } from './chart-domain';
import { chartSelectionFromEvent, compatibleChartTypes } from './chart-interactions';
import type { JobArtifact } from '../agent/api/execution-api';

const artifact: JobArtifact = {
  id: 'combo1',
  job_id: 'j1',
  kind: 'chart',
  name: fixture.title,
  source_sql_execution_id: fixture.source_sql_execution_id,
  payload: fixture,
  created_at: '',
};
function normalize(payload: unknown = fixture) {
  return normalizeChartArtifact(
    { ...artifact, payload: payload as Record<string, unknown> },
    undefined,
    'Warehouse',
  );
}

describe('line and stacked column chart', () => {
  it('stacks only columns and uses explicit axes and SQL order', () => {
    const model = normalize()!;
    expect(model.chartType).toBe('combo');
    if (model.chartType !== 'combo') throw new Error('Expected combo');
    expect(compatibleChartTypes(model)).toEqual(['combo']);
    const option = buildChartOption(model) as {
      series: Array<{ type: string; stack?: string; yAxisIndex: number; connectNulls?: boolean }>;
      yAxis: Array<{ name: string }>;
    };
    expect(option.series.map((series) => series.type)).toEqual(['bar', 'bar', 'line', 'line']);
    expect(option.series.map((series) => series.stack)).toEqual([
      'datasource',
      'datasource',
      undefined,
      undefined,
    ]);
    expect(option.series.map((series) => series.yAxisIndex)).toEqual([0, 0, 1, 1]);
    expect(option.series[2]!.connectNulls).toBe(false);
    expect(option.yAxis.map((axis) => axis.name)).toEqual(['Orders (count)', 'Fulfilment (%)']);
    expect(model.series[2]!.points[1]!.fulfilled).toBeNull();
    expect(
      chartSelectionFromEvent(model, {
        seriesId: model.series[2]!.id,
        data: model.series[2]!.points[0],
      }),
    ).toMatchObject({ metricLabel: 'Fulfilment', value: 72.5, dimensionValue: 'Jan' });
    expect(
      combineCompatibleCharts([
        { ...model, comparisonKey: 'same' },
        { ...model, id: 'other', comparisonKey: 'same' },
      ]),
    ).toHaveLength(2);
  });

  it.each([
    'missing_type',
    'secondary_bar',
    'mixed_unit',
    'invalid_value',
    'missing_column',
    'duplicate_category',
  ])('rejects %s', (kind) => {
    const payload = structuredClone(fixture);
    if (kind === 'missing_type') payload.encoding.series[0]!.type = '';
    if (kind === 'secondary_bar') payload.encoding.series[0]!.axis = 'secondary';
    if (kind === 'mixed_unit') payload.encoding.series[2]!.axis = 'primary';
    if (kind === 'invalid_value') payload.data[0]!.fulfilled = 'invalid';
    if (kind === 'missing_column') payload.data[0]!.online = null as never;
    if (kind === 'duplicate_category') payload.data[1]!.month = 'Jan';
    expect(normalize(payload)).toBeNull();
  });

  it('uses one shared scale and unstacked columns when configured', () => {
    const payload = structuredClone(fixture);
    payload.stacked = false;
    payload.encoding.series.forEach((series) => {
      series.axis = 'primary';
      series.unit = 'count';
    });
    const model = normalize(payload)!;
    if (model.chartType !== 'combo') throw new Error('Expected combo');
    const option = buildChartOption(model) as {
      series: Array<{ stack?: string; yAxisIndex: number }>;
      yAxis: unknown[];
    };
    expect(option.yAxis).toHaveLength(1);
    expect(
      option.series.every((series) => series.stack === undefined && series.yAxisIndex === 0),
    ).toBe(true);
  });
});
