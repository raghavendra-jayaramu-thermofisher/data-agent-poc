import { apiClient, withAuthRefresh } from '../../api/client';
import type { components } from '../../api/generated/schema';
import type { DataSource } from '../../api/types';
type Schemas = components['schemas'];
export type RelationalDataSourceCreate = Schemas['PostgresDataSourceCreate'] | Schemas['MySQLDataSourceCreate'] | Schemas['MSSQLDataSourceCreate'];
export type DataSourceUpdate = Schemas['DataSourceUpdate'];
export type SchemaMetadata = Schemas['SchemaMetadataResponse'];
export function listDataSources(): Promise<DataSource[]> {
    return withAuthRefresh(() => apiClient.GET('/api/v1/data-sources'));
}
export function getDataSource(id: string): Promise<DataSource> {
    return withAuthRefresh(() => apiClient.GET('/api/v1/data-sources/{data_source_id}', { params: { path: { data_source_id: id } } }));
}
export function createRelationalDataSource(body: RelationalDataSourceCreate): Promise<DataSource> {
    return withAuthRefresh(() => apiClient.POST('/api/v1/data-sources', { body }));
}
export function updateDataSource(id: string, body: DataSourceUpdate): Promise<DataSource> {
    return withAuthRefresh(() => apiClient.PATCH('/api/v1/data-sources/{data_source_id}', { params: { path: { data_source_id: id } }, body }));
}
export function deleteDataSource(id: string): Promise<void> {
    return withAuthRefresh(() => apiClient.DELETE('/api/v1/data-sources/{data_source_id}', { params: { path: { data_source_id: id } } })) as Promise<void>;
}
export function testDataSource(id: string): Promise<Schemas['JobAcceptedResponse']> {
    return withAuthRefresh(() => apiClient.POST('/api/v1/data-sources/{data_source_id}/test', { params: { path: { data_source_id: id } } }));
}
export function getDataSourceSchema(id: string): Promise<SchemaMetadata> {
    return withAuthRefresh(() => apiClient.GET('/api/v1/data-sources/{data_source_id}/schema', { params: { path: { data_source_id: id } } }));
}
function multipart(values: Record<string, string | Blob>): FormData {
    const form = new FormData();
    for (const [key, value] of Object.entries(values))
        form.append(key, value);
    return form;
}
export function createExcelDataSource(name: string, file: File): Promise<Schemas['ExcelUploadResponse']> {
    return withAuthRefresh(() => apiClient.POST('/api/v1/data-sources/excel', {
        body: { name, file: file as unknown as string },
        bodySerializer: () => multipart({ name, file }),
    }));
}
export function replaceExcelDataSource(id: string, file: File): Promise<Schemas['JobAcceptedResponse']> {
    return withAuthRefresh(() => apiClient.POST('/api/v1/data-sources/{data_source_id}/excel/replace', {
        params: { path: { data_source_id: id } },
        body: { file: file as unknown as string },
        bodySerializer: () => multipart({ file }),
    }));
}
