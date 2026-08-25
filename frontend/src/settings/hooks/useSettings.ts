import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { getOperationalStatus, listAuditLogs, updateOrganization } from '../api/settings-api';

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, name }: { organizationId: string; name: string }) => updateOrganization(organizationId, { name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.organizations.list });
    },
  });
}

export function useAuditLogs(enabled: boolean) {
  const { activeOrganization } = useOrganization();
  return useQuery({
    queryKey: queryKeys.settings.audit(activeOrganization?.id ?? null),
    queryFn: () => listAuditLogs(100),
    enabled: enabled && Boolean(activeOrganization),
  });
}

export function useOperationalStatus(enabled: boolean) {
  const { activeOrganization } = useOrganization();
  return useQuery({
    queryKey: queryKeys.settings.operations(activeOrganization?.id ?? null),
    queryFn: getOperationalStatus,
    enabled: enabled && Boolean(activeOrganization),
  });
}
