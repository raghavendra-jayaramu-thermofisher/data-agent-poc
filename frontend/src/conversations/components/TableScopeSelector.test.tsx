import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource } from '../../api/types';
import { TableScopeSelector } from './TableScopeSelector';
import type { SourceTableScope } from './table-scope';

const listTables = vi.hoisted(() => vi.fn());
vi.mock('../../data-sources/api/data-source-api', () => ({ listSourceTables: listTables }));
vi.mock('../../organizations/OrganizationProvider', () => ({ useOrganization: () => ({ activeOrganization: { id: 'org1' } }) }));

const sources = [{ id: 'ds1', name: 'Warehouse' }] as DataSource[];
const all: SourceTableScope[] = [{ data_source_id: 'ds1', mode: 'all', tables: [] }];
const firstPage = { knowledge_version_id: 'v1', items: [{ schema: 'dbo', name: 'orders', object_type: 'table', column_count: 4 }], next_cursor: null };

function mount(value = all, readOnly = false, dataSources = sources) {
  const change = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><TableScopeSelector dataSources={dataSources} sourceIds={dataSources.map((source) => source.id)} value={value} onChange={change} readOnly={readOnly} /></QueryClientProvider>);
  return { change, user: userEvent.setup() };
}

beforeEach(() => { listTables.mockReset(); listTables.mockResolvedValue(firstPage); });

describe('table selection dialog', () => {
  it('keeps each source selection while switching between sources', async () => {
    const { user, change } = mount(all, false, [...sources, { id: 'ds2', name: 'Finance' } as DataSource]);
    await user.click(screen.getByRole('button', { name: 'Tables: All tables' }));
    await user.click(await screen.findByRole('checkbox', { name: /orders/ }));
    await user.click(screen.getByRole('button', { name: 'Finance, all tables' }));
    expect(await screen.findByRole('checkbox', { name: /orders/ })).not.toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: /orders/ }));
    await user.click(screen.getByRole('button', { name: 'Warehouse, 1 table selected' }));
    expect(await screen.findByRole('checkbox', { name: /orders/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(change.mock.calls[0]![0].map((scope: SourceTableScope) => [scope.data_source_id, scope.tables?.length])).toEqual([['ds1', 1], ['ds2', 1]]);
  });

  it('removes a table from the visible selection summary without widening scope', async () => {
    const { user } = mount();
    await user.click(screen.getByRole('button', { name: 'Tables: All tables' }));
    await user.click(await screen.findByRole('checkbox', { name: /orders/ }));
    await user.click(screen.getByRole('button', { name: 'Remove dbo.orders' }));
    expect(screen.getByRole('checkbox', { name: /orders/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Selected tables' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });
  it('loads on opening and only applies the draft when Apply is pressed', async () => {
    const { user, change } = mount();
    expect(listTables).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Tables: All tables' }));
    const dialog = await screen.findByRole('dialog');
    const table = await within(dialog).findByRole('checkbox', { name: /orders/ });
    await user.click(table);
    expect(change).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(change).toHaveBeenCalledWith([{ data_source_id: 'ds1', mode: 'selected', tables: [{ schema: 'dbo', name: 'orders' }], knowledge_version_id: 'v1' }]);
  });

  it('disallows an empty selected scope and discards edits on Cancel', async () => {
    const { user, change } = mount();
    const trigger = screen.getByRole('button', { name: 'Tables: All tables' });
    await user.click(trigger);
    await user.click(screen.getByRole('radio', { name: 'Selected tables' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    await user.click(await screen.findByRole('checkbox', { name: /orders/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(change).not.toHaveBeenCalled();
    await user.click(trigger);
    expect(await screen.findByRole('radio', { name: 'All tables' })).toBeChecked();
  });

  it('preserves selected tables when search has no matches', async () => {
    const { user, change } = mount();
    await user.click(screen.getByRole('button', { name: 'Tables: All tables' }));
    await user.click(await screen.findByRole('checkbox', { name: /orders/ }));
    listTables.mockResolvedValue({ ...firstPage, items: [] });
    await user.type(screen.getByRole('searchbox'), 'missing');
    expect(await screen.findByText('No tables match your search.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(change.mock.calls[0]![0][0].tables).toEqual([{ schema: 'dbo', name: 'orders' }]);
  });

  it('loads the next page with its schema version and preserves earlier selections', async () => {
    listTables.mockImplementation(async (_id, _search, cursor) => cursor
      ? { ...firstPage, items: [{ schema: 'dbo', name: 'customers', object_type: 'view', column_count: 2 }] }
      : { ...firstPage, next_cursor: 'dbo.orders' });
    const { user, change } = mount();
    await user.click(screen.getByRole('button', { name: 'Tables: All tables' }));
    await user.click(await screen.findByRole('checkbox', { name: /orders/ }));
    await user.click(screen.getByRole('button', { name: 'Load more tables' }));
    await user.click(await screen.findByRole('checkbox', { name: /customers/ }));
    expect(listTables).toHaveBeenLastCalledWith('ds1', '', 'dbo.orders', 'v1', expect.any(AbortSignal));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(change.mock.calls[0]![0][0].tables).toHaveLength(2);
  });

  it('shows saved scope without querying the catalog and closes with Escape', async () => {
    const { user, change } = mount([{ data_source_id: 'ds1', mode: 'selected', tables: [{ schema: 'dbo', name: 'orders' }] }], true);
    const trigger = screen.getByRole('button', { name: 'Tables: orders' });
    await user.click(trigger);
    expect(await screen.findByText('dbo.orders')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(listTables).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(change).not.toHaveBeenCalled();
  });

  it('shows catalog errors and allows retry without changing scope', async () => {
    listTables.mockRejectedValue(new Error('Schema knowledge is not ready.'));
    const { user, change } = mount();
    await user.click(screen.getByRole('button', { name: 'Tables: All tables' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Schema knowledge is not ready.');
    listTables.mockResolvedValue(firstPage);
    await user.click(screen.getByRole('button', { name: 'Retry / refresh list' }));
    expect(await screen.findByRole('checkbox', { name: /orders/ })).toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });
});
