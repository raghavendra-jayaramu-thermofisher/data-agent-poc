import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useMemo, useRef, useState } from 'react';
import { Copy, Check, Maximize2, X, Search, Download, Table } from 'lucide-react';
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

export function AnalyticalTable({
  model,
  label = 'Analytical result',
  hideToolbar = false,
  fullscreen: controlledFullscreen,
  onFullscreen,
  onCloseFullscreen,
}: {
  model: AnalyticalTableModel;
  label?: string;
  hideToolbar?: boolean;
  fullscreen?: boolean;
  onFullscreen?(): void;
  onCloseFullscreen?(): void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [copied, setCopied] = useState(false);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');

  const isFullscreen = controlledFullscreen !== undefined ? controlledFullscreen : internalFullscreen;
  const openFullscreen = onFullscreen ?? (() => setInternalFullscreen(true));
  const closeFullscreen = onCloseFullscreen ?? (() => setInternalFullscreen(false));

  const columnDefs = useMemo<ColumnDef<AnalyticalRow>[]>(
    () =>
      model.columns.map((column) => ({
        id: column,
        accessorFn: (row) => row.values[column],
        header: formatColumnHeader(column, model.columnLabels),
        cell: (info) => formatAnalyticalValue(info.getValue() as AnalyticalValue),
        sortingFn: 'alphanumeric',
      })),
    [model.columns, model.columnLabels]
  );

  const table = useReactTable({
    data: model.rows,
    columns: columnDefs,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  });

  const renderedRows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);

  const numericColumns = useMemo(
    () => new Set(model.columns.filter((column) => isNumericColumn(model.rows, column))),
    [model.columns, model.rows]
  );

  async function copyTable() {
    try {
      await navigator.clipboard.writeText(toTsv(model));
      setCopied(true);
      notifications.success('Copied table to clipboard');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notifications.error('Unable to copy table');
    }
  }

  function downloadCsv() {
    const tsv = toTsv(model);
    const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${label.replace(/\s+/g, '_').toLowerCase()}.tsv`;
    link.click();
    URL.revokeObjectURL(url);
    notifications.success('Downloaded table file');
  }

  return (
    <div className="analytical-table-shell">
      {!hideToolbar && (
        <div className="analytical-table-toolbar flex items-center justify-between gap-2 p-2 border-b border-[#DAD5CD] bg-[#FBFAF7]">
          <div className="flex items-center gap-2">
            <strong className="text-xs font-semibold text-[#252127]">
              {model.rowCount.toLocaleString()} row{model.rowCount === 1 ? '' : 's'}
            </strong>
            {model.truncated && (
              <span className="text-[10px] px-1.5 py-0.2 bg-[#F8EDCF] text-[#8C5A00] rounded font-medium">
                Truncated
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FFFDFC] hover:bg-[#F0EEE9] text-[#252127] border border-[#DAD5CD] rounded text-xs font-medium transition-colors"
              onClick={() => void copyTable()}
              title="Copy as TSV"
            >
              {copied ? <Check size={12} className="text-[#32745A]" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy table'}</span>
            </button>

            <button
              type="button"
              className="p-1 text-[#625C64] hover:text-[#252127] hover:bg-[#EAE7E1] rounded transition-colors"
              onClick={openFullscreen}
              title="Expand to full screen"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
      )}

      {!model.rows.length && (
        <div className="artifact-empty text-center py-6 text-xs text-[#8B848C]" role="status">
          No rows returned.
        </div>
      )}

      {model.rows.length > 0 && (
        <div ref={scrollRef} className="analytical-table-scroll overflow-auto max-h-[480px]">
          <table className="analytical-table w-full border-collapse" aria-label={label}>
            <thead className="bg-[#F0EEE9] border-b border-[#DAD5CD] shadow-xs sticky top-0 z-10">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th
                      key={header.id}
                      className={`sticky top-0 bg-[#F0EEE9] z-10 px-3.5 py-2.5 text-xs font-semibold text-[#252127] border-b border-[#DAD5CD] select-none ${
                        numericColumns.has(header.column.id) ? 'text-right' : 'text-left'
                      }`}
                    >
                      <button
                        type="button"
                        className={`font-semibold text-xs text-[#252127] hover:text-[#4B123F] inline-flex items-center gap-1 cursor-pointer w-full ${
                          numericColumns.has(header.column.id) ? 'justify-end' : 'justify-start'
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                        <span>
                          {header.column.getIsSorted() === 'asc'
                            ? ' ↑'
                            : header.column.getIsSorted() === 'desc'
                            ? ' ↓'
                            : ''}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {renderedRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[#EAE7E1] hover:bg-[#F0EDE6] transition-colors odd:bg-[#FFFFFF] even:bg-[#FAF8F5]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`px-3.5 py-2 text-xs text-[#252127] ${
                        numericColumns.has(cell.column.id) ? 'text-right font-mono tabular-nums' : 'text-left'
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Fullscreen Table Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDFC] border border-[#DAD5CD] rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#DAD5CD] bg-[#FBFAF7]">
              <div className="flex items-center gap-2.5">
                <Table size={18} className="text-[#4B123F]" />
                <div>
                  <h3 className="font-semibold text-base text-[#252127]">{label}</h3>
                  <p className="text-xs text-[#625C64]">
                    {renderedRows.length.toLocaleString()} matching rows of {model.rowCount.toLocaleString()} total
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-[#8B848C]" />
                  <input
                    type="text"
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    placeholder="Search across all columns…"
                    className="w-64 h-8 pl-8 pr-2.5 bg-[#FFFDFC] border border-[#DAD5CD] rounded text-xs text-[#252127] outline-none focus:border-[#9A4D86]"
                  />
                </div>

                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFDFC] hover:bg-[#F0EEE9] text-[#252127] border border-[#DAD5CD] rounded text-xs font-semibold"
                  onClick={() => downloadCsv()}
                >
                  <Download size={13} />
                  <span>Download TSV</span>
                </button>

                <button
                  type="button"
                  className="p-1.5 text-[#625C64] hover:text-[#252127] hover:bg-[#EAE7E1] rounded cursor-pointer"
                  onClick={closeFullscreen}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4">
              <table className="analytical-table w-full">
                <thead className="bg-[#F0EEE9] shadow-xs">
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id}>
                      {group.headers.map((header) => (
                        <th
                          key={header.id}
                          className={`px-3 py-2 text-left font-semibold text-xs text-[#252127] border-b border-[#DAD5CD] sticky top-0 bg-[#F0EEE9] z-10 ${
                            numericColumns.has(header.column.id) ? 'numeric-cell' : ''
                          }`}
                        >
                          <button
                            type="button"
                            className="font-semibold text-xs text-left hover:text-[#4B123F] inline-flex items-center gap-1 cursor-pointer"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            <span>
                              {header.column.getIsSorted() === 'asc'
                                ? ' ↑'
                                : header.column.getIsSorted() === 'desc'
                                ? ' ↓'
                                : ''}
                            </span>
                          </button>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {renderedRows.map((row) => (
                    <tr key={row.id} className="border-b border-[#EAE7E1] hover:bg-[#F6F4EF] transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={`px-3 py-2 text-xs text-[#252127] ${
                            numericColumns.has(cell.column.id) ? 'numeric-cell' : ''
                          }`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
