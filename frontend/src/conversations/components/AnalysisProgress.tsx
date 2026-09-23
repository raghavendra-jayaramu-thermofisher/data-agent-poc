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
  isActive: boolean;
};

const ACTIVE_EVENT_TYPES = new Set([
  'job.queued',
  'job.started',
  'agent.started',
  'model.request.started',
  'tool.started',
  'sql.started',
  'datasource.test.started',
  'excel.materialization.started',
  'knowledge.generation.started',
]);

function isActiveEvent(event: JobEvent) {
  return ACTIVE_EVENT_TYPES.has(event.event_type) || event.event_type.endsWith('.started');
}

function payloadString(event: JobEvent, key: string) {
  const value = event.payload[key];
  return typeof value === 'string' ? value : null;
}

function matchingCompletion(event: JobEvent, events: JobEvent[]) {
  const correlationKey =
    event.event_type === 'sql.started' ? 'sql_execution_id' : 'tool_execution_id';
  const correlationId = payloadString(event, correlationKey);
  if (!correlationId) return null;

  return (
    events.find(
      (candidate) =>
        candidate.sequence > event.sequence &&
        payloadString(candidate, correlationKey) === correlationId &&
        (candidate.event_type.endsWith('.completed') ||
          candidate.event_type.endsWith('.failed') ||
          candidate.event_type.endsWith('.cancelled')),
    ) ?? null
  );
}

function completedDurationSeconds(event: JobEvent, events: JobEvent[]) {
  const durationMs = event.payload.duration_ms;
  if (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0) {
    return durationMs / 1000;
  }

  const correlationKey = event.event_type.startsWith('sql.')
    ? 'sql_execution_id'
    : event.event_type.startsWith('tool.')
      ? 'tool_execution_id'
      : null;
  const correlationId = correlationKey ? payloadString(event, correlationKey) : null;
  if (correlationKey && correlationId) {
    const start = [...events]
      .reverse()
      .find(
        (candidate) =>
          candidate.sequence < event.sequence &&
          candidate.event_type.endsWith('.started') &&
          payloadString(candidate, correlationKey) === correlationId,
      );
    if (start) return secondsBetween(start.created_at, Date.parse(event.created_at));
  }

  const nextEvent = events.find((candidate) => candidate.sequence > event.sequence);
  return nextEvent ? secondsBetween(event.created_at, Date.parse(nextEvent.created_at)) : 0;
}

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
  seconds = Math.floor(seconds);
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
      if (label) {
        // Reinsert repeated labels so the Map preserves the latest event's chronology.
        unique.delete(label);
        unique.set(label, { event, label, isActive: false });
      }
    }
    const ordered = [...unique.values()];
    const latestEvent = managedJob.events.at(-1);
    if (latestEvent && isActiveEvent(latestEvent)) {
      const current = ordered.at(-1);
      if (current?.event.sequence === latestEvent.sequence) current.isActive = true;
    } else if (latestEvent && (job.status === 'queued' || job.status === 'running')) {
      ordered.push({
        event: {
          sequence: latestEvent.sequence + 0.5,
          event_type: 'answer.preparing',
          level: 'info',
          payload: {},
          created_at: latestEvent.created_at,
        },
        label: 'Preparing answer…',
        isActive: true,
      });
    }
    return ordered.slice(-4);
  }, [job.status, managedJob.events]);

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
            <span>{steps.length > 0 ? 'In progress' : currentLabel}</span>
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
            {steps.map((step) => {
              const isCurrent = step.isActive;
              const StepIcon = eventIcon(step.event.event_type);
              const completion = isCurrent
                ? matchingCompletion(step.event, managedJob.events)
                : null;
              const duration = isCurrent
                ? secondsBetween(
                    step.event.created_at,
                    completion ? Date.parse(completion.created_at) : now,
                  )
                : completedDurationSeconds(step.event, managedJob.events);

              return (
                <li
                  className={isCurrent ? 'is-current' : 'is-complete'}
                  key={`${step.event.sequence}-${step.label}`}
                >
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
        {isStopping ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Square size={12} fill="currentColor" />
        )}
        <span>{isStopping ? 'Stopping…' : 'Stop'}</span>
      </button>
    </section>
  );
}
