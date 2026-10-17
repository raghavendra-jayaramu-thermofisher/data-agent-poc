import { describe, expect, it } from 'vitest';
import type { MultiSourceChartModel, PieChartModel } from './chart-domain';
import { buildChartOption } from './build-chart-option';

const series = (id: string, source: string, unit: string, metric = 'value') => ({
  id,
  dataSourceId: source,
  dataSourceName: source,
  metric,
  label: metric,
  unit,
  dimension: 'month',
  points: [
    { month: 'Jan', [metric]: 1 },
    { month: 'Feb', [metric]: 2 },
  ],
});

describe('controlled ECharts option builder', () => {
  it.each(['bar', 'line', 'area'] as const)(
    'builds %s options through dataset + encode',
    (chartType) => {
      const model: MultiSourceChartModel = {
        id: 'c1',
        title: 'Test',
        chartType,
        dimension: 'month',
        series: [series('s1', 'DB', 'USD')],
        provenance: [{ dataSourceId: 'DB', dataSourceName: 'DB' }],
      };
      const option = buildChartOption(model) as Record<string, unknown>;
      expect(option.dataset).toBeTruthy();
      expect(option.series).toBeTruthy();
      expect(JSON.stringify(option)).not.toContain('renderItem');
    },
  );

  it('uses a deliberate second value axis for two explicit units', () => {
    const model: MultiSourceChartModel = {
      id: 'c1',
      title: 'Revenue and rate',
      chartType: 'line',
      dimension: 'month',
      series: [series('s1', 'DB', 'USD', 'revenue'), series('s2', 'DB', '%', 'rate')],
      provenance: [{ dataSourceId: 'DB', dataSourceName: 'DB' }],
    };
    const option = buildChartOption(model) as {
      yAxis?: unknown[];
      series?: Array<{ yAxisIndex?: number }>;
    };
    expect(option.yAxis).toHaveLength(2);
    expect(option.series?.map((item) => item.yAxisIndex)).toEqual([0, 1]);
  });

  it('adds dataZoom for long time series', () => {
    const long = series('s1', 'DB', 'USD');
    long.points = Array.from({ length: 80 }, (_, i) => ({ month: String(i), value: i }));
    const option = buildChartOption({
      id: 'c1',
      title: 'Long',
      chartType: 'line',
      dimension: 'month',
      series: [long],
      provenance: [{ dataSourceId: 'DB', dataSourceName: 'DB' }],
    }) as Record<string, unknown>;
    expect(option.dataZoom).toBeTruthy();
  });

  it('builds pie options without arbitrary executable configuration', () => {
    const model: PieChartModel = {
      id: 'p1',
      title: 'Mix',
      chartType: 'pie',
      category: 'segment',
      value: 'revenue',
      valueLabel: 'Revenue',
      dataSourceId: 'ds1',
      dataSourceName: 'DB',
      points: [{ segment: 'A', revenue: 60 }],
      provenance: [{ dataSourceId: 'ds1', dataSourceName: 'DB' }],
    };
    const option = buildChartOption(model);
    expect(JSON.stringify(option)).toContain('pie');
    expect(JSON.stringify(option)).not.toContain('function');
  });

  it.each(['vertical', 'horizontal'] as const)(
    'renders %s stacks with distinct component encodings',
    (orientation) => {
      const points = [{ month: 'Jan', online: 60, store: 40 }];
      const model: MultiSourceChartModel = {
        id: 'c1',
        title: 'Sales mix',
        chartType: 'bar',
        orientation,
        stacked: true,
        dimension: 'month',
        provenance: [],
        series: [
          { ...series('s1', 'DB', 'USD', 'online'), points },
          { ...series('s2', 'DB', 'USD', 'store'), points },
        ],
      };
      const option = buildChartOption(model) as {
        xAxis: { type: string } | Array<{ type: string }>;
        yAxis: { type: string; inverse?: boolean } | Array<{ type: string }>;
        series: Array<{ encode: Record<string, string>; stack?: string; stackStrategy?: string }>;
      };
      expect(option.series.map((item) => item.stack)).toEqual(['DB', 'DB']);
      expect(option.series[0]?.stackStrategy).toBe('samesign');
      expect(option.series[0]?.encode).toEqual(
        orientation === 'horizontal' ? { x: 'online', y: 'month' } : { x: 'month', y: 'online' },
      );
      if (orientation === 'horizontal') {
        expect(option.xAxis).toMatchObject([{ type: 'value', name: 'USD' }]);
        expect(option.yAxis).toMatchObject({ type: 'category', inverse: true });
      } else {
        expect(option.xAxis).toMatchObject({ type: 'category' });
      }
    },
  );

  it('keeps combined data sources in separate stacks', () => {
    const option = buildChartOption({
      id: 'c1',
      title: 'Sales',
      chartType: 'bar',
      stacked: true,
      dimension: 'month',
      series: [series('s1', 'Source A', 'USD'), series('s2', 'Source B', 'USD')],
      provenance: [],
    }) as { series: Array<{ stack?: string }> };
    expect(option.series.map((item) => item.stack)).toEqual(['Source A', 'Source B']);
  });

  it('keeps legacy bars grouped and uses the category axis for horizontal zoom', () => {
    const long = series('s1', 'DB', 'USD');
    long.points = Array.from({ length: 80 }, (_, i) => ({ month: String(i), value: i }));
    const model: MultiSourceChartModel = {
      id: 'c1',
      title: 'Sales',
      chartType: 'bar',
      dimension: 'month',
      series: [long],
      provenance: [],
    };
    const legacy = buildChartOption(model) as { series: Array<{ stack?: string }> };
    expect(legacy.series[0]?.stack).toBeUndefined();
    const horizontal = buildChartOption({ ...model, orientation: 'horizontal' }) as {
      dataZoom: Array<{ yAxisIndex?: number; orient?: string }>;
    };
    expect(horizontal.dataZoom[0]?.yAxisIndex).toBe(0);
    expect(horizontal.dataZoom[1]?.orient).toBe('vertical');
  });

  it('renders a donut as a pie series with an inner radius', () => {
    const model: PieChartModel = {
      id: 'd1',
      title: 'Sales mix',
      chartType: 'donut',
      category: 'category',
      value: 'sales',
      valueLabel: 'Sales',
      dataSourceId: 'ds1',
      dataSourceName: 'DB',
      points: [
        { category: 'Services', sales: 60 },
        { category: 'Products', sales: 40 },
      ],
      provenance: [],
    };
    const option = buildChartOption(model) as {
      series: Array<{ type: string; radius: string[]; encode: Record<string, string> }>;
    };
    expect(option.series[0]).toMatchObject({
      type: 'pie',
      radius: ['45%', '68%'],
      encode: { itemName: 'category', value: 'sales' },
    });
  });
});
