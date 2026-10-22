import { expect, test } from '@playwright/test';

const tokens = { access_token: 'e2e-access', refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 900 };
const user = { id: 'u1', email: 'owner@example.com', display_name: 'Owner', is_active: true, email_verified_at: null, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };
const org = { id: 'org-1', name: 'Acme Analytics', role: 'owner', created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };
const source = { id: 'ds1', organization_id: 'org-1', name: 'Production PostgreSQL', kind: 'postgres', display_type: 'postgres', status: 'active', config: {}, created_by: 'u1', last_tested_at: null, last_error_code: null, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z', active_file: null };
const conversation = { id: 'c1', organization_id: 'org-1', title: 'Why did revenue fall?', created_by: 'u1', model_profile_id: null, data_source_ids: ['ds1'], created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };

function job(status: 'running' | 'succeeded') {
  return { id: 'j-chat', organization_id: 'org-1', job_type: 'chat_query', status, requested_by: 'u1', conversation_id: 'c1', input: {}, result: status === 'succeeded' ? {} : null, attempt_count: 1, max_attempts: 3, cancel_requested_at: null, error_code: null, error_message: null, created_at: '2026-08-24T12:00:01Z', started_at: '2026-08-24T12:00:02Z', finished_at: status === 'succeeded' ? '2026-08-24T12:00:06Z' : null };
}

test('Task 3 durable analysis survives navigation/reload and reconciles the final answer', async ({ page }) => {
  let jobStatus: 'running' | 'succeeded' = 'running';
  let finalAnswer = false;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(({ auth }) => {
    sessionStorage.setItem('db-assistant.auth.v1', JSON.stringify(auth));
    localStorage.setItem('db-assistant.preferences.v1', JSON.stringify({ lastAskDataSourceIds: ['ds1'] }));
  }, { auth: tokens });

  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: user }));
  await page.route('**/api/v1/organizations', (route) => route.fulfill({ json: [org] }));
  await page.route('**/api/v1/data-sources', (route) => route.fulfill({ json: [source] }));
  await page.route('**/api/v1/models/profiles', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/conversations', async (route) => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 201, json: conversation });
    return route.fulfill({ json: { items: [conversation], next_cursor: null, has_more: false } });
  });
  await page.route('**/api/v1/conversations/c1', (route) => route.fulfill({ json: conversation }));
  await page.route('**/api/v1/conversations/c1/messages**', async (route) => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 202, json: { message_id: 'm1', job_id: 'j-chat' } });
    const messages = finalAnswer ? [
      { id: 'm1', conversation_id: 'c1', role: 'user', content: 'Why did revenue fall?', job_id: 'j-chat', metadata: {}, created_at: '2026-08-24T12:00:01Z' },
      { id: 'm2', conversation_id: 'c1', role: 'assistant', content: '**Revenue declined 8%**, led by enterprise churn.', job_id: 'j-chat', metadata: {}, created_at: '2026-08-24T12:00:06Z' },
    ] : [];
    return route.fulfill({ json: { items: messages, next_cursor: null, has_more: false } });
  });
  await page.route('**/api/v1/jobs**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/events')) return route.abort();
    if (url.pathname.endsWith('/execution')) return route.fulfill({ json: { tools: [], sql: [], models: [], artifacts: [] } });
    if (url.pathname === '/api/v1/jobs/j-chat') return route.fulfill({ json: job(jobStatus) });
    const status = url.searchParams.get('status');
    if (status === 'queued') return route.fulfill({ json: [] });
    if (status === 'running') return route.fulfill({ json: jobStatus === 'running' ? [job('running')] : [] });
    return route.fulfill({ json: [job(jobStatus)] });
  });

  await page.goto('/ask');
  await expect(page.getByText('1/10 selected')).toBeVisible();
  await page.getByRole('textbox', { name: 'Question' }).fill('Why did revenue fall?');
  await page.getByRole('button', { name: 'Ask' }).click();

  await expect(page).toHaveURL(/\/conversations\/c1$/);
  await expect(page.getByText('Why did revenue fall?')).toBeVisible();
  await expect(page.getByRole('button', { name: /Jobs \(1\)/ })).toBeVisible();

  await page.getByRole('link', { name: 'Data Sources' }).click();
  await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Jobs \(1\)/ })).toBeVisible();

  await page.goto('/conversations/c1');
  await page.reload();
  await expect(page.getByRole('button', { name: /Jobs \(1\)/ })).toBeVisible();

  jobStatus = 'succeeded';
  finalAnswer = true;
  await page.reload();
  await expect(page.getByText('Revenue declined 8%')).toBeVisible();
  await expect(page.getByText('led by enterprise churn.')).toBeVisible();
});
