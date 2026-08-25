import { expect, test } from '@playwright/test';

const tokens = { access_token: 'e2e-access', refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 900 };
const user = { id: 'u1', email: 'owner@example.com', display_name: 'Owner', is_active: true, email_verified_at: null, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };
const org = { id: 'org-1', name: 'Acme Analytics', role: 'owner', created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };
const source = { id: 'ds1', organization_id: 'org-1', name: 'Production PostgreSQL', kind: 'postgres', display_type: 'postgres', status: 'active', config: {}, created_by: 'u1', last_tested_at: null, last_error_code: null, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z', active_file: null };
const conversation = { id: 'c1', organization_id: 'org-1', title: 'Monthly revenue', created_by: 'u1', model_profile_id: null, data_source_ids: ['ds1'], created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };
const messages = [
  { id: 'm1', conversation_id: 'c1', role: 'user', content: 'Show monthly revenue.', job_id: 'j1', metadata: {}, created_at: '2026-08-24T12:00:00Z' },
  { id: 'm2', conversation_id: 'c1', role: 'assistant', content: 'Revenue increased.', job_id: 'j1', metadata: {}, created_at: '2026-08-24T12:00:02Z' },
];
const trace = {
  tools: [], models: [],
  sql: [{ id: 's1', tool_execution_id: 't1', data_source_id: 'ds1', sql_text: 'SELECT month, revenue FROM monthly_revenue', status: 'succeeded', row_count: 2, truncated: false, columns: ['month', 'revenue'], result_bytes: 50, duration_ms: 100, error_code: null, error_message: null, started_at: '2026-08-24T12:00:00Z', finished_at: '2026-08-24T12:00:01Z' }],
  artifacts: [
    { id: 'a-table', job_id: 'j1', kind: 'table', name: 'Monthly revenue data', source_sql_execution_id: 's1', payload: { schema_version: 1, data_source_id: 'ds1', columns: ['month', 'revenue'], rows: [['2026-01', 100000], ['2026-02', 125000]], row_count: 2, truncated: false }, created_at: '2026-08-24T12:00:01Z' },
    { id: 'a-chart', job_id: 'j1', kind: 'chart', name: 'Monthly revenue', source_sql_execution_id: 's1', payload: { schema_version: 1, renderer: 'frontend', chart_type: 'line', title: 'Monthly revenue', source_sql_execution_id: 's1', encoding: { x: { field: 'month', label: 'Month' }, series: [{ field: 'revenue', label: 'Revenue' }] }, data: [{ month: '2026-01', revenue: 100000 }, { month: '2026-02', revenue: 125000 }] }, created_at: '2026-08-24T12:00:01Z' },
  ],
};
const dashboard = { id: 'd1', organization_id: 'org-1', title: 'Executive', description: 'Saved analysis', created_by: 'u1', widget_count: 1, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };
function dashboardWidget(refreshed: boolean) {
  return { id: 'w1', dashboard_id: 'd1', data_source_id: 'ds1', title: 'Show monthly revenue.', widget_type: 'line', question: 'Show monthly revenue.', sql_text: 'SELECT month, revenue FROM monthly_revenue', visualization_config: { x_field: 'month', x_label: 'month', series: [{ field: 'revenue', label: 'revenue' }] }, layout_config: { columns: 6, rows: 2 }, created_from_job_id: 'j1', created_from_sql_execution_id: 's1', last_refresh_job_id: refreshed ? 'jr1' : null, last_refreshed_at: refreshed ? '2026-08-24T12:10:00Z' : null, enabled: true, created_at: '2026-08-24T12:00:00Z', updated_at: refreshed ? '2026-08-24T12:10:00Z' : '2026-08-24T12:00:00Z', latest_artifact: { id: refreshed ? 'a-refresh' : 'a-chart', kind: 'chart', name: 'Show monthly revenue.', created_at: refreshed ? '2026-08-24T12:10:00Z' : '2026-08-24T12:00:01Z', payload: { schema_version: 1, renderer: 'frontend', chart_type: 'line', title: 'Show monthly revenue.', source_sql_execution_id: refreshed ? 's-refresh' : 's1', encoding: { x: { field: 'month' }, series: [{ field: 'revenue', label: 'Revenue' }] }, data: [{ month: '2026-01', revenue: 100000 }, { month: '2026-02', revenue: refreshed ? 130000 : 125000 }] } } };
}

test('conversation result → save to dashboard → provenance → background refresh', async ({ page }) => {
  let saved = false;
  let refreshGetCount = 0;
  let refreshCompleted = false;
  await page.addInitScript(({ auth }) => sessionStorage.setItem('db-assistant.auth.v1', JSON.stringify(auth)), { auth: tokens });
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: user }));
  await page.route('**/api/v1/organizations', (route) => route.fulfill({ json: [org] }));
  await page.route('**/api/v1/data-sources', (route) => route.fulfill({ json: [source] }));
  await page.route('**/api/v1/conversations/c1/messages**', (route) => route.fulfill({ json: messages }));
  await page.route('**/api/v1/conversations/c1', (route) => route.fulfill({ json: { ...conversation, messages } }));
  await page.route('**/api/v1/conversations', (route) => route.fulfill({ json: [conversation] }));
  await page.route('**/api/v1/jobs/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/jobs/j1/execution') return route.fulfill({ json: trace });
    if (url.pathname === '/api/v1/jobs/jr1/events') {
      refreshCompleted = true;
      const event = { sequence: 1, event_type: 'job.completed', level: 'info', payload: {}, created_at: '2026-08-24T12:10:00Z' };
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: `id: 1\nevent: job.completed\ndata: ${JSON.stringify(event)}\n\n` });
    }
    if (url.pathname === '/api/v1/jobs/jr1') {
      refreshGetCount += 1;
      const complete = refreshGetCount > 1 || refreshCompleted;
      return route.fulfill({ json: { id: 'jr1', organization_id: 'org-1', job_type: 'dashboard_refresh', status: complete ? 'succeeded' : 'running', requested_by: 'u1', conversation_id: null, input: { widget_id: 'w1' }, result: complete ? { widget_id: 'w1' } : null, attempt_count: 1, max_attempts: 3, cancel_requested_at: null, error_code: null, error_message: null, created_at: '2026-08-24T12:09:59Z', started_at: '2026-08-24T12:10:00Z', finished_at: complete ? '2026-08-24T12:10:01Z' : null } });
    }
    return route.fulfill({ json: [] });
  });
  await page.route('**/api/v1/jobs?**', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/dashboards', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [dashboard] });
    return route.continue();
  });
  await page.route('**/api/v1/dashboards/d1/widgets', async (route) => {
    const body = await route.request().postDataJSON();
    expect(body.source_job_id).toBe('j1');
    expect(body.source_sql_execution_id).toBe('s1');
    expect(body.widget_type).toBe('line');
    saved = true;
    return route.fulfill({ status: 201, json: dashboardWidget(false) });
  });
  await page.route('**/api/v1/dashboards/d1', (route) => route.fulfill({ json: { ...dashboard, widgets: saved ? [dashboardWidget(refreshCompleted)] : [] } }));
  await page.route('**/api/v1/dashboards/widgets/w1/refresh', (route) => route.fulfill({ status: 202, json: { job_id: 'jr1' } }));

  await page.goto('/conversations/c1');
  await page.getByRole('button', { name: 'Save to dashboard' }).first().click();
  await expect(page.getByRole('heading', { name: 'Save analysis to dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Save widget' }).click();
  await expect(page).toHaveURL(/\/dashboards\/d1$/);
  await expect(page.getByRole('heading', { name: 'Show monthly revenue.' })).toBeVisible();
  await page.getByText('View source').click();
  await expect(page.getByText('SELECT month, revenue FROM monthly_revenue')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View job' })).toHaveAttribute('href', '/jobs/j1');

  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByText(/previous successful data remains visible/i)).toBeVisible();
  await expect.poll(() => refreshCompleted).toBe(true);
  await expect(page.getByText(/last refreshed/i)).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.dashboard-grid')).toHaveCSS('grid-template-columns', /\d+px/);
});
