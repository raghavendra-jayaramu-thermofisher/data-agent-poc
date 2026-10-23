import { Button, Tabs } from '@heroui/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Activity, ChevronRight, RefreshCw, Square } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { AppError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import { PageError, PageLoading } from '../../components/PageState';
import {
  ManagementHeader,
  ManagementMenu,
  ManagementSearch,
} from '../../components/management/ManagementUI';
import { listDataSources } from '../../data-sources/api/data-source-api';
import { formatLocalDateTime, formatRelativeTime } from '../../lib/datetime';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { useJobManager } from '../JobManagerProvider';
import { JobStatusBadge } from '../components/JobStatusBadge';
import { useJobs } from '../hooks/useJobs';
import { formatJobDuration, jobContext, jobStatusLabel, jobTypeLabel } from '../job-display';
import { isActiveJobStatus, type JobStatus } from '../types';
import '../jobs.css';

const filters = [
  'all',
  'queued',
  'running',
  'waiting_for_input',
  'succeeded',
  'failed',
  'cancelled',
] as const;
type JobFilter = (typeof filters)[number];
function isJobFilter(value: string | null): value is JobFilter {
  return Boolean(value && filters.includes(value as JobFilter));
}

export function JobsPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const manager = useJobManager();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const requestedFilter = params.get('status');
  const filter: JobFilter = isJobFilter(requestedFilter) ? requestedFilter : 'all';
  const query = useJobs(filter === 'all' ? undefined : (filter as JobStatus), 100);
  const sources = useQuery({
    queryKey: queryKeys.dataSources.list(orgId),
    queryFn: listDataSources,
    enabled: Boolean(orgId),
    staleTime: 60_000,
  });
  const sourceNames = Object.fromEntries(
    (sources.data ?? []).map((source) => [source.id, source.name]),
  );
  const cancel = useMutation({ mutationFn: (id: string) => manager.cancel(id) });
  const jobs = useMemo(() => {
    const managedById = new Map(manager.jobs.map((entry) => [entry.job.id, entry.job]));
    return (query.data ?? []).map((job) => {
      const current = managedById.get(job.id);
      return current
        ? { ...job, ...current, duration_ms: job.duration_ms ?? current.duration_ms }
        : job;
    });
  }, [manager.jobs, query.data]);
  const visible = jobs.filter(
    (job) =>
      (filter === 'all' || job.status === filter) &&
      (
        jobTypeLabel(job.job_type) +
        ' ' +
        jobContext(job, sourceNames) +
        ' ' +
        jobStatusLabel(job.status)
      )
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <section className="management-page jobs-page">
      <ManagementHeader title="Jobs">
        <ManagementSearch label="Search jobs" value={search} onChange={setSearch} />
        <Button
          variant="secondary"
          isIconOnly
          aria-label="Refresh jobs"
          isPending={query.isFetching}
          onPress={() => void query.refetch()}
        >
          <RefreshCw size={15} aria-hidden="true" />
        </Button>
      </ManagementHeader>
      {cancel.isError && (
        <p className="management-error" role="alert">
          {(cancel.error as unknown as AppError)?.message ||
            'Unable to cancel this job. Please try again.'}
        </p>
      )}
      <Tabs
        className="management-tabs jobs-tabs"
        variant="secondary"
        selectedKey={filter}
        onSelectionChange={(key) =>
          setParams((current) => {
            const next = new URLSearchParams(current);
            if (key === 'all') next.delete('status');
            else next.set('status', String(key));
            return next;
          })
        }
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Job status">
            {filters.map((status) => (
              <Tabs.Tab key={status} id={status}>
                {status === 'all' ? 'All' : jobStatusLabel(status)}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id={filter}>
          {query.isLoading && !jobs.length && <PageLoading label="Loading jobs…" />}
          {query.isError && !jobs.length && (
            <PageError title="Unable to load jobs" retry={() => void query.refetch()} />
          )}
          <div className="jobs-list">
            {visible.map((job) => (
              <article className="jobs-row" key={job.id}>
                <Link to={'/jobs/' + job.id} className="jobs-row-link">
                  <span className="management-row-icon">
                    <Activity size={16} aria-hidden="true" />
                  </span>
                  <span className="jobs-row-copy">
                    <span className="jobs-row-title">{jobTypeLabel(job.job_type)}</span>
                    {(jobContext(job, sourceNames) ||
                      (job.status === 'failed' && job.error_message) ||
                      (isActiveJobStatus(job.status) && manager.currentLabel(job.id))) && (
                      <span className="jobs-row-context">
                        {job.status === 'failed'
                          ? job.error_message || jobContext(job, sourceNames)
                          : jobContext(job, sourceNames) || manager.currentLabel(job.id)}
                      </span>
                    )}
                  </span>
                  <JobStatusBadge status={job.status} />
                  <span className="jobs-row-duration" title="Duration">
                    {formatJobDuration(job.duration_ms)}
                  </span>
                  <time
                    className="jobs-row-time"
                    dateTime={job.created_at}
                    title={formatLocalDateTime(job.created_at)}
                  >
                    {formatRelativeTime(job.created_at)}
                  </time>
                  <ChevronRight size={16} className="jobs-row-chevron" aria-hidden="true" />
                </Link>
                {isActiveJobStatus(job.status) && (
                  <ManagementMenu
                    name={jobTypeLabel(job.job_type)}
                    disabled={cancel.isPending}
                    actions={[
                      {
                        id: 'cancel',
                        label: 'Cancel job',
                        icon: <Square size={13} />,
                        danger: true,
                      },
                    ]}
                    onAction={() => cancel.mutate(job.id)}
                  />
                )}
              </article>
            ))}
          </div>
          {!visible.length && !query.isLoading && !query.isError && (
            <div className="management-empty">
              <Activity size={26} aria-hidden="true" />
              <h2>
                {search
                  ? 'No matching jobs'
                  : filter === 'all'
                    ? 'No jobs yet'
                    : filter === 'running'
                      ? 'No jobs in progress'
                      : 'No ' + jobStatusLabel(filter).toLocaleLowerCase() + ' jobs'}
              </h2>
              {search ? (
                <Button variant="secondary" onPress={() => setSearch('')}>
                  Clear search
                </Button>
              ) : (
                <p>
                  {filter === 'all'
                    ? 'Your analyses and background tasks will appear here.'
                    : 'Jobs with this status will appear here.'}
                </p>
              )}
            </div>
          )}
        </Tabs.Panel>
      </Tabs>
    </section>
  );
}
