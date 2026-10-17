import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import { Copy, Download, Search, Table } from 'lucide-react';
import {
  ArtifactFrame,
  type ArtifactAction,
  type ArtifactMetadata,
} from '../components/ArtifactFrame';
import { excelTableFromModel } from './excel-export';
import { useExcelExport } from './useExcelExport';
import { notifications } from '../../components/notifications';
import {
  formatAnalyticalValue,
  formatColumnHeader,
  isNumericColumn,
  toTsv,
  type AnalyticalRow,
  type AnalyticalTableModel,
  type AnalyticalValue,
} from './table-domain';

export type TableViewState = { sorting: SortingState; globalFilter: string };

export function AnalyticalTable({
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
  viewState,
  onViewStateChange,
  scrollPosition: controlledScroll,
}: {
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
  scrollPosition?: RefObject<{ top: number; left: number }>;
}) {
  const [localState, setLocalState] = useState<TableViewState>({ sorting: [], globalFilter: '' });
  const state = viewState ?? localState;
  const changeState = onViewStateChange ?? setLocalState;
  const [showSearch, setShowSearch] = useState(false);
  const localScroll = useRef({ top: 0, left: 0 });
  const scrollPosition = controlledScroll ?? localScroll;
  const attachScroll = useCallback(
    (element: HTMLDivElement | null) => {
      if (element) {
        element.scrollTop = scrollPosition.current.top;
        element.scrollLeft = scrollPosition.current.left;
      }
    },
    [scrollPosition],
  );
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
    data: model.rows,
    columns: columnDefs,
    state,
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
    () => new Set(model.columns.filter((column) => isNumericColumn(model.rows, column))),
    [model.columns, model.rows],
  );
  const { pending, exportExcel } = useExcelExport(() => excelTableFromModel(model, label));
  async function copy() {
    try {
      await navigator.clipboard.writeText(toTsv(model));
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
    <div
      ref={attachScroll}
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
      <table className="analytical-table" aria-label={label}>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
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
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
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
          ))}
        </tbody>
      </table>
    </div>
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
            <span>{table.getRowModel().rows.length.toLocaleString()} matching rows</span>
          </div>
        )
      }
    >
      {grid}
    </ArtifactFrame>
  );
}
