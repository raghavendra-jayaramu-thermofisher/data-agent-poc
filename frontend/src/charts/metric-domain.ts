export const MAX_METRICS = 6;
export const MAX_METRIC_DETAILS = 4;

export const METRIC_FORMATS = ['number', 'currency', 'count', 'percent'] as const;
export const METRIC_TONES = ['neutral', 'positive', 'negative', 'warning', 'info'] as const;
export const METRIC_POLARITIES = ['higher_is_better', 'lower_is_better', 'neutral'] as const;
export const METRIC_ICONS = [
  'alert',
  'calendar',
  'chart',
  'check',
  'clock',
  'currency',
  'lock',
  'package',
  'truck',
  'users',
] as const;

export type MetricFormat = (typeof METRIC_FORMATS)[number];
export type MetricTone = (typeof METRIC_TONES)[number];
export type MetricPolarity = (typeof METRIC_POLARITIES)[number];
export type MetricIconName = (typeof METRIC_ICONS)[number];

export type MetricDetailModel = {
  field: string;
  label: string;
  format: MetricFormat;
  unit: string | null;
  value: number | null;
};

export type MetricCardModel = {
  field: string;
  label: string;
  format: MetricFormat;
  unit: string | null;
  caption: string | null;
  icon: MetricIconName | null;
  tone: MetricTone;
  value: number;
  comparison: { field: string; label: string | null; value: number | null } | null;
  polarity: MetricPolarity;
  details: MetricDetailModel[];
};

export type MetricDirection = 'up' | 'down' | 'flat';
export type MetricChange = {
  direction: MetricDirection;
  /** Absolute change, formatted like the headline value (percentage points for percent metrics). */
  amountText: string;
  /** Relative change versus the comparison value; null when it is undefined (zero baseline) or a percent metric. */
  percentText: string | null;
  label: string | null;
  tone: MetricTone;
  /** Complete wording for assistive technology. */
  spokenText: string;
};

const LOCALE = 'en-US';
const COMPACT_UNITS = [
  { divisor: 1e3, suffix: 'K' },
  { divisor: 1e6, suffix: 'M' },
  { divisor: 1e9, suffix: 'B' },
] as const;

/** Parse a finite number from a number or numeric text such as "1,250.50"; otherwise null. */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[$,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const wholeNumber = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const twoDecimals = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const upToTwoDecimals = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });

/** K, M or B with two decimals; plain figure below one thousand (fixed to two decimals for money). */
export function formatCompact(value: number, fixedDecimals = false): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs < 1000) {
    const plain = (fixedDecimals ? twoDecimals : upToTwoDecimals).format(abs);
    // A value such as 999.999 rounds up to 1,000 and belongs in the next unit.
    if (!plain.startsWith('1,000')) return sign + plain;
  }
  let index = 0;
  while (index < COMPACT_UNITS.length - 1 && abs >= COMPACT_UNITS[index + 1]!.divisor) index += 1;
  let scaled = Math.round((abs / COMPACT_UNITS[index]!.divisor) * 100) / 100;
  // Rounding can reach 1,000 of a unit (999,995 -> 1,000.00K); promote it to the next unit.
  if (scaled >= 1000 && index < COMPACT_UNITS.length - 1) {
    index += 1;
    scaled = Math.round((abs / COMPACT_UNITS[index]!.divisor) * 100) / 100;
  }
  return `${sign}${twoDecimals.format(scaled)}${COMPACT_UNITS[index]!.suffix}`;
}

function withUnit(text: string, format: MetricFormat, unit: string | null): string {
  if (!unit) return text;
  if (format === 'currency') return text.startsWith('-') ? `-${unit}${text.slice(1)}` : unit + text;
  return `${text} ${unit}`;
}

export function formatMetricValue(
  value: number,
  format: MetricFormat,
  unit: string | null,
): { headline: string; exact: string | null } {
  if (format === 'percent') return { headline: `${twoDecimals.format(value)}%`, exact: null };
  if (format === 'count')
    return { headline: withUnit(wholeNumber.format(value), format, unit), exact: null };
  const compact = formatCompact(value, format === 'currency');
  const exactFull =
    format === 'currency' ? twoDecimals.format(value) : upToTwoDecimals.format(value);
  return {
    headline: withUnit(compact, format, unit),
    // The exact figure is only worth showing when the headline had to abbreviate it.
    exact: Math.abs(value) >= 1000 ? withUnit(exactFull, format, unit) : null,
  };
}

export function changeTone(direction: MetricDirection, polarity: MetricPolarity): MetricTone {
  if (direction === 'flat' || polarity === 'neutral') return 'neutral';
  const improved = (direction === 'up') === (polarity === 'higher_is_better');
  return improved ? 'positive' : 'negative';
}

/** Change of a headline value against its comparison value; calculated here, never supplied. */
export function computeMetricChange(
  value: number,
  comparison: number | null,
  options: {
    format: MetricFormat;
    unit: string | null;
    polarity: MetricPolarity;
    label: string | null;
  },
): MetricChange | null {
  if (comparison == null) return null;
  const amount = value - comparison;
  const direction: MetricDirection = Math.abs(amount) < 1e-9 ? 'flat' : amount > 0 ? 'up' : 'down';
  const abs = Math.abs(amount);
  const amountText =
    options.format === 'percent'
      ? `${twoDecimals.format(abs)} pp`
      : formatMetricValue(abs, options.format, options.unit).headline;
  const percentText =
    options.format !== 'percent' && comparison !== 0
      ? `${twoDecimals.format((abs / Math.abs(comparison)) * 100)}%`
      : null;
  const movement = direction === 'up' ? 'Up' : direction === 'down' ? 'Down' : 'No change';
  const spokenText =
    direction === 'flat'
      ? `No change${options.label ? ` ${options.label}` : ''}`
      : `${movement} ${percentText ?? amountText}${options.label ? ` ${options.label}` : ''}`;
  return {
    direction,
    amountText,
    percentText,
    label: options.label,
    tone: changeTone(direction, options.polarity),
    spokenText,
  };
}
