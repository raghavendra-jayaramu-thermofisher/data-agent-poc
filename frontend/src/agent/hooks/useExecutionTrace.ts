import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { getExecutionTrace } from '../api/execution-api';

export function useExecutionTrace(jobId: string | null | undefined, enabled = true) {
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  return useQuery({
    queryKey: queryKeys.jobs.execution(orgId, jobId ?? ''),
    queryFn: () => getExecutionTrace(jobId!),
    enabled: Boolean(orgId && jobId && enabled),
    staleTime: 15_000,
  });
}
