import { Bot, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatLocalDateTime } from '../../lib/datetime';
import type { ModelExecution } from '../api/execution-api';
import { formatCost, formatElapsed, sanitizeOperationalText } from '../lib/execution-format';

function token(value: number | null) {
  return value == null ? '—' : value.toLocaleString();
}

export function ModelExecutionCard({ execution }: { execution: ModelExecution }) {
  const error = sanitizeOperationalText(execution.error_message);
  const isSucceeded = execution.status === 'succeeded';

  return (
    <div className="border border-[var(--db-border-default)] bg-[var(--db-surface-raised)] rounded-lg p-2.5 text-xs mb-2 shadow-2xs">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[var(--db-surface-hover)]">
        <div className="flex items-center gap-2">
          {isSucceeded ? (
            <CheckCircle2 size={13} className="text-[var(--db-success)]" />
          ) : (
            <AlertCircle size={13} className="text-[var(--db-danger)]" />
          )}
          <Bot size={13} className="text-[var(--db-primary)]" />
          <strong className="font-semibold text-[var(--db-text-primary)]">{execution.model_name}</strong>
          <span className="text-[10px] text-[var(--db-text-muted)]">({execution.phase || 'Model Call'})</span>
        </div>

        <span className="text-[11px] text-[var(--db-text-muted)]">
          {formatElapsed(execution.started_at, execution.finished_at)}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2 text-[10px] bg-[var(--db-surface-muted)] p-2 rounded">
        <div>
          <span className="text-[var(--db-text-muted)] block">Input Tokens</span>
          <span className="font-semibold font-mono text-[var(--db-text-primary)]">{token(execution.input_tokens)}</span>
        </div>
        <div>
          <span className="text-[var(--db-text-muted)] block">Output Tokens</span>
          <span className="font-semibold font-mono text-[var(--db-text-primary)]">{token(execution.output_tokens)}</span>
        </div>
        <div>
          <span className="text-[var(--db-text-muted)] block">Total Tokens</span>
          <span className="font-semibold font-mono text-[var(--db-text-primary)]">{token(execution.total_tokens)}</span>
        </div>
        <div>
          <span className="text-[var(--db-text-muted)] block">Cost</span>
          <span
            className="font-semibold font-mono text-[var(--db-text-primary)]"
            title={execution.cost == null ? 'No price set for this model profile' : undefined}
          >
            {formatCost(execution.cost)}
          </span>
        </div>
        <div>
          <span className="text-[var(--db-text-muted)] block">Started</span>
          <span className="font-mono text-[var(--db-text-primary)] truncate block">{formatLocalDateTime(execution.started_at)}</span>
        </div>
      </div>

      {error && (
        <div className="mt-2 p-2 bg-[var(--db-danger-soft)] border border-[var(--db-danger)]/20 rounded text-[var(--db-danger)] text-xs">
          <strong>{execution.error_code || 'Model Error'}:</strong> {error}
        </div>
      )}
    </div>
  );
}
