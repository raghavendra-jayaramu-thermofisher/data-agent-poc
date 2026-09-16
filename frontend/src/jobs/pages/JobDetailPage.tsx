import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router';
import {
  Activity,
  ArrowLeft,
  XCircle,
  RotateCcw,
  Layers,
  Terminal,
} from 'lucide-react';
import { ArtifactRenderer } from '../../agent/components/ArtifactRenderer';
import { ExecutionTimeline } from '../../agent/components/ExecutionTimeline';
import { useExecutionTrace } from '../../agent/hooks/useExecutionTrace';
import { queryKeys } from '../../api/queryKeys';
import { PageState } from '../../components/PageState';
import { StatusChip } from '../../components/StatusChip';
import { listDataSources } from '../../data-sources/api/data-source-api';
import { formatLocalDateTime } from '../../lib/datetime';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { useJobManager } from '../JobManagerProvider';
import { useJob } from '../hooks/useJobs';
import { getSafeJobEventLabel } from '../sse/job-events';
import { isActiveJobStatus } from '../types';

export function JobDetailPage() {
  const { jobId = '' } = useParams();
  const manager = useJobManager();
  const managed = manager.jobs.find((item) => item.job.id === jobId);
  const query = useJob(jobId);
  const trace = useExecutionTrace(jobId, Boolean(jobId));
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const dataSources = useQuery({
    queryKey: queryKeys.dataSources.list(orgId),
    queryFn: listDataSources,
    enabled: Boolean(orgId),
    staleTime: 60_000,
  });
  const sourceNames = Object.fromEntries(
    (dataSources.data ?? []).map((source) => [source.id, source.name])
  );
  const job = managed?.job ?? query.data;

  if (query.isLoading && !job) return <PageState title="Loading durable job…" loading />;
  if (query.isError || !job)
    return (
      <PageState
        title="Job not found"
        description="This job is unavailable in the active workspace."
      />
    );

  return (
    <section className="page max-w-5xl mx-auto">
      {/* Header */}
      <div className="page-header mb-6">
        <div>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1 text-xs text-[#8B848C] hover:text-[#4B123F] mb-1 font-medium"
          >
            <ArrowLeft size={12} />
            <span>Back to Jobs</span>
          </Link>
          <div className="flex items-center gap-2">
            <Activity size={22} className="text-[#4B123F]" />
            <h1 className="text-xl font-semibold text-[#252127]">
              {job.job_type.replaceAll('_', ' ').toUpperCase()}
            </h1>
          </div>
          <p className="text-xs text-[#625C64] font-mono mt-0.5">{job.id}</p>
        </div>

        <div className="flex items-center gap-2">
          <StatusChip status={job.status} />
          {isActiveJobStatus(job.status) && (
            <button
              type="button"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#A84545] hover:bg-[#8F3535] text-[#FFF9FD] rounded text-xs font-semibold transition-colors"
              onClick={() => void manager.cancel(job.id)}
            >
              <XCircle size={13} />
              <span>Cancel Job</span>
            </button>
          )}
        </div>
      </div>

      {/* Durable State & Event Timeline Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-[#252127] pb-2 mb-3 border-b border-[#E7E3DC]">
            Durable Execution State
          </h2>
          <dl className="grid grid-cols-3 gap-3 text-xs">
            <dt className="text-[#8B848C] uppercase text-[10px] font-semibold">Created</dt>
            <dd className="col-span-2 text-[#252127]">{formatLocalDateTime(job.created_at)}</dd>

            <dt className="text-[#8B848C] uppercase text-[10px] font-semibold">Started</dt>
            <dd className="col-span-2 text-[#252127]">
              {job.started_at ? formatLocalDateTime(job.started_at) : '—'}
            </dd>

            <dt className="text-[#8B848C] uppercase text-[10px] font-semibold">Finished</dt>
            <dd className="col-span-2 text-[#252127]">
              {job.finished_at ? formatLocalDateTime(job.finished_at) : '—'}
            </dd>

            <dt className="text-[#8B848C] uppercase text-[10px] font-semibold">SQL Attempts</dt>
            <dd className="col-span-2 font-mono text-[#252127]">
              {job.attempt_count} / {job.max_attempts}
            </dd>

            <dt className="text-[#8B848C] uppercase text-[10px] font-semibold">Error Status</dt>
            <dd className="col-span-2 text-[#A84545] font-mono">{job.error_message ?? '—'}</dd>
          </dl>
        </div>

        <div className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg p-5 shadow-xs flex flex-col">
          <h2 className="text-sm font-semibold text-[#252127] pb-2 mb-3 border-b border-[#E7E3DC]">
            Live Event Stream
          </h2>
          <div className="flex-1 overflow-y-auto space-y-2 max-h-56 pr-1">
            {(managed?.events ?? []).map((event) => (
              <div
                key={event.sequence}
                className="flex items-center justify-between p-2 bg-[#FBFAF7] border border-[#DAD5CD] rounded text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-[#8B848C]">#{event.sequence}</span>
                  <span className="text-[#252127] font-medium">
                    {getSafeJobEventLabel(event) ?? 'Operational event'}
                  </span>
                </div>
                <time className="text-[10px] text-[#8B848C]">
                  {formatLocalDateTime(event.created_at)}
                </time>
              </div>
            ))}
            {!managed?.events.length && (
              <p className="text-xs text-[#8B848C] py-8 text-center">
                No live events are cached in this browser session. Durable state remains available above.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Execution Trace */}
      <section className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg p-6 shadow-xs mb-6">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E7E3DC]">
          <div>
            <div className="flex items-center gap-2">
              <Terminal size={18} className="text-[#4B123F]" />
              <h2 className="text-base font-semibold text-[#252127]">Execution Trace</h2>
            </div>
            <p className="text-xs text-[#625C64] mt-0.5">
              Persisted operational records only. Private model reasoning and hidden prompts are never displayed.
            </p>
          </div>
          {trace.isError && (
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FFFDFC] hover:bg-[#F0EEE9] text-[#252127] border border-[#DAD5CD] rounded text-xs font-semibold"
              onClick={() => void trace.refetch()}
            >
              <RotateCcw size={12} />
              <span>Retry Trace</span>
            </button>
          )}
        </div>

        {trace.isLoading ? (
          <p className="text-xs text-[#8B848C] py-4 text-center">Loading persisted execution records…</p>
        ) : trace.data ? (
          <ExecutionTimeline trace={trace.data} dataSourceNames={sourceNames} />
        ) : (
          <p className="text-xs text-[#8B848C] py-4 text-center">Execution records are unavailable for this job.</p>
        )}
      </section>

      {/* Artifacts */}
      {trace.data?.artifacts?.length ? (
        <section className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-lg p-6 shadow-xs">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#E7E3DC]">
            <Layers size={18} className="text-[#4B123F]" />
            <h2 className="text-base font-semibold text-[#252127]">Generated Artifacts</h2>
          </div>
          <ArtifactRenderer
            jobId={job.id}
            artifacts={trace.data.artifacts}
            sql={trace.data.sql ?? []}
            dataSourceNames={sourceNames}
          />
        </section>
      ) : null}
    </section>
  );
}
