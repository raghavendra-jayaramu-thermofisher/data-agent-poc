import { apiClient, withAuthRefresh } from '../../api/client';
import type { components } from '../../api/generated/schema';
import type { ModelConnection, ModelProfile } from '../../api/types';
type S = components['schemas'];
export function listConnections(): Promise<ModelConnection[]> { return withAuthRefresh(() => apiClient.GET('/api/v1/models/connections')); }
export function createConnection(body: S['ModelConnectionCreate']): Promise<ModelConnection> { return withAuthRefresh(() => apiClient.POST('/api/v1/models/connections', { body })); }
export function getConnection(id: string): Promise<ModelConnection> { return withAuthRefresh(() => apiClient.GET('/api/v1/models/connections/{connection_id}', { params: { path: { connection_id: id } } })); }
export function updateConnection(id: string, body: S['ModelConnectionUpdate']): Promise<ModelConnection> { return withAuthRefresh(() => apiClient.PATCH('/api/v1/models/connections/{connection_id}', { params: { path: { connection_id: id } }, body })); }
export function deleteConnection(id: string): Promise<void> { return withAuthRefresh(() => apiClient.DELETE('/api/v1/models/connections/{connection_id}', { params: { path: { connection_id: id } } })) as Promise<void>; }
export function testConnection(id: string): Promise<S['ModelConnectionTestResponse']> { return withAuthRefresh(() => apiClient.POST('/api/v1/models/connections/{connection_id}/test', { params: { path: { connection_id: id } } })); }
export function listProfiles(): Promise<ModelProfile[]> { return withAuthRefresh(() => apiClient.GET('/api/v1/models/profiles')); }
export function getDefaultProfile(): Promise<ModelProfile | null> { return withAuthRefresh(() => apiClient.GET('/api/v1/models/profiles/default')); }
export function createProfile(body: S['ModelProfileCreate']): Promise<ModelProfile> { return withAuthRefresh(() => apiClient.POST('/api/v1/models/profiles', { body })); }
export function getProfile(id: string): Promise<ModelProfile> { return withAuthRefresh(() => apiClient.GET('/api/v1/models/profiles/{profile_id}', { params: { path: { profile_id: id } } })); }
export function updateProfile(id: string, body: S['ModelProfileUpdate']): Promise<ModelProfile> { return withAuthRefresh(() => apiClient.PATCH('/api/v1/models/profiles/{profile_id}', { params: { path: { profile_id: id } }, body })); }
export function deleteProfile(id: string): Promise<void> { return withAuthRefresh(() => apiClient.DELETE('/api/v1/models/profiles/{profile_id}', { params: { path: { profile_id: id } } })) as Promise<void>; }
export function setDefaultProfile(id: string): Promise<ModelProfile> { return withAuthRefresh(() => apiClient.POST('/api/v1/models/profiles/{profile_id}/default', { params: { path: { profile_id: id } } })); }
