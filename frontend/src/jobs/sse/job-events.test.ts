import { describe, expect, it } from 'vitest';
import { appendJobEvent, getSafeJobEventLabel, parseJobEvent } from './job-events';
const event = (sequence: number, event_type = 'job.started') => ({
  sequence,
  event_type,
  level: 'info',
  payload: {},
  created_at: '2026-08-24T12:00:00Z',
});

describe('job events', () => {
  it('parses the durable event contract and rejects malformed frames', () => {
    expect(parseJobEvent(JSON.stringify(event(3)))?.sequence).toBe(3);
    expect(parseJobEvent('{bad')).toBeNull();
    expect(parseJobEvent(JSON.stringify({ sequence: '3' }))).toBeNull();
  });

  it('deduplicates replayed sequences and keeps chronological order', () => {
    const first = appendJobEvent([], event(2));
    const withEarlier = appendJobEvent(first, event(1));
    expect(withEarlier.map((item) => item.sequence)).toEqual([1, 2]);
    expect(appendJobEvent(withEarlier, event(2))).toBe(withEarlier);
  });

  it('maps known progress safely and does not expose arbitrary payload text', () => {
    expect(
      getSafeJobEventLabel({
        ...event(4, 'excel.sheet.started'),
        payload: { sheet_name: 'Orders', secret: 'never' },
      }),
    ).toBe('Importing Orders…');
    expect(getSafeJobEventLabel(event(5, 'deepagents.private.reasoning'))).toBeNull();
  });
});
