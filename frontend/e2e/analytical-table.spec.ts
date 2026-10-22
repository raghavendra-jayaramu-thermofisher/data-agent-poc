import { expect, test } from '@playwright/test';
import { checkArtifactHeader } from './helpers/artifact-header';

for (const { width, touch } of [
  { width: 1440, touch: false },
  { width: 390, touch: false },
  { width: 390, touch: true },
]) {
  test.describe(`${width}px ${touch ? 'touch' : 'mouse and keyboard'}`, () => {
    test.use({ hasTouch: touch, isMobile: touch });
    test(`result table stays compact and readable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 960 });
      const timestamp = '2026-10-17T00:00:00Z';
      const title = 'Weekly shipment snapshots';
      const artifactId = '33333333-3333-4333-8333-333333333333';
      const columns = [
        'group',
        'detailed_status',
        'reference',
        ...Array.from({ length: 13 }, (_, i) => `week_${i + 1}`),
      ];
      const rows = Array.from({ length: 24 }, (_, i) => [
        i % 2 ? 'Awaiting shipment' : 'Stock available',
        i % 2 ? 'Partially allocated stock' : 'Ready for dispatch',
        i === 0 ? '000123' : i === 1 ? '9007199254740993.12' : `REF-${i}`,
        ...Array.from({ length: 13 }, (_, week) => 1442405 + i * 100 + week),
      ]);
      const conversation = {
        id: 'c1',
        organization_id: 'org1',
        created_by: 'u1',
        title,
        model_profile_id: null,
        data_source_ids: [],
        table_scope: [],
        created_at: timestamp,
        updated_at: timestamp,
      };
      const messages = [
        {
          id: 'm1',
          conversation_id: 'c1',
          role: 'assistant',
          content: `[[artifact:${artifactId}]]`,
          job_id: 'j1',
          metadata: {},
          created_at: timestamp,
        },
      ];
      const artifact = {
        id: artifactId,
        job_id: 'j1',
        kind: 'table',
        name: title,
        source_sql_execution_id: null,
        created_at: timestamp,
        payload: {
          schema_version: 1,
          columns,
          rows,
          row_count: rows.length,
          truncated: false,
          display: 'expanded',
        },
      };
      await page.addInitScript(() => {
        sessionStorage.setItem(
          'db-assistant.auth.v1',
          JSON.stringify({
            access_token: 'mock',
            refresh_token: 'mock',
            token_type: 'bearer',
            expires_in: 900,
          }),
        );
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (text: string) => {
              (window as unknown as { tableClipboard: string }).tableClipboard = text;
            },
          },
        });
      });
      let exported: { rows: unknown[][] } | undefined;
      await page.route('**/api/v1/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        let json: unknown = [];
        if (path.endsWith('/auth/me'))
          json = {
            id: 'u1',
            email: 'tester@example.com',
            display_name: 'Tester',
            is_active: true,
            created_at: timestamp,
            updated_at: timestamp,
          };
        else if (path.endsWith('/organizations'))
          json = [
            {
              id: 'org1',
              name: 'Test workspace',
              role: 'owner',
              created_at: timestamp,
              updated_at: timestamp,
            },
          ];
        else if (path.endsWith('/conversations/c1/messages')) json = { items: messages, next_cursor: null, has_more: false };
        else if (path.endsWith('/conversations/c1')) json = conversation;
        else if (path.endsWith('/conversations')) json = { items: [conversation], next_cursor: null, has_more: false };
        else if (path.endsWith('/execution'))
          json = { tools: [], models: [], sql: [], artifacts: [artifact] };
        else if (path.endsWith('/exports/excel')) {
          exported = route.request().postDataJSON();
          return route.fulfill({
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            body: 'mock workbook',
          });
        }
        await route.fulfill({ json });
      });
      await page.goto('/conversations/c1');
      const artifactView = page.locator('.table-artifact');
      const table = artifactView.getByRole('table', { name: title });
      await expect(table).toBeVisible();
      await checkArtifactHeader(artifactView, 'table');
      await expect(page.locator('body')).toHaveCSS('font-family', /IBM Plex Sans/);
      await expect(page.locator('.topbar')).toHaveCount(0);
      await expect(page.locator('.app-shell')).toHaveCSS('background-image', /gradient/);
      await expect(page.locator('.main-content')).toHaveCSS('font-family', /IBM Plex Sans/);
      await expect(page.getByRole('textbox', { name: 'Ask a follow-up' })).toHaveCSS(
        'font-family',
        /IBM Plex Sans/,
      );
      const secondary = artifactView.locator('.artifact-secondary-actions');
      if (touch) {
        await expect(secondary).toBeHidden();
        const more = artifactView.getByRole('button', { name: 'Table actions' });
        await expect(more).toHaveCSS('height', '44px');
      } else {
        await page.mouse.move(0, 0);
        await expect(secondary).toHaveCSS('opacity', '0');
        await artifactView.getByRole('button', { name: 'Copy table', exact: true }).focus();
        await expect(secondary).toHaveCSS('opacity', '1');
        await page.keyboard.press('Tab');
        await expect(artifactView.getByRole('button', { name: 'Export to Excel' })).toBeFocused();
      }
      await expect(artifactView.getByRole('button', { name: 'Table information' })).toHaveCount(0);
      await artifactView.getByRole('button', { name: 'Table actions' }).click();
      await page.getByRole('menuitem', { name: 'Table information' }).click();
      const info = page.getByRole('dialog', { name: title + ' information' });
      await expect(info.getByText('24', { exact: true })).toBeVisible();
      await info.screenshot({ path: test.info().outputPath(`table-information-${width}.png`) });
      await page.keyboard.press('Escape');
      async function action(name: string) {
        if (touch) {
          await artifactView.getByRole('button', { name: 'Table actions' }).click();
          await page.getByRole('menuitem', { name, exact: true }).click();
        } else {
          await artifactView.hover();
          await artifactView.getByRole('button', { name, exact: true }).click();
        }
      }
      const firstRow = table.locator('tbody tr').first();
      const text = firstRow.locator('td').first();
      const number = firstRow.locator('td').nth(3);
      await expect(text).toHaveCSS('font-size', '12px');
      await expect(text).toHaveCSS('font-family', /IBM Plex Sans/);
      await expect(number).toHaveCSS(
        'font-family',
        await text.evaluate((cell) => getComputedStyle(cell).fontFamily),
      );
      await expect(number).toHaveCSS('text-align', 'right');
      await expect(number).toHaveText('1,442,405');
      await expect(firstRow.locator('td').nth(2)).toHaveText('000123');
      await expect(table.locator('tbody tr').nth(1).locator('td').nth(2)).toHaveText(
        '9007199254740993.12',
      );
      expect((await firstRow.boundingBox())!.height).toBe(32);
      expect(
        (await table.getByText('Partially allocated stock').first().boundingBox())!.height,
      ).toBeLessThanOrEqual(20);
      const scroll = artifactView.locator('.analytical-table-scroll');
      await scroll.evaluate((element) => {
        element.scrollTop = 200;
        element.scrollLeft = 200;
      });
      const headerBounds = (await table.getByRole('columnheader').first().boundingBox())!;
      expect(headerBounds.y).toBeCloseTo((await scroll.boundingBox())!.y, 0);
      await scroll.evaluate((element) => {
        element.scrollTop = 0;
        element.scrollLeft = 0;
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await artifactView.screenshot({ path: test.info().outputPath(`table-${width}.png`) });
      await page.screenshot({ path: test.info().outputPath(`workspace-${width}.png`) });
      await action('Copy table');
      expect(
        await page.evaluate(() => (window as unknown as { tableClipboard: string }).tableClipboard),
      ).toContain('000123');
      const download = page.waitForEvent('download');
      await action('Export to Excel');
      await download;
      expect(exported?.rows).toEqual(rows);
      await action('Expand table to full screen');
      const dialog = page.getByRole('dialog', { name: title });
      const expanded = dialog.getByRole('table');
      await expect(dialog).toBeVisible();
      await expect
        .poll(async () => Object.values((await dialog.boundingBox())!).map(Math.round))
        .toEqual([0, 0, width, 960]);
      await expect(expanded.locator('td').first()).toHaveCSS('font-size', '12px');
      await expect(expanded.locator('td').nth(3)).toHaveCSS('text-align', 'right');
      await expanded.getByRole('button', { name: 'Group', exact: true }).click();
      await expect(
        expanded.getByRole('columnheader', { name: 'Group', exact: true }),
      ).toHaveAttribute('aria-sort', 'ascending');
      await dialog.getByPlaceholder('Search across all columns…').fill('Ready for dispatch');
      await expect(expanded.locator('tbody tr')).toHaveCount(12);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(
        artifactView.getByRole('button', {
          name: touch ? 'Table actions' : 'Expand table to full screen',
        }),
      ).toBeFocused();
      await expect(table.locator('tbody tr')).toHaveCount(12);
      await expect(table.getByRole('columnheader', { name: 'Group', exact: true })).toHaveAttribute(
        'aria-sort',
        'ascending',
      );
      await artifactView.getByRole('button', { name: 'Hide table' }).click();
      await expect(table).toHaveCount(0);
      await artifactView.getByRole('button', { name: 'View table' }).click();
      await expect(table.locator('tbody tr')).toHaveCount(12);
    });
  });
}
