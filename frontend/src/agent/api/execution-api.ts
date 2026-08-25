import { apiClient, withAuthRefresh } from '../../api/client';
import type { components } from '../../api/generated/schema';

type Schemas = components['schemas'];
export type ExecutionTrace = Schemas['JobExecutionTraceResponse'];
export type ToolExecution = Schemas['ToolExecutionResponse'];
export type SqlExecution = Schemas['SQLExecutionResponse'];
export type ModelExecution = Schemas['ModelExecutionResponse'];
export type JobArtifact = Schemas['JobArtifactResponse'];

export function getExecutionTrace(jobId: string): Promise<ExecutionTrace> {
  return withAuthRefresh(() => apiClient.GET('/api/v1/jobs/{job_id}/execution', {
    params: { path: { job_id: jobId } },
  }));
}
