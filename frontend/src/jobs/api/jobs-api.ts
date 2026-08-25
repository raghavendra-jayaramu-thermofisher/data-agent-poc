import { apiClient, withAuthRefresh } from '../../api/client';
import type { Job } from '../../api/types';
export function listJobs(status?: string, limit = 50): Promise<Job[]> {
    return withAuthRefresh(() => apiClient.GET('/api/v1/jobs', { params: { query: { status: status ?? null, limit } } }));
}
export function getJob(jobId: string): Promise<Job> {
    return withAuthRefresh(() => apiClient.GET('/api/v1/jobs/{job_id}', { params: { path: { job_id: jobId } } }));
}
export function cancelJob(jobId: string): Promise<Job> {
    return withAuthRefresh(() => apiClient.POST('/api/v1/jobs/{job_id}/cancel', { params: { path: { job_id: jobId } } }));
}
