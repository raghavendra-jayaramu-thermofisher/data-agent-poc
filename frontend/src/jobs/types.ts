import type { Job } from '../api/types';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type JobEvent = {
    sequence: number;
    event_type: string;
    level: string;
    payload: Record<string, unknown>;
    created_at: string;
};
export type ManagedJob = {
    job: Job;
    events: JobEvent[];
    lastSeenSequence: number;
    connectionState: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed';
};
export function isActiveJobStatus(status: string): status is 'queued' | 'running' {
    return status === 'queued' || status === 'running';
}
export function isTerminalJobStatus(status: string): status is 'succeeded' | 'failed' | 'cancelled' {
    return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}
