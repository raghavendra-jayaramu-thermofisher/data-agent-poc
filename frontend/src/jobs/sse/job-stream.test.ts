import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchEventSourceMock = vi.hoisted(() => vi.fn());
const clientMocks = vi.hoisted(() => ({
  headers: new Headers({ Authorization: 'Bearer access', 'X-Organization-ID': 'org-1' }),
  refresh: vi.fn(),
}));

vi.mock('@microsoft/fetch-event-source', () => ({ fetchEventSource: fetchEventSourceMock }));
vi.mock('../../api/client', () => ({
  API_BASE_URL: 'http://localhost:12201',
  getAuthenticatedHeaders: (extra?: HeadersInit) => {
    const headers = new Headers(clientMocks.headers);
    if (extra) new Headers(extra).forEach((value, key) => headers.set(key, value));
    return headers;
  },
  getAuthenticatedHeaderRecord: (extra?: Record<string, string>) => {
    const record: Record<string, string> = { ...extra };
    clientMocks.headers.forEach((value, key) => { record[key] = value; });
    return record;
  },
  refreshAuthTokens: clientMocks.refresh,
}));

import { streamJobEvents } from './job-stream';

describe('job SSE transport', () => {
  beforeEach(() => {
    fetchEventSourceMock.mockReset();
    clientMocks.refresh.mockReset();
    clientMocks.headers = new Headers({ Authorization: 'Bearer access', 'X-Organization-ID': 'org-1' });
  });

  it('resumes from the durable sequence using query and Last-Event-ID and parses events', async () => {
    const received: number[] = [];
    fetchEventSourceMock.mockImplementation(async (url: string, options: Record<string, unknown>) => {
      const callbacks = options as {
        headers: Record<string, string>;
        onopen(response: Response): Promise<void>;
        onmessage(message: { data: string }): void;
        onclose(): void;
      };
      expect(url).toContain('after_sequence=8');
      expect(callbacks.headers['Last-Event-ID']).toBe('8');
      expect(callbacks.headers['Authorization']).toBe('Bearer access');
      expect(callbacks.headers['X-Organization-ID']).toBe('org-1');
      await callbacks.onopen(new Response(null, { status: 200 }));
      callbacks.onmessage({
        data: JSON.stringify({
          sequence: 9,
          event_type: 'sql.completed',
          level: 'info',
          payload: {},
          created_at: '2026-08-24T12:00:00Z',
        }),
      });
      expect(callbacks.headers.get('Last-Event-ID')).toBe('9');
      callbacks.onclose();
    });

    await streamJobEvents({
      jobId: 'job-1',
      afterSequence: 8,
      signal: new AbortController().signal,
      onOpen: vi.fn(),
      onEvent: (event) => received.push(event.sequence),
      onError: vi.fn(),
      onClosed: vi.fn(),
    });

    expect(received).toEqual([9]);
  });

  it('refreshes an expired access token before reconnecting', async () => {
    clientMocks.refresh.mockResolvedValue(true);
    clientMocks.headers = new Headers({ Authorization: 'Bearer refreshed', 'X-Organization-ID': 'org-1' });
    fetchEventSourceMock.mockImplementation(async (_url: string, options: Record<string, unknown>) => {
      const callbacks = options as { onopen(response: Response): Promise<void> };
      await expect(callbacks.onopen(new Response(null, { status: 401 }))).rejects.toThrow('reconnecting');
    });

    await streamJobEvents({
      jobId: 'job-1',
      afterSequence: 0,
      signal: new AbortController().signal,
      onOpen: vi.fn(),
      onEvent: vi.fn(),
      onError: vi.fn(),
      onClosed: vi.fn(),
    });

    expect(clientMocks.refresh).toHaveBeenCalledTimes(1);
  });
});
