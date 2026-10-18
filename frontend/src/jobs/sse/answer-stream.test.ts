import { describe, expect, it } from 'vitest';
import { applyAnswerStreamEvent } from './answer-stream';
import type { JobEvent } from '../types';

const event = (event_type: string, payload: Record<string, unknown>): JobEvent => ({
  sequence: 1,
  event_type,
  payload,
  level: 'info',
  created_at: '2026-10-18T00:00:00Z',
});

describe('streamed answer state', () => {
  it('reconstructs deltas with UTF-16 offsets, rejecting replayed or missing text', () => {
    let state = applyAnswerStreamEvent(undefined, event('answer.started', { stream_id: 'first' }));
    state = applyAnswerStreamEvent(
      state,
      event('answer.delta', { stream_id: 'first', offset: 0, text: 'Hi 🌍' }),
    );
    expect(state?.text).toBe('Hi 🌍');
    expect(
      applyAnswerStreamEvent(
        state,
        event('answer.delta', { stream_id: 'first', offset: 0, text: 'Hi 🌍' }),
      ),
    ).toBe(state);
    expect(
      applyAnswerStreamEvent(
        state,
        event('answer.delta', { stream_id: 'first', offset: 9, text: 'Missing' }),
      ),
    ).toBe(state);
    expect(
      applyAnswerStreamEvent(
        state,
        event('answer.delta', { stream_id: 'first', offset: 5, text: ' again' }),
      )?.text,
    ).toBe('Hi 🌍 again');
  });

  it('resets the preview for a new attempt and ignores older stream IDs', () => {
    const first = { streamId: 'old', text: 'Old response' };
    const next = applyAnswerStreamEvent(first, event('answer.started', { stream_id: 'new' }));
    expect(next).toEqual({ streamId: 'new', text: '' });
    expect(
      applyAnswerStreamEvent(
        next,
        event('answer.delta', { stream_id: 'old', offset: 0, text: 'Late' }),
      ),
    ).toBe(next);
    expect(applyAnswerStreamEvent(next, event('job.retry_scheduled', {}))).toBeUndefined();
    expect(applyAnswerStreamEvent(first, event('job.started', {}))).toBeUndefined();
  });
});
