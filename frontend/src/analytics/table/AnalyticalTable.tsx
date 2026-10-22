import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Table as ReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Copy, Download, Search, Table } from 'lucide-react';
import {
  ArtifactFrame,
  type ArtifactAction,
  type ArtifactMetadata,
} from '../components/ArtifactFrame';
import { downloadExcel, excelTableFromModel, saveWorkbook } from './excel-export';
import { exportTableRows, listTableRows, type TableQuery } from './table-rows-api';
import { useExcelExport } from './useExcelExport';
import { useTableRows } from './useTableRows';
import { LoadMoreSentinel } from '../../components/LoadMoreSentinel';
import { notifications } from '../../components/notifications';
import {
  formatAnalyticalValue,
  formatColumnHeader,
  isNumericColumn,
  toTsv,
  type AnalyticalRow,
  rowsFromPositional,
  type AnalyticalTableModel,
  type AnalyticalValue,
  type TablePaging,
} from './table-domain';

export type TableViewState = { sorting: SortingState; globalFilter: string };

type ScrollPosition = { top: number; left: number };

// Rows rendered before the viewport is measured (first paint, jsdom).
const UNMEASURED_ROW_COUNT = 50;
// Request the next server page while this many loaded rows remain below the viewport.
const PREFETCH_ROWS = 60;
const COPY_PAGE_SIZE = 1000;

type RemoteRows = {
  /** Changes when the server sort or search changes; the viewport then returns to the top. */
  viewKey: string;
  totalCount: number;
  hasMore: boolean;
  isFetchingMore: boolean;
  isError: boolean;
  loadMore(): void;
};

/** Every stored row for the current sort and search, read in large pages for Copy. */
async function allRemoteRows(paging: TablePaging, query: TableQuery, columns: string[]) {
  const rows: unknown[][] = [];
  let cursor: string | null = null;
  do {
    const page = await listTableRows(paging, query, cursor, COPY_PAGE_SIZE);
    rows.push(...(page.rows as unknown[][]));
    cursor = page.next_cursor;
  } while (cursor);
  return rowsFromPositional(columns, rows);
}

// Each viewer owns its scroll observer, so the inline and fullscreen tables both virtualize while
// the parent keeps the shared sort, filter and last scroll position.
function TableViewport({
  table,
  label,
  numericColumns,
  scrollPosition,
  remote,
}: {
  table: ReactTable<AnalyticalRow>;
  label: string;
  numericColumns: Set<string>;
  scrollPosition: RefObject<ScrollPosition>;
  /** Present when rows load from the server as the reader scrolls. */
  remote?: RemoteRows;
}) {
  const scroll = useRef<HTMLDivElement | null>(null);
  const rows = table.getRowModel().rows;
  const columnCount = table.getVisibleLeafColumns().length;
  const virtual = useVirtualizer<HTMLDivElement, Element>({
    count: rows.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 32,
    initialOffset: () => scrollPosition.current.top,
    overscan: 10,
  });
  const virtualRows = virtual.getVirtualItems();
  const indices = virtualRows.length
    ? virtualRows.map((row) => row.index)
    : Array.from({ length: Math.min(UNMEASURED_ROW_COUNT, rows.length) }, (_, index) => index);
  const before = virtualRows[0]?.start ?? 0;
  const after = virtualRows.length ? virtual.getTotalSize() - virtualRows.at(-1)!.end : 0;
  const lastVisible = virtualRows.at(-1)?.index ?? -1;
  const shouldPrefetch =
    Boolean(remote?.hasMore && !remote.isFetchingMore && !remote.isError) &&
    lastVisible >= rows.length - PREFETCH_ROWS;
  const loadMore = remote?.loadMore;
  useEffect(() => {
    if (shouldPrefetch) loadMore?.();
  }, [shouldPrefetch, loadMore]);
  const viewKey = remote?.viewKey;
  const shownViewKey = useRef(viewKey);
  useEffect(() => {
    if (shownViewKey.current === viewKey) return;
    shownViewKey.current = viewKey;
    scrollPosition.current = { ...scrollPosition.current, top: 0 };
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [viewKey, scrollPosition]);
  const spacer = (height: number) =>
    height > 0 && (
      <tr aria-hidden="true">
        <td colSpan={columnCount} style={{ height, padding: 0, border: 0 }} />
      </tr>
    );
  return (
    <div
      ref={(element) => {
        scroll.current = element;
        if (element) {
          element.scrollTop = scrollPosition.current.top;
          element.scrollLeft = scrollPosition.current.left;
        }
      }}
      className="analytical-table-scroll"
      tabIndex={0}
      role="region"
      aria-label={`${label} scrollable table`}
      onScroll={(event) => {
        scrollPosition.current = {
          top: event.currentTarget.scrollTop,
          left: event.currentTarget.scrollLeft,
        };
      }}
    >
      <table
        className="analytical-table"
        aria-label={label}
        aria-rowcount={(remote?.totalCount ?? rows.length) + 1}
      >
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id} aria-rowindex={1}>
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className={numericColumns.has(header.column.id) ? 'numeric-cell' : undefined}
                  aria-sort={
                    header.column.getIsSorted() === 'asc'
                      ? 'ascending'
                      : header.column.getIsSorted() === 'desc'
                        ? 'descending'
                        : 'none'
                  }
                >
                  <button
                    type="button"
                    className="analytical-table-sort"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <span className="analytical-cell-value">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </span>
                    <span aria-hidden="true">
                      {header.column.getIsSorted() === 'asc'
                        ? '↑'
                        : header.column.getIsSorted() === 'desc'
                          ? '↓'
                          : ''}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {spacer(before)}
          {indices.map((index) => {
            const row = rows[index]!;
            return (
              <tr
                key={row.id}
                data-index={index}
                ref={(element) => {
                  if (element) virtual.measureElement(element);
                }}
                aria-rowindex={index + 2}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={numericColumns.has(cell.column.id) ? 'numeric-cell' : undefined}
                  >
                    <span className="analytical-cell-value">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </span>
                  </td>
                ))}
              </tr>
            );
          })}
          {spacer(after)}
          {remote && (remote.hasMore || remote.isFetchingMore) && (
            <tr className="analytical-table-more">
              <td colSpan={columnCount}>
                <LoadMoreSentinel
                  hasMore={remote.hasMore}
                  isLoading={remote.isFetchingMore}
                  isError={remote.isError}
                  onLoadMore={remote.loadMore}
                  loadingLabel="Loading more rows…"
                />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

type AnalyticalTableProps = {
  model: AnalyticalTableModel;
  label?: string;
  hideToolbar?: boolean;
  fullscreen?: boolean;
  onFullscreen?(): void;
  onCloseFullscreen?(): void;
  defaultOpen?: boolean;
  metadata?: ArtifactMetadata;
  extraActions?: ArtifactAction[];
  className?: string;
  viewState?: TableViewState;
  onViewStateChange?(state: TableViewState): void;
  scrollPosition?: RefObject<ScrollPosition>;
};

type TableBodyProps = AnalyticalTableProps & {
  state: TableViewState;
  changeState(state: TableViewState): void;
  remoteRows?: ReturnType<typeof useTableRows>;
};

export function AnalyticalTable(props: AnalyticalTableProps) {
  const [localState, setLocalState] = useState<TableViewState>({ sorting: [], globalFilter: '' });
  const state = props.viewState ?? localState;
  const changeState = props.onViewStateChange ?? setLocalState;
  return props.model.paging ? (
    <PagedAnalyticalTable {...props} state={state} changeState={changeState} />
  ) : (
    <AnalyticalTableBody {...props} state={state} changeState={changeState} />
  );
}

/** Large stored results: rows arrive from the server as the reader scrolls, sorts or searches. */
function PagedAnalyticalTable(props: TableBodyProps) {
  const remoteRows = useTableRows(props.model, props.state);
  return <AnalyticalTableBody {...props} remoteRows={remoteRows} />;
}

function AnalyticalTableBody({
  model,
  label = 'Analytical result',
  hideToolbar = false,
  fullscreen,
  onFullscreen,
  onCloseFullscreen,
  defaultOpen = true,
  metadata,
  extraActions = [],
  className = '',
  scrollPosition: controlledScroll,
  state,
  changeState,
  remoteRows,
}: TableBodyProps) {
  const [showSearch, setShowSearch] = useState(false);
  const localScroll = useRef<ScrollPosition>({ top: 0, left: 0 });
  const scrollPosition = controlledScroll ?? localScroll;
  const paging = remoteRows && model.paging;
  const data = paging ? remoteRows.rows : model.rows;
  const columnDefs = useMemo<ColumnDef<AnalyticalRow>[]>(
    () =>
      model.columns.map((column) => ({
        id: column,
        accessorFn: (row) => row.values[column],
        header: formatColumnHeader(column, model.columnLabels),
        cell: (info) => formatAnalyticalValue(info.getValue() as AnalyticalValue),
        sortingFn: 'alphanumeric',
      })),
    [model.columns, model.columnLabels],
  );
  const table = useReactTable({
    data,
    columns: columnDefs,
    state,
    // Large stored results are sorted and searched by the server over every row.
    manualSorting: Boolean(paging),
    manualFiltering: Boolean(paging),
    onSortingChange: (updater) =>
      changeState({
        ...state,
        sorting: typeof updater === 'function' ? updater(state.sorting) : updater,
      }),
    onGlobalFilterChange: (updater) =>
      changeState({
        ...state,
        globalFilter: typeof updater === 'function' ? updater(state.globalFilter) : updater,
      }),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  });
  const numericColumns = useMemo(
    () => new Set(model.columns.filter((column) => isNumericColumn(data, column))),
    [model.columns, data],
  );
  const { pending, exportExcel } = useExcelExport(async () => {
    if (!paging) return downloadExcel(excelTableFromModel(model, label));
    const headers = model.columns.map((column) => formatColumnHeader(column, model.columnLabels));
    saveWorkbook(await exportTableRows(paging, remoteRows.query, label, headers), label);
    return { truncated: model.truncated };
  });
  const matchingCount = paging
    ? (remoteRows.matchingCount ?? data.length)
    : table.getRowModel().rows.length;
  const remote: RemoteRows | undefined = paging && {
    viewKey: JSON.stringify(remoteRows.query),
    totalCount: matchingCount,
    hasMore: remoteRows.hasMore,
    isFetchingMore: remoteRows.isFetchingMore,
    isError: remoteRows.isError,
    loadMore: remoteRows.loadMore,
  };
  async function copy() {
    try {
      const rows = paging
        ? await allRemoteRows(paging, remoteRows.query, model.columns)
        : table.getRowModel().rows.map((row) => row.original);
      await navigator.clipboard.writeText(toTsv({ ...model, rows }));
      notifications.success('Copied table to clipboard');
    } catch {
      notifications.error('Unable to copy table');
    }
  }
  const grid = !model.rows.length ? (
    <p className="artifact-empty" role="status">
      No rows returned.
    </p>
  ) : (
    <TableViewport
      table={table}
      label={label}
      numericColumns={numericColumns}
      scrollPosition={scrollPosition}
      remote={remote}
    />
  );
  if (hideToolbar) return grid;
  return (
    <ArtifactFrame
      title={label}
      kind="table"
      icon={Table}
      defaultOpen={defaultOpen}
      className={`analytical-table-shell ${className}`}
      metadata={{ rowCount: model.rowCount, ...metadata }}
      warning={
        model.truncated || metadata?.sources?.some((source) => source.truncated)
          ? 'Truncated result'
          : undefined
      }
      fullscreen={fullscreen}
      onFullscreenChange={
        fullscreen === undefined
          ? undefined
          : (open) => (open ? onFullscreen?.() : onCloseFullscreen?.())
      }
      actions={[
        { id: 'copy', label: 'Copy table', icon: Copy, run: copy },
        {
          id: 'export',
          label: 'Export to Excel',
          icon: Download,
          busy: pending,
          disabled: !model.columns.length,
          run: exportExcel,
        },
        ...extraActions,
      ]}
      moreActions={[
        {
          id: 'search',
          label: 'Search table',
          icon: Search,
          run: () => setShowSearch((show) => !show),
        },
      ]}
      tools={(expanded) =>
        (expanded || showSearch) && (
          <div className="artifact-search-bar">
            <Search size={14} aria-hidden="true" />
            <input
              aria-label="Search table"
              placeholder="Search across all columns…"
              value={state.globalFilter}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
            />
            <span aria-live="polite">
              {paging && remoteRows.isUpdating
                ? 'Searching…'
                : `${matchingCount.toLocaleString()} matching rows`}
            </span>
          </div>
        )
      }
    >
      {grid}
    </ArtifactFrame>
  );
}
