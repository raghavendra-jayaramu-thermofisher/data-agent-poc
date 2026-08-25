import type { JobEvent } from '../types';
export function parseJobEvent(data: string): JobEvent | null {
    try {
        const value: unknown = JSON.parse(data);
        if (!value || typeof value !== 'object')
            return null;
        const candidate = value as Record<string, unknown>;
        if (typeof candidate.sequence !== 'number' ||
            typeof candidate.event_type !== 'string' ||
            typeof candidate.level !== 'string' ||
            typeof candidate.created_at !== 'string' ||
            !candidate.payload ||
            typeof candidate.payload !== 'object' ||
            Array.isArray(candidate.payload)) {
            return null;
        }
        return {
            sequence: candidate.sequence,
            event_type: candidate.event_type,
            level: candidate.level,
            payload: candidate.payload as Record<string, unknown>,
            created_at: candidate.created_at,
        };
    }
    catch {
        return null;
    }
}
export function appendJobEvent(events: JobEvent[], next: JobEvent): JobEvent[] {
    if (events.some((event) => event.sequence === next.sequence))
        return events;
    return [...events, next].sort((a, b) => a.sequence - b.sequence);
}
const exactLabels: Record<string, string> = {
    'job.queued': 'Queued',
    'job.started': 'Started',
    'job.completed': 'Completed',
    'job.failed': 'Failed',
    'job.cancelled': 'Cancelled',
    'datasource.test.started': 'Testing data source…',
    'datasource.test.completed': 'Data source test completed',
    'excel.materialization.started': 'Creating analytical database…',
    'excel.database.created': 'Analytical database created',
    'datasource.ready': 'Data source ready',
    'knowledge.generation.started': 'Generating knowledge…',
    'knowledge.schema.inspected': 'Schema inspected',
    'knowledge.index.generated': 'Knowledge index generated',
    'knowledge.documents.generated': 'Knowledge documents generated',
    'knowledge.generation.completed': 'Knowledge ready',
    'knowledge.index.loaded': 'Reading data knowledge…',
    'knowledge.schema.loaded': 'Loading table schema…',
    'agent.started': 'Starting analysis…',
    'model.request.started': 'Analyzing…',
    'model.request.completed': 'Analysis step completed',
    'tool.started': 'Running analysis tool…',
    'tool.completed': 'Analysis tool completed',
    'sql.started': 'Executing SQL…',
    'sql.completed': 'SQL completed',
    'chart.generated': 'Chart created',
    'answer.generated': 'Answer generated',
    'dashboard.widget.refreshed': 'Dashboard widget refreshed',
};
function safeShortLabel(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return null;
    return normalized.length > 80 ? `${normalized.slice(0, 77)}…` : normalized;
}
export function getSafeJobEventLabel(event?: JobEvent): string | null {
    if (!event)
        return null;
    const exact = exactLabels[event.event_type];
    if (exact)
        return exact;
    if (event.event_type === 'excel.sheet.started') {
        const name = safeShortLabel(event.payload.sheet_name);
        return name ? `Importing ${name}…` : 'Importing worksheet…';
    }
    if (event.event_type === 'excel.sheet.completed') {
        const name = safeShortLabel(event.payload.sheet_name);
        return name ? `Imported ${name}` : 'Worksheet imported';
    }
    if (event.event_type.startsWith('knowledge.'))
        return 'Updating knowledge…';
    if (event.event_type.startsWith('excel.'))
        return 'Processing workbook…';
    if (event.event_type.startsWith('datasource.'))
        return 'Processing data source…';
    if (event.event_type.startsWith('job.'))
        return 'Updating job…';
    if (event.event_type.startsWith('model.request.'))
        return 'Analyzing…';
    if (event.event_type.startsWith('tool.'))
        return 'Running analysis tool…';
    if (event.event_type.startsWith('sql.'))
        return 'Executing SQL…';
    if (event.event_type.startsWith('agent.'))
        return 'Running analysis…';
    if (event.event_type.startsWith('dashboard.'))
        return 'Refreshing dashboard…';
    return null;
}
