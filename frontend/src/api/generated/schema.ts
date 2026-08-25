/**
 * AUTO-GENERATED OFFLINE FALLBACK from src/api/generated/openapi.json.
 * Normal development should regenerate this file with `npm run api:generate`
 * using pinned openapi-typescript@7.13.0.
 */
export interface components {
  schemas: {
    "AuditLogResponse": { "action": string; "created_at": string; "id": number; "metadata": Record<string, unknown>; "organization_id": string; "resource_id": (string) | (null); "resource_type": string; "user_id": (string) | (null); };
    "Body_create_excel_data_source_api_v1_data_sources_excel_post": { "file": string; "name": string; };
    "Body_replace_excel_data_source_api_v1_data_sources__data_source_id__excel_replace_post": { "file": string; };
    "ColumnMetadataResponse": { "default": (string) | (null); "name": string; "native_type": string; "nullable": (boolean) | (null); };
    "ConversationCreate": { "data_source_ids": Array<string>; "model_profile_id"?: (string) | (null); "title"?: (string) | (null); };
    "ConversationDetailResponse": { "created_at": string; "created_by": string; "data_source_ids"?: Array<string>; "id": string; "messages"?: Array<components["schemas"]["MessageResponse"]>; "model_profile_id": (string) | (null); "organization_id": string; "title": (string) | (null); "updated_at": string; };
    "ConversationResponse": { "created_at": string; "created_by": string; "data_source_ids"?: Array<string>; "id": string; "model_profile_id": (string) | (null); "organization_id": string; "title": (string) | (null); "updated_at": string; };
    "DashboardCreate": { "description"?: (string) | (null); "title": string; };
    "DashboardDetailResponse": { "created_at": string; "created_by": string; "description": (string) | (null); "id": string; "organization_id": string; "title": string; "updated_at": string; "widget_count"?: number; "widgets"?: Array<components["schemas"]["DashboardWidgetResponse"]>; };
    "DashboardRefreshResponse": { "job_id": string; };
    "DashboardResponse": { "created_at": string; "created_by": string; "description": (string) | (null); "id": string; "organization_id": string; "title": string; "updated_at": string; "widget_count"?: number; };
    "DashboardUpdate": { "description"?: (string) | (null); "title"?: (string) | (null); };
    "DashboardWidgetCreate": { "layout_config"?: Record<string, unknown>; "source_job_id": string; "source_sql_execution_id": string; "title"?: (string) | (null); "visualization_config"?: Record<string, unknown>; "widget_type": "metric" | "table" | "bar" | "line" | "area" | "pie"; };
    "DashboardWidgetResponse": { "created_at": string; "created_from_job_id": (string) | (null); "created_from_sql_execution_id": (string) | (null); "dashboard_id": string; "data_source_id": string; "enabled": boolean; "id": string; "last_refresh_job_id": (string) | (null); "last_refreshed_at": (string) | (null); "latest_artifact"?: (Record<string, unknown>) | (null); "layout_config": Record<string, unknown>; "question": (string) | (null); "sql_text": string; "title": string; "updated_at": string; "visualization_config": Record<string, unknown>; "widget_type": string; };
    "DashboardWidgetUpdate": { "enabled"?: (boolean) | (null); "layout_config"?: (Record<string, unknown>) | (null); "title"?: (string) | (null); "visualization_config"?: (Record<string, unknown>) | (null); };
    "DataSourceFileResponse": { "created_at": string; "error_code": (string) | (null); "id": string; "is_active": boolean; "original_filename": string; "sha256": string; "sheet_mapping": Array<Record<string, unknown>>; "size_bytes": number; "status": string; "updated_at": string; };
    "DataSourceResponse": { "active_file"?: (components["schemas"]["DataSourceFileResponse"]) | (null); "config": Record<string, unknown>; "created_at": string; "created_by": string; "display_type": string; "id": string; "kind": string; "last_error_code": (string) | (null); "last_tested_at": (string) | (null); "name": string; "organization_id": string; "status": string; "updated_at": string; };
    "DataSourceUpdate": { "config"?: (Record<string, unknown>) | (null); "credentials"?: (components["schemas"]["DatabaseCredentials"]) | (null); "name"?: (string) | (null); "status"?: ("active" | "disabled") | (null); };
    "DatabaseCredentials": { "password": string; "username": string; };
    "ExcelUploadResponse": { "data_source": components["schemas"]["DataSourceResponse"]; "job_id": string; };
    "ForeignKeyMetadataResponse": { "constrained_columns": Array<string>; "referred_columns": Array<string>; "referred_schema": (string) | (null); "referred_table": string; };
    "ForgotPasswordRequest": { "email": string; };
    "HTTPValidationError": { "detail"?: Array<components["schemas"]["ValidationError"]>; };
    "JobAcceptedResponse": { "job_id": string; };
    "JobArtifactResponse": { "created_at": string; "id": string; "job_id": string; "kind": string; "name": (string) | (null); "payload": Record<string, unknown>; "source_sql_execution_id": (string) | (null); };
    "JobExecutionTraceResponse": { "artifacts"?: Array<components["schemas"]["JobArtifactResponse"]>; "models"?: Array<components["schemas"]["ModelExecutionResponse"]>; "sql"?: Array<components["schemas"]["SQLExecutionResponse"]>; "tools"?: Array<components["schemas"]["ToolExecutionResponse"]>; };
    "JobResponse": { "attempt_count": number; "cancel_requested_at": (string) | (null); "conversation_id": (string) | (null); "created_at": string; "error_code": (string) | (null); "error_message": (string) | (null); "finished_at": (string) | (null); "id": string; "input": Record<string, unknown>; "job_type": string; "max_attempts": number; "organization_id": string; "requested_by": string; "result": (Record<string, unknown>) | (null); "started_at": (string) | (null); "status": string; };
    "KnowledgeAnnotationCreate": { "content": string; "scope_key"?: (string) | (null); "scope_type": "datasource" | "table" | "column" | "metric"; };
    "KnowledgeAnnotationResponse": { "content": string; "created_at": string; "created_by": string; "id": string; "knowledge_base_id": string; "scope_key": (string) | (null); "scope_type": string; "updated_at": string; };
    "KnowledgeAnnotationUpdate": { "content": string; };
    "KnowledgeDocumentResponse": { "content_markdown": string; "created_at": string; "document_key": string; "document_type": string; "estimated_tokens": number; "id": string; "metadata": Record<string, unknown>; "title": string; };
    "KnowledgeDocumentSummary": { "created_at": string; "document_key": string; "document_type": string; "estimated_tokens": number; "id": string; "metadata": Record<string, unknown>; "title": string; };
    "KnowledgeJobResponse": { "job_id": string; "knowledge_base_id": string; };
    "KnowledgeStatusResponse": { "current_version_id": (string) | (null); "current_version_number": (number) | (null); "data_source_id": string; "generated_at": (string) | (null); "knowledge_base_id": (string) | (null); "last_error_code": (string) | (null); "object_count": (number) | (null); "schema_fingerprint": (string) | (null); "status": string; };
    "KnowledgeVersionResponse": { "created_at": string; "generated_by_job_id": (string) | (null); "id": string; "knowledge_base_id": string; "schema_fingerprint": string; "version_number": number; };
    "LoginRequest": { "email": string; "password": string; };
    "LogoutRequest": { "refresh_token": string; };
    "MSSQLConfig": { "database": string; "encrypt"?: boolean; "host": string; "odbc_driver"?: string; "port"?: number; "schema_name"?: string; "trust_server_certificate"?: boolean; };
    "MSSQLDataSourceCreate": { "config": components["schemas"]["MSSQLConfig"]; "credentials": components["schemas"]["DatabaseCredentials"]; "kind": "mssql"; "name": string; };
    "MessageAcceptedResponse": { "job_id": string; "message_id": string; };
    "MessageCreate": { "content": string; "model_profile_id"?: (string) | (null); };
    "MessageResponse": { "content": string; "conversation_id": string; "created_at": string; "id": string; "job_id": (string) | (null); "metadata": Record<string, unknown>; "role": string; };
    "ModelConnectionCreate": { "api_key"?: (string) | (null); "base_url": string; "name": string; };
    "ModelConnectionResponse": { "base_url": string; "created_at": string; "created_by": string; "has_api_key"?: boolean; "id": string; "last_error_code": (string) | (null); "last_tested_at": (string) | (null); "name": string; "organization_id": string; "status": string; "updated_at": string; };
    "ModelConnectionTestResponse": { "model_count": number; "ok": boolean; "sample_models": Array<string>; "tested_at": string; };
    "ModelConnectionUpdate": { "api_key"?: (string) | (null); "base_url"?: (string) | (null); "clear_api_key"?: boolean; "name"?: (string) | (null); "status"?: (string) | (null); };
    "ModelExecutionResponse": { "error_code": (string) | (null); "error_message": (string) | (null); "finished_at": (string) | (null); "id": string; "input_tokens": (number) | (null); "job_id": string; "model_name": string; "model_profile_id": string; "output_tokens": (number) | (null); "phase": string; "sequence": number; "started_at": string; "status": string; "total_tokens": (number) | (null); };
    "ModelProfileCreate": { "connection_id": string; "display_name": string; "enabled"?: boolean; "is_default"?: boolean; "model_name": string; "settings"?: Record<string, unknown>; };
    "ModelProfileResponse": { "connection_id": string; "created_at": string; "display_name": string; "enabled": boolean; "id": string; "is_default": boolean; "model_name": string; "organization_id": string; "settings": Record<string, unknown>; "updated_at": string; };
    "ModelProfileUpdate": { "connection_id"?: (string) | (null); "display_name"?: (string) | (null); "enabled"?: (boolean) | (null); "model_name"?: (string) | (null); "settings"?: (Record<string, unknown>) | (null); };
    "MySQLConfig": { "database": string; "host": string; "port"?: number; "ssl"?: boolean; };
    "MySQLDataSourceCreate": { "config": components["schemas"]["MySQLConfig"]; "credentials": components["schemas"]["DatabaseCredentials"]; "kind": "mysql"; "name": string; };
    "OrganizationResponse": { "created_at": string; "created_by": string; "id": string; "name": string; "role"?: (string) | (null); "slug": string; "updated_at": string; };
    "OrganizationUpdateRequest": { "name": string; };
    "PostgresConfig": { "database": string; "host": string; "port"?: number; "schema_name"?: string; "ssl_mode"?: "disable" | "prefer" | "require" | "verify-ca" | "verify-full"; };
    "PostgresDataSourceCreate": { "config": components["schemas"]["PostgresConfig"]; "credentials": components["schemas"]["DatabaseCredentials"]; "kind": "postgres"; "name": string; };
    "RefreshRequest": { "refresh_token": string; };
    "ResetPasswordRequest": { "new_password": string; "token": string; };
    "SQLExecutionResponse": { "columns": (Array<string>) | (null); "data_source_id": string; "duration_ms": (number) | (null); "error_code": (string) | (null); "error_message": (string) | (null); "finished_at": (string) | (null); "id": string; "result_bytes": (number) | (null); "row_count": (number) | (null); "sql_text": string; "started_at": string; "status": string; "tool_execution_id": string; "truncated": boolean; };
    "SchemaMetadataResponse": { "tables": Array<components["schemas"]["TableMetadataResponse"]>; };
    "SignupRequest": { "display_name"?: (string) | (null); "email": string; "organization_name"?: (string) | (null); "password": string; };
    "TableMetadataResponse": { "columns": Array<components["schemas"]["ColumnMetadataResponse"]>; "foreign_keys": Array<components["schemas"]["ForeignKeyMetadataResponse"]>; "name": string; "object_type": string; "primary_key": Array<string>; "schema": (string) | (null); };
    "TokenResponse": { "access_token": string; "expires_in": number; "refresh_token": string; "token_type"?: string; };
    "ToolExecutionResponse": { "error_code": (string) | (null); "error_message": (string) | (null); "finished_at": (string) | (null); "id": string; "input_summary": Record<string, unknown>; "job_id": string; "output_summary": (Record<string, unknown>) | (null); "sequence": number; "started_at": string; "status": string; "tool_name": string; };
    "UserResponse": { "created_at": string; "display_name": (string) | (null); "email": string; "email_verified_at": (string) | (null); "id": string; "is_active": boolean; "updated_at": string; };
    "ValidationError": { "ctx"?: Record<string, unknown>; "input"?: unknown; "loc": Array<(string) | (number)>; "msg": string; "type": string; };
    "app__auth__schemas__MessageResponse": { "message": string; };
  };
}

export interface paths {
  "/api/v1/audit": {
    get: { parameters: { "query"?: { "limit"?: number; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": Array<components["schemas"]["AuditLogResponse"]>; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/auth/forgot-password": {
    post: { requestBody: { content: { "application/json": components["schemas"]["ForgotPasswordRequest"]; } }; responses: { "200": { content: { "application/json": components["schemas"]["app__auth__schemas__MessageResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/auth/login": {
    post: { requestBody: { content: { "application/json": components["schemas"]["LoginRequest"]; } }; responses: { "200": { content: { "application/json": components["schemas"]["TokenResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/auth/logout": {
    post: { requestBody: { content: { "application/json": components["schemas"]["LogoutRequest"]; } }; responses: { "200": { content: { "application/json": components["schemas"]["app__auth__schemas__MessageResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/auth/me": {
    get: { responses: { "200": { content: { "application/json": components["schemas"]["UserResponse"]; } }; }; };
  };
  "/api/v1/auth/refresh": {
    post: { requestBody: { content: { "application/json": components["schemas"]["RefreshRequest"]; } }; responses: { "200": { content: { "application/json": components["schemas"]["TokenResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/auth/reset-password": {
    post: { requestBody: { content: { "application/json": components["schemas"]["ResetPasswordRequest"]; } }; responses: { "200": { content: { "application/json": components["schemas"]["app__auth__schemas__MessageResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/auth/signup": {
    post: { requestBody: { content: { "application/json": components["schemas"]["SignupRequest"]; } }; responses: { "201": { content: { "application/json": components["schemas"]["TokenResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/conversations": {
    get: { parameters: { "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": Array<components["schemas"]["ConversationResponse"]>; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    post: { parameters: { "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "application/json": components["schemas"]["ConversationCreate"]; } }; responses: { "201": { content: { "application/json": components["schemas"]["ConversationResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/conversations/{conversation_id}": {
    get: { parameters: { "path": { "conversation_id": string; }; "query"?: { "message_limit"?: number; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["ConversationDetailResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/conversations/{conversation_id}/messages": {
    get: { parameters: { "path": { "conversation_id": string; }; "query"?: { "limit"?: number; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": Array<components["schemas"]["MessageResponse"]>; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    post: { parameters: { "path": { "conversation_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "application/json": components["schemas"]["MessageCreate"]; } }; responses: { "202": { content: { "application/json": components["schemas"]["MessageAcceptedResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/dashboards": {
    get: { parameters: { "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": Array<components["schemas"]["DashboardResponse"]>; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    post: { parameters: { "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "application/json": components["schemas"]["DashboardCreate"]; } }; responses: { "201": { content: { "application/json": components["schemas"]["DashboardResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/dashboards/widgets/{widget_id}": {
    delete: { parameters: { "path": { "widget_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "204": { content?: never }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    patch: { parameters: { "path": { "widget_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "application/json": components["schemas"]["DashboardWidgetUpdate"]; } }; responses: { "200": { content: { "application/json": components["schemas"]["DashboardWidgetResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/dashboards/widgets/{widget_id}/refresh": {
    post: { parameters: { "path": { "widget_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "202": { content: { "application/json": components["schemas"]["DashboardRefreshResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/dashboards/{dashboard_id}": {
    delete: { parameters: { "path": { "dashboard_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "204": { content?: never }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    get: { parameters: { "path": { "dashboard_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["DashboardDetailResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    patch: { parameters: { "path": { "dashboard_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "application/json": components["schemas"]["DashboardUpdate"]; } }; responses: { "200": { content: { "application/json": components["schemas"]["DashboardResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/dashboards/{dashboard_id}/refresh": {
    post: { parameters: { "path": { "dashboard_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "202": { content: { "application/json": components["schemas"]["DashboardRefreshResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/dashboards/{dashboard_id}/widgets": {
    post: { parameters: { "path": { "dashboard_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "application/json": components["schemas"]["DashboardWidgetCreate"]; } }; responses: { "201": { content: { "application/json": components["schemas"]["DashboardWidgetResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/data-sources": {
    get: { parameters: { "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": Array<components["schemas"]["DataSourceResponse"]>; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    post: { parameters: { "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "application/json": (components["schemas"]["PostgresDataSourceCreate"]) | (components["schemas"]["MySQLDataSourceCreate"]) | (components["schemas"]["MSSQLDataSourceCreate"]); } }; responses: { "201": { content: { "application/json": components["schemas"]["DataSourceResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/data-sources/excel": {
    post: { parameters: { "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "multipart/form-data": components["schemas"]["Body_create_excel_data_source_api_v1_data_sources_excel_post"]; } }; responses: { "202": { content: { "application/json": components["schemas"]["ExcelUploadResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/data-sources/{data_source_id}": {
    delete: { parameters: { "path": { "data_source_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "204": { content?: never }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    get: { parameters: { "path": { "data_source_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["DataSourceResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    patch: { parameters: { "path": { "data_source_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "application/json": components["schemas"]["DataSourceUpdate"]; } }; responses: { "200": { content: { "application/json": components["schemas"]["DataSourceResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/data-sources/{data_source_id}/excel/replace": {
    post: { parameters: { "path": { "data_source_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "multipart/form-data": components["schemas"]["Body_replace_excel_data_source_api_v1_data_sources__data_source_id__excel_replace_post"]; } }; responses: { "202": { content: { "application/json": components["schemas"]["JobAcceptedResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/data-sources/{data_source_id}/schema": {
    get: { parameters: { "path": { "data_source_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["SchemaMetadataResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/data-sources/{data_source_id}/test": {
    post: { parameters: { "path": { "data_source_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "202": { content: { "application/json": components["schemas"]["JobAcceptedResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/jobs": {
    get: { parameters: { "query"?: { "status"?: (string) | (null); "limit"?: number; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": Array<components["schemas"]["JobResponse"]>; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/jobs/{job_id}": {
    get: { parameters: { "path": { "job_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["JobResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/jobs/{job_id}/cancel": {
    post: { parameters: { "path": { "job_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["JobResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/jobs/{job_id}/events": {
    get: { parameters: { "path": { "job_id": string; }; "query"?: { "after_sequence"?: number; }; "header"?: { "Last-Event-ID"?: (string) | (null); "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": unknown; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/jobs/{job_id}/execution": {
    get: { parameters: { "path": { "job_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["JobExecutionTraceResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/knowledge/annotations/{annotation_id}": {
    delete: { parameters: { "path": { "annotation_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "204": { content?: never }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    patch: { parameters: { "path": { "annotation_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "application/json": components["schemas"]["KnowledgeAnnotationUpdate"]; } }; responses: { "200": { content: { "application/json": components["schemas"]["KnowledgeAnnotationResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/knowledge/data-sources/{data_source_id}": {
    get: { parameters: { "path": { "data_source_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["KnowledgeStatusResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/knowledge/data-sources/{data_source_id}/annotations": {
    get: { parameters: { "path": { "data_source_id": string; }; "query"?: { "scope_type"?: ("datasource" | "table" | "column" | "metric") | (null); "scope_key"?: (string) | (null); }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": Array<components["schemas"]["KnowledgeAnnotationResponse"]>; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    post: { parameters: { "path": { "data_source_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "application/json": components["schemas"]["KnowledgeAnnotationCreate"]; } }; responses: { "201": { content: { "application/json": components["schemas"]["KnowledgeAnnotationResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/knowledge/data-sources/{data_source_id}/documents": {
    get: { parameters: { "path": { "data_source_id": string; }; "query"?: { "document_type"?: ("index" | "table_schema") | (null); "limit"?: number; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": Array<components["schemas"]["KnowledgeDocumentSummary"]>; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/knowledge/data-sources/{data_source_id}/documents/{document_id}": {
    get: { parameters: { "path": { "data_source_id": string; "document_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["KnowledgeDocumentResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/knowledge/data-sources/{data_source_id}/generate": {
    post: { parameters: { "path": { "data_source_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "202": { content: { "application/json": components["schemas"]["KnowledgeJobResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/knowledge/data-sources/{data_source_id}/index": {
    get: { parameters: { "path": { "data_source_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["KnowledgeDocumentResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/knowledge/data-sources/{data_source_id}/table": {
    get: { parameters: { "path": { "data_source_id": string; }; "query": { "key": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["KnowledgeDocumentResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/knowledge/data-sources/{data_source_id}/versions": {
    get: { parameters: { "path": { "data_source_id": string; }; "query"?: { "limit"?: number; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": Array<components["schemas"]["KnowledgeVersionResponse"]>; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/models/connections": {
    get: { parameters: { "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": Array<components["schemas"]["ModelConnectionResponse"]>; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    post: { parameters: { "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "application/json": components["schemas"]["ModelConnectionCreate"]; } }; responses: { "201": { content: { "application/json": components["schemas"]["ModelConnectionResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/models/connections/{connection_id}": {
    delete: { parameters: { "path": { "connection_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "204": { content?: never }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    get: { parameters: { "path": { "connection_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["ModelConnectionResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    patch: { parameters: { "path": { "connection_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "application/json": components["schemas"]["ModelConnectionUpdate"]; } }; responses: { "200": { content: { "application/json": components["schemas"]["ModelConnectionResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/models/connections/{connection_id}/test": {
    post: { parameters: { "path": { "connection_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["ModelConnectionTestResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/models/profiles": {
    get: { parameters: { "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": Array<components["schemas"]["ModelProfileResponse"]>; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    post: { parameters: { "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "application/json": components["schemas"]["ModelProfileCreate"]; } }; responses: { "201": { content: { "application/json": components["schemas"]["ModelProfileResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/models/profiles/default": {
    get: { parameters: { "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": (components["schemas"]["ModelProfileResponse"]) | (null); } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/models/profiles/{profile_id}": {
    delete: { parameters: { "path": { "profile_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "204": { content?: never }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    get: { parameters: { "path": { "profile_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["ModelProfileResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
    patch: { parameters: { "path": { "profile_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "application/json": components["schemas"]["ModelProfileUpdate"]; } }; responses: { "200": { content: { "application/json": components["schemas"]["ModelProfileResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/models/profiles/{profile_id}/default": {
    post: { parameters: { "path": { "profile_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["ModelProfileResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/ops/status": {
    get: { parameters: { "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": Record<string, unknown>; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/organizations": {
    get: { responses: { "200": { content: { "application/json": Array<components["schemas"]["OrganizationResponse"]>; } }; }; };
  };
  "/api/v1/organizations/current": {
    get: { parameters: { "header"?: { "X-Organization-ID"?: (string) | (null); }; }; responses: { "200": { content: { "application/json": components["schemas"]["OrganizationResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/api/v1/organizations/{organization_id}": {
    patch: { parameters: { "path": { "organization_id": string; }; "header"?: { "X-Organization-ID"?: (string) | (null); }; }; requestBody: { content: { "application/json": components["schemas"]["OrganizationUpdateRequest"]; } }; responses: { "200": { content: { "application/json": components["schemas"]["OrganizationResponse"]; } }; "422": { content: { "application/json": components["schemas"]["HTTPValidationError"]; } }; }; };
  };
  "/health": {
    get: { responses: { "200": { content: { "application/json": Record<string, string>; } }; }; };
  };
  "/ready": {
    get: { responses: { "200": { content: { "application/json": unknown; } }; }; };
  };
}
