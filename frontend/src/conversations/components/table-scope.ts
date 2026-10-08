import type { components } from '../../api/generated/schema';

export type SourceTableScope = components['schemas']['SourceTableScope'];
export type TableIdentifier = components['schemas']['TableIdentifier'];

export function normalizeTableScope(sourceIds: string[], scope: SourceTableScope[]): SourceTableScope[] {
  return sourceIds.map((id) => scope.find((item) => item.data_source_id === id)
    ?? { data_source_id: id, mode: 'all', tables: [] });
}

export function tableIdentity(table: TableIdentifier) {
  return JSON.stringify([table.schema ?? null, table.name]);
}

export function tableScopeLabel(scope: SourceTableScope[]) {
  const selected = scope.filter((item) => item.mode === 'selected');
  if (!selected.length) return 'Tables: All tables';
  const count = selected.reduce((sum, item) => sum + (item.tables?.length ?? 0), 0);
  const singleTable = selected.flatMap((item) => item.tables ?? [])[0];
  const selection = count === 1 && singleTable ? singleTable.name : `${count} selected`;
  return `Tables: ${selection}${selected.length < scope.length ? ' + all in other sources' : ''}`;
}
