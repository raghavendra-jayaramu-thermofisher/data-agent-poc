import { expect, test } from '@playwright/test';

const timestamp = '2026-10-08T00:00:00Z';
const source = {
  id: 'source-1',
  organization_id: 'org-1',
  name: 'Warehouse',
  kind: 'postgres',
  display_type: 'postgres',
  status: 'active',
  config: {},
  created_by: 'user-1',
  last_tested_at: null,
  last_error_code: null,
  created_at: timestamp,
  updated_at: timestamp,
  active_file: null,
};

for (const width of [1280, 390]) {
  test(`table selection supports keyboard navigation and fits a ${width}px screen`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() =>
      sessionStorage.setItem(
        'db-assistant.auth.v1',
        JSON.stringify({
          access_token: 'mock-access',
          refresh_token: 'mock-refresh',
          token_type: 'bearer',
          expires_in: 900,
        }),
      ),
    );
    // Every API request is mocked: no real credentials, user records, or analytical jobs.
    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      if (path.endsWith('/auth/me'))
        return route.fulfill({
          json: {
            id: 'user-1',
            email: 'tester@example.com',
            display_name: 'Tester',
            is_active: true,
            created_at: timestamp,
            updated_at: timestamp,
          },
        });
      if (path.endsWith('/organizations'))
        return route.fulfill({
          json: [
            {
              id: 'org-1',
              name: 'Test workspace',
              role: 'owner',
              created_at: timestamp,
              updated_at: timestamp,
            },
          ],
        });
      if (path.endsWith('/data-sources')) return route.fulfill({ json: [source] });
      if (path.endsWith('/tables'))
        return route.fulfill({
          json: {
            knowledge_version_id: 'version-1',
            next_cursor: null,
            items: [
              { schema: 'public', name: 'orders', object_type: 'table', column_count: 12 },
              {
                schema: 'reporting',
                name: 'RegionalPerformanceSummaryWithAnExtendedName',
                object_type: 'view',
                column_count: 4,
              },
              ...Array.from({ length: 24 }, (_, index) => ({
                schema: 'public',
                name: `APJ_Backlog_Analysis_${String(index + 1).padStart(2, '0')}`,
                object_type: index % 3 === 0 ? 'view' : 'table',
                column_count: 10 + index * 3,
              })),
            ],
          },
        });
      return route.fulfill({ json: [] });
    });
    await page.goto('/ask');
    await page.getByRole('button', { name: 'Tables: All tables' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const orders = dialog.getByRole('checkbox', { name: /orders/ });
    await orders.focus();
    await page.keyboard.press('Space');
    await expect(orders).toBeChecked();
    await expect(dialog.getByRole('radio', { name: 'Choose tables' })).toBeChecked();
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const footer = dialog.locator('.table-scope-footer');
    const footerBefore = await footer.boundingBox();
    const catalog = dialog.locator('.table-scope-catalog');
    await catalog.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    // Ignore subpixel motion during the modal's opening animation.
    expect(Math.abs((await footer.boundingBox())!.y - footerBefore!.y)).toBeLessThan(3);
    await expect(dialog.getByRole('button', { name: 'Apply' })).toBeInViewport();
    await catalog.evaluate((node) => {
      node.scrollTop = 0;
    });
    await page.screenshot({
      path: test.info().outputPath(`table-picker-${width}.png`),
      animations: 'disabled',
    });
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByRole('button', { name: 'Tables: orders' })).toBeVisible();

    await page.getByRole('button', { name: 'Tables: orders' }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Tables: orders' })).toBeFocused();
    await page.getByRole('button', { name: 'Tables: orders' }).click();
    await dialog.getByRole('checkbox', { name: /orders/ }).uncheck();
    await dialog
      .getByRole('checkbox', { name: /RegionalPerformanceSummaryWithAnExtendedName/ })
      .check();
    await dialog.getByRole('button', { name: 'Apply' }).click();
    const longNameTrigger = page.getByRole('button', {
      name: 'Tables: RegionalPerformanceSummaryWithAnExtendedName',
    });
    await expect(longNameTrigger).toBeVisible();
    const chipBounds = await longNameTrigger.boundingBox();
    expect(chipBounds!.x + chipBounds!.width).toBeLessThanOrEqual(width);
  });
}
