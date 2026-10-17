import { z } from 'zod';
import type { JobArtifact } from '../../agent/api/execution-api';

const dimension = z.object({
  field: z.string().min(1),
  label: z.string().nullable(),
  sort_field: z.string().nullable(),
  sort_type: z.enum(['text', 'number', 'date']),
  descending: z.boolean(),
});
const measure = z.object({
  field: z.string().min(1),
  label: z.string().nullable(),
  decimal_places: z.number().int().min(0).max(12),
  format: z.enum(['number', 'percent']),
});
const scalar = z.union([z.string().max(512), z.number().finite(), z.boolean(), z.null()]);
const node = z.object({
  id: z.string().regex(/^[rc][a-f0-9]{24}$/),
  parent_id: z.string().nullable(),
  depth: z.number().int().min(0).max(3),
  path: z.array(scalar).max(3),
  label: z.string().max(512),
});
const decimal = z
  .string()
  .max(256)
  .regex(/^[+-]?\d+(?:\.\d+)?$/)
  .nullable();
const schema = z.object({
  schema_version: z.literal(1),
  renderer: z.literal('frontend'),
  totals_source: z.literal('sql'),
  source_sql_execution_id: z.string().uuid(),
  source_digest: z.string().regex(/^[a-f0-9]{64}$/),
  source_row_count: z.number().int().nonnegative(),
  spec: z.object({
    sql_execution_id: z.string().uuid(),
    title: z.string().min(1).max(240),
    rows: z.array(dimension).min(1).max(3),
    columns: z.array(dimension).min(1).max(3),
    measures: z.array(measure).min(1).max(4),
    row_depth_field: z.string().nullable(),
    column_depth_field: z.string().nullable(),
    show_row_subtotals: z.boolean(),
    show_row_grand_total: z.boolean(),
    show_column_subtotals: z.boolean(),
    show_column_grand_total: z.boolean(),
    initial_expansion_depth: z.number().int().min(0).max(3),
  }),
  row_nodes: z.array(node).max(10000),
  column_nodes: z.array(node).max(256),
  cells: z
    .array(
      z.object({
        row_id: z.string(),
        column_id: z.string(),
        values: z.array(decimal).min(1).max(4),
      }),
    )
    .max(200000),
});

export type MatrixModel = z.infer<typeof schema>;
export type MatrixNode = MatrixModel['row_nodes'][number];
export type MatrixMeasure = MatrixModel['spec']['measures'][number];
export type MatrixViewState = { collapsed_rows: string[]; collapsed_columns: string[] };

export function parseMatrixArtifact(artifact: JobArtifact): MatrixModel | null {
  if (artifact.kind !== 'matrix') return null;
  const result = schema.safeParse(artifact.payload);
  if (!result.success) return null;
  const model = result.data;
  if (
    model.source_sql_execution_id !== artifact.source_sql_execution_id ||
    model.spec.sql_execution_id !== model.source_sql_execution_id
  )
    return null;
  const fields = [...model.spec.rows, ...model.spec.columns, ...model.spec.measures].map(
    (field) => field.field,
  );
  if (new Set(fields).size !== fields.length) return null;
  for (const [nodes, axis, depth] of [
    [model.row_nodes, 'r', model.spec.rows.length],
    [model.column_nodes, 'c', model.spec.columns.length],
  ] as const) {
    const seen = new Map<string, MatrixNode>();
    for (const item of nodes) {
      if (
        !item.id.startsWith(axis) ||
        seen.has(item.id) ||
        item.depth !== item.path.length ||
        item.depth > depth
      )
        return null;
      if (item.depth > 1) {
        const parent = item.parent_id ? seen.get(item.parent_id) : undefined;
        if (
          !parent ||
          parent.depth !== item.depth - 1 ||
          JSON.stringify(parent.path) !== JSON.stringify(item.path.slice(0, -1))
        )
          return null;
      } else if (item.parent_id !== null) return null;
      seen.set(item.id, item);
    }
  }
  const rows = new Set(model.row_nodes.map((item) => item.id));
  const columns = new Set(model.column_nodes.map((item) => item.id));
  const cells = new Set<string>();
  for (const item of model.cells) {
    const key = `${item.row_id}:${item.column_id}`;
    if (
      !rows.has(item.row_id) ||
      !columns.has(item.column_id) ||
      cells.has(key) ||
      item.values.length !== model.spec.measures.length
    )
      return null;
    cells.add(key);
  }
  if (model.row_nodes.length * model.column_nodes.length * model.spec.measures.length > 200000)
    return null;
  return model;
}

export function groupIds(nodes: MatrixNode[]): Set<string> {
  return new Set(nodes.flatMap((item) => (item.parent_id ? [item.parent_id] : [])));
}

export function initialMatrixState(model: MatrixModel): MatrixViewState {
  const groups = groupIds(model.row_nodes);
  return {
    collapsed_rows: model.row_nodes
      .filter((item) => groups.has(item.id) && item.depth >= model.spec.initial_expansion_depth)
      .map((item) => item.id),
    collapsed_columns: [],
  };
}

export function projectMatrix(model: MatrixModel, state: MatrixViewState) {
  function project(nodes: MatrixNode[], collapsed: string[], column: boolean) {
    const byId = new Map(nodes.map((item) => [item.id, item]));
    const groups = groupIds(nodes);
    if (
      new Set(collapsed).size !== collapsed.length ||
      collapsed.some((id) => !groups.has(id)) ||
      (column && collapsed.length && !model.spec.show_column_subtotals)
    )
      throw new Error('Invalid matrix expansion state');
    const collapsedSet = new Set(collapsed);
    if (column) {
      const byParent = new Map<string | null, MatrixNode[]>();
      for (const item of nodes)
        byParent.set(item.parent_id, [...(byParent.get(item.parent_id) ?? []), item]);
      const output: MatrixNode[] = [];
      function visit(item: MatrixNode) {
        if (!collapsedSet.has(item.id))
          for (const child of byParent.get(item.id) ?? []) visit(child);
        if (!groups.has(item.id) || model.spec.show_column_subtotals) output.push(item);
      }
      for (const root of byParent.get(null) ?? []) visit(root);
      return output;
    }
    return nodes.filter((item) => {
      let parent = item.parent_id;
      while (parent) {
        if (collapsedSet.has(parent)) return false;
        parent = byId.get(parent)?.parent_id ?? null;
      }
      return !column || !groups.has(item.id) || model.spec.show_column_subtotals;
    });
  }
  return {
    rows: project(model.row_nodes, state.collapsed_rows, false),
    columns: project(model.column_nodes, state.collapsed_columns, true),
  };
}

// BigInt rounding keeps database decimal strings exact, including values above 2^53.
export function formatMatrixNumber(value: string | null, measure: MatrixMeasure): string {
  if (value === null) return '';
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = value.replace(/^[+-]/, '').split('.');
  let integer = BigInt(whole + fraction);
  const shift = measure.decimal_places + (measure.format === 'percent' ? 2 : 0) - fraction.length;
  if (shift >= 0) integer *= 10n ** BigInt(shift);
  else {
    const divisor = 10n ** BigInt(-shift);
    integer = integer / divisor + ((integer % divisor) * 2n >= divisor ? 1n : 0n);
  }
  const digits = integer.toString().padStart(measure.decimal_places + 1, '0');
  const prefix = measure.decimal_places ? digits.slice(0, -measure.decimal_places) : digits;
  const suffix = measure.decimal_places ? `.${digits.slice(-measure.decimal_places)}` : '';
  return `${negative && integer !== 0n ? '-' : ''}${prefix.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${suffix}${measure.format === 'percent' ? '%' : ''}`;
}

export type MatrixHeader = { key: string; label: string; span: number; nodeId?: string };
export function matrixHeaders(model: MatrixModel, columns: MatrixNode[]): MatrixHeader[][] {
  const depth = model.spec.columns.length + (model.spec.measures.length > 1 ? 1 : 0);
  const output: MatrixHeader[][] = Array.from({ length: depth }, () => []);
  const byId = new Map(model.column_nodes.map((item) => [item.id, item]));
  for (const item of columns) {
    const ancestry = new Map<number, MatrixNode>();
    let ancestor: MatrixNode | undefined = item;
    while (ancestor) {
      ancestry.set(ancestor.depth, ancestor);
      ancestor = ancestor.parent_id ? byId.get(ancestor.parent_id) : undefined;
    }
    for (const measure of model.spec.measures) {
      for (let level = 0; level < depth; level++) {
        const isMeasure = level === model.spec.columns.length;
        const member = ancestry.get(level + 1);
        const key = isMeasure
          ? `${item.id}:${measure.field}`
          : (member?.id ?? `${item.id}:${level}`);
        const label = isMeasure
          ? (measure.label ?? measure.field)
          : !item.path.length
            ? 'Grand total'
            : (member?.label ?? 'Total');
        const headers = output[level]!;
        const last = headers.at(-1);
        if (last?.key === key) last.span++;
        else {
          headers.push({ key, label, span: 1, nodeId: isMeasure ? undefined : member?.id });
        }
      }
    }
  }
  return output;
}

export function matrixTsv(model: MatrixModel, state: MatrixViewState): string {
  const view = projectMatrix(model, state);
  const escape = (value: string) => value.replace(/[\t\r\n]/g, ' ');
  const label = (value: string) => (/^\s*[=+@-]/.test(value) ? `'${value}` : value);
  const headers = matrixHeaders(model, view.columns).map((row, index) => [
    index === 0 ? label(model.spec.rows.map((item) => item.label ?? item.field).join(' / ')) : '',
    ...row.flatMap((item) => [label(item.label), ...Array<string>(item.span - 1).fill('')]),
  ]);
  const cells = new Map(
    model.cells.map((item) => [`${item.row_id}:${item.column_id}`, item.values]),
  );
  const rows = view.rows.map((row) => [
    label(`${'  '.repeat(Math.max(0, row.depth - 1))}${row.label}`),
    ...view.columns.flatMap((column) =>
      model.spec.measures.map((measure, index) =>
        formatMatrixNumber(cells.get(`${row.id}:${column.id}`)?.[index] ?? null, measure),
      ),
    ),
  ]);
  return [...headers, ...rows].map((row) => row.map(escape).join('\t')).join('\n');
}
