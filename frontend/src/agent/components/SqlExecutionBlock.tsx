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
    <div className="border border-[#DAD5CD] bg-[#FFFDFC] rounded-lg p-3 text-xs mb-2 shadow-2xs">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#EAE7E1]">
        <div className="flex items-center gap-2 min-w-0">
          {isSucceeded ? (
            <CheckCircle2 size={14} className="text-[#32745A] shrink-0" />
          ) : (
            <AlertCircle size={14} className="text-[#A84545] shrink-0" />
          )}
          <strong className="font-semibold text-[#252127] text-xs">SQL Execution</strong>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#F0EEE9] rounded text-[10px] text-[#625C64]">
            <Database size={10} />
            <span>{dataSourceName}</span>
          </span>
          {execution.row_count != null && (
            <span className="text-[10px] text-[#8B848C]">
              · {execution.row_count.toLocaleString()} rows
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-[#8B848C] font-mono">
            {formatDuration(execution.duration_ms)}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F0EEE9] hover:bg-[#EAE7E1] text-[#252127] border border-[#DAD5CD] rounded text-[10px] font-medium transition-colors"
            onClick={() => void copySql()}
            title="Copy SQL"
          >
            {copied ? <Check size={10} className="text-[#32745A]" /> : <Copy size={10} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            className="p-1 text-[#625C64] hover:text-[#252127] hover:bg-[#F0EEE9] rounded transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <pre className="p-2 bg-[#F0EEE9] border border-[#DAD5CD] rounded text-[11px] font-mono text-[#252127] overflow-x-auto max-h-48 leading-relaxed">
            <code>{execution.sql_text}</code>
          </pre>

          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[#EAE7E1] text-[10px] text-[#8B848C]">
            <span>{formatLocalDateTime(execution.started_at)}</span>
            <div className="flex items-center gap-3">
              {execution.result_bytes != null && <span>Payload: {formatBytes(execution.result_bytes)}</span>}
              {execution.truncated && (
                <span className="text-[#8C5A00] font-medium bg-[#F8EDCF] px-1 rounded">Truncated</span>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-2 p-2 bg-[#F7E7E5] border border-[#A84545]/20 rounded text-[#A84545] text-xs">
              <strong>{execution.error_code || 'Execution Error'}:</strong> {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
