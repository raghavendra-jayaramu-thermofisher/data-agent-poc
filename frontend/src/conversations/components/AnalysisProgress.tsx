import { Loader2, StopCircle, Check } from 'lucide-react';
import type { ManagedJob } from '../../jobs/types';
import { getSafeJobEventLabel } from '../../jobs/sse/job-events';

export function AnalysisProgress({
  managedJob,
  onCancel,
}: {
  managedJob: ManagedJob;
  onCancel(): void;
}) {
  const job = managedJob.job;
  const safeEvents = managedJob.events
    .map(getSafeJobEventLabel)
    .filter((label): label is string => Boolean(label));
  const recentSteps = [...new Set(safeEvents)].slice(-4);
  const latest =
    recentSteps.at(-1) ?? (job.status === 'queued' ? 'Queued for analysis…' : 'Running analysis…');

  return (
    <div className="analysis-progress-card" role="status" aria-live="polite" data-job-id={job.id}>
      <div className="flex flex-col gap-1 min-w-0">
        <div className="analysis-progress-info">
          <Loader2 size={14} className="animate-spin text-[#4B123F]" />
          <strong className="text-xs font-semibold">{latest}</strong>
        </div>

        {recentSteps.length > 1 && (
          <ul className="pl-5 space-y-0.5 text-[11px] text-[#625C64] list-none">
            {recentSteps.map((step, index) => {
              const isCurrent = index === recentSteps.length - 1;
              return (
                <li key={`${step}-${index}`} className="flex items-center gap-1.5">
                  {isCurrent ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4B123F] animate-pulse" />
                  ) : (
                    <Check size={11} className="text-[#32745A]" />
                  )}
                  <span className={isCurrent ? 'font-medium text-[#252127]' : ''}>{step}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        type="button"
        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[#A84545] hover:bg-[#F7E7E5] rounded border border-transparent transition-colors flex-shrink-0"
        onClick={onCancel}
      >
        <StopCircle size={13} />
        <span>Cancel</span>
      </button>
    </div>
  );
}
