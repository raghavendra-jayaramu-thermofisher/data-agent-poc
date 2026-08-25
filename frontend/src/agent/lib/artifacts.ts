import type { JobArtifact } from '../api/execution-api';
import { rowsFromPositional, type AnalyticalTableModel } from '../../analytics/table/table-domain';

function object(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseTextArtifact(artifact: JobArtifact): { markdown: string } | null {
  if (artifact.kind !== 'text') return null;
  const payload = object(artifact.payload);
  if (!payload) return null;
  const text =
    typeof payload.markdown === 'string'
      ? payload.markdown
      : typeof payload.text === 'string'
      ? payload.text
      : typeof payload.content === 'string'
      ? payload.content
      : null;
  return text != null ? { markdown: text } : null;
}

export function parseTableArtifact(artifact: JobArtifact): AnalyticalTableModel | null {
  if (artifact.kind !== 'table') return null;
  const payload = object(artifact.payload);
  if (!payload || payload.schema_version !== 1) return null;
  if (
    !Array.isArray(payload.columns) ||
    !payload.columns.every((item) => typeof item === 'string') ||
    !Array.isArray(payload.rows) ||
    !payload.rows.every(Array.isArray)
  )
    return null;
  const rowCount =
    typeof payload.row_count === 'number' && payload.row_count >= 0
      ? payload.row_count
      : payload.rows.length;
  const truncated = payload.truncated === true;
  const dataSourceId = typeof payload.data_source_id === 'string' ? payload.data_source_id : null;
  return {
    columns: payload.columns,
    rows: rowsFromPositional(payload.columns, payload.rows as unknown[][]),
    rowCount,
    truncated,
    dataSourceId,
  };
}
