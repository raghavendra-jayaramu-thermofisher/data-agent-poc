import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatLocalDateTime } from '../../lib/datetime';
import type { ToolExecution } from '../api/execution-api';
import { formatElapsed, safeSummaryEntries, sanitizeOperationalText } from '../lib/execution-format';

function formatToolName(name: string) {
  switch (name) {
    case 'read_knowledge_index':
      return 'Knowledge Index Discovery';
    case 'read_table_schema':
      return 'Table Schema Inspection';
    case 'execute_sql':
      return 'SQL Execution';
    case 'create_chart':
      return 'Chart Generation';
    default:
      return name;
  }
}

export function ToolExecutionCard({ execution }: { execution: ToolExecution }) {
  const [expanded, setExpanded] = useState(false);
  const error = sanitizeOperationalText(execution.error_message);
  const inputEntries = safeSummaryEntries(execution.input_summary);
  const outputEntries = safeSummaryEntries(execution.output_summary);
  const isSucceeded = execution.status === 'succeeded';

  return (
    <div className="border border-[var(--db-border-default)] bg-[var(--db-surface-raised)] rounded-lg p-2.5 text-xs mb-2 shadow-2xs hover:border-[var(--db-primary)]/30 transition-all">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isSucceeded ? (
            <CheckCircle2 size={13} className="text-[var(--db-success)] shrink-0" />
          ) : (
            <AlertCircle size={13} className="text-[var(--db-danger)] shrink-0" />
          )}
          <span className="font-semibold text-[var(--db-text-primary)] truncate">
            {formatToolName(execution.tool_name)}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 bg-[var(--db-surface-muted)] text-[var(--db-text-secondary)] rounded font-mono">
            #{execution.sequence}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-[var(--db-text-muted)]">
            {formatElapsed(execution.started_at, execution.finished_at)}
          </span>
          <button
            type="button"
            className="p-1 text-[var(--db-text-secondary)] hover:text-[var(--db-text-primary)] hover:bg-[var(--db-surface-muted)] rounded transition-colors"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Hide details' : 'View details'}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2.5 pt-2 border-t border-[var(--db-surface-hover)] space-y-2 text-[11px]">
          <div className="text-[10px] text-[var(--db-text-muted)]">
            {formatLocalDateTime(execution.started_at)}
          </div>

          {inputEntries.length > 0 && (
            <div>
              <span className="font-semibold text-[var(--db-text-secondary)] block mb-1">Inputs:</span>
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 bg-[var(--db-surface-muted)] p-2 rounded text-[var(--db-text-primary)] font-mono text-[10px]">
                {inputEntries.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-[var(--db-text-muted)]">{k}:</dt>
                    <dd className="truncate">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {outputEntries.length > 0 && (
            <div>
              <span className="font-semibold text-[var(--db-text-secondary)] block mb-1">Outputs:</span>
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 bg-[var(--db-surface-muted)] p-2 rounded text-[var(--db-text-primary)] font-mono text-[10px]">
                {outputEntries.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-[var(--db-text-muted)]">{k}:</dt>
                    <dd className="truncate">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {error && (
            <div className="p-2 bg-[var(--db-danger-soft)] border border-[var(--db-danger)]/20 rounded text-[var(--db-danger)]">
              <strong>{execution.error_code || 'Error'}:</strong> {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
