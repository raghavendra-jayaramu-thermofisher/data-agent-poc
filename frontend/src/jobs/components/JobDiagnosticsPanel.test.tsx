import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Job } from '../../api/types';
import type { ExecutionTrace } from '../../agent/api/execution-api';
import { JobDiagnosticsPanel } from './JobDiagnosticsPanel';
vi.mock('../../components/notifications', () => ({ notifications: { success: vi.fn(), error: vi.fn() } }));
const job: Job = { id: 'j1', job_type: 'chat_query', status: 'failed', error_code: 'FINAL_ANSWER_PROVIDER_FAILED', error_message: 'Final answer failed.', organization_id: 'o', requested_by: 'u', conversation_id: null, input: { private_prompt: 'secret' }, result: null, attempt_count: 1, max_attempts: 3, cancel_requested_at: null, created_at: '2026-10-04T00:00:00Z', started_at: null, finished_at: null };
const trace: ExecutionTrace = { models: [{ id: 'm1', job_id: 'j1', sequence: 1, model_profile_id: 'p', model_name: 'model', phase: 'finalization', status: 'failed', input_tokens: null, output_tokens: null, total_tokens: null, error_code: 'FINAL_ANSWER_PROVIDER_FAILED', error_message: 'http_status: 400\nprovider_message: Unsupported parameter\nparameter: temperature', started_at: job.created_at, finished_at: null }], tools: [], sql: [], artifacts: [] };
describe('job failure diagnostics', () => {
  it('shows the recorded cause and copies only diagnostics without retry controls or prompts', async () => {
    const user = userEvent.setup(); render(<JobDiagnosticsPanel job={job} trace={trace} />);
    expect(screen.getByText(/Unsupported parameter/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy Diagnostics' }));
    const copied = await navigator.clipboard.readText();
    expect(copied).toContain('parameter: temperature'); expect(copied).not.toContain('private_prompt'); expect(copied).not.toContain('secret');
  });
  it('keeps the job error copyable when execution records are unavailable', () => {
    render(<JobDiagnosticsPanel job={job} unavailable />);
    expect(screen.getByText(/could not be loaded/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Diagnostics' })).toBeEnabled();
  });
  it('does not show a failure panel for successful jobs', () => {
    render(<JobDiagnosticsPanel job={{ ...job, status: 'succeeded' }} />);
    expect(screen.queryByRole('region', { name: 'Job diagnostics' })).not.toBeInTheDocument();
  });
});
