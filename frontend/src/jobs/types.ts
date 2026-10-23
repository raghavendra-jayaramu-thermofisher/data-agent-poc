import type { Job } from '../api/types';
export type JobStatus =
    | 'queued'
    | 'running'
    | 'waiting_for_input'
    | 'succeeded'
    | 'failed'
    | 'cancelled';
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
    answer?: StreamingAnswer;
};
export type StreamingAnswer = { streamId: string; text: string };
export function isActiveJobStatus(status: string): status is 'queued' | 'running' {
    return status === 'queued' || status === 'running';
}
/** Paused for the user's answers: no worker holds it, and answering queues it again. */
export function isWaitingJobStatus(status: string): status is 'waiting_for_input' {
    return status === 'waiting_for_input';
}
export function isTerminalJobStatus(status: string): status is 'succeeded' | 'failed' | 'cancelled' {
    return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}
