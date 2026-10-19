import type { Job } from '../api/types';

export function jobTypeLabel(type: string) {
  return (
    (
      {
        chat_query: 'Data analysis',
        datasource_test: 'Connection test',
        knowledge_generation: 'Schema refresh',
        excel_materialization: 'Workbook import',
        dashboard_refresh: 'Dashboard refresh',
      } as Record<string, string>
    )[type] ?? type.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
  );
}
export function jobStatusLabel(status: string) {
  return (
    (
      {
        queued: 'Queued',
        running: 'In progress',
        succeeded: 'Completed',
        failed: 'Failed',
        cancelled: 'Cancelled',
      } as Record<string, string>
    )[status] ?? status
  );
}
export function formatJobDuration(durationMs: number | null | undefined) {
  if (durationMs == null) return '—';
  if (durationMs < 1000) return '<1s';
  const seconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [hours ? hours + 'h' : '', minutes || hours ? minutes + 'm' : '', (seconds % 60) + 's']
    .filter(Boolean)
    .join(' ');
}
export function jobContext(job: Job, sourceNames: Record<string, string>) {
  const question = [job.input.prompt, job.input.question].find(
    (value): value is string => typeof value === 'string' && Boolean(value.trim()),
  );
  if (job.job_type === 'chat_query' && question) return question;
  const sourceId = job.input.data_source_id;
  return typeof sourceId === 'string' ? (sourceNames[sourceId] ?? '') : '';
}
