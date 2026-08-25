import { describe, expect, it } from 'vitest';
import type { MultiSourceChartModel, PieChartModel } from './chart-domain';
import { buildChartOption } from './build-chart-option';

const series = (id: string, source: string, unit: string, metric = 'value') => ({ id, dataSourceId: source, dataSourceName: source, metric, label: metric, unit, dimension: 'month', points: [{ month: 'Jan', [metric]: 1 }, { month: 'Feb', [metric]: 2 }] });

describe('controlled ECharts option builder', () => {
  it.each(['bar', 'line', 'area'] as const)('builds %s options through dataset + encode', (chartType) => {
    const model: MultiSourceChartModel = { id: 'c1', title: 'Test', chartType, dimension: 'month', series: [series('s1', 'DB', 'USD')], provenance: [{ dataSourceId: 'DB', dataSourceName: 'DB' }] };
    const option = buildChartOption(model) as Record<string, unknown>;
    expect(option.dataset).toBeTruthy();
    expect(option.series).toBeTruthy();
    expect(JSON.stringify(option)).not.toContain('renderItem');
  });

  it('uses a deliberate second value axis for two explicit units', () => {
    const model: MultiSourceChartModel = { id: 'c1', title: 'Revenue and rate', chartType: 'line', dimension: 'month', series: [series('s1', 'DB', 'USD', 'revenue'), series('s2', 'DB', '%', 'rate')], provenance: [{ dataSourceId: 'DB', dataSourceName: 'DB' }] };
    const option = buildChartOption(model) as { yAxis?: unknown[]; series?: Array<{ yAxisIndex?: number }> };
    expect(option.yAxis).toHaveLength(2);
    expect(option.series?.map((item) => item.yAxisIndex)).toEqual([0, 1]);
  });

  it('adds dataZoom for long time series', () => {
    const long = series('s1', 'DB', 'USD'); long.points = Array.from({ length: 80 }, (_, i) => ({ month: String(i), value: i }));
    const option = buildChartOption({ id: 'c1', title: 'Long', chartType: 'line', dimension: 'month', series: [long], provenance: [{ dataSourceId: 'DB', dataSourceName: 'DB' }] }) as Record<string, unknown>;
    expect(option.dataZoom).toBeTruthy();
  });

  it('builds pie options without arbitrary executable configuration', () => {
    const model: PieChartModel = { id: 'p1', title: 'Mix', chartType: 'pie', category: 'segment', value: 'revenue', valueLabel: 'Revenue', dataSourceId: 'ds1', dataSourceName: 'DB', points: [{ segment: 'A', revenue: 60 }], provenance: [{ dataSourceId: 'ds1', dataSourceName: 'DB' }] };
    const option = buildChartOption(model);
    expect(JSON.stringify(option)).toContain('pie');
    expect(JSON.stringify(option)).not.toContain('function');
  });
});
