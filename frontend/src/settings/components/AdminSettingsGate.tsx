import type { PropsWithChildren } from 'react';
import { PageState } from '../../components/PageState';
import { useOrganization } from '../../organizations/OrganizationProvider';

export function hasAdminRole(role: string | null | undefined) {
  return role === 'owner' || role === 'admin';
}

export function AdminSettingsGate({ children }: PropsWithChildren) {
  const { activeOrganization, isLoading } = useOrganization();
  if (isLoading) return <PageState title="Loading workspace…" loading />;
  if (!hasAdminRole(activeOrganization?.role)) {
    return <PageState title="Admin access required" description="Only organization owners and admins can view this section." />;
  }
  return children;
}
