import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren, } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import type { Job } from '../api/types';
import { notifications } from '../components/notifications';
import { useOrganization } from '../organizations/OrganizationProvider';
import * as jobsApi from './api/jobs-api';
import { appendJobEvent, getSafeJobEventLabel } from './sse/job-events';
import { streamJobEvents } from './sse/job-stream';
import type { JobEvent, ManagedJob } from './types';
import { isActiveJobStatus, isTerminalJobStatus } from './types';
type JobManagerValue = {
    jobs: ManagedJob[];
    activeJobs: ManagedJob[];
    isLoading: boolean;
    registerJob(jobId: string): Promise<void>;
    cancel(jobId: string): Promise<void>;
    latestEvent(jobId: string): JobEvent | undefined;
    currentLabel(jobId: string): string | null;
};
const JobManagerContext = createContext<JobManagerValue | null>(null);
function toManaged(job: Job, existing?: ManagedJob): ManagedJob {
    return {
        job,
        events: existing?.events ?? [],
        lastSeenSequence: existing?.lastSeenSequence ?? 0,
        connectionState: existing?.connectionState ?? 'idle',
    };
}
function destinationDataSourceId(job: Job): string | null {
    const values = [job.input.data_source_id, job.result?.data_source_id];
    const id = values.find((value): value is string => typeof value === 'string');
    return id ?? null;
}
export function getJobDestination(job: Job): string | null {
    if (job.conversation_id)
        return `/conversations/${job.conversation_id}`;
    const dataSourceId = destinationDataSourceId(job);
    if (dataSourceId)
        return `/data-sources/${dataSourceId}`;
    return `/jobs/${job.id}`;
}
export function JobManagerProvider({ children }: PropsWithChildren) {
    const queryClient = useQueryClient();
    const { activeOrganization } = useOrganization();
    const orgId = activeOrganization?.id ?? null;
    const [managed, setManaged] = useState<Record<string, ManagedJob>>({});
    const streams = useRef(new Map<string, AbortController>());
    const lastSequences = useRef(new Map<string, number>());
    const jobsQuery = useQuery({
        queryKey: queryKeys.jobs.list(orgId, 'recent'),
        enabled: Boolean(orgId),
        queryFn: async () => {
            const [queued, running, recent] = await Promise.all([
                jobsApi.listJobs('queued', 50),
                jobsApi.listJobs('running', 50),
                jobsApi.listJobs(undefined, 30),
            ]);
            const byId = new Map<string, Job>();
            [...recent, ...queued, ...running].forEach((job) => byId.set(job.id, job));
            return [...byId.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        },
        retry: 1,
    });
    const reconcileJob = useCallback(async (jobId: string) => {
        const job = await jobsApi.getJob(jobId);
        setManaged((current) => ({ ...current, [jobId]: toManaged(job, current[jobId]) }));
        if (isTerminalJobStatus(job.status)) {
            streams.current.get(jobId)?.abort();
            streams.current.delete(jobId);
            await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all(orgId) });
            await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.execution(orgId, job.id) });
            if (job.job_type === 'datasource_test' || job.job_type === 'excel_materialization') {
                await queryClient.invalidateQueries({ queryKey: queryKeys.dataSources.all(orgId) });
            }
            if (job.job_type === 'knowledge_generation') {
                await queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all(orgId) });
            }
            if (job.job_type === 'dashboard_refresh') {
                await queryClient.invalidateQueries({ queryKey: queryKeys.dashboards.all(orgId) });
            }
            if (job.job_type === 'chat_query') {
                await queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all(orgId) });
                await queryClient.invalidateQueries({ queryKey: queryKeys.instructions.list(orgId) });
            }
            if (job.job_type === 'chat_query' && job.conversation_id) {
                await queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messages(orgId, job.conversation_id) });
                await queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(orgId, job.conversation_id) });
                await queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list(orgId) });
            }
        }
        return job;
    }, [orgId, queryClient]);
    const connect = useCallback((jobId: string) => {
        if (streams.current.has(jobId))
            return;
        const snapshot = managed[jobId];
        if (snapshot && !isActiveJobStatus(snapshot.job.status))
            return;
        const controller = new AbortController();
        streams.current.set(jobId, controller);
        setManaged((current) => {
            const item = current[jobId];
            return item
                ? { ...current, [jobId]: { ...item, connectionState: 'connecting' } }
                : current;
        });
        void streamJobEvents({
            jobId,
            afterSequence: lastSequences.current.get(jobId) ?? snapshot?.lastSeenSequence ?? 0,
            signal: controller.signal,
            onOpen: () => {
                setManaged((current) => {
                    const item = current[jobId];
                    return item ? { ...current, [jobId]: { ...item, connectionState: 'connected' } } : current;
                });
            },
            onEvent: (event) => {
                const lastSeen = lastSequences.current.get(jobId) ?? 0;
                if (event.sequence <= lastSeen)
                    return;
                lastSequences.current.set(jobId, event.sequence);
                setManaged((current) => {
                    const item = current[jobId];
                    if (!item)
                        return current;
                    return {
                        ...current,
                        [jobId]: {
                            ...item,
                            job: event.event_type === 'job.started' && item.job.status === 'queued'
                                ? { ...item.job, status: 'running', started_at: item.job.started_at ?? event.created_at }
                                : item.job,
                            events: appendJobEvent(item.events, event),
                            lastSeenSequence: event.sequence,
                            connectionState: 'connected',
                        },
                    };
                });
                if (event.event_type === 'job.completed' ||
                    event.event_type === 'job.failed' ||
                    event.event_type === 'job.cancelled') {
                    void reconcileJob(jobId).then((job) => {
                        if (job.status === 'succeeded')
                            notifications.success('Background job completed');
                        if (job.status === 'failed')
                            notifications.error('Background job failed', job.error_message ?? undefined);
                        if (job.status === 'cancelled')
                            notifications.info('Background job cancelled');
                    });
                }
            },
            onError: () => {
                setManaged((current) => {
                    const item = current[jobId];
                    return item ? { ...current, [jobId]: { ...item, connectionState: 'reconnecting' } } : current;
                });
            },
            onClosed: () => {
                streams.current.delete(jobId);
                setManaged((current) => {
                    const item = current[jobId];
                    return item ? { ...current, [jobId]: { ...item, connectionState: 'closed' } } : current;
                });
                void reconcileJob(jobId);
            },
        }).catch(() => {
            streams.current.delete(jobId);
        });
    }, [managed, reconcileJob]);
    useEffect(() => {
        for (const controller of streams.current.values())
            controller.abort();
        streams.current.clear();
        lastSequences.current.clear();
        setManaged({});
    }, [orgId]);
    useEffect(() => {
        if (!jobsQuery.data)
            return;
        setManaged((current) => {
            const next = { ...current };
            for (const job of jobsQuery.data)
                next[job.id] = toManaged(job, current[job.id]);
            return next;
        });
    }, [jobsQuery.data]);
    useEffect(() => {
        Object.values(managed)
            .filter((entry) => isActiveJobStatus(entry.job.status))
            .forEach((entry) => connect(entry.job.id));
    }, [connect, managed]);
    useEffect(() => () => {
        for (const controller of streams.current.values())
            controller.abort();
        streams.current.clear();
        lastSequences.current.clear();
    }, []);
    const registerJob = useCallback(async (jobId: string) => {
        const job = await jobsApi.getJob(jobId);
        setManaged((current) => ({ ...current, [jobId]: toManaged(job, current[jobId]) }));
        await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all(orgId) });
    }, [orgId, queryClient]);
    const cancel = useCallback(async (jobId: string) => {
        const job = await jobsApi.cancelJob(jobId);
        setManaged((current) => ({ ...current, [jobId]: toManaged(job, current[jobId]) }));
        await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all(orgId) });
    }, [orgId, queryClient]);
    const jobs = useMemo(() => Object.values(managed).sort((a, b) => Date.parse(b.job.created_at) - Date.parse(a.job.created_at)), [managed]);
    const activeJobs = useMemo(() => jobs.filter((entry) => isActiveJobStatus(entry.job.status)), [jobs]);
    const value = useMemo<JobManagerValue>(() => ({
        jobs,
        activeJobs,
        isLoading: jobsQuery.isLoading,
        registerJob,
        cancel,
        latestEvent: (jobId) => managed[jobId]?.events.at(-1),
        currentLabel: (jobId) => getSafeJobEventLabel(managed[jobId]?.events.at(-1)),
    }), [activeJobs, jobs, jobsQuery.isLoading, managed, registerJob, cancel]);
    return <JobManagerContext.Provider value={value}>{children}</JobManagerContext.Provider>;
}
export function useJobManager() {
    const value = useContext(JobManagerContext);
    if (!value)
        throw new Error('useJobManager must be used inside JobManagerProvider');
    return value;
}
