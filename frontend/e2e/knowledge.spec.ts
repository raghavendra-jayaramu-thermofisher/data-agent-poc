import { expect, test, type Page } from '@playwright/test';

async function settled(page: Page, selector: string) {
  await expect
    .poll(() =>
      page
        .locator(selector)
        .evaluate(
          (element) =>
            element
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === 'running').length,
        ),
    )
    .toBe(0);
}

for (const viewport of [
  { width: 1280, height: 850 },
  { width: 390, height: 844 },
]) {
  test(
    'knowledge explorer and business rules at ' + viewport.width + 'px',
    async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      const time = '2026-10-18T00:00:00Z';
      const sources = ['Sales analytics', 'Regional reporting', 'Inventory'].map((name, index) => ({
        id: 'ds' + index,
        name,
        kind: 'mssql',
        display_type: 'SQL Server',
        status: 'active',
        config: {},
        organization_id: 'org1',
        created_by: 'u1',
        last_error_code: null,
        last_tested_at: null,
        created_at: time,
        updated_at: time,
      }));
      const makeDocument = (name: string) => ({
        id: name,
        document_type: 'table_schema',
        document_key: 'dbo.' + name,
        title: 'dbo.' + name,
        metadata: {},
        estimated_tokens: 259,
        created_at: time,
      });
      const documents = [
        'orders',
        'customers',
        'products',
        'regions',
        'stock',
        'weekly_snapshots',
        'shipments',
        'order_status',
        'currencies',
        'countries',
        'customer_contacts',
        'sales_representatives',
      ].map(makeDocument);
      const makeAnnotation = (
        id: string,
        scope_type: string,
        scope_key: string | null,
        content: string,
      ) => ({
        id,
        scope_type,
        scope_key,
        content,
        knowledge_base_id: 'kb1',
        created_by: 'u1',
        created_at: time,
        updated_at: time,
      });
      let annotations = [
        makeAnnotation(
          'calendar',
          'datasource',
          null,
          '# Fiscal calendar\n\nThe fiscal year starts on October 1. Use the reporting calendar when grouping weekly snapshots.',
        ),
        makeAnnotation(
          'format',
          'datasource',
          null,
          '# Currency and formatting\n\nReport backlog in P$ millions with two decimal places.',
        ),
        makeAnnotation(
          'rules',
          'table',
          'dbo.orders',
          '# Backlog reporting rules\n\nInclude open order lines. Exclude printed invoices and retain blank order statuses.',
        ),
        makeAnnotation(
          'metric',
          'metric',
          'overdue_backlog',
          '# Overdue backlog\n\nOrders with a customer-request date before the snapshot date.',
        ),
      ];
      const unexpected: string[] = [];
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
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
      let generated = 0;
      await page.route('**/api/v1/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        const method = route.request().method();
        let json: unknown = [];
        // The chat sidebar reads paged conversations.
        if (new URL(route.request().url()).pathname.endsWith('/conversations'))
          json = { items: [], next_cursor: null, has_more: false };
        if (path.endsWith('/auth/me'))
          json = {
            id: 'u1',
            email: 'alex@example.com',
            display_name: 'Alex Morgan',
            is_active: true,
            created_at: time,
            updated_at: time,
          };
        else if (path.endsWith('/organizations'))
          json = [
            { id: 'org1', name: 'Operations', role: 'owner', created_at: time, updated_at: time },
          ];
        else if (path === '/api/v1/data-sources') json = sources;
        else if (/^\/api\/v1\/data-sources\/ds\d$/.test(path))
          json = sources.find((item) => path.endsWith('/' + item.id));
        else if (path.endsWith('/versions') || path.endsWith('/index')) {
          unexpected.push(path);
          return route.fulfill({ status: 500 });
        } else if (path.endsWith('/generate')) {
          generated++;
          json = { job_id: 'kg1', knowledge_base_id: 'kb1' };
        } else if (path === '/api/v1/jobs/kg1')
          json = {
            id: 'kg1',
            job_type: 'knowledge_generation',
            status: 'succeeded',
            organization_id: 'org1',
            requested_by: 'u1',
            input: { data_source_id: 'ds0' },
            result: {},
            attempt_count: 1,
            max_attempts: 1,
            error_code: null,
            error_message: null,
            conversation_id: null,
            cancel_requested_at: null,
            created_at: time,
            started_at: time,
            finished_at: time,
          };
        else if (path.endsWith('/documents')) json = documents;
        else if (path.includes('/documents/')) {
          const doc = documents.find((item) => path.endsWith('/' + item.id))!;
          json = {
            ...doc,
            content_markdown:
              '# Table: ' +
              doc.title +
              '\n\nObject type: table\n\n## Columns\n\n| Column | Type | Nullable | Default |\n| --- | --- | --- | --- |\n| id | int | No | — |\n| customer_name | varchar(100) | Yes | — |\n| backlog_value | decimal(18, 2) | No | 0 |\n| snapshot_date | date | No | — |\n| stock_status | varchar(50) | Yes | — |\n\n## Relationships\n\nThe customer ID links orders to the customer directory.\n\n## Reporting notes\n\nUse the weekly snapshot date when comparing backlog over time.',
          };
        } else if (path.endsWith('/annotations') && path.includes('/data-sources/')) {
          if (method === 'POST') {
            const created = {
              ...makeAnnotation('created', 'datasource', null, ''),
              ...route.request().postDataJSON(),
            };
            annotations.push(created);
            json = created;
          } else json = annotations;
        } else if (path.includes('/knowledge/annotations/')) {
          const id = path.split('/').pop();
          if (method === 'DELETE') {
            annotations = annotations.filter((item) => item.id !== id);
            return route.fulfill({ status: 204 });
          }
          annotations = annotations.map((item) =>
            item.id === id ? { ...item, ...route.request().postDataJSON() } : item,
          );
          json = annotations.find((item) => item.id === id);
        } else if (/\/knowledge\/data-sources\/ds\d$/.test(path))
          json = {
            data_source_id: path.split('/').pop(),
            status: path.endsWith('/ds1') ? 'empty' : 'ready',
            current_version_id: path.endsWith('/ds1') ? null : 'v1',
            current_version_number: 1,
            object_count: 272,
            schema_fingerprint: '48ec9492a097c5b1',
            generated_at: time,
            knowledge_base_id: 'kb1',
            last_error_code: null,
          };
        await route.fulfill({ json });
      });
      await page.goto('/knowledge');
      await expect(page.getByRole('heading', { name: 'Knowledge', exact: true })).toBeVisible();
      await expect(page.locator('.knowledge-source-row')).toHaveCount(3);
      await expect(page.getByText('Not set up', { exact: true })).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath('knowledge-home-' + viewport.width + '.png'),
        fullPage: true,
      });
      const sourceSearch = page.getByRole('searchbox', { name: 'Search data sources' });
      await sourceSearch.fill('Regional');
      await expect(page.locator('.knowledge-source-row')).toHaveCount(1);
      await expect(page.locator('.knowledge-source-row')).toContainText('Not set up');
      await page.getByRole('button', { name: 'Clear search', exact: true }).click();
      await page.getByRole('link', { name: /Sales analytics/ }).click();
      await expect(
        page.getByRole('heading', { name: 'Sales analytics', exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('tab')).toHaveCount(2);
      await expect(page.getByRole('heading', { name: 'dbo.orders', exact: true })).toBeVisible();
      await expect(
        page.getByText(/estimated tokens|Schema fingerprint|Active version|Last generated/),
      ).toHaveCount(0);
      await expect(page.locator('.schema-item-btn')).toHaveCount(documents.length);
      const search = page.getByRole('searchbox', { name: 'Search tables and views' });
      await search.focus();
      await expect(search).toHaveCSS('box-shadow', 'none');
      await expect(page.locator('.schema-sidebar-tools .knowledge-search')).not.toHaveCSS(
        'box-shadow',
        'none',
      );
      await settled(page, '.knowledge-tabs');
      if (viewport.width > 640) {
        expect(
          (await page.getByRole('tab', { name: 'Schema explorer' }).boundingBox())!.width,
        ).toBeLessThan(160);
      }
      await page.screenshot({
        path: testInfo.outputPath('knowledge-schema-' + viewport.width + '.png'),
        fullPage: true,
      });
      await search.fill('customers');
      await expect(page.locator('.schema-item-btn')).toHaveCount(1);
      await page.getByRole('button', { name: 'dbo.customers', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'dbo.customers', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Clear table search' }).click();
      expect(
        await page.locator('.main-content').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await page.getByRole('button', { name: 'Refresh schema', exact: true }).click();
      await expect.poll(() => generated).toBe(1);
      await page.getByRole('tab', { name: 'Business knowledge', exact: true }).click();
      await expect(page.locator('.annotation-row')).toHaveCount(4);
      await settled(page, '.knowledge-tabs');
      if (viewport.width > 640)
        expect((await page.locator('.annotation-row').first().boundingBox())!.height).toBeLessThan(
          60,
        );
      await page.screenshot({
        path: testInfo.outputPath('knowledge-business-' + viewport.width + '.png'),
        fullPage: true,
      });
      await page
        .getByRole('searchbox', { name: 'Search business knowledge' })
        .fill('printed invoices');
      await expect(page.locator('.annotation-row')).toHaveCount(1);
      await page.getByRole('button', { name: 'Clear knowledge search' }).click();
      await page.getByRole('button', { name: 'Add knowledge', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Add business knowledge', exact: true });
      await expect(dialog).toBeVisible();
      await settled(page, '.knowledge-modal-backdrop');
      const box = (await dialog.boundingBox())!;
      expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(3);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
      expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath('knowledge-add-' + viewport.width + '.png'),
        fullPage: true,
      });
      await dialog.getByRole('button', { name: /Applies to/ }).click();
      await page.getByRole('option', { name: 'Table', exact: true }).click();
      await dialog.getByRole('textbox', { name: 'Table name', exact: true }).fill('dbo.customers');
      await dialog
        .getByRole('textbox', { name: 'Instructions', exact: true })
        .fill('# Customer reporting\n\nGroup customer revenue by billing country.');
      await dialog.getByRole('button', { name: 'Add knowledge', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.locator('.annotation-row')).toHaveCount(5);
      await page
        .getByRole('button', { name: 'More actions for Customer reporting', exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'Edit knowledge', exact: true }).click();
      const input = page.getByRole('textbox', { name: 'Instructions', exact: true });
      await input.fill('# Customer reporting\n\nGroup customer revenue by shipping country.');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect(input).not.toBeVisible();
      await page
        .getByRole('button', { name: 'Customer reporting, Table, dbo.customers', exact: true })
        .click();
      await expect(
        page.getByText('Group customer revenue by shipping country.', { exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'More actions for Customer reporting', exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'Delete knowledge', exact: true }).click();
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Delete knowledge', exact: true })
        .click();
      await expect(page.locator('.annotation-row')).toHaveCount(4);
      expect(unexpected).toEqual([]);
      expect(errors).toEqual([]);
    },
  );
}
