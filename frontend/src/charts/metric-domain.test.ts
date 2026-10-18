import { describe, expect, it } from 'vitest';
import {
  changeTone,
  computeMetricChange,
  formatCompact,
  formatMetricValue,
  toFiniteNumber,
  type MetricDirection,
  type MetricPolarity,
} from './metric-domain';

describe('toFiniteNumber', () => {
  it('parses numbers and numeric text and rejects everything else', () => {
    expect(toFiniteNumber(12.5)).toBe(12.5);
    expect(toFiniteNumber('17552267.65356')).toBe(17552267.65356);
    expect(toFiniteNumber('$1,250.50')).toBe(1250.5);
    expect(toFiniteNumber('n/a')).toBeNull();
    expect(toFiniteNumber('')).toBeNull();
    expect(toFiniteNumber(Number.NaN)).toBeNull();
    expect(toFiniteNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(toFiniteNumber(null)).toBeNull();
    expect(toFiniteNumber(true)).toBeNull();
  });
});

describe('formatCompact', () => {
  it.each([
    [0, '0'],
    [12.5, '12.5'],
    [999, '999'],
    [1000, '1.00K'],
    [1234.5, '1.23K'],
    [999.999, '1.00K'],
    [999995, '1.00M'],
    [17552267.65356, '17.55M'],
    [2.5e9, '2.50B'],
    [-1500, '-1.50K'],
    [-17552267, '-17.55M'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatCompact(value)).toBe(expected);
  });

  it('keeps two decimals below one thousand when asked (money)', () => {
    expect(formatCompact(950.5, true)).toBe('950.50');
    expect(formatCompact(0, true)).toBe('0.00');
  });
});

describe('formatMetricValue', () => {
  it('shows currency compactly with the exact value underneath', () => {
    expect(formatMetricValue(17552267.65356, 'currency', 'P$')).toEqual({
      headline: 'P$17.55M',
      exact: 'P$17,552,267.65',
    });
    expect(formatMetricValue(-1500000, 'currency', 'P$').headline).toBe('-P$1.50M');
    expect(formatMetricValue(950.5, 'currency', 'P$')).toEqual({
      headline: 'P$950.50',
      exact: null,
    });
    expect(formatMetricValue(48184.6719, 'currency', null).headline).toBe('48.18K');
  });

  it('shows counts as whole numbers with separators and never abbreviates them', () => {
    expect(formatMetricValue(17080, 'count', null)).toEqual({ headline: '17,080', exact: null });
    expect(formatMetricValue(17080.6, 'count', null).headline).toBe('17,081');
  });

  it('shows percentages with two decimals', () => {
    expect(formatMetricValue(52.034, 'percent', null)).toEqual({ headline: '52.03%', exact: null });
  });

  it('appends a unit to plain numbers and keeps the exact value', () => {
    expect(formatMetricValue(1029962.2, 'number', 'L')).toEqual({
      headline: '1.03M L',
      exact: '1,029,962.2 L',
    });
    expect(formatMetricValue(42, 'number', null)).toEqual({ headline: '42', exact: null });
  });
});

describe('changeTone', () => {
  it.each<[MetricDirection, MetricPolarity, string]>([
    ['up', 'higher_is_better', 'positive'],
    ['up', 'lower_is_better', 'negative'],
    ['down', 'higher_is_better', 'negative'],
    ['down', 'lower_is_better', 'positive'],
    ['up', 'neutral', 'neutral'],
    ['down', 'neutral', 'neutral'],
    ['flat', 'higher_is_better', 'neutral'],
    ['flat', 'lower_is_better', 'neutral'],
  ])('%s with %s is %s', (direction, polarity, expected) => {
    expect(changeTone(direction, polarity)).toBe(expected);
  });
});

describe('computeMetricChange', () => {
  const base = {
    format: 'currency' as const,
    unit: 'P$',
    polarity: 'neutral' as const,
    label: 'vs previous week',
  };

  it('calculates a decrease from the two values', () => {
    const change = computeMetricChange(17552267.65, 17846061.87, base)!;
    expect(change.direction).toBe('down');
    expect(change.percentText).toBe('1.65%');
    expect(change.amountText).toBe('P$293.79K');
    expect(change.tone).toBe('neutral');
    expect(change.spokenText).toBe('Down 1.65% vs previous week');
  });

  it('colours the change by polarity, not by direction', () => {
    const good = computeMetricChange(90, 100, { ...base, polarity: 'lower_is_better' })!;
    const bad = computeMetricChange(90, 100, { ...base, polarity: 'higher_is_better' })!;
    expect(good.tone).toBe('positive');
    expect(bad.tone).toBe('negative');
  });

  it('reports an increase and no change', () => {
    expect(computeMetricChange(110, 100, base)!.direction).toBe('up');
    const flat = computeMetricChange(100, 100, { ...base, polarity: 'higher_is_better' })!;
    expect(flat.direction).toBe('flat');
    expect(flat.tone).toBe('neutral');
    expect(flat.spokenText).toBe('No change vs previous week');
  });

  it('has no percentage against a zero baseline', () => {
    const change = computeMetricChange(50, 0, base)!;
    expect(change.percentText).toBeNull();
    expect(change.amountText).toBe('P$50.00');
    expect(change.spokenText).toBe('Up P$50.00 vs previous week');
  });

  it('measures percent metrics in percentage points', () => {
    const change = computeMetricChange(52.03, 50, { ...base, format: 'percent', unit: null })!;
    expect(change.amountText).toBe('2.03 pp');
    expect(change.percentText).toBeNull();
    expect(change.direction).toBe('up');
  });

  it('handles negative baselines and counts', () => {
    expect(computeMetricChange(-50, -100, base)!.direction).toBe('up');
    expect(computeMetricChange(-50, -100, base)!.percentText).toBe('50.00%');
    const count = computeMetricChange(17080, 17500, { ...base, format: 'count', unit: null })!;
    expect(count.amountText).toBe('420');
    expect(count.percentText).toBe('2.40%');
  });

  it('is absent without a comparison value', () => {
    expect(computeMetricChange(10, null, base)).toBeNull();
  });

  it('omits the label from spoken text when none is given', () => {
    expect(computeMetricChange(10, 5, { ...base, label: null })!.spokenText).toBe('Up 100.00%');
  });
});
