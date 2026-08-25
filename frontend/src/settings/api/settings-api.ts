import { apiClient, withAuthRefresh } from '../../api/client';
import type { components } from '../../api/generated/schema';

export type AuditLog = components['schemas']['AuditLogResponse'];
export type OrganizationUpdate = components['schemas']['OrganizationUpdateRequest'];

export async function updateOrganization(organizationId: string, body: OrganizationUpdate) {
  return withAuthRefresh(() => apiClient.PATCH('/api/v1/organizations/{organization_id}', {
    params: { path: { organization_id: organizationId } },
    body,
  }));
}

export async function listAuditLogs(limit = 100) {
  return withAuthRefresh(() => apiClient.GET('/api/v1/audit', { params: { query: { limit } } }));
}

export async function getOperationalStatus() {
  return withAuthRefresh(() => apiClient.GET('/api/v1/ops/status'));
}
