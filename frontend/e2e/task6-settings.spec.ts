import { expect, test } from '@playwright/test';

const tokens = { access_token: 'e2e-access', refresh_token: 'e2e-refresh', token_type: 'bearer', expires_in: 900 };
const user = { id: 'u1', email: 'owner@example.com', display_name: 'Owner', is_active: true, email_verified_at: null, created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };
const org = { id: 'org-1', name: 'Acme Analytics', slug: 'acme-analytics', created_by: 'u1', role: 'owner', created_at: '2026-08-24T12:00:00Z', updated_at: '2026-08-24T12:00:00Z' };

test('admin settings render audit/operations with sensitive metadata redacted', async ({ page }) => {
  await page.addInitScript(({ auth }) => sessionStorage.setItem('db-assistant.auth.v1', JSON.stringify(auth)), { auth: tokens });
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ json: user }));
  await page.route('**/api/v1/organizations', (route) => route.fulfill({ json: [org] }));
  await page.route('**/api/v1/jobs?**', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/audit?**', (route) => route.fulfill({ json: [{ id: 1, organization_id: 'org-1', user_id: 'u1', action: 'model.connection.updated', resource_type: 'model_connection', resource_id: 'c1', metadata: { status: 'active', nested: { api_key: 'SHOULD_NOT_RENDER', provider: 'compatible' } }, created_at: '2026-08-24T12:00:00Z' }] }));
  await page.route('**/api/v1/ops/status', (route) => route.fulfill({ json: { api: 'ok', workers: { active: 1, access_token: 'SHOULD_NOT_RENDER' } } }));

  await page.goto('/settings/audit');
  await expect(page.getByRole('heading', { name: 'Audit' })).toBeVisible();
  await page.getByText('View').click();
  await expect(page.getByText('compatible')).toBeVisible();
  await expect(page.getByText('SHOULD_NOT_RENDER')).toHaveCount(0);

  await page.getByRole('link', { name: 'Operations' }).click();
  await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
  await expect(page.getByText('SHOULD_NOT_RENDER')).toHaveCount(0);
});
