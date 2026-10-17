import { expect, test } from '@playwright/test';
import baseFixture from '../../test-fixtures/matrix.json' with { type: 'json' };

for (const { width, large } of [
  { width: 1280, large: false },
  { width: 390, large: false },
  { width: 1280, large: true },
]) {
  test(`matrix renders, scrolls, expands, reloads and exports at ${width}px${large ? ' with 500 rows' : ''}`, async ({
    page,
  }) => {
    const fixture = structuredClone(baseFixture);
    if (large) {
      fixture.spec.rows = [fixture.spec.rows[0]!];
      fixture.spec.show_row_subtotals = false;
      fixture.spec.show_row_grand_total = false;
      fixture.row_nodes = Array.from({ length: 500 }, (_, index) => ({
        id: `r${index.toString(16).padStart(24, '0')}`,
        parent_id: null,
        depth: 1,
        path: [`Record ${index}`],
        label: `Record ${index}`,
      }));
      fixture.cells = fixture.row_nodes.flatMap((row, index) =>
        fixture.column_nodes.map((column) => ({
          row_id: row.id,
          column_id: column.id,
          values: [String(index), String(index)],
        })),
      );
      fixture.source_row_count = fixture.cells.length;
    }
    await page.setViewportSize({ width, height: 844 });
    const timestamp = '2026-10-17T00:00:00Z';
    const matrixId = '22222222-2222-4222-8222-222222222222';
    const source = {
      id: 'ds1',
      organization_id: 'org1',
      name: 'Warehouse',
      kind: 'postgres',
      display_type: 'postgres',
      status: 'active',
      config: {},
      created_by: 'u1',
      last_tested_at: null,
      last_error_code: null,
      created_at: timestamp,
      updated_at: timestamp,
      active_file: null,
    };
    const conversation = {
      id: 'c1',
      organization_id: 'org1',
      created_by: 'u1',
      title: 'Matrix comparison',
      model_profile_id: null,
      data_source_ids: ['ds1'],
      table_scope: [],
      created_at: timestamp,
      updated_at: timestamp,
    };
    const messages = [
      {
        id: 'm1',
        conversation_id: 'c1',
        role: 'assistant',
        content: `## Results\n\n[[artifact:${matrixId}]]`,
        job_id: 'j1',
        metadata: {},
        created_at: timestamp,
      },
    ];
    const artifact = {
      id: matrixId,
      job_id: 'j1',
      kind: 'matrix',
      name: fixture.spec.title,
      source_sql_execution_id: fixture.source_sql_execution_id,
      payload: fixture,
      created_at: timestamp,
    };
    const sql = {
      id: fixture.source_sql_execution_id,
      tool_execution_id: 't1',
      data_source_id: 'ds1',
      sql_text: 'SELECT division, category, period, amount, units FROM analytical_result',
      status: 'succeeded',
      row_count: fixture.source_row_count,
      truncated: false,
      columns: ['division', 'category', 'period', 'amount', 'units'],
      result_bytes: 1000,
      duration_ms: 1,
      error_code: null,
      error_message: null,
      started_at: timestamp,
      finished_at: timestamp,
    };
    let exportState: unknown;
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
            (window as unknown as { matrixClipboard: string }).matrixClipboard = text;
          },
        },
      });
    });
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
            name: 'Matrix workspace',
            role: 'owner',
            created_at: timestamp,
            updated_at: timestamp,
          },
        ];
      else if (path.endsWith('/conversations/c1/messages')) json = messages;
      else if (path.endsWith('/conversations/c1')) json = { ...conversation, messages };
      else if (path.endsWith('/conversations')) json = [conversation];
      else if (path.endsWith('/data-sources')) json = [source];
      else if (path.endsWith('/execution'))
        json = { tools: [], models: [], sql: [sql], artifacts: [artifact] };
      else if (path.endsWith('/matrix/excel')) {
        exportState = route.request().postDataJSON();
        return route.fulfill({
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          body: 'mock-download',
        });
      }
      await route.fulfill({ json });
    });
    await page.goto('/conversations/c1');
    const matrix = page.getByRole('region', { name: 'Orders by period', exact: true });
    await expect(matrix).toBeVisible();
    const table = matrix.getByRole('table');
    await expect(matrix).toHaveCSS('border-top-width', '1px');
    if (!large) await expect(matrix.locator('.matrix-subtotal td').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await matrix.hover();
    if (large) {
      expect(await table.locator('tbody tr').count()).toBeLessThan(50);
      await expect(table.getByRole('rowheader', { name: 'Record 499', exact: true })).toHaveCount(
        0,
      );
      await matrix.locator('.matrix-scroll').evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await expect(table.getByRole('rowheader', { name: 'Record 499', exact: true })).toBeVisible();
      await matrix.getByRole('button', { name: 'Copy matrix' }).click();
      const copied = await page.evaluate(
        () => (window as unknown as { matrixClipboard: string }).matrixClipboard,
      );
      expect(copied).toContain('Record 0\t');
      expect(copied).toContain('Record 499\t');
      expect(copied.split('\n')).toHaveLength(502);
      await matrix.getByRole('button', { name: 'Expand matrix to full screen' }).click();
      const dialog = page.getByRole('dialog', { name: 'Orders by period' });
      await expect(
        dialog.getByRole('rowheader', { name: 'Record 499', exact: true }),
      ).toBeVisible();
      expect(await dialog.locator('tbody tr').count()).toBeLessThan(60);
      await dialog.getByRole('button', { name: 'Exit matrix full screen' }).click();
      await expect(
        matrix.getByRole('rowheader', { name: 'Record 499', exact: true }),
      ).toBeVisible();
      await matrix.getByRole('button', { name: 'Hide matrix' }).click();
      await matrix.getByRole('button', { name: 'View matrix' }).click();
      await expect(
        matrix.getByRole('rowheader', { name: 'Record 499', exact: true }),
      ).toBeVisible();
      return;
    }
    await expect(table.getByText('9,007,199,254,740,993.12').first()).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Week 2', exact: true })).toBeVisible();
    await matrix.getByRole('button', { name: 'Expand North', exact: true }).press('Enter');
    await expect(table.getByText('Parts', { exact: true })).toBeVisible();
    const header = matrix.locator(':scope > .artifact-viewer-header');
    await expect(header.getByText('Warehouse')).toHaveCount(0);
    await header.getByRole('button', { name: 'Matrix actions' }).click();
    await page.getByRole('menuitem', { name: 'Matrix information' }).click();
    const information = page.getByRole('dialog', { name: 'Orders by period information' });
    await expect(information.getByText('Warehouse', { exact: true })).toBeVisible();
    await expect(information.getByText('1 ms', { exact: true })).toBeVisible();
    await information.getByText('SQL query', { exact: true }).click();
    await expect(information.getByLabel('SQL query')).toHaveText(sql.sql_text);
    await page.keyboard.press('Escape');
    await expect(header.getByRole('button', { name: 'Matrix actions' })).toBeFocused();
    for (const name of [
      'Export matrix',
      'Copy matrix',
      'Expand matrix to full screen',
      'Hide matrix',
    ]) {
      const button = header.getByRole('button', { name, exact: true });
      await expect(button).toBeVisible();
      const bounds = (await button.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    await header.getByRole('button', { name: 'Hide matrix' }).click();
    await expect(table).toHaveCount(0);
    await expect(header.getByRole('button', { name: 'Copy matrix' })).toBeVisible();
    await header.getByRole('button', { name: 'View matrix' }).click();
    await expect(table.getByText('Parts', { exact: true })).toBeVisible();
    await header.getByRole('button', { name: 'Expand matrix to full screen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Orders by period' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Parts', { exact: true })).toBeVisible();
    const dialogBounds = (await dialog.boundingBox())!;
    expect(dialogBounds.width).toBe(width);
    expect(dialogBounds.height).toBeCloseTo(844, 0);
    await dialog.getByRole('button', { name: 'Collapse North', exact: true }).click();
    await expect(dialog.getByText('Parts', { exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Expand North', exact: true }).click();
    await dialog.getByRole('button', { name: 'Copy matrix' }).click();
    const fullscreenDownload = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export matrix' }).click();
    expect((await fullscreenDownload).suggestedFilename()).toBe('Orders by period.xlsx');
    await expect(dialog.getByRole('button', { name: 'Export matrix' })).not.toHaveAttribute(
      'aria-busy',
      'true',
    );
    await expect(dialog.getByRole('button', { name: 'Export matrix' })).toBeFocused();
    await dialog.screenshot({ path: test.info().outputPath(`matrix-fullscreen-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(
      header.getByRole('button', { name: 'Expand matrix to full screen' }),
    ).toBeFocused();
    await expect(table.getByText('Parts', { exact: true })).toBeVisible();
    await page.reload();
    await matrix.hover();
    await expect(matrix.getByRole('button', { name: 'Collapse North', exact: true })).toBeVisible();
    await matrix.getByRole('button', { name: 'Copy matrix' }).click();
    expect(
      await page.evaluate(() => (window as unknown as { matrixClipboard: string }).matrixClipboard),
    ).toContain('  Parts');
    const download = page.waitForEvent('download');
    await matrix.getByRole('button', { name: 'Export matrix' }).click();
    expect((await download).suggestedFilename()).toBe('Orders by period.xlsx');
    expect(exportState).toEqual({ collapsed_rows: expect.any(Array), collapsed_columns: [] });
    const scroll = matrix.locator('.matrix-scroll');
    await scroll.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const sticky = table.locator('tbody th').first();
    const bounds = await sticky.boundingBox();
    const viewport = await scroll.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(viewport!.x - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await matrix.screenshot({ path: test.info().outputPath(`matrix-${width}.png`) });
  });
}
