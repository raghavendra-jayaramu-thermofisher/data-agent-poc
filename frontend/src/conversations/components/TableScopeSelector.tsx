import { useEffect, useState } from 'react';
import { Button, Modal } from '@heroui/react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Database, Layers3, LockKeyhole, Search, Table2, X } from 'lucide-react';
import type { DataSource } from '../../api/types';
import { queryKeys } from '../../api/queryKeys';
import { listSourceTables } from '../../data-sources/api/data-source-api';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { normalizeTableScope, tableIdentity, tableScopeLabel } from './table-scope';
import type { SourceTableScope, TableIdentifier } from './table-scope';
import './TableScopeSelector.css';

type Props = {
  dataSources: DataSource[];
  sourceIds: string[];
  value: SourceTableScope[];
  onChange?(scope: SourceTableScope[]): void;
  readOnly?: boolean;
  disabled?: boolean;
};

function SourceTables({ source, scope, onChange, readOnly }: {
  source: { id: string; name: string };
  scope: SourceTableScope;
  onChange(scope: SourceTableScope): void;
  readOnly: boolean;
}) {
  const { activeOrganization } = useOrganization();
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const queryKey = queryKeys.dataSources.tables(activeOrganization?.id ?? null, source.id, query);
  const catalog = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => listSourceTables(source.id, query, pageParam?.cursor, pageParam?.version, signal),
    initialPageParam: undefined as { cursor: string; version: string } | undefined,
    getNextPageParam: (page) => page.next_cursor ? { cursor: page.next_cursor, version: page.knowledge_version_id } : undefined,
    enabled: !readOnly && Boolean(activeOrganization?.id),
    retry: false,
    staleTime: 30_000,
  });
  const tables = catalog.data?.pages.flatMap((page) => page.items) ?? [];
  const selected = scope.tables ?? [];
  const selectedIds = new Set(selected.map(tableIdentity));
  const visibleTables = readOnly
    ? selected.filter((table) => `${table.schema ?? ''}.${table.name}`.toLowerCase().includes(query.toLowerCase()))
      .map((table) => ({ ...table, object_type: '', column_count: 0 }))
    : tables;
  const schemas = [...new Set(visibleTables.map((table) => table.schema ?? ''))];
  const toggle = (table: TableIdentifier) => {
    const next = selectedIds.has(tableIdentity(table))
      ? selected.filter((item) => tableIdentity(item) !== tableIdentity(table))
      : [...selected, { schema: table.schema ?? null, name: table.name }];
    onChange({ ...scope, mode: 'selected', tables: next, knowledge_version_id: catalog.data?.pages[0]?.knowledge_version_id });
  };
  return <section className={`table-scope-source ${readOnly ? 'table-scope-source--readonly' : ''}`} aria-label={source.name}>
    <div className="table-scope-source-header">
      <div className="table-scope-source-title"><Database size={16} aria-hidden="true" /><h3 title={source.name}>{source.name}</h3></div>
      {readOnly ? <span className="table-scope-source-badge"><LockKeyhole size={12} />Fixed selection</span> : (
        <div className="table-scope-modes" role="group" aria-label={`Table scope for ${source.name}`}>
          <label className={scope.mode === 'all' ? 'is-active' : ''}>
            <input type="radio" name={`table-mode-${source.id}`} checked={scope.mode === 'all'} onChange={() => onChange({ ...scope, mode: 'all', tables: [], knowledge_version_id: null })} />All tables
          </label>
          <label className={scope.mode === 'selected' ? 'is-active' : ''}>
            <input type="radio" name={`table-mode-${source.id}`} checked={scope.mode === 'selected'} onChange={() => onChange({ ...scope, mode: 'selected', tables: selected })} />Selected tables
          </label>
        </div>
      )}
    </div>
    <div className="table-scope-browser">
      <div className="table-scope-list-pane">
        <div className="table-scope-list-toolbar">
          <label className="table-scope-search">
            <span className="table-scope-sr-only">Search tables or schemas</span>
            <Search size={16} aria-hidden="true" />
            <input type="search" value={search} placeholder="Search tables or schemas…" onChange={(event) => setSearch(event.target.value)} />
          </label>
          <span className="table-scope-loaded-count">{readOnly ? `${visibleTables.length} selected` : query ? `${visibleTables.length} found` : `${visibleTables.length} tables`}</span>
        </div>
        <div className="table-scope-catalog" aria-label="Table catalog" tabIndex={0}>
          {!readOnly && catalog.isPending && <div className="table-scope-empty" role="status"><Table2 size={24} /><p>Loading tables…</p></div>}
          {!readOnly && catalog.isError && <div role="alert" className="table-scope-empty table-scope-error">
            <p>{catalog.error instanceof Error ? catalog.error.message : 'Unable to load tables.'}</p>
            <Button size="sm" variant="secondary" onPress={() => void client.resetQueries({ queryKey, exact: true })}>Retry / refresh list</Button>
          </div>}
          {readOnly && scope.mode === 'all' ? <div className="table-scope-empty"><Layers3 size={28} /><strong>All tables and views</strong><p>This conversation can use every table in this source.</p></div> : <>
            {(readOnly || (!catalog.isPending && !catalog.isError)) && visibleTables.length === 0 && <div className="table-scope-empty"><Search size={24} /><p>{query ? 'No tables match your search.' : 'No tables or views are available.'}</p></div>}
            {schemas.map((schema) => <fieldset key={schema}>
              <legend>{schema || 'No schema'}</legend>
              {visibleTables.filter((table) => (table.schema ?? '') === schema).map((table) => {
                const checked = scope.mode === 'selected' && selectedIds.has(tableIdentity(table));
                return readOnly ? <div key={tableIdentity(table)} className="table-scope-row is-selected">
                  <Check size={15} aria-hidden="true" /><Table2 size={16} aria-hidden="true" />
                  <span className="table-scope-name">{table.schema ? `${table.schema}.` : ''}{table.name}</span>
                </div> : <label key={tableIdentity(table)} className={`table-scope-row ${checked ? 'is-selected' : ''}`}>
                  <input type="checkbox" checked={checked} disabled={!selectedIds.has(tableIdentity(table)) && selected.length >= 500} onChange={() => toggle(table)} />
                  <Table2 size={16} aria-hidden="true" />
                  <span className="table-scope-name" title={table.schema ? `${table.schema}.${table.name}` : table.name}>{table.name}</span>
                  {table.object_type === 'view' ? <span className="table-scope-object-type is-view">View</span> : null}
                  {table.column_count > 0 ? <span className="table-scope-columns">{table.column_count} cols</span> : null}
                </label>;
              })}
            </fieldset>)}
            {!readOnly && catalog.hasNextPage && <div className="table-scope-load-more"><Button size="sm" variant="secondary" isPending={catalog.isFetchingNextPage} onPress={() => void catalog.fetchNextPage()}>Load more tables</Button></div>}
          </>}
        </div>
        {!readOnly && <p className={`table-scope-list-hint ${scope.mode === 'selected' && !selected.length ? 'table-scope-error' : ''}`}>
          {selected.length >= 500 ? '500-table limit reached. Use All tables for a larger scope.' : scope.mode === 'selected' && !selected.length ? 'Select at least one table.' : 'Select a table to narrow the scope. Tables and views are supported.'}
        </p>}
      </div>
      {!readOnly && <aside className="table-scope-selection" aria-label="Selected tables summary">
        <div className="table-scope-selection-header"><h4>Selection <span>{scope.mode === 'all' ? 'All' : selected.length}</span></h4>
          {selected.length > 0 && <button type="button" onClick={() => onChange({ ...scope, mode: 'selected', tables: [] })}>Clear</button>}
        </div>
        {scope.mode === 'all' || !selected.length ? <div className="table-scope-selection-empty"><Layers3 size={20} aria-hidden="true" />
          <strong>{scope.mode === 'all' ? 'All tables included' : 'No tables selected'}</strong>
          <p>{scope.mode === 'all' ? 'Queries have access to all tables in this source.' : 'Select tables on the left to narrow scope.'}</p>
        </div> : <ul className="table-scope-selected-list">
          {selected.map((table) => <li key={tableIdentity(table)}>
            <div><span title={table.name}>{table.name}</span><small>{table.schema || 'No schema'}</small></div>
            <button type="button" aria-label={`Remove ${table.schema ? `${table.schema}.` : ''}${table.name}`} onClick={() => toggle(table)}><X size={14} /></button>
          </li>)}
        </ul>}
      </aside>}
    </div>
  </section>;
}

export function TableScopeSelector({ dataSources, sourceIds, value, onChange, readOnly = false, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SourceTableScope[]>([]);
  const [activeSourceId, setActiveSourceId] = useState(sourceIds[0] ?? '');
  const scope = normalizeTableScope(sourceIds, value);
  const valid = draft.every((item) => item.mode === 'all' || (item.tables?.length ?? 0) > 0);
  const openDialog = () => { setDraft(structuredClone(scope)); setActiveSourceId(sourceIds[0] ?? ''); setOpen(true); };
  const sources = sourceIds.map((id) => dataSources.find((source) => source.id === id) ?? { id, name: 'Unavailable data source' });
  const displayedScope = readOnly ? scope : normalizeTableScope(sourceIds, draft);
  const activeSource = sources.find((source) => source.id === activeSourceId) ?? sources[0];
  const selectedCount = displayedScope.reduce((count, item) => count + (item.tables?.length ?? 0), 0);
  const allCount = displayedScope.filter((item) => item.mode === 'all').length;
  const summary = selectedCount ? `${selectedCount} table${selectedCount === 1 ? '' : 's'} selected${allCount ? ` · all tables in ${allCount} other source${allCount === 1 ? '' : 's'}` : ''}` : `All tables in ${allCount} source${allCount === 1 ? '' : 's'}`;
  return <>
    <button type="button" className={`chat-composer-chip table-scope-trigger ${open || sourceIds.length > 0 ? 'active' : ''}`} disabled={disabled || sourceIds.length === 0}
      aria-haspopup="dialog" aria-expanded={open} onClick={openDialog}
      title={sourceIds.length ? `${tableScopeLabel(scope)} · ${readOnly ? 'Fixed for this conversation' : 'Choose tables for this conversation'}` : 'Select a data source first'}>
      <Table2 size={12} aria-hidden="true" /><span>{tableScopeLabel(scope)}</span>
      {readOnly ? <LockKeyhole size={11} aria-hidden="true" /> : <ChevronDown size={11} aria-hidden="true" />}
    </button>
    <Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
      <Modal.Container size="lg" scroll="inside" placement="center">
        <Modal.Dialog className="table-scope-dialog">
          <Modal.CloseTrigger />
          <Modal.Header className="table-scope-header"><span className="table-scope-heading-icon"><Table2 size={20} /></span>
            <Modal.Heading>{readOnly ? 'Selected tables' : 'Select tables'}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="table-scope-body">
            {sources.length > 1 && <nav className="table-scope-source-nav" aria-label="Data sources">
              {sources.map((source) => {
                const item = displayedScope.find((entry) => entry.data_source_id === source.id);
                const count = item?.tables?.length ?? 0;
                return <button key={source.id} type="button" aria-label={`${source.name}, ${item?.mode === 'all' ? 'all tables' : `${count} table${count === 1 ? '' : 's'} selected`}`} aria-pressed={source.id === activeSource?.id} onClick={() => setActiveSourceId(source.id)}>
                  <Database size={14} aria-hidden="true" /><span>{source.name}</span><small>{item?.mode === 'all' ? 'All' : item?.tables?.length ?? 0}</small>
                </button>;
              })}
            </nav>}
            {activeSource && (() => {
              const item = displayedScope.find((entry) => entry.data_source_id === activeSource.id) ?? { data_source_id: activeSource.id, mode: 'all' as const, tables: [] };
              return <SourceTables key={activeSource.id} source={activeSource} scope={item} readOnly={readOnly}
                onChange={(next) => setDraft((current) => normalizeTableScope(sourceIds, current).map((entry) => entry.data_source_id === activeSource.id ? next : entry))} />;
            })()}
          </Modal.Body>
          <Modal.Footer className="table-scope-footer">
            <div className="table-scope-footer-summary"><strong aria-live="polite">{!valid && !readOnly ? 'Choose at least one table for each selected source' : summary}</strong><span><LockKeyhole size={11} />{readOnly ? 'Fixed for this conversation' : 'Fixed after your first question'}</span></div>
            {readOnly ? <Button onPress={() => setOpen(false)}>Close</Button> : <>
              <Button variant="secondary" onPress={() => setOpen(false)}>Cancel</Button>
              <Button isDisabled={!valid || !sourceIds.length} onPress={() => { onChange?.(normalizeTableScope(sourceIds, draft)); setOpen(false); }}>Apply</Button>
            </>}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </>;
}
