import { CircleDollarSign } from 'lucide-react';
import type { ModelExecution } from '../api/execution-api';
import { formatCost, summarizeUsage } from '../lib/execution-format';
import { useShowCost } from '../../lib/useShowCost';

/** One-line cost and token total for a job's model calls. */
export function JobUsageSummary({
  models,
  className = '',
}: {
  models: ReadonlyArray<ModelExecution>;
  className?: string;
}) {
  const showCost = useShowCost();
  if (!models.length) return null;
  const usage = summarizeUsage(models);
  const tokens = usage.inputTokens + usage.outputTokens;
  const unpriced =
    showCost && usage.unpricedCalls > 0
      ? `${usage.unpricedCalls} model ${usage.unpricedCalls === 1 ? 'call has' : 'calls have'} no price`
      : null;
  return (
    <p
      className={`job-usage-summary ${className}`.trim()}
      aria-label={showCost ? 'Question cost' : 'Question usage'}
      title={`${usage.inputTokens.toLocaleString()} input · ${usage.outputTokens.toLocaleString()} output tokens`}
    >
      {showCost && (
        <>
          <CircleDollarSign size={13} aria-hidden="true" />
          <span className="job-usage-cost">{usage.cost == null ? 'Cost not available' : formatCost(usage.cost)}</span>
        </>
      )}
      <span>{tokens.toLocaleString()} tokens</span>
      <span>
        {usage.calls} model {usage.calls === 1 ? 'call' : 'calls'}
      </span>
      {unpriced && <span className="job-usage-warning">{unpriced}</span>}
    </p>
  );
}
