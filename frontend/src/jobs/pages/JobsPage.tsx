import { useMemo } from 'react';
import { useSearchParams, Link } from 'react-router';
import { Activity, ArrowRight } from 'lucide-react';
import { PageState } from '../../components/PageState';
import { StatusChip } from '../../components/StatusChip';
import { formatLocalDateTime, formatRelativeTime } from '../../lib/datetime';
import { useJobManager } from '../JobManagerProvider';
import { useJobs } from '../hooks/useJobs';
import type { JobStatus } from '../types';

const filters = ['all', 'queued', 'running', 'succeeded', 'failed', 'cancelled'] as const;
type JobFilter = (typeof filters)[number];

function isJobFilter(value: string | null): value is JobFilter {
  return Boolean(value && filters.includes(value as JobFilter));
}

function formatJobDuration(durationMs: number | null | undefined) {
  if (durationMs == null) return '—';
  if (durationMs < 1000) return `${durationMs} ms`;

  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (hours) parts.push(`${hours}h`);
  if (minutes || hours) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

export function JobsPage() {
  const [params, setParams] = useSearchParams();
  const manager = useJobManager();
  const requestedFilter = params.get('status');
  const filter: JobFilter = isJobFilter(requestedFilter) ? requestedFilter : 'all';
  const query = useJobs(filter === 'all' ? undefined : (filter as JobStatus), 100);

  const jobs = useMemo(() => {
    const managedById = new Map(manager.jobs.map((entry) => [entry.job.id, entry.job]));
    return (query.data ?? []).map((job) => {
      const managedJob = managedById.get(job.id);
      return managedJob
        ? { ...job, ...managedJob, duration_ms: job.duration_ms ?? managedJob.duration_ms }
        : job;
    });
  }, [manager.jobs, query.data]);

  if (query.isLoading && !jobs.length) {
    return <PageState title="Loading jobs" description="Restoring durable background work…" loading />;
  }
  if (query.isError && !jobs.length) {
    return <PageState title="Unable to load jobs" description="Check your connection and try again." />;
  }

  return (
    <section className="page max-w-6xl mx-auto">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity size={20} className="text-[#4B123F]" />
            <h1 className="text-xl font-semibold text-[#252127]">Job Ledger</h1>
          </div>
          <p className="text-xs text-[#625C64]">
            Durable background execution records, analytical job tasks, and error audits.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 mb-4 pb-2 border-b border-[#DAD5CD]" aria-label="Job status filters">
        {filters.map((status) => (
          <button
            key={status}
            type="button"
            className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors ${
              filter === status
                ? 'bg-[#4B123F] text-[#FFF9FD] font-semibold'
                : 'bg-[#FFFDFC] text-[#252127] border border-[#DAD5CD] hover:bg-[#F0EEE9]'
            }`}
            onClick={() => setParams(status === 'all' ? {} : { status })}
          >
            {status}
          </button>
        ))}
      </div>

      {jobs.length ? (
        <div className="analytical-table-shell">
          <table className="analytical-table" aria-label="Jobs">
            <thead>
              <tr>
                <th>Job Type</th>
                <th>Status</th>
                <th>Progress / Message</th>
                <th>Created</th>
                <th>Time Taken</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="cursor-pointer hover:bg-[#F8EFF5]/60 transition-colors">
                  <td>
                    <Link
                      to={`/jobs/${job.id}`}
                      className="font-medium text-[#4B123F] hover:underline flex items-center gap-1.5"
                    >
                      <Activity size={12} className="text-[#8B848C]" />
                      <span>{job.job_type.replaceAll('_', ' ')}</span>
                    </Link>
                  </td>
                  <td>
                    <StatusChip status={job.status} />
                  </td>
                  <td className="text-xs text-[#625C64] max-w-md truncate">
                    {manager.currentLabel(job.id) ?? job.error_message ?? '—'}
                  </td>
                  <td className="text-xs text-[#625C64]">
                    <span title={formatLocalDateTime(job.created_at)}>{formatRelativeTime(job.created_at)}</span>
                  </td>
                  <td className="text-xs text-[#625C64]">{formatJobDuration(job.duration_ms)}</td>
                  <td>
                    <Link
                      to={`/jobs/${job.id}`}
                      className="text-xs text-[#4B123F] font-semibold hover:underline flex items-center gap-1"
                    >
                      <span>Details</span>
                      <ArrowRight size={11} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PageState title="No jobs found" description="No background jobs match the current filter." />
      )}
    </section>
  );
}
