import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { ModelExecution } from '../api/execution-api';
import { JobUsageSummary } from './JobUsageSummary';
import { setShowCost } from '../../lib/useShowCost';

const call = (overrides: Partial<ModelExecution>): ModelExecution => ({
  id: 'm1',
  job_id: 'j1',
  sequence: 1,
  model_profile_id: 'p1',
  model_name: 'model-x',
  phase: 'analysis',
  status: 'succeeded',
  input_tokens: 1000,
  output_tokens: 100,
  total_tokens: 1100,
  error_code: null,
  error_message: null,
  started_at: '2026-10-22T10:00:00Z',
  finished_at: '2026-10-22T10:00:02Z',
  ...overrides,
});

it('shows the question cost, tokens and model calls', () => {
  render(<JobUsageSummary models={[call({ cost: 0.0125 }), call({ id: 'm2', cost: 0.0025 })]} />);
  const summary = screen.getByLabelText('Question cost');
  expect(summary).toHaveTextContent('$0.0150');
  expect(summary).toHaveTextContent('2,200 tokens');
  expect(summary).toHaveTextContent('2 model calls');
});

it('says when calls have no price instead of showing zero', () => {
  render(<JobUsageSummary models={[call({ cost: null })]} />);
  const summary = screen.getByLabelText('Question cost');
  expect(summary).toHaveTextContent('Cost not available');
  expect(summary).toHaveTextContent('1 model call has no price');
  expect(summary).not.toHaveTextContent('$0');
});

it('keeps tokens and model calls but hides the cost when cost is hidden', () => {
  setShowCost(false);
  render(<JobUsageSummary models={[call({ cost: 0.0125 }), call({ id: 'm2', cost: null })]} />);
  const summary = screen.getByLabelText('Question usage');
  expect(summary).toHaveTextContent('2,200 tokens');
  expect(summary).toHaveTextContent('2 model calls');
  expect(summary).not.toHaveTextContent('$');
  expect(summary).not.toHaveTextContent(/cost|price/i);
});

it('renders nothing without model calls', () => {
  const { container } = render(<JobUsageSummary models={[]} />);
  expect(container).toBeEmptyDOMElement();
});
