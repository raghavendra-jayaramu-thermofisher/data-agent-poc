import * as echarts from 'echarts';
import { describe, expect, it } from 'vitest';
import { buildChartOption } from './build-chart-option';
import type { ChartableModel, MultiSourceChartModel } from './chart-domain';
import { normalizeChartArtifact } from './chart-domain';
import comboFixture from '../../../test-fixtures/combo-chart.json';

// SVG rendering uses real ECharts geometry; jsdom supplies no canvas font measurement.
echarts.setPlatformAPI({ measureText: (text) => ({ width: text.length * 7 }) });

const points = [
  { category: 'Services', online: 60, store: 40 },
  { category: 'Products', online: 30, store: 20 },
];
const bars: MultiSourceChartModel = {
  id: 'c1',
  title: 'Sales by category',
  chartType: 'bar',
  dimension: 'category',
  provenance: [],
  series: ['online', 'store'].map((metric) => ({
    id: metric,
    dataSourceId: 'ds1',
    dataSourceName: 'Source',
    metric,
    label: metric,
    dimension: 'category',
    points,
  })),
};
const donut: ChartableModel = {
  id: 'd1',
  title: 'Sales mix',
  chartType: 'donut',
  category: 'category',
  value: 'online',
  valueLabel: 'Sales',
  dataSourceId: 'ds1',
  dataSourceName: 'Source',
  points,
  provenance: [],
};

describe('actual ECharts SVG rendering', () => {
  it('renders mixed columns and lines with real datasets and a secondary axis', () => {
    const model = normalizeChartArtifact(
      {
        id: 'combo',
        job_id: 'j1',
        kind: 'chart',
        name: comboFixture.title,
        source_sql_execution_id: comboFixture.source_sql_execution_id,
        payload: comboFixture,
        created_at: '',
      },
      undefined,
      'Source',
    );
    if (!model || model.chartType !== 'combo') throw new Error('Expected combo');
    const chart = echarts.init(null, undefined, {
      renderer: 'svg',
      ssr: true,
      width: 900,
      height: 450,
    });
    try {
      chart.setOption({ ...buildChartOption(model), animation: false });
      const svg = chart.renderToSVGString();
      for (const text of [
        'Orders (count)',
        'Fulfilment (%)',
        'Online',
        'Store',
        'Target',
        'Jan',
        'Jun',
      ])
        expect(svg).toContain(text);
      expect(svg).not.toContain('NaN');
    } finally {
      chart.dispose();
    }
  });
  it.each([
    { name: 'donut', model: donut },
    { name: 'horizontal bars', model: { ...bars, orientation: 'horizontal' as const } },
    { name: 'stacked columns', model: { ...bars, stacked: true } },
    {
      name: 'stacked horizontal bars',
      model: { ...bars, stacked: true, orientation: 'horizontal' as const },
    },
  ])('renders $name with real dataset encodings', ({ model }) => {
    const chart = echarts.init(null, undefined, {
      renderer: 'svg',
      ssr: true,
      width: 700,
      height: 450,
    });
    try {
      chart.setOption({ ...buildChartOption(model), animation: false });
      const svg = chart.renderToSVGString();
      expect(svg).toContain('<svg');
      expect(svg).toContain('Services');
      expect(svg).toContain('Products');
      expect(svg).toContain('<path');
      expect(svg).not.toContain('NaN');
    } finally {
      chart.dispose();
    }
  });
});
