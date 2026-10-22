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
  if (!payload || payload.schema_version !== 1) return null;
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

export type HtmlArtifactModel = {
  fileName: 'index.html';
  sizeBytes: number;
};

export function parseHtmlArtifact(artifact: JobArtifact): HtmlArtifactModel | null {
  if (artifact.kind !== 'html') return null;
  const payload = object(artifact.payload);
  if (
    !payload ||
    payload.schema_version !== 1 ||
    payload.file_name !== 'index.html' ||
    typeof payload.size_bytes !== 'number' ||
    !Number.isInteger(payload.size_bytes) ||
    payload.size_bytes < 1
  ) return null;
  return { fileName: 'index.html', sizeBytes: payload.size_bytes };
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
  const display =
    payload.display === 'expanded' ||
    payload.display === 'collapsed' ||
    payload.display === 'hidden' ||
    payload.display === 'auto'
      ? payload.display
      : 'auto';
  const columnLabels =
    payload.column_labels != null && typeof payload.column_labels === 'object' && !Array.isArray(payload.column_labels)
      ? (payload.column_labels as Record<string, string>)
      : undefined;
  return {
    columns: payload.columns,
    rows: rowsFromPositional(payload.columns, payload.rows as unknown[][]),
    rowCount,
    truncated,
    dataSourceId,
    display,
    columnLabels,
    paging: artifact.table_rows?.has_more
      ? {
          jobId: artifact.job_id,
          artifactId: artifact.id,
          storedRowCount: artifact.table_rows.stored_row_count,
          nextCursor: artifact.table_rows.next_cursor,
        }
      : undefined,
  };
}
