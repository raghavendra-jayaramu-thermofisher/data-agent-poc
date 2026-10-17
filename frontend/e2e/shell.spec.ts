import { expect, test } from '@playwright/test';
const tokenPair = {
    access_token: 'e2e-access',
    refresh_token: 'e2e-refresh',
    token_type: 'bearer',
    expires_in: 900,
};
test.describe('Task 1 shell', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript((tokens) => {
            window.sessionStorage.setItem('db-assistant.auth.v1', JSON.stringify(tokens));
        }, tokenPair);
        await page.route('**/api/v1/auth/me', (route) => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: 'user-1',
                email: 'analyst@example.com',
                display_name: 'Analyst',
                is_active: true,
                email_verified_at: null,
                created_at: '2026-08-24T12:00:00Z',
                updated_at: '2026-08-24T12:00:00Z',
            }),
        }));
        await page.route('**/api/v1/organizations', (route) => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                {
                    id: 'org-1',
                    name: 'Acme Analytics',
                    role: 'owner',
                    created_at: '2026-08-24T12:00:00Z',
                    updated_at: '2026-08-24T12:00:00Z',
                },
            ]),
        }));
    });
    test('mobile navigation opens as an accessible drawer', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/ask');
        const openNavigation = page.getByRole('button', { name: 'Open navigation' });
        await expect(openNavigation).toBeVisible();
        await openNavigation.click();
        await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Dashboards' })).toBeVisible();
    });
});
