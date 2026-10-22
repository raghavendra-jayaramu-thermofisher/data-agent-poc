export const queryKeys = {
    auth: { me: ['auth', 'me'] as const },
    organizations: {
        list: ['organizations', 'list'] as const,
        current: (id: string | null) => ['organizations', 'current', id] as const,
    },
    conversations: {
        all: (orgId: string | null) => ['conversations', orgId] as const,
        lists: (orgId: string | null) => ['conversations', orgId, 'list'] as const,
        list: (orgId: string | null, search = '') => ['conversations', orgId, 'list', search] as const,
        detail: (orgId: string | null, id: string) => ['conversations', orgId, 'detail', id] as const,
        messages: (orgId: string | null, id: string) => ['conversations', orgId, 'messages', id] as const,
    },
    jobs: {
        all: (orgId: string | null) => ['jobs', orgId] as const,
        list: (orgId: string | null, status?: string) => ['jobs', orgId, 'list', status ?? 'all'] as const,
        detail: (orgId: string | null, id: string) => ['jobs', orgId, 'detail', id] as const,
        execution: (orgId: string | null, id: string) => ['jobs', orgId, 'execution', id] as const,
        tableRows: (orgId: string | null, artifactId: string, query: object) => ['jobs', orgId, 'table-rows', artifactId, query] as const,
    },
    dataSources: {
        all: (orgId: string | null) => ['data-sources', orgId] as const,
        list: (orgId: string | null) => ['data-sources', orgId, 'list'] as const,
        detail: (orgId: string | null, id: string) => ['data-sources', orgId, 'detail', id] as const,
        schema: (orgId: string | null, id: string) => ['data-sources', orgId, 'schema', id] as const,
        tables: (orgId: string | null, id: string, search: string) => ['data-sources', orgId, id, 'tables', search] as const,
    },
    models: {
        all: (orgId: string | null) => ['models', orgId] as const,
        connections: (orgId: string | null) => ['models', orgId, 'connections'] as const,
        connection: (orgId: string | null, id: string) => ['models', orgId, 'connection', id] as const,
        profiles: (orgId: string | null) => ['models', orgId, 'profiles'] as const,
        profile: (orgId: string | null, id: string) => ['models', orgId, 'profile', id] as const,
        defaultProfile: (orgId: string | null) => ['models', orgId, 'profiles', 'default'] as const,
    },
    dashboards: {
        all: (orgId: string | null) => ['dashboards', orgId] as const,
        list: (orgId: string | null) => ['dashboards', orgId, 'list'] as const,
        detail: (orgId: string | null, id: string) => ['dashboards', orgId, 'detail', id] as const,
    },
    settings: {
        audit: (orgId: string | null) => ['settings', orgId, 'audit'] as const,
        operations: (orgId: string | null) => ['settings', orgId, 'operations'] as const,
    },
    instructions: {
        all: (orgId: string | null) => ['instructions', orgId] as const,
        list: (orgId: string | null) => ['instructions', orgId, 'list'] as const,
        detail: (orgId: string | null, id: string) => ['instructions', orgId, 'detail', id] as const,
    },
    knowledge: {
        all: (orgId: string | null) => ['knowledge', orgId] as const,
        status: (orgId: string | null, dataSourceId: string) => ['knowledge', orgId, dataSourceId, 'status'] as const,
        index: (orgId: string | null, dataSourceId: string) => ['knowledge', orgId, dataSourceId, 'index'] as const,
        documents: (orgId: string | null, dataSourceId: string, search = '') => ['knowledge', orgId, dataSourceId, 'documents', search] as const,
        document: (orgId: string | null, dataSourceId: string, documentId: string) => ['knowledge', orgId, dataSourceId, 'document', documentId] as const,
        annotations: (orgId: string | null, dataSourceId: string) => ['knowledge', orgId, dataSourceId, 'annotations'] as const,
        versions: (orgId: string | null, dataSourceId: string) => ['knowledge', orgId, dataSourceId, 'versions'] as const,
    },
};
