export type AnalyticalValue = string | number | boolean | null | Record<string, unknown> | unknown[];
export type AnalyticalRow = { id: string; values: Record<string, AnalyticalValue> };

export type AnalyticalTableModel = {
  columns: string[];
  rows: AnalyticalRow[];
  rowCount: number;
  truncated: boolean;
  dataSourceId?: string | null;
  display?: 'expanded' | 'collapsed' | 'hidden' | 'auto';
  columnLabels?: Record<string, string>;
};

const UPPERCASE_TOKENS = new Set(['id', 'url', 'api', 'kpi', 'sql', 'sku', 'tsv', 'csv', 'db', 'ip']);

export function formatColumnHeader(column: string, customLabels?: Record<string, string>): string {
  if (customLabels && customLabels[column]?.trim()) {
    return customLabels[column].trim();
  }
  if (!column) return '';
  const words = column
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ')
    .trim()
    .split(/\s+/);

  return words
    .map((word) => {
      const lower = word.toLowerCase();
      if (UPPERCASE_TOKENS.has(lower)) {
        return lower.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}


export function rowsFromPositional(columns: string[], rows: unknown[][]): AnalyticalRow[] {
  return rows.map((raw, rowIndex) => ({
    id: String(rowIndex),
    values: Object.fromEntries(columns.map((column, columnIndex) => [column, (raw[columnIndex] ?? null) as AnalyticalValue])),
  }));
}

export function formatAnalyticalValue(value: AnalyticalValue | undefined): string {
  if (value == null) return '—';
  if (typeof value === 'number') return new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value);
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return 'Structured value'; }
}

export function isNumericColumn(rows: AnalyticalRow[], column: string): boolean {
  const values = rows.map((row) => row.values[column]).filter((value) => value != null).slice(0, 20);
  return values.length > 0 && values.every((value) => typeof value === 'number');
}

export function toTsv(model: AnalyticalTableModel): string {
  const escape = (value: string) => value.replaceAll('\t', ' ').replaceAll('\r', ' ').replaceAll('\n', ' ');
  return [model.columns.join('\t'), ...model.rows.map((row) => model.columns.map((column) => escape(formatAnalyticalValue(row.values[column]))).join('\t'))].join('\n');
}
