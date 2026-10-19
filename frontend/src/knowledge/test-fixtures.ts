import type { components } from '../api/generated/schema';
type S = components['schemas'];
export const time = '2026-10-18T10:00:00Z';
export const source: S['DataSourceResponse'] = {
  id: 'ds-1',
  name: 'Sales Analytics DB',
  kind: 'mssql',
  display_type: 'SQL Server',
  status: 'active',
  config: {},
  organization_id: 'org-1',
  created_by: 'u1',
  last_error_code: null,
  last_tested_at: null,
  created_at: time,
  updated_at: time,
};
export const status: S['KnowledgeStatusResponse'] = {
  data_source_id: 'ds-1',
  knowledge_base_id: 'kb-1',
  current_version_id: 'v-1',
  current_version_number: 1,
  status: 'ready',
  object_count: 42,
  schema_fingerprint: 'abcd1234',
  generated_at: time,
  last_error_code: null,
};
export const documents: S['KnowledgeDocumentSummary'][] = ['orders', 'customers'].map((name) => ({
  id: 'doc-' + name,
  document_type: 'table_schema',
  document_key: 'dbo.' + name,
  title: 'dbo.' + name,
  metadata: {},
  estimated_tokens: 250,
  created_at: time,
}));
export const detail: S['KnowledgeDocumentResponse'] = {
  ...documents[0]!,
  content_markdown:
    '# Table: dbo.orders\n\n## Columns\n\n| Column | Type | Nullable |\n| --- | --- | --- |\n| id | int | No |\n| amount | decimal | Yes |',
};
export const annotation: S['KnowledgeAnnotationResponse'] = {
  id: 'ann-1',
  knowledge_base_id: 'kb-1',
  created_by: 'u1',
  scope_type: 'datasource',
  scope_key: null,
  content: '# Fiscal calendar\n\nThe fiscal year starts on October 1.',
  created_at: time,
  updated_at: time,
};
