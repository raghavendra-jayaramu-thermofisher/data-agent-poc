import type { components } from './generated/schema';
export type ApiSchemas = components['schemas'];
export type Job = ApiSchemas['JobResponse'];
export type DataSource = ApiSchemas['DataSourceResponse'];
export type ModelConnection = ApiSchemas['ModelConnectionResponse'];
export type ModelProfile = ApiSchemas['ModelProfileResponse'];
export type KnowledgeStatus = ApiSchemas['KnowledgeStatusResponse'];
