import { describe, expect, it } from 'vitest';
import fixture from '../../../../test-fixtures/matrix.json';
import hierarchy from '../../../../test-fixtures/matrix-hierarchy.json';
import {
  formatMatrixNumber,
  initialMatrixState,
  matrixTsv,
  parseMatrixArtifact,
  projectMatrix,
  type MatrixMeasure,
} from './matrix-domain';

const artifact = {
  id: 'matrix1',
  job_id: 'job1',
  kind: 'matrix',
  name: 'Orders',
  source_sql_execution_id: fixture.source_sql_execution_id,
  payload: fixture,
  created_at: '',
};
const model = parseMatrixArtifact(artifact)!;
const number: MatrixMeasure = { field: 'amount', label: null, decimal_places: 2, format: 'number' };

describe('matrix domain', () => {
  it('accepts the actual backend-produced fixture', () => {
    expect(model).not.toBeNull();
    expect(model.column_nodes.map((item) => item.label)).toEqual(['Week 2', 'Week 10']);
  });
  it.each([
    ['9007199254740993.125', '9,007,199,254,740,993.13'],
    ['-1.005', '-1.01'],
    ['0', '0.00'],
    [null, ''],
    ['-0.001', '0.00'],
  ])('formats %s without losing decimal precision', (value, expected) => {
    expect(formatMatrixNumber(value, number)).toBe(expected);
  });
  it('formats ratios as percentages without summing or converting to floats', () => {
    expect(formatMatrixNumber('0.12345', { ...number, format: 'percent' })).toBe('12.35%');
  });
  it('copies SQL labels as literal spreadsheet text while preserving numeric cells', () => {
    const copy = structuredClone(model);
    copy.row_nodes[0]!.label = '=SUM(1,2)';
    expect(matrixTsv(copy, initialMatrixState(copy))).toContain("'=SUM(1,2)\t0.10");
  });
  it('projects collapse state and copies all displayed data, not DOM rows', () => {
    const state = initialMatrixState(model);
    const collapsed = projectMatrix(model, state);
    expect(collapsed.rows.map((item) => item.label)).toEqual(['North', 'South', 'Grand total']);
    const tsv = matrixTsv(model, state);
    expect(tsv).toContain('9,007,199,254,740,993.12');
    expect(tsv).not.toContain('Parts');
    const expanded = matrixTsv(model, { collapsed_rows: [], collapsed_columns: [] });
    expect(expanded).toContain('  Parts');
    expect(expanded).toContain('\t0\t');
    expect(projectMatrix(model, { collapsed_rows: [], collapsed_columns: [] }).rows.length).toBe(
      model.row_nodes.length,
    );
  });
  it('rejects stale view state and invalid artifact versions, lineage or coordinates', () => {
    expect(() =>
      projectMatrix(model, { collapsed_rows: ['unknown'], collapsed_columns: [] }),
    ).toThrow();
    for (const payload of [
      { ...fixture, schema_version: 2 },
      { ...fixture, cells: [...fixture.cells, fixture.cells[0]] },
      { ...fixture, row_nodes: [{ ...fixture.row_nodes[0], parent_id: 'cycle' }] },
      { ...fixture, cells: [{ ...fixture.cells[0], values: ['NaN', '2'] }] },
    ])
      expect(parseMatrixArtifact({ ...artifact, payload })).toBeNull();
    expect(parseMatrixArtifact({ ...artifact, source_sql_execution_id: 'other' })).toBeNull();
  });
  it('supports unrelated multilevel column data and keeps SQL averages unchanged', () => {
    const sensor = parseMatrixArtifact({
      ...artifact,
      source_sql_execution_id: hierarchy.source_sql_execution_id,
      payload: hierarchy,
    })!;
    expect(sensor).not.toBeNull();
    const expanded = projectMatrix(sensor, { collapsed_rows: [], collapsed_columns: [] });
    expect(expanded.columns.map((item) => item.label)).toEqual(['1', '2', '2026', 'Grand total']);
    const year = sensor.column_nodes.find((item) => item.depth === 1)!;
    const state = { collapsed_rows: [], collapsed_columns: [year.id] };
    expect(projectMatrix(sensor, state).columns.map((item) => item.label)).toEqual([
      '2026',
      'Grand total',
    ]);
    expect(matrixTsv(sensor, state)).toContain('33.75');
  });
});
