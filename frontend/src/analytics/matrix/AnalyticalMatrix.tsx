import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Table as TableIcon,
  ChevronsDownUp,
  ChevronsUpDown,
} from 'lucide-react';
import { ArtifactFrame, type ArtifactMetadata } from '../components/ArtifactFrame';
import { apiClient, withAuthRefresh } from '../../api/client';
import { notifications } from '../../components/notifications';
import {
  formatMatrixNumber,
  groupIds,
  initialMatrixState,
  matrixHeaders,
  matrixTsv,
  projectMatrix,
  type MatrixModel,
  type MatrixNode,
  type MatrixViewState,
} from './matrix-domain';

function readState(model: MatrixModel, key: string): MatrixViewState {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (
      raw &&
      typeof raw === 'object' &&
      'collapsed_rows' in raw &&
      'collapsed_columns' in raw &&
      Array.isArray(raw.collapsed_rows) &&
      Array.isArray(raw.collapsed_columns) &&
      raw.collapsed_rows.every((id) => typeof id === 'string') &&
      raw.collapsed_columns.every((id) => typeof id === 'string')
    ) {
      const state = {
        collapsed_rows: raw.collapsed_rows as string[],
        collapsed_columns: raw.collapsed_columns as string[],
      };
      projectMatrix(model, state);
      return state;
    }
  } catch {
    /* An old or inaccessible preference never prevents rendering. */
  }
  return initialMatrixState(model);
}

// Each viewer owns its scroll observer. The expansion state and last position live
// in the parent so replacing the inline viewport with fullscreen preserves both.
function MatrixViewport({
  count,
  label,
  getPosition,
  onPositionChange,
  children,
}: {
  count: number;
  label: string;
  getPosition(): { top: number; left: number };
  onPositionChange(position: { top: number; left: number }): void;
  children(virtual: Virtualizer<HTMLDivElement, Element>): ReactNode;
}) {
  const scroll = useRef<HTMLDivElement | null>(null);
  const virtual = useVirtualizer<HTMLDivElement, Element>({
    count,
    getScrollElement: () => scroll.current,
    estimateSize: () => 32,
    initialOffset: () => getPosition().top,
    overscan: 8,
  });
  return (
    <div
      ref={(element) => {
        scroll.current = element;
        if (element) {
          const position = getPosition();
          element.scrollTop = position.top;
          element.scrollLeft = position.left;
        }
      }}
      onScroll={(event) =>
        onPositionChange({
          top: event.currentTarget.scrollTop,
          left: event.currentTarget.scrollLeft,
        })
      }
      className="matrix-scroll"
      tabIndex={0}
      role="region"
      aria-label={`${label} scrollable matrix`}
    >
      {children(virtual)}
    </div>
  );
}

export function AnalyticalMatrix({
  model,
  artifactId,
  jobId,
  dataSourceName,
  metadata,
}: {
  model: MatrixModel;
  artifactId: string;
  jobId: string;
  dataSourceName?: string;
  metadata?: ArtifactMetadata;
}) {
  const storageKey = `matrix-view-v1:${artifactId}`;
  const [state, setState] = useState(() => readState(model, storageKey));
  const [exporting, setExporting] = useState(false);
  const [copying, setCopying] = useState(false);
  const view = useMemo(() => projectMatrix(model, state), [model, state]);
  const rowGroups = useMemo(() => groupIds(model.row_nodes), [model]);
  const columnGroups = useMemo(() => groupIds(model.column_nodes), [model]);
  const cells = useMemo(
    () => new Map(model.cells.map((cell) => [`${cell.row_id}:${cell.column_id}`, cell.values])),
    [model],
  );
  const update = useCallback(
    (next: MatrixViewState) => {
      setState(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* Storage can be disabled. */
      }
    },
    [storageKey],
  );
  const toggle = useCallback(
    (id: string, column = false) => {
      const field = column ? 'collapsed_columns' : 'collapsed_rows';
      update({
        ...state,
        [field]: state[field].includes(id)
          ? state[field].filter((value) => value !== id)
          : [...state[field], id],
      });
    },
    [state, update],
  );
  const defs = useMemo<ColumnDef<MatrixNode>[]>(
    () => [
      {
        id: 'hierarchy',
        header: model.spec.rows.map((item) => item.label ?? item.field).join(' / '),
        cell: ({ row }) => {
          const node = row.original;
          const group = rowGroups.has(node.id);
          const expanded = !state.collapsed_rows.includes(node.id);
          return (
            <div
              className="matrix-row-label"
              style={{ paddingInlineStart: Math.max(0, node.depth - 1) * 18 }}
            >
              {group ? (
                <button
                  type="button"
                  className="matrix-toggle"
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.label}`}
                  aria-expanded={expanded}
                  onClick={() => toggle(node.id)}
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span className="matrix-toggle-spacer" />
              )}
              <span>{node.label}</span>
            </div>
          );
        },
      },
      ...view.columns.flatMap((column) =>
        model.spec.measures.map((measure, index): ColumnDef<MatrixNode> => ({
          id: `${column.id}:${measure.field}`,
          accessorFn: (row) => cells.get(`${row.id}:${column.id}`)?.[index] ?? null,
          cell: ({ getValue }) => {
            const value = getValue() as string | null;
            return <span title={value ?? undefined}>{formatMatrixNumber(value, measure)}</span>;
          },
        })),
      ),
    ],
    [model, rowGroups, state.collapsed_rows, toggle, view.columns, cells],
  );
  const table = useReactTable({
    data: view.rows,
    columns: defs,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });
  const scrollPosition = useRef({ top: 0, left: 0 });
  const rendered = table.getRowModel().rows;
  const headers = useMemo(() => matrixHeaders(model, view.columns), [model, view.columns]);

  async function copy() {
    if (copying) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(matrixTsv(model, state));
      notifications.success('Copied matrix');
    } catch {
      notifications.error('Unable to copy matrix');
    } finally {
      setCopying(false);
    }
  }
  async function exportExcel() {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await withAuthRefresh(() =>
        apiClient.POST('/api/v1/jobs/{job_id}/artifacts/{artifact_id}/matrix/excel', {
          params: { path: { job_id: jobId, artifact_id: artifactId } },
          body: state,
          parseAs: 'blob',
        }),
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${model.spec.title.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120) || 'Matrix'}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      notifications.error('Unable to export matrix. Please try again.');
    } finally {
      setExporting(false);
    }
  }
  const content = (
    <div className="matrix-content">
      {!model.row_nodes.length ? (
        <p className="matrix-empty">No data for this matrix.</p>
      ) : (
        <MatrixViewport
          count={view.rows.length}
          label={model.spec.title}
          getPosition={() => scrollPosition.current}
          onPositionChange={(position) => {
            scrollPosition.current = {
              ...position,
            };
          }}
        >
          {(virtual) => {
            const virtualRows = virtual.getVirtualItems();
            // Initial/SSR renders and jsdom have no measured viewport yet.
            const indices = virtualRows.length
              ? virtualRows.map((row) => row.index)
              : Array.from({ length: Math.min(50, rendered.length) }, (_, index) => index);
            return (
              <table
                aria-label={model.spec.title}
                aria-rowcount={view.rows.length + headers.length}
              >
                <thead>
                  {headers.map((header, level) => (
                    <tr key={level}>
                      {level === 0 && (
                        <th className="matrix-corner" rowSpan={headers.length} scope="col">
                          {model.spec.rows.map((item) => item.label ?? item.field).join(' / ')}
                        </th>
                      )}
                      {header.map((cell) => (
                        <th
                          key={cell.key}
                          colSpan={cell.span}
                          scope={cell.span > 1 ? 'colgroup' : 'col'}
                        >
                          {cell.nodeId &&
                          columnGroups.has(cell.nodeId) &&
                          model.spec.show_column_subtotals ? (
                            <button
                              type="button"
                              className="matrix-column-toggle"
                              aria-label={`${state.collapsed_columns.includes(cell.nodeId) ? 'Expand' : 'Collapse'} column ${cell.label}`}
                              aria-expanded={!state.collapsed_columns.includes(cell.nodeId)}
                              onClick={() => toggle(cell.nodeId!, true)}
                            >
                              {cell.label}
                              {state.collapsed_columns.includes(cell.nodeId) ? (
                                <ChevronRight size={13} />
                              ) : (
                                <ChevronDown size={13} />
                              )}
                            </button>
                          ) : (
                            cell.label
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {!!virtualRows[0]?.start && (
                    <tr aria-hidden="true">
                      <td
                        colSpan={defs.length}
                        style={{ height: virtualRows[0].start, padding: 0 }}
                      />
                    </tr>
                  )}
                  {indices.map((index) => {
                    const row = rendered[index]!;
                    return (
                      <tr
                        key={row.id}
                        data-index={index}
                        ref={(element) => {
                          if (element) virtual.measureElement(element);
                        }}
                        aria-rowindex={headers.length + index + 1}
                        className={
                          row.original.depth === 0
                            ? 'matrix-grand-total'
                            : row.original.depth < model.spec.rows.length
                              ? 'matrix-subtotal'
                              : ''
                        }
                      >
                        {row.getVisibleCells().map((cell, cellIndex) =>
                          cellIndex === 0 ? (
                            <th key={cell.id} scope="row">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </th>
                          ) : (
                            <td
                              key={cell.id}
                              className={
                                (view.columns[
                                  Math.floor((cellIndex - 1) / model.spec.measures.length)
                                ]?.depth ?? model.spec.columns.length) < model.spec.columns.length
                                  ? 'matrix-column-total'
                                  : undefined
                              }
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ),
                        )}
                      </tr>
                    );
                  })}
                  {!!virtualRows.length && virtual.getTotalSize() > virtualRows.at(-1)!.end && (
                    <tr aria-hidden="true">
                      <td
                        colSpan={defs.length}
                        style={{
                          height: virtual.getTotalSize() - virtualRows.at(-1)!.end,
                          padding: 0,
                        }}
                      />
                    </tr>
                  )}
                </tbody>
              </table>
            );
          }}
        </MatrixViewport>
      )}
    </div>
  );

  return (
    <ArtifactFrame
      title={model.spec.title}
      kind="matrix"
      icon={TableIcon}
      className="analytical-matrix"
      metadata={{
        rowCount: view.rows.length,
        artifactId,
        jobId,
        sources: dataSourceName ? [{ name: dataSourceName }] : [],
        ...metadata,
        notes: [
          model.spec.measures.map((item) => item.label ?? item.field).join(' · '),
          'Values and totals from SQL. Blank cells indicate no value. Copy and export follow the current expansion state.',
          ...(metadata?.notes ?? []),
        ],
      }}
      actions={[
        { id: 'export', label: 'Export matrix', icon: Download, busy: exporting, run: exportExcel },
        { id: 'copy', label: 'Copy matrix', icon: Copy, busy: copying, run: copy },
      ]}
      moreActions={
        rowGroups.size
          ? [
              {
                id: 'expand-all',
                label: 'Expand all rows',
                icon: ChevronsUpDown,
                run: () => update({ ...state, collapsed_rows: [] }),
              },
              {
                id: 'collapse-all',
                label: 'Collapse all rows',
                icon: ChevronsDownUp,
                run: () => update({ ...state, collapsed_rows: [...rowGroups] }),
              },
            ]
          : []
      }
    >
      {content}
    </ArtifactFrame>
  );
}
