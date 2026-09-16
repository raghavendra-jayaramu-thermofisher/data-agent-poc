import { expect, it } from 'vitest';
import type { ChartableModel } from './chart-domain';
import { chartSelectionFromEvent, compatibleChartTypes, followUpForSelection } from './chart-interactions';

const line: ChartableModel = {
  id: 'c1', title: 'Revenue', chartType: 'line', dimension: 'month', dimensionLabel: 'Month', comparisonKey: null,
  series: [{ id: 's1', dataSourceId: 'ds1', dataSourceName: 'Warehouse', metric: 'revenue', label: 'Revenue', unit: 'USD', dimension: 'month', points: [{ month: 'Apr 2026', revenue: 8100000 }] }],
  provenance: [{ dataSourceId: 'ds1', dataSourceName: 'Warehouse' }],
};

it('extracts a persistent analytical selection from a controlled chart event', () => {
  expect(chartSelectionFromEvent(line, { seriesId: 's1', data: { month: 'Apr 2026', revenue: 8100000 } })).toEqual({
    dimensionLabel: 'Month', dimensionValue: 'Apr 2026', metricLabel: 'Revenue', value: 8100000, dataSourceName: 'Warehouse',
  });
});

it('creates visible ordinary chat follow-ups from a chart selection', () => {
  const selection = chartSelectionFromEvent(line, { seriesId: 's1', data: { month: 'Apr 2026', revenue: 8100000 } })!;
  expect(followUpForSelection('explain', selection)).toBe('Explain Revenue for Month Apr 2026, including the main reasons behind this result.');
  expect(followUpForSelection('breakdown', selection)).toMatch(/^Break down Revenue/);
  expect(followUpForSelection('compare', selection)).toMatch(/^Compare Revenue/);
});

it('offers only safe local cartesian presentation switches', () => {
  expect(compatibleChartTypes(line)).toEqual(['line', 'bar', 'area']);
  expect(compatibleChartTypes({ id: 'p1', title: 'Mix', chartType: 'pie', category: 'segment', value: 'revenue', valueLabel: 'Revenue', dataSourceId: 'ds1', dataSourceName: 'Warehouse', points: [{ segment: 'A', revenue: 1 }], provenance: [] })).toEqual([]);
});
