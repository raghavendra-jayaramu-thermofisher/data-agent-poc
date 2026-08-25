import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as jobsApi from '../api/jobs-api';
import type { JobStatus } from '../types';

export function useJobs(status?: JobStatus, limit = 50) {
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;

  return useQuery({
    queryKey: queryKeys.jobs.list(orgId, status ?? 'all'),
    queryFn: () => jobsApi.listJobs(status, limit),
    enabled: Boolean(orgId),
    retry: 1,
  });
}

export function useJob(jobId: string) {
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;

  return useQuery({
    queryKey: queryKeys.jobs.detail(orgId, jobId),
    queryFn: () => jobsApi.getJob(jobId),
    enabled: Boolean(orgId && jobId),
    retry: 1,
  });
}
