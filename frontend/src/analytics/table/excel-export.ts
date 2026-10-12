import { apiClient, withAuthRefresh } from '../../api/client';
import type { components } from '../../api/generated/schema';
import { formatColumnHeader, type AnalyticalTableModel, type AnalyticalValue } from './table-domain';

export type ExcelTableExport = components['schemas']['ExcelTableExport'];

function exportValue(value: AnalyticalValue | undefined) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  return JSON.stringify(value);
}

export function excelTableFromModel(model: AnalyticalTableModel, title: string): ExcelTableExport {
  return {
    title: title.slice(0, 240),
    headers: model.columns.map((column) => formatColumnHeader(column, model.columnLabels)),
    rows: model.rows.map((row) => model.columns.map((column) => exportValue(row.values[column]))),
    truncated: model.truncated,
  };
}

export async function downloadExcel(table: ExcelTableExport) {
  const file = await withAuthRefresh(() => apiClient.POST('/api/v1/exports/excel', {
    body: table,
    parseAs: 'blob',
  }));
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${table.title.replace(/[^\p{L}\p{N}._ -]+/gu, '_').replace(/^[ ._]+|[ ._]+$/g, '').slice(0, 120) || 'Table'}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to consume the URL before releasing the workbook.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
