import { expect, test, type Locator } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const backend = resolve(process.cwd(), '../backend');
const python =
  process.env.EXPORT_TEST_PYTHON ??
  resolve(
    backend,
    existsSync(resolve(backend, '.venv/Scripts/python.exe'))
      ? '.venv/Scripts/python.exe'
      : '.venv/bin/python',
  );
const tableId = '11111111-1111-4111-8111-111111111111';
const chartId = '22222222-2222-4222-8222-222222222222';
const timestamp = '2026-10-10T00:00:00Z';

for (const width of [1280, 390]) {
  test(`Excel exports Markdown, collapsed results, expanded tables and chart data at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60000); // Includes generating and inspecting four real workbooks in Python.
    await page.setViewportSize({ width, height: 844 });
    const conversation = {
      id: 'c1',
      organization_id: 'org1',
      title: 'Excel report',
      created_by: 'u1',
      data_source_ids: ['ds1'],
      model_profile_id: null,
      table_scope: [],
      created_at: timestamp,
      updated_at: timestamp,
    };
    const message = {
      id: 'm1',
      conversation_id: 'c1',
      role: 'assistant',
      job_id: 'j1',
      metadata: {},
      created_at: timestamp,
      content: `## KPI Summary\n\n| KPI | Value |\n| --- | --- |\n| **Backlog** | P$19.51M |\n\n## Customers\n\n[[artifact:${tableId}]]\n\n## Regions\n\n[[artifact:${chartId}]]`,
    };
    const source = {
      id: 'ds1',
      organization_id: 'org1',
      name: 'Warehouse',
      kind: 'mssql',
      display_type: 'mssql',
      status: 'active',
      config: {},
      created_by: 'u1',
      last_tested_at: null,
      last_error_code: null,
      created_at: timestamp,
      updated_at: timestamp,
      active_file: null,
    };
    const rows = Array.from({ length: 150 }, (_, index) => [
      index === 0 ? '=SUM(A1:A2)' : `Customer ${index}`,
      index + 0.123456,
      index % 2 === 0,
    ]);
    const artifacts = [
      {
        id: tableId,
        job_id: 'j1',
        kind: 'table',
        name: 'Customer backlog',
        source_sql_execution_id: 's1',
        created_at: timestamp,
        payload: {
          schema_version: 1,
          data_source_id: 'ds1',
          columns: ['customer', 'amount', 'active'],
          rows,
          row_count: rows.length,
          truncated: false,
          display: 'collapsed',
        },
      },
      {
        id: chartId,
        job_id: 'j1',
        kind: 'chart',
        name: 'Regional backlog',
        source_sql_execution_id: 's2',
        created_at: timestamp,
        payload: {
          schema_version: 1,
          renderer: 'frontend',
          chart_type: 'bar',
          title: 'Regional backlog',
          source_sql_execution_id: 's2',
          data_source_id: 'ds1',
          encoding: { x: { field: 'region' }, series: [{ field: 'amount', label: 'Amount' }] },
          data: [
            { region: 'Japan', amount: 123.45 },
            { region: 'ANZ', amount: 67.89 },
          ],
        },
      },
    ];
    const sql = ['s1', 's2'].map((id) => ({
      id,
      tool_execution_id: `t${id}`,
      data_source_id: 'ds1',
      sql_text: 'select * from results',
      status: 'succeeded',
      row_count: id === 's1' ? 150 : 2,
      columns: id === 's1' ? ['customer', 'amount', 'active'] : ['region', 'amount'],
      truncated: false,
      result_bytes: 10,
      duration_ms: 5,
      error_code: null,
      error_message: null,
      started_at: timestamp,
      finished_at: timestamp,
    }));
    const submitted: { title: string; rows: unknown[][] }[] = [];
    await page.addInitScript(() =>
      sessionStorage.setItem(
        'db-assistant.auth.v1',
        JSON.stringify({
          access_token: 'mock',
          refresh_token: 'mock',
          token_type: 'bearer',
          expires_in: 900,
        }),
      ),
    );
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/exports/excel')) {
        expect(route.request().headers().authorization).toBe('Bearer mock');
        expect(route.request().headers()['x-organization-id']).toBe('org1');
        const body = route.request().postDataJSON();
        submitted.push(body);
        // Generate the real workbook using the backend writer, without querying live data.
        const file = execFileSync(
          python,
          [
            '-c',
            'import json,sys; from app.exports.excel import ExcelTableExport,build_excel; sys.stdout.buffer.write(build_excel(ExcelTableExport.model_validate(json.load(sys.stdin))))',
          ],
          { cwd: backend, input: JSON.stringify(body) },
        );
        return route.fulfill({
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          body: file,
        });
      }
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
      else if (path.endsWith('/conversations/c1/messages')) json = [message];
      else if (path.endsWith('/conversations/c1')) json = { ...conversation, messages: [message] };
      else if (path.endsWith('/conversations')) json = [conversation];
      else if (path.endsWith('/data-sources')) json = [source];
      else if (path.endsWith('/execution')) json = { tools: [], models: [], sql, artifacts };
      await route.fulfill({ json });
    });
    async function download(button: Locator, filename: string) {
      await button.hover();
      const bounds = await button.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      const pending = page.waitForEvent('download');
      await button.click();
      const file = await pending;
      expect(file.suggestedFilename()).toBe(filename);
      const path = test.info().outputPath(filename);
      await file.saveAs(path);
      const dimensions = JSON.parse(
        execFileSync(
          python,
          [
            '-c',
            'import json,sys; from openpyxl import load_workbook; s=load_workbook(sys.argv[1]).active; print(json.dumps({"rows":s.max_row,"columns":s.max_column,"first_type":s["A2"].data_type}))',
            path,
          ],
          { cwd: backend },
        ).toString(),
      );
      return dimensions;
    }
    await page.goto('/conversations/c1');
    const markdown = page.locator('.markdown-table-wrapper');
    await expect(markdown).toBeVisible();
    expect(
      await download(markdown.getByRole('button', { name: 'Export to Excel' }), 'KPI Summary.xlsx'),
    ).toMatchObject({ rows: 2, columns: 2 });
    const table = page.locator('.table-artifact');
    await expect(table).toBeVisible();
    await table.hover();
    expect(
      await download(
        table.getByRole('button', { name: 'Export to Excel' }),
        'Customer backlog.xlsx',
      ),
    ).toMatchObject({ rows: 151, columns: 3, first_type: 's' });
    expect(submitted.at(-1)?.rows).toHaveLength(150);
    await expect(table.locator('table')).toHaveCount(0);
    await table.getByRole('button', { name: 'View table' }).click();
    await table.getByRole('button', { name: 'Expand table to full screen' }).click();
    const expanded = page.getByRole('dialog', { name: 'Customer backlog' });
    await expect(expanded).toBeVisible();
    await expanded.getByPlaceholder('Search across all columns…').fill('Customer 149');
    expect(
      await download(
        expanded.getByRole('button', { name: 'Export to Excel' }),
        'Customer backlog.xlsx',
      ),
    ).toMatchObject({ rows: 151 });
    await expanded.getByRole('button', { name: 'Exit table full screen' }).click();
    await expect(expanded).toHaveCount(0);
    const chart = page.getByRole('region', { name: 'Regional backlog', exact: true });
    await chart.hover();
    await chart.getByRole('button', { name: 'Show chart data', exact: true }).click();
    expect(
      await download(
        chart.getByRole('button', { name: 'Export chart data' }),
        'Regional backlog data.xlsx',
      ),
    ).toMatchObject({ rows: 3 });
    await page.locator('.main-content').evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(markdown).toBeInViewport();
    await page.screenshot({
      path: test.info().outputPath('excel-actions.png'),
      animations: 'disabled',
    });
  });
}
