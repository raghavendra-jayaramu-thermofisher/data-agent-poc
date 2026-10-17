import { expect, test } from '@playwright/test';
import baseFixture from '../../test-fixtures/combo-chart.json' with { type: 'json' };

for (const { width, large } of [
  { width: 1440, large: false },
  { width: 390, large: false },
  { width: 1440, large: true },
]) {
  test(`combo chart renders, opens fullscreen and saves all series at ${width}px${large ? ' with zoom' : ''}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    const fixture = structuredClone(baseFixture);
    if (large)
      fixture.data = Array.from({ length: 80 }, (_, i) => ({
        ...baseFixture.data[i % baseFixture.data.length]!,
        month: `Period ${i + 1}`,
      }));
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const timestamp = '2026-10-17T00:00:00Z';
    const sqlId = fixture.source_sql_execution_id;
    const chart = {
      id: '55555555-5555-4555-8555-555555555555',
      job_id: 'j1',
      kind: 'chart',
      name: fixture.title,
      source_sql_execution_id: sqlId,
      payload: fixture,
      created_at: timestamp,
    };
    const columns = Object.keys(fixture.data[0]!);
    const table = {
      ...chart,
      id: 'table1',
      kind: 'table',
      payload: {
        schema_version: 1,
        columns,
        rows: fixture.data.map((row) =>
          columns.map((column) => (row as Record<string, unknown>)[column]),
        ),
        row_count: fixture.data.length,
        truncated: false,
        display: 'hidden',
        data_source_id: 'ds1',
      },
    };
    const conversation = {
      id: 'c1',
      organization_id: 'org1',
      created_by: 'u1',
      title: fixture.title,
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
        content: '[[artifact:55555555-5555-4555-8555-555555555555]]',
        job_id: 'j1',
        metadata: {},
        created_at: timestamp,
      },
    ];
    const sql = {
      id: sqlId,
      tool_execution_id: 't1',
      data_source_id: 'ds1',
      sql_text: 'SELECT month, online, store, fulfilled, target FROM monthly_summary',
      status: 'succeeded',
      row_count: 6,
      truncated: false,
      columns,
      result_bytes: 1000,
      duration_ms: 1,
      error_code: null,
      error_message: null,
      started_at: timestamp,
      finished_at: timestamp,
    };
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
    const dashboard = {
      id: 'd1',
      organization_id: 'org1',
      title: 'Operations',
      description: null,
      created_by: 'u1',
      created_at: timestamp,
      updated_at: timestamp,
      widget_count: 0,
    };
    let saved: { widget_type: string; visualization_config: Record<string, unknown> } | undefined;
    let widget: unknown;
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
      else if (path.endsWith('/conversations/c1/messages')) json = messages;
      else if (path.endsWith('/conversations/c1')) json = { ...conversation, messages };
      else if (path.endsWith('/conversations')) json = [conversation];
      else if (path.endsWith('/data-sources')) json = [source];
      else if (path.endsWith('/execution'))
        json = { tools: [], models: [], sql: [sql], artifacts: [table, chart] };
      else if (path.endsWith('/dashboards/d1/widgets')) {
        saved = route.request().postDataJSON();
        widget = {
          ...saved,
          id: 'w1',
          dashboard_id: 'd1',
          data_source_id: 'ds1',
          title: fixture.title,
          question: null,
          sql_text: sql.sql_text,
          layout_config: {},
          created_from_job_id: 'j1',
          created_from_sql_execution_id: sqlId,
          last_refresh_job_id: null,
          last_refreshed_at: null,
          enabled: true,
          created_at: timestamp,
          updated_at: timestamp,
          latest_artifact: chart,
        };
        json = widget;
      } else if (path.endsWith('/dashboards/d1'))
        json = { ...dashboard, widgets: widget ? [widget] : [] };
      else if (path.endsWith('/dashboards')) json = [dashboard];
      await route.fulfill({ json });
    });
    await page.goto('/conversations/c1');
    const chartView = page.getByRole('region', { name: fixture.title, exact: true });
    await expect(
      chartView.getByRole('img', { name: /Interactive Line \+ stacked columns/ }),
    ).toBeVisible();
    await expect(chartView.locator('canvas')).toHaveCount(1);
    await chartView.getByRole('button', { name: 'Chart actions' }).click();
    await page.getByRole('menuitem', { name: 'Chart information' }).click();
    const information = page.getByRole('dialog', { name: fixture.title + ' information' });
    await expect(information.getByText('Warehouse', { exact: true })).toBeVisible();
    await expect(information.getByText('Line + stacked columns', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    let lastFrame = '';
    await expect
      .poll(
        async () => {
          const frame = await chartView
            .locator('canvas')
            .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
          const stable = frame === lastFrame;
          lastFrame = frame;
          return stable;
        },
        { intervals: [200] },
      )
      .toBe(true);
    await chartView.screenshot({ path: test.info().outputPath(`combo-${width}.png`) });
    await chartView.hover();
    await chartView.getByRole('button', { name: 'Show chart data', exact: true }).click();
    await expect(chartView.getByRole('table')).toBeVisible();
    await expect(chartView.getByRole('cell', { name: '72.5', exact: true }).first()).toBeVisible();
    await chartView.getByRole('button', { name: 'Show chart', exact: true }).click();
    // Exercise ECharts' public actions/events against the actual mounted chart.
    // Importing its installed React wrapper gives access to the same ECharts registry.
    async function interactionState(change = false) {
      return page
        .locator('.echarts-for-react')
        .first()
        .evaluate(
          async (element, { change, large }) => {
            const modulePath = performance
              .getEntriesByType('resource')
              .map((entry) => entry.name)
              .find((name) => name.includes('/node_modules/.vite/deps/echarts-for-react.js?'))!;
            const { default: Chart } = await import(modulePath);
            const chart = new Chart({ option: {} }).echarts.getInstanceByDom(element);
            if (change) {
              chart.dispatchAction({ type: 'legendToggleSelect', name: 'Store' });
              if (large) chart.dispatchAction({ type: 'dataZoom', start: 20, end: 70 });
            }
            const option = chart.getOption();
            return {
              store: option.legend[0].selected.Store,
              zoom: option.dataZoom?.map((item: { start: number; end: number }) => [
                Math.round(item.start),
                Math.round(item.end),
              ]),
            };
          },
          { change, large },
        );
    }
    const remembered = await interactionState(true);
    expect(remembered.store).toBe(false);
    if (large)
      expect(remembered.zoom).toEqual([
        [20, 70],
        [20, 70],
      ]);
    await chartView.getByRole('button', { name: 'Expand chart to full screen' }).click();
    const full = page.getByRole('dialog', { name: fixture.title });
    await expect(full.locator('canvas')).toHaveCount(1);
    await expect
      .poll(async () => Object.values((await full.boundingBox())!).map(Math.round))
      .toEqual([0, 0, width, 960]);
    await expect.poll(() => interactionState()).toEqual(remembered);
    await full.screenshot({ path: test.info().outputPath(`combo-fullscreen-${width}.png`) });
    await full.getByRole('button', { name: 'Exit chart full screen' }).click();
    await expect.poll(() => interactionState()).toEqual(remembered);
    await chartView.getByRole('button', { name: 'Hide chart' }).click();
    await chartView.getByRole('button', { name: 'View chart' }).click();
    await expect.poll(() => interactionState()).toEqual(remembered);
    await page.getByRole('button', { name: 'Save to dashboard' }).click();
    const save = page.getByRole('dialog', { name: 'Save analysis to dashboard' });
    await expect(save.getByLabel('Primary Y-axis title')).toHaveValue('Orders (count)');
    await expect(save.getByLabel('Secondary Y-axis title')).toHaveValue('Fulfilment (%)');
    await expect(save.getByLabel('Series 3 unit')).toHaveValue('%');
    await save.getByRole('button', { name: 'Save widget', exact: true }).click();
    await expect.poll(() => saved?.widget_type).toBe('combo');
    expect(saved?.visualization_config).toMatchObject({
      stacked: true,
      orientation: 'vertical',
      series: fixture.encoding.series,
      y_label: fixture.y_label,
      secondary_y_label: fixture.secondary_y_label,
    });
    await expect(page).toHaveURL(/\/dashboards\/d1$/);
    await expect(
      page.getByRole('img', { name: /Interactive Line \+ stacked columns/ }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
