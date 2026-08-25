import { expect, test } from '@playwright/test';
const tokens = { access_token: 'e2e-access', refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 900 };
const user = { id: 'u1', email: 'owner@example.com', display_name: 'Owner', is_active: true, email_verified_at: null, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };
const org = { id: 'org-1', name: 'Acme Analytics', slug: 'acme', created_by: 'u1', role: 'owner', created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };
const job = { id: 'j1', organization_id: 'org-1', job_type: 'knowledge_generation', status: 'running', requested_by: 'u1', conversation_id: null, input: { data_source_id: 'ds1' }, result: null, attempt_count: 1, max_attempts: 3, cancel_requested_at: null, error_code: null, error_message: null, created_at: '2026-08-24T12:00:00Z', started_at: '2026-08-24T12:00:01Z', finished_at: null };
const source = { id: 'ds1', organization_id: 'org-1', name: 'Production PostgreSQL', kind: 'postgres', display_type: 'postgres', status: 'active', config: { host: 'db.internal', port: 5432, database: 'app', schema_name: 'public', ssl_mode: 'require' }, created_by: 'u1', last_tested_at: null, last_error_code: null, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z', active_file: null };
test('Task 2 global job center persists while navigating management screens', async ({ page }) => { await page.setViewportSize({ width: 1280, height: 800 }); await page.addInitScript(t => sessionStorage.setItem('db-assistant.auth.v1', JSON.stringify(t)), tokens); await page.route('**/api/v1/auth/me', r => r.fulfill({ json: user })); await page.route('**/api/v1/organizations', r => r.fulfill({ json: [org] })); await page.route('**/api/v1/jobs**', r => { const url = new URL(r.request().url()); if (url.pathname.endsWith('/events'))
    return r.abort(); if (url.pathname === '/api/v1/jobs/j1')
    return r.fulfill({ json: job }); const status = url.searchParams.get('status'); return r.fulfill({ json: status === 'queued' ? [] : [job] }); }); await page.route('**/api/v1/data-sources', r => r.fulfill({ json: [source] })); await page.route('**/api/v1/models/connections', r => r.fulfill({ json: [] })); await page.route('**/api/v1/models/profiles', r => r.fulfill({ json: [] })); await page.goto('/data-sources'); await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible(); await expect(page.getByRole('button', { name: /Jobs \(1\)/ })).toBeVisible(); await page.getByRole('link', { name: 'Models' }).click(); await expect(page.getByRole('heading', { name: 'Models' })).toBeVisible(); await expect(page.getByRole('button', { name: /Jobs \(1\)/ })).toBeVisible(); await page.getByRole('button', { name: /Jobs \(1\)/ }).click(); await expect(page.getByRole('heading', { name: 'Job Center' })).toBeVisible(); await expect(page.getByText('knowledge generation')).toBeVisible(); });

test('Excel upload registers a durable job before navigating to its data source', async ({ page }) => {
  const excelSource = {
    ...source,
    id: 'ds-excel',
    name: 'Orders Workbook',
    kind: 'duckdb',
    display_type: 'excel',
    status: 'preparing',
    config: {},
  };
  const excelJob = {
    ...job,
    id: 'excel-job',
    job_type: 'excel_materialization',
    input: { data_source_id: 'ds-excel' },
  };

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript((storedTokens) => {
    sessionStorage.setItem('db-assistant.auth.v1', JSON.stringify(storedTokens));
  }, tokens);
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: user }));
  await page.route('**/api/v1/organizations', (route) => route.fulfill({ json: [org] }));
  await page.route('**/api/v1/jobs**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/events')) return route.abort();
    if (url.pathname === '/api/v1/jobs/excel-job') return route.fulfill({ json: excelJob });
    return route.fulfill({ json: [] });
  });
  await page.route('**/api/v1/data-sources/excel', async (route) => {
    expect(route.request().method()).toBe('POST');
    return route.fulfill({ status: 202, json: { data_source: excelSource, job_id: 'excel-job' } });
  });
  await page.route('**/api/v1/data-sources/ds-excel', (route) => route.fulfill({ json: excelSource }));

  await page.goto('/data-sources/new');
  await page.getByRole('button', { name: 'Excel' }).click();
  await page.getByLabel('Name').fill('Orders Workbook');
  await page.getByLabel('Workbook').setInputFiles({
    name: 'orders.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('fixture-workbook'),
  });
  await page.getByRole('button', { name: 'Upload workbook' }).click();

  await expect(page).toHaveURL(/\/data-sources\/ds-excel$/);
  await expect(page.getByRole('button', { name: /Jobs \(1\)/ })).toBeVisible();
  await page.getByRole('button', { name: /Jobs \(1\)/ }).click();
  await expect(page.getByText('Excel materialization')).toBeVisible();
});
