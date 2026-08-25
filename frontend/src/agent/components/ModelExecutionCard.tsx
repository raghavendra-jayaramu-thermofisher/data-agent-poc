import { Bot, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatLocalDateTime } from '../../lib/datetime';
import type { ModelExecution } from '../api/execution-api';
import { formatElapsed, sanitizeOperationalText } from '../lib/execution-format';

function token(value: number | null) {
  return value == null ? '—' : value.toLocaleString();
}

export function ModelExecutionCard({ execution }: { execution: ModelExecution }) {
  const error = sanitizeOperationalText(execution.error_message);
  const isSucceeded = execution.status === 'succeeded';

  return (
    <div className="border border-[#DAD5CD] bg-[#FFFDFC] rounded-lg p-2.5 text-xs mb-2 shadow-2xs">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#EAE7E1]">
        <div className="flex items-center gap-2">
          {isSucceeded ? (
            <CheckCircle2 size={13} className="text-[#32745A]" />
          ) : (
            <AlertCircle size={13} className="text-[#A84545]" />
          )}
          <Bot size={13} className="text-[#4B123F]" />
          <strong className="font-semibold text-[#252127]">{execution.model_name}</strong>
          <span className="text-[10px] text-[#8B848C]">({execution.phase || 'Model Call'})</span>
        </div>

        <span className="text-[11px] text-[#8B848C]">
          {formatElapsed(execution.started_at, execution.finished_at)}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-[10px] bg-[#F0EEE9] p-2 rounded">
        <div>
          <span className="text-[#8B848C] block">Input Tokens</span>
          <span className="font-semibold font-mono text-[#252127]">{token(execution.input_tokens)}</span>
        </div>
        <div>
          <span className="text-[#8B848C] block">Output Tokens</span>
          <span className="font-semibold font-mono text-[#252127]">{token(execution.output_tokens)}</span>
        </div>
        <div>
          <span className="text-[#8B848C] block">Total Tokens</span>
          <span className="font-semibold font-mono text-[#252127]">{token(execution.total_tokens)}</span>
        </div>
        <div>
          <span className="text-[#8B848C] block">Started</span>
          <span className="font-mono text-[#252127] truncate block">{formatLocalDateTime(execution.started_at)}</span>
        </div>
      </div>

      {error && (
        <div className="mt-2 p-2 bg-[#F7E7E5] border border-[#A84545]/20 rounded text-[#A84545] text-xs">
          <strong>{execution.error_code || 'Model Error'}:</strong> {error}
        </div>
      )}
    </div>
  );
}
