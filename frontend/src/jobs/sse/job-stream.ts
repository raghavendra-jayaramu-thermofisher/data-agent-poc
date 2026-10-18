import { fetchEventSource } from '@microsoft/fetch-event-source';
import { API_BASE_URL, getAuthenticatedHeaderRecord, refreshAuthTokens } from '../../api/client';
import { parseJobEvent } from './job-events';
import type { JobEvent } from '../types';
type Options = {
    jobId: string;
    afterSequence: number;
    signal: AbortSignal;
    onOpen(): void;
    onEvent(event: JobEvent): void;
    onError(error: unknown): void;
    onClosed(): void;
};
class FatalStreamError extends Error {
}
export async function streamJobEvents(options: Options): Promise<void> {
    let lastSequence = options.afterSequence;
    const url = new URL(`/api/v1/jobs/${options.jobId}/events`, API_BASE_URL);
    if (options.afterSequence > 0)
        url.searchParams.set('after_sequence', String(options.afterSequence));
    const headers = getAuthenticatedHeaderRecord({ Accept: 'text/event-stream' });
    if (options.afterSequence > 0)
        headers['last-event-id'] = String(options.afterSequence);
    await fetchEventSource(url.toString(), {
        // The SSE library copies and advances its own Last-Event-ID before onmessage.
        // Override it on every real request with our last *accepted* sequence, so a
        // missing chunk is replayed instead of skipped. Also refresh auth on retries.
        fetch: (input, init) => {
            const retryHeaders = new Headers(init?.headers);
            for (const [name, value] of Object.entries(getAuthenticatedHeaderRecord()))
                retryHeaders.set(name, value);
            retryHeaders.set('last-event-id', String(lastSequence));
            return globalThis.fetch(input, { ...init, headers: retryHeaders });
        },
        method: 'GET',
        headers,
        signal: options.signal,
        openWhenHidden: true,
        async onopen(response) {
            if (response.status === 401) {
                const refreshed = await refreshAuthTokens();
                if (!refreshed)
                    throw new FatalStreamError('SSE authentication expired');
                const current = getAuthenticatedHeaderRecord();
                if (current['Authorization'])
                    headers['Authorization'] = current['Authorization'];
                throw new Error('SSE authentication refreshed; reconnecting');
            }
            if (response.status === 403 || response.status === 404)
                throw new FatalStreamError(`SSE access rejected (${response.status})`);
            if (!response.ok)
                throw new Error(`SSE connection failed (${response.status})`);
            options.onOpen();
        },
        onmessage(message) {
            // fetch-event-source updates this header before calling us. Keep the last
            // accepted sequence if a malformed frame or a gap requires durable replay.
            headers['last-event-id'] = String(lastSequence);
            if (!message.data)
                return;
            const parsed = parseJobEvent(message.data);
            if (!parsed)
                return;
            if (parsed.sequence <= lastSequence) return;
            if (parsed.sequence !== lastSequence + 1)
                throw new Error('A live update was missed; reconnecting to recover it.');
            lastSequence = parsed.sequence;
            headers['last-event-id'] = String(parsed.sequence);
            options.onEvent(parsed);
        },
        onclose() { options.onClosed(); },
        onerror(error) {
            options.onError(error);
            if (error instanceof FatalStreamError)
                throw error;
            return 1500;
        },
    });
}
