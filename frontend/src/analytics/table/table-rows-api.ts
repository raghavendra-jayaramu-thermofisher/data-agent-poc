import { apiClient, withAuthRefresh } from '../../api/client';
import type { components } from '../../api/generated/schema';
import type { TablePaging } from './table-domain';

export type TableRowsPage = components['schemas']['TableRowsPage'];
export type TableQuery = { sort: string | null; descending: boolean; search: string };

export const TABLE_PAGE_SIZE = 200;

export function listTableRows(
  paging: TablePaging,
  query: TableQuery,
  cursor: string | null,
  limit = TABLE_PAGE_SIZE,
  signal?: AbortSignal,
): Promise<TableRowsPage> {
  return withAuthRefresh(() =>
    apiClient.GET('/api/v1/jobs/{job_id}/artifacts/{artifact_id}/rows', {
      params: {
        path: { job_id: paging.jobId, artifact_id: paging.artifactId },
        query: {
          sort: query.sort ?? undefined,
          descending: query.descending || undefined,
          search: query.search || undefined,
          cursor,
          limit,
        },
      },
      signal,
    }),
  );
}

/** Builds the workbook on the server from every stored row in the viewer's sort and search. */
export function exportTableRows(
  paging: TablePaging,
  query: TableQuery,
  title: string,
  headers: string[],
): Promise<Blob> {
  return withAuthRefresh(() =>
    apiClient.POST('/api/v1/jobs/{job_id}/artifacts/{artifact_id}/table/excel', {
      params: { path: { job_id: paging.jobId, artifact_id: paging.artifactId } },
      body: { title: title.slice(0, 240), headers, ...query },
      parseAs: 'blob',
    }),
  );
}
