import { apiClient, withAuthRefresh } from '../../api/client';
import type { components } from '../../api/generated/schema';
type S = components['schemas'];
export function getStatus(dataSourceId: string): Promise<S['KnowledgeStatusResponse']> {
  return withAuthRefresh(() =>
    apiClient.GET('/api/v1/knowledge/data-sources/{data_source_id}', {
      params: { path: { data_source_id: dataSourceId } },
    }),
  );
}
export function generate(dataSourceId: string): Promise<S['KnowledgeJobResponse']> {
  return withAuthRefresh(() =>
    apiClient.POST('/api/v1/knowledge/data-sources/{data_source_id}/generate', {
      params: { path: { data_source_id: dataSourceId } },
    }),
  );
}
export function listVersions(
  dataSourceId: string,
  limit = 50,
): Promise<S['KnowledgeVersionResponse'][]> {
  return withAuthRefresh(() =>
    apiClient.GET('/api/v1/knowledge/data-sources/{data_source_id}/versions', {
      params: { path: { data_source_id: dataSourceId }, query: { limit } },
    }),
  );
}
export function getIndex(dataSourceId: string): Promise<S['KnowledgeDocumentResponse']> {
  return withAuthRefresh(() =>
    apiClient.GET('/api/v1/knowledge/data-sources/{data_source_id}/index', {
      params: { path: { data_source_id: dataSourceId } },
    }),
  );
}
export function listDocuments(
  dataSourceId: string,
  documentType: 'index' | 'table_schema' | null = 'table_schema',
  limit = 500,
): Promise<S['KnowledgeDocumentSummary'][]> {
  return withAuthRefresh(() =>
    apiClient.GET('/api/v1/knowledge/data-sources/{data_source_id}/documents', {
      params: {
        path: { data_source_id: dataSourceId },
        query: { document_type: documentType, limit },
      },
    }),
  );
}
export function getDocument(
  dataSourceId: string,
  documentId: string,
): Promise<S['KnowledgeDocumentResponse']> {
  return withAuthRefresh(() =>
    apiClient.GET('/api/v1/knowledge/data-sources/{data_source_id}/documents/{document_id}', {
      params: { path: { data_source_id: dataSourceId, document_id: documentId } },
    }),
  );
}
export function getTableDocument(
  dataSourceId: string,
  key: string,
): Promise<S['KnowledgeDocumentResponse']> {
  return withAuthRefresh(() =>
    apiClient.GET('/api/v1/knowledge/data-sources/{data_source_id}/table', {
      params: { path: { data_source_id: dataSourceId }, query: { key } },
    }),
  );
}
export function listAnnotations(dataSourceId: string): Promise<S['KnowledgeAnnotationResponse'][]> {
  return withAuthRefresh(() =>
    apiClient.GET('/api/v1/knowledge/data-sources/{data_source_id}/annotations', {
      params: { path: { data_source_id: dataSourceId }, query: {} },
    }),
  );
}
export function createAnnotation(
  dataSourceId: string,
  body: S['KnowledgeAnnotationCreate'],
): Promise<S['KnowledgeAnnotationResponse']> {
  return withAuthRefresh(() =>
    apiClient.POST('/api/v1/knowledge/data-sources/{data_source_id}/annotations', {
      params: { path: { data_source_id: dataSourceId } },
      body,
    }),
  );
}
export function updateAnnotation(
  annotationId: string,
  body: S['KnowledgeAnnotationUpdate'],
): Promise<S['KnowledgeAnnotationResponse']> {
  return withAuthRefresh(() =>
    apiClient.PATCH('/api/v1/knowledge/annotations/{annotation_id}', {
      params: { path: { annotation_id: annotationId } },
      body,
    }),
  );
}
export function deleteAnnotation(annotationId: string): Promise<void> {
  return withAuthRefresh(() =>
    apiClient.DELETE('/api/v1/knowledge/annotations/{annotation_id}', {
      params: { path: { annotation_id: annotationId } },
    }),
  ) as Promise<void>;
}
export function getCompactSchema(dataSourceId: string): Promise<S['CompactSchemaResponse']> {
  return withAuthRefresh(() =>
    apiClient.GET('/api/v1/knowledge/data-sources/{data_source_id}/schema-compact', {
      params: { path: { data_source_id: dataSourceId } },
    }),
  );
}
export type ImportOptions = { onDuplicate: 'skip' | 'replace'; dryRun: boolean };
/** Sends Markdown notes (front matter: title, scope, key). A dry run only reports what would happen. */
export function importAnnotations(
  dataSourceId: string,
  files: File[],
  options: ImportOptions,
): Promise<S['KnowledgeImportResponse']> {
  const serialize = () => {
    const form = new FormData();
    for (const file of files) form.append('files', file, file.name);
    return form;
  };
  return withAuthRefresh(() =>
    apiClient.POST('/api/v1/knowledge/data-sources/{data_source_id}/annotations/import', {
      params: {
        path: { data_source_id: dataSourceId },
        query: { on_duplicate: options.onDuplicate, dry_run: options.dryRun },
      },
      body: { files: files as unknown as string[] },
      bodySerializer: serialize,
    }),
  );
}
/** A ZIP with one Markdown file per note, in the format the import reads. */
export function exportAnnotations(dataSourceId: string): Promise<Blob> {
  return withAuthRefresh(() =>
    apiClient.GET('/api/v1/knowledge/data-sources/{data_source_id}/annotations/export', {
      params: { path: { data_source_id: dataSourceId } },
      parseAs: 'blob',
    }),
  ) as Promise<Blob>;
}
