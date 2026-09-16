import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BrainCircuit,
  Check,
  CircleCheck,
  Clock3,
  Database,
  Loader2,
  MessageSquareText,
  Play,
  PlugZap,
  Square,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { JobEvent, ManagedJob } from '../../jobs/types';
import { getSafeJobEventLabel } from '../../jobs/sse/job-events';

type ProgressStep = {
  event: JobEvent;
  label: string;
};

function eventIcon(eventType: string): LucideIcon {
  if (eventType === 'job.queued') return Clock3;
  if (eventType === 'job.started' || eventType === 'agent.started') return Play;
  if (eventType.startsWith('model.')) return BrainCircuit;
  if (eventType.startsWith('tool.')) return Wrench;
  if (eventType.startsWith('sql.')) return Database;
  if (eventType.startsWith('chart.')) return BarChart3;
  if (eventType.startsWith('answer.')) return MessageSquareText;
  return PlugZap;
}

function secondsBetween(start: string, endMs: number) {
  const startMs = Date.parse(start);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

function formatDuration(seconds: number) {
  if (seconds < 1) return '<1s';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function AnalysisProgress({
  managedJob,
  onCancel,
}: {
  managedJob: ManagedJob;
  onCancel(): Promise<void> | void;
}) {
  const job = managedJob.job;
  const [now, setNow] = useState(() => Date.now());
  const [isStopping, setIsStopping] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const steps = useMemo(() => {
    const unique = new Map<string, ProgressStep>();
    for (const event of managedJob.events) {
      const label = getSafeJobEventLabel(event);
      if (label) unique.set(label, { event, label });
    }
    return [...unique.values()].slice(-4);
  }, [managedJob.events]);

  const currentLabel =
    steps.at(-1)?.label ?? (job.status === 'queued' ? 'Waiting to start' : 'Running analysis');
  const elapsed = secondsBetween(job.created_at, now);

  const stop = async () => {
    if (isStopping) return;
    setIsStopping(true);
    try {
      await onCancel();
    } catch {
      setIsStopping(false);
    }
  };

  return (
    <section className="analysis-progress-card" aria-live="polite" data-job-id={job.id}>
      <div className="analysis-progress-main">
        <div className="analysis-progress-summary">
          <span className="analysis-progress-spinner" aria-hidden="true">
            <Loader2 size={16} />
          </span>
          <div className="analysis-progress-copy">
            <strong>Analyzing your data</strong>
            <span>{steps.length > 0 ? `Step ${steps.length} in progress` : currentLabel}</span>
          </div>
          <span className="analysis-progress-elapsed" aria-label={`${elapsed} seconds elapsed`}>
            <Clock3 size={12} />
            {formatDuration(elapsed)}
          </span>
        </div>

        <div className="analysis-progress-track" aria-hidden="true">
          <span />
        </div>

        {steps.length > 0 ? (
          <ol className="analysis-progress-steps" aria-label="Analysis progress">
            {steps.map((step, index) => {
              const isCurrent = index === steps.length - 1;
              const StepIcon = eventIcon(step.event.event_type);
              const nextEvent = steps[index + 1]?.event;
              const duration = secondsBetween(
                step.event.created_at,
                isCurrent || !nextEvent ? now : Date.parse(nextEvent.created_at),
              );

              return (
                <li className={isCurrent ? 'is-current' : 'is-complete'} key={`${step.event.sequence}-${step.label}`}>
                  <span className="analysis-progress-step-icon" aria-hidden="true">
                    {isCurrent ? <StepIcon size={13} /> : <CircleCheck size={14} />}
                  </span>
                  <span className="analysis-progress-step-label">{step.label}</span>
                  <span className="analysis-progress-step-time">{formatDuration(duration)}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="analysis-progress-awaiting">
            <Check size={13} aria-hidden="true" /> Request received
          </div>
        )}
      </div>

      <button
        type="button"
        className="analysis-progress-stop"
        onClick={() => void stop()}
        disabled={isStopping}
      >
        {isStopping ? <Loader2 size={13} className="animate-spin" /> : <Square size={12} fill="currentColor" />}
        <span>{isStopping ? 'Stopping…' : 'Stop'}</span>
      </button>
    </section>
  );
}
