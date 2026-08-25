import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { getDashboard, listDashboards } from '../api/dashboard-api';

export function useDashboards() {
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  return useQuery({ queryKey: queryKeys.dashboards.list(orgId), queryFn: listDashboards, enabled: Boolean(orgId) });
}

export function useDashboard(dashboardId: string | undefined) {
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  return useQuery({ queryKey: queryKeys.dashboards.detail(orgId, dashboardId ?? ''), queryFn: () => getDashboard(dashboardId!), enabled: Boolean(orgId && dashboardId) });
}
