import { expect, test } from '@playwright/test';

const tokens = { access_token: 'e2e-access', refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 900 };
const user = { id: 'u1', email: 'owner@example.com', display_name: 'Owner', is_active: true, email_verified_at: null, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };
const org = { id: 'org-1', name: 'Acme Analytics', role: 'owner', created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };
const source = { id: 'ds1', organization_id: 'org-1', name: 'Production PostgreSQL', kind: 'postgres', display_type: 'postgres', status: 'active', config: {}, created_by: 'u1', last_tested_at: null, last_error_code: null, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z', active_file: null };
const conversation = { id: 'c1', organization_id: 'org-1', title: 'Monthly revenue', created_by: 'u1', model_profile_id: null, data_source_ids: ['ds1'], created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };
const messages = [
  { id: 'm1', conversation_id: 'c1', role: 'user', content: 'Show monthly revenue.', job_id: 'j1', metadata: {}, created_at: '2026-08-24T12:00:00Z' },
  { id: 'm2', conversation_id: 'c1', role: 'assistant', content: 'Revenue increased from January to February.', job_id: 'j1', metadata: {}, created_at: '2026-08-24T12:00:02Z' },
];
const succeededJob = { id: 'j1', organization_id: 'org-1', job_type: 'chat_query', status: 'succeeded', requested_by: 'u1', conversation_id: 'c1', input: {}, result: {}, attempt_count: 1, max_attempts: 3, cancel_requested_at: null, error_code: null, error_message: null, created_at: '2026-08-24T12:00:00Z', started_at: '2026-08-24T12:00:00Z', finished_at: '2026-08-24T12:00:02Z' };
const trace = {
  tools: [
    { id: 't1', job_id: 'j1', sequence: 1, tool_name: 'execute_sql', status: 'succeeded', input_summary: { data_source_id: 'ds1' }, output_summary: { row_count: 2 }, error_code: null, error_message: null, started_at: '2026-08-24T12:00:00Z', finished_at: '2026-08-24T12:00:01Z' },
    { id: 't2', job_id: 'j1', sequence: 2, tool_name: 'future_tool_name', status: 'succeeded', input_summary: { hidden_prompt: 'MUST_NOT_RENDER', safe_key: 'safe' }, output_summary: null, error_code: null, error_message: null, started_at: '2026-08-24T12:00:01Z', finished_at: '2026-08-24T12:00:01Z' },
  ],
  sql: [{ id: 's1', tool_execution_id: 't1', data_source_id: 'ds1', sql_text: 'SELECT month, revenue FROM monthly_revenue ORDER BY month', status: 'succeeded', row_count: 2, truncated: true, columns: ['month', 'revenue'], result_bytes: 52, duration_ms: 183, error_code: null, error_message: null, started_at: '2026-08-24T12:00:00Z', finished_at: '2026-08-24T12:00:01Z' }],
  models: [{ id: 'model1', job_id: 'j1', sequence: 1, model_profile_id: 'p1', model_name: 'analyst-model', phase: 'answer', status: 'succeeded', input_tokens: null, output_tokens: null, total_tokens: null, error_code: null, error_message: null, started_at: '2026-08-24T12:00:01Z', finished_at: '2026-08-24T12:00:02Z' }],
  artifacts: [
    { id: 'a-table', job_id: 'j1', kind: 'table', name: 'Monthly revenue data', source_sql_execution_id: 's1', payload: { schema_version: 1, data_source_id: 'ds1', columns: ['month', 'revenue'], rows: [['2026-01', 100000], ['2026-02', 125000]], row_count: 2, truncated: true }, created_at: '2026-08-24T12:00:01Z' },
    { id: 'a-chart', job_id: 'j1', kind: 'chart', name: 'Monthly revenue', source_sql_execution_id: 's1', payload: { schema_version: 1, renderer: 'frontend', chart_type: 'line', title: 'Monthly revenue', source_sql_execution_id: 's1', encoding: { x: { field: 'month', label: 'Month' }, series: [{ field: 'revenue', label: 'Revenue' }] }, data: [{ month: '2026-01', revenue: 100000 }, { month: '2026-02', revenue: 125000 }] }, created_at: '2026-08-24T12:00:01Z' },
  ],
};

test('Task 4 renders chart/table artifacts and an inspectable generic execution trace', async ({ page }) => {
  await page.addInitScript(({ auth }) => sessionStorage.setItem('db-assistant.auth.v1', JSON.stringify(auth)), { auth: tokens });
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: user }));
  await page.route('**/api/v1/organizations', (route) => route.fulfill({ json: [org] }));
  await page.route('**/api/v1/data-sources', (route) => route.fulfill({ json: [source] }));
  await page.route('**/api/v1/conversations/c1/messages**', (route) => route.fulfill({ json: { items: messages, next_cursor: null, has_more: false } }));
  await page.route('**/api/v1/conversations/c1', (route) => route.fulfill({ json: conversation }));
  await page.route('**/api/v1/conversations', (route) => route.fulfill({ json: { items: [conversation], next_cursor: null, has_more: false } }));
  await page.route('**/api/v1/jobs**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/jobs/j1/execution') return route.fulfill({ json: trace });
    if (url.pathname === '/api/v1/jobs/j1') return route.fulfill({ json: succeededJob });
    return route.fulfill({ json: [] });
  });

  await page.goto('/conversations/c1');
  await expect(page.getByText('Revenue increased from January to February.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Monthly revenue' })).toBeVisible();
  await expect(page.locator('.chart-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Data' }).click();
  await expect(page.getByRole('table', { name: 'Monthly revenue data' })).toBeVisible();
  await expect(page.getByText('Production PostgreSQL').first()).toBeVisible();

  await page.getByRole('button', { name: 'View execution' }).click();
  await expect(page.getByText('future_tool_name')).toBeVisible();
  await expect(page.getByText('SELECT month, revenue FROM monthly_revenue ORDER BY month')).toBeVisible();
  await expect(page.getAllByText('Not reported')).toHaveCount(3);
  await expect(page.getByText('MUST_NOT_RENDER')).toHaveCount(0);

  await expect(page.getByRole('heading', { name: 'Monthly revenue data' })).toBeVisible();
  await expect(page.getByText('Truncated result')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save to dashboard' }).first()).toBeVisible();
});
