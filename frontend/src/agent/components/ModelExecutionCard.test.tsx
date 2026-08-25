import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ModelExecutionCard } from './ModelExecutionCard';

it('does not present unreported token usage as measured zero', () => {
  render(<ModelExecutionCard execution={{ id: 'm1', job_id: 'j1', sequence: 1, model_profile_id: 'p1', model_name: 'model-x', phase: 'answer', status: 'succeeded', input_tokens: null, output_tokens: null, total_tokens: null, error_code: null, error_message: null, started_at: '2026-08-24T12:00:00Z', finished_at: '2026-08-24T12:00:01Z' }}/>);
  expect(screen.getAllByText('Not reported')).toHaveLength(3);
  expect(screen.queryByText('0')).not.toBeInTheDocument();
});
