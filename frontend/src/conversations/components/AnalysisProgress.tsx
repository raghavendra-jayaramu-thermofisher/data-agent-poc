import { useEffect, useId, useState } from 'react';
import { ChevronRight, Square } from 'lucide-react';
import { BrandLogo } from '../../components/BrandLogo';
import type { ManagedJob } from '../../jobs/types';
import { getSafeJobEventLabel } from '../../jobs/sse/job-events';
import './AnalysisProgress.css';

function secondsBetween(start: string, endMs: number) {
  const startMs = Date.parse(start);
  return Number.isFinite(startMs) && Number.isFinite(endMs)
    ? Math.max(0, Math.floor((endMs - startMs) / 1000))
    : 0;
}

function formatDuration(seconds: number) {
  if (seconds < 1) return '<1s';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function AnalysisProgress({
  managedJob,
  onCancel,
}: {
  managedJob: ManagedJob;
  onCancel(): Promise<void> | void;
}) {
  const { job, events } = managedJob;
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [stopError, setStopError] = useState(false);
  const historyId = useId();
  const cancelRequested = isStopping || Boolean(job.cancel_requested_at);
  const currentLabel = cancelRequested
    ? 'Stopping analysis…'
    : (getSafeJobEventLabel(events.at(-1)) ??
      (job.status === 'queued' ? 'Waiting to start' : 'Working on your request…'));
  const elapsed = secondsBetween(job.created_at, now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function stop() {
    if (cancelRequested) return;
    setIsStopping(true);
    setStopError(false);
    try {
      await onCancel();
    } catch {
      setIsStopping(false);
      setStopError(true);
    }
  }

  return (
    <section
      className="analysis-progress-card"
      aria-label="Analysis in progress"
      data-job-id={job.id}
    >
      <div className="analysis-progress-row">
        <button
          type="button"
          className="analysis-progress-toggle"
          aria-label={`${expanded ? 'Hide' : 'Show'} analysis activity`}
          aria-expanded={expanded}
          aria-controls={historyId}
          onClick={() => setExpanded((value) => !value)}
        >
          <BrandLogo decorative className="analysis-progress-pie" paused={cancelRequested} />
          <span className="analysis-progress-current" role="status">
            {currentLabel}
          </span>
          <ChevronRight className="analysis-progress-chevron" size={14} aria-hidden="true" />
        </button>
        <span className="analysis-progress-elapsed" aria-label={`${elapsed} seconds elapsed`}>
          {formatDuration(elapsed)}
        </span>
        <button
          type="button"
          className="analysis-progress-stop"
          onClick={() => void stop()}
          disabled={cancelRequested}
        >
          <Square size={10} fill="currentColor" aria-hidden="true" />
          <span>{cancelRequested ? 'Stopping…' : 'Stop'}</span>
        </button>
      </div>
      <div id={historyId} hidden={!expanded}>
        {expanded && (
          <div
            className="analysis-progress-history"
            role="region"
            aria-label="Analysis activity"
            tabIndex={0}
          >
            <div className="analysis-progress-log-heading">
              <span>Analysis activity</span>
              <span>Time since start</span>
            </div>
            {events.length ? (
              <ol aria-label="Analysis events">
                {events.map((event, index) => (
                  <li
                    key={event.sequence}
                    data-current={index === events.length - 1}
                    data-level={event.level}
                  >
                    <span>{getSafeJobEventLabel(event) ?? 'Working on your request…'}</span>
                    <time dateTime={event.created_at}>
                      {formatDuration(secondsBetween(job.created_at, Date.parse(event.created_at)))}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="analysis-progress-empty">Waiting for activity…</p>
            )}
          </div>
        )}
      </div>
      {stopError && (
        <p className="analysis-progress-error" role="alert">
          Could not stop the analysis. Try again.
        </p>
      )}
    </section>
  );
}
