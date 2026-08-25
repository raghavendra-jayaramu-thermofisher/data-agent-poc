import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/server';
import { getExecutionTrace } from './execution-api';

describe('execution trace API', () => {
  it('loads the persisted generic tools/sql/models/artifacts contract', async () => {
    server.use(http.get('http://localhost:8000/api/v1/jobs/j1/execution', ({ request }) => {
      expect(request.headers.get('Accept')).toBe('application/json');
      return HttpResponse.json({ tools: [], sql: [], models: [], artifacts: [{ id: 'a1', job_id: 'j1', kind: 'text', name: 'Answer', source_sql_execution_id: null, payload: { schema_version: 1, markdown: 'ok' }, created_at: '2026-08-24T12:00:00Z' }] });
    }));
    expect((await getExecutionTrace('j1')).artifacts).toHaveLength(1);
  });
});
