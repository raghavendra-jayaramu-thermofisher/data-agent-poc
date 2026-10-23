import { jobStatusLabel } from '../job-display';

export function JobStatusBadge({ status }: { status: string }) {
  return (
    <span
      className="management-badge"
      data-tone={
        status === 'succeeded'
          ? 'success'
          : status === 'failed'
            ? 'danger'
            : status === 'running' || status === 'queued'
              ? 'accent'
              : status === 'waiting_for_input'
                ? 'warning'
                : 'neutral'
      }
    >
      {jobStatusLabel(status)}
    </span>
  );
}
