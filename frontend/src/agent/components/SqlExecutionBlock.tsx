import { useState } from 'react';
import { Copy, Check, Database, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { notifications } from '../../components/notifications';
import { formatLocalDateTime } from '../../lib/datetime';
import type { SqlExecution } from '../api/execution-api';
import { formatBytes, formatDuration, sanitizeOperationalText } from '../lib/execution-format';

export function SqlExecutionBlock({
  execution,
  dataSourceName,
}: {
  execution: SqlExecution;
  dataSourceName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  async function copySql() {
    try {
      await navigator.clipboard.writeText(execution.sql_text);
      setCopied(true);
      notifications.success('Copied SQL');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notifications.error('Unable to copy SQL');
    }
  }

  const error = sanitizeOperationalText(execution.error_message);
  const isSucceeded = execution.status === 'succeeded';

  return (
    <div className="border border-[var(--db-border-default)] bg-[var(--db-surface-raised)] rounded-lg p-3 text-xs mb-2 shadow-2xs">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[var(--db-surface-hover)]">
        <div className="flex items-center gap-2 min-w-0">
          {isSucceeded ? (
            <CheckCircle2 size={14} className="text-[var(--db-success)] shrink-0" />
          ) : (
            <AlertCircle size={14} className="text-[var(--db-danger)] shrink-0" />
          )}
          <strong className="font-semibold text-[var(--db-text-primary)] text-xs">SQL Execution</strong>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[var(--db-surface-muted)] rounded text-[10px] text-[var(--db-text-secondary)]">
            <Database size={10} />
            <span>{dataSourceName}</span>
          </span>
          {execution.row_count != null && (
            <span className="text-[10px] text-[var(--db-text-muted)]">
              · {execution.row_count.toLocaleString()} rows
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-[var(--db-text-muted)] font-mono">
            {formatDuration(execution.duration_ms)}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--db-surface-muted)] hover:bg-[var(--db-surface-hover)] text-[var(--db-text-primary)] border border-[var(--db-border-default)] rounded text-[10px] font-medium transition-colors"
            onClick={() => void copySql()}
            title="Copy SQL"
          >
            {copied ? <Check size={10} className="text-[var(--db-success)]" /> : <Copy size={10} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            className="p-1 text-[var(--db-text-secondary)] hover:text-[var(--db-text-primary)] hover:bg-[var(--db-surface-muted)] rounded transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <pre className="p-2 bg-[var(--db-surface-muted)] border border-[var(--db-border-default)] rounded text-[11px] font-mono text-[var(--db-text-primary)] overflow-x-auto max-h-48 leading-relaxed">
            <code>{execution.sql_text}</code>
          </pre>

          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[var(--db-surface-hover)] text-[10px] text-[var(--db-text-muted)]">
            <span>{formatLocalDateTime(execution.started_at)}</span>
            <div className="flex items-center gap-3">
              {execution.result_bytes != null && <span>Payload: {formatBytes(execution.result_bytes)}</span>}
              {execution.truncated && (
                <span className="text-[var(--db-warning)] font-medium bg-[var(--db-warning-soft)] px-1 rounded">Truncated</span>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-2 p-2 bg-[var(--db-danger-soft)] border border-[var(--db-danger)]/20 rounded text-[var(--db-danger)] text-xs">
              <strong>{execution.error_code || 'Execution Error'}:</strong> {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
