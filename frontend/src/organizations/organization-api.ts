import { apiClient, withAuthRefresh } from '../api/client';
export async function listOrganizations() { return withAuthRefresh(() => apiClient.GET('/api/v1/organizations')); }
export async function getCurrentOrganization() { return withAuthRefresh(() => apiClient.GET('/api/v1/organizations/current')); }
