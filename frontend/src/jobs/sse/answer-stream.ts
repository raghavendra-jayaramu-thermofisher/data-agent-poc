import type { JobEvent, StreamingAnswer } from '../types';

export function isAnswerStreamEvent(event: JobEvent): boolean {
  return event.event_type === 'answer.started' || event.event_type === 'answer.delta';
}

/** Sequences are deduplicated by the job manager; offsets protect against missing/replayed text. */
export function applyAnswerStreamEvent(
  current: StreamingAnswer | undefined,
  event: JobEvent,
): StreamingAnswer | undefined {
  if (event.event_type === 'job.started' || event.event_type === 'job.retry_scheduled')
    return undefined;
  const { stream_id: streamId, offset, text } = event.payload;
  if (event.event_type === 'answer.started' && typeof streamId === 'string')
    return { streamId, text: '' };
  if (
    event.event_type !== 'answer.delta' ||
    typeof streamId !== 'string' ||
    !Number.isSafeInteger(offset) ||
    typeof text !== 'string'
  )
    return current;
  if (!current || current.streamId !== streamId || offset !== current.text.length) return current;
  return { ...current, text: current.text + text };
}
