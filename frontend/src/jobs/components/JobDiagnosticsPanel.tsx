import type { ExecutionTrace } from '../../agent/api/execution-api';
import type { Job } from '../../api/types';
import { notifications } from '../../components/notifications';

export function JobDiagnosticsPanel({
  job,
  trace,
  unavailable,
}: {
  job: Job;
  trace?: ExecutionTrace;
  unavailable?: boolean;
}) {
  if (job.status !== 'failed') return null;
  const failures = [
    ...(trace?.models ?? [])
      .filter((item) => item.status === 'failed')
      .map((item) => ({
        kind: 'model',
        provider_error_response: item.provider_error_response,
        id: item.id,
        stage: item.phase,
        model: item.model_name,
        code: item.error_code,
        message: item.error_message,
        time: item.finished_at,
      })),
    ...(trace?.tools ?? [])
      .filter((item) => item.status === 'failed')
      .map((item) => ({
        kind: 'tool',
        id: item.id,
        stage: item.tool_name,
        code: item.error_code,
        message: item.error_message,
        time: item.finished_at,
      })),
    ...(trace?.sql ?? [])
      .filter((item) => item.status === 'failed')
      .map((item) => ({
        kind: 'sql',
        id: item.id,
        stage: 'SQL execution',
        code: item.error_code,
        message: item.error_message,
        time: item.finished_at,
      })),
  ];
  const diagnostics = {
    job_id: job.id,
    job_type: job.job_type,
    status: job.status,
    error_code: job.error_code,
    error_message: job.error_message,
    finished_at: job.finished_at,
    failures,
    execution_details_available: Boolean(trace),
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      notifications.success('Job diagnostics copied');
    } catch {
      notifications.error('Unable to copy diagnostics. Select and copy the details below.');
    }
  };
  return (
    <section
      aria-label="Job diagnostics"
      className="bg-[var(--db-surface-raised)] border border-[#E8B4B4] rounded-lg p-5 mb-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--db-danger)]">Failure diagnostics</h2>
        <button
          type="button"
          onClick={() => void copy()}
          className="text-xs text-[var(--db-primary)] underline"
        >
          Copy diagnostics
        </button>
      </div>
      <p className="text-xs mt-2">
        {job.error_code}: {job.error_message}
      </p>
      {failures.map((failure) => (
        <div
          key={failure.id}
          className="mt-3 text-xs border-t border-[var(--db-border-default)] pt-3"
        >
          <p className="font-semibold">
            {failure.stage}
            {'model' in failure ? ` · ${failure.model}` : ''}
          </p>
          <p>{failure.code}</p>
          <pre className="whitespace-pre-wrap break-words mt-2">
            {failure.message || 'No detailed error was recorded for this step.'}
          </pre>
          {'provider_error_response' in failure && Boolean(failure.provider_error_response) && (
            <details className="mt-3">
              <summary className="cursor-pointer font-semibold">Raw provider error</summary>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words">
                {JSON.stringify(failure.provider_error_response, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ))}
      {(unavailable || !failures.length) && (
        <p className="text-xs text-[var(--db-text-secondary)] mt-3">
          {unavailable
            ? 'Execution details could not be loaded. The job error is still available to copy.'
            : 'Only recorded diagnostics can be shown. Older failures may not include the underlying provider error.'}
        </p>
      )}
    </section>
  );
}
