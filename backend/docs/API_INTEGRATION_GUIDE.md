# DB Assistant Backend — API Integration Guide

This document is the frontend/API contract guide for the current backend implementation (`0.6.0`). It covers authentication, organization scoping, asynchronous jobs/SSE, datasource/model/knowledge flows, conversations, execution traces, dashboards, audit APIs, and recommended frontend integration patterns.

## 1. API basics

Default local base URL:

```text
http://localhost:12201
```

Versioned application API prefix:

```text
/api/v1
```

Default FastAPI contract endpoints:

```text
Swagger UI:   /docs
OpenAPI JSON: /openapi.json
```

The frontend should generate/derive API types from `/openapi.json` rather than maintain a second handwritten DTO system.

## 2. Headers

### 2.1 Authentication

Authenticated endpoints use an access JWT:

```http
Authorization: Bearer <access_token>
```

The current backend returns access and refresh tokens in JSON. It does not use an HTTP-only refresh cookie.

### 2.2 Organization/workspace selection

Most application resources are organization-scoped. When a user belongs to multiple organizations, send:

```http
X-Organization-ID: <organization UUID>
```

If this header is omitted, the backend resolves the user's first membership. A frontend with workspace switching should therefore send `X-Organization-ID` consistently after the active workspace is known.

Invalid or inaccessible organization IDs are rejected rather than used to access resources by UUID alone.

### 2.3 JSON requests

For normal JSON endpoints:

```http
Content-Type: application/json
```

Excel upload/replacement uses `multipart/form-data`; do not manually set the multipart boundary in browser code.

## 3. Authentication lifecycle

### 3.1 Signup

```http
POST /api/v1/auth/signup
```

Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPass123",
  "display_name": "Alex",
  "organization_name": "Acme"
}
```

Password rules:

- 10–256 characters;
- at least one uppercase letter;
- at least one lowercase letter;
- at least one digit.

Response: `201 Created`

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 900
}
```

Signup also creates the user's initial organization/workspace.

### 3.2 Login

```http
POST /api/v1/auth/login
```

```json
{
  "email": "user@example.com",
  "password": "StrongPass123"
}
```

Returns the same `TokenResponse` shape as signup.

### 3.3 Refresh-token rotation

```http
POST /api/v1/auth/refresh
```

```json
{
  "refresh_token": "<current refresh token>"
}
```

A successful refresh returns a new access token **and a new refresh token**. Replace the stored token pair atomically. Do not continue using the old refresh token.

Recommended frontend behavior:

```text
API call -> 401
  -> if a refresh token exists, perform one serialized refresh request
  -> replace access + refresh tokens
  -> retry the original safe request once
  -> if refresh fails, clear auth state and route to login
```

Avoid triggering multiple parallel refresh rotations from concurrent 401 responses. Use a single refresh promise/mutex in the API client.

### 3.4 Logout

```http
POST /api/v1/auth/logout
```

```json
{
  "refresh_token": "<current refresh token>"
}
```

Clear local authentication state after successful logout. Also clear it if the server says the session is no longer usable.

### 3.5 Current user

```http
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

Response:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "Alex",
  "is_active": true,
  "email_verified_at": null,
  "created_at": "2026-08-24T...+00:00",
  "updated_at": "2026-08-24T...+00:00"
}
```

### 3.6 Forgot/reset password

```text
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

Forgot password:

```json
{
  "email": "user@example.com"
}
```

The response intentionally does not reveal whether the account exists.

Reset password:

```json
{
  "token": "<reset token>",
  "new_password": "NewStrongPass123"
}
```

The new password uses the same complexity rules as signup.

## 4. Standard error contract

Application errors use one envelope:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password."
  }
}
```

Validation errors use the same envelope and may include field errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "field_errors": {
      "email": "value is not a valid email address",
      "password": "String should have at least 10 characters"
    }
  }
}
```

Recommended normalized frontend type:

```ts
type AppError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
};
```

Do not display raw transport errors or assume every non-2xx response has provider/database details. The backend intentionally sanitizes unexpected errors.

Common HTTP meanings:

| Status | Meaning |
|---:|---|
| `400` | Invalid request/business rule |
| `401` | Missing/invalid/expired access authentication |
| `403` | Authenticated but role does not permit action |
| `404` | Resource not found in active organization, including cross-org isolation |
| `409` | State conflict, duplicate/in-progress/disabled condition |
| `422` | Pydantic request validation failure |
| `500` | Sanitized internal error |
| `502` | Upstream/datasource operation failure in endpoints that execute directly |
| `503` | Readiness dependency unavailable |

## 5. Organization and role model

Roles currently used by the backend:

```text
owner
admin
member
```

### Role-sensitive APIs

Owner/admin required for:

- organization rename;
- relational datasource create/update/delete/test;
- Excel datasource create/replace/delete;
- model connection/profile mutation and connection testing;
- knowledge generation;
- knowledge annotation create/update/delete;
- audit log access;
- operational status access.

Normal organization members can read organization-scoped resources, create/use conversations, inspect jobs/execution traces, and use dashboard APIs as currently implemented.

**Current backend behavior:** job cancellation is organization-scoped but is not restricted to the original requester. If the product UI should limit who sees a Cancel button, enforce the desired UX rule in the frontend and consider a future backend authorization refinement.

### Organizations endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/organizations` | List organizations for current user, including `role` |
| `GET` | `/api/v1/organizations/current` | Resolve active organization (`X-Organization-ID` aware) |
| `PATCH` | `/api/v1/organizations/{organization_id}` | Rename organization; owner/admin |

Rename request:

```json
{
  "name": "Acme Analytics"
}
```

## 6. Endpoint index

All paths below are relative to the API host.

### Health

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | No | API process liveness |
| `GET` | `/ready` | No | PostgreSQL + Redis readiness |

### Authentication

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/auth/signup` | No | Signup + initial organization + tokens |
| `POST` | `/api/v1/auth/login` | No | Login |
| `POST` | `/api/v1/auth/refresh` | No access JWT | Rotate refresh token and issue token pair |
| `POST` | `/api/v1/auth/logout` | No access JWT required | Revoke refresh session |
| `POST` | `/api/v1/auth/forgot-password` | No | Request reset instructions |
| `POST` | `/api/v1/auth/reset-password` | No | Reset password with action token |
| `GET` | `/api/v1/auth/me` | Bearer | Current user |

### Organizations

| Method | Path | Role |
|---|---|---|
| `GET` | `/api/v1/organizations` | authenticated |
| `GET` | `/api/v1/organizations/current` | member |
| `PATCH` | `/api/v1/organizations/{organization_id}` | owner/admin |

### Data sources

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/api/v1/data-sources` | member | List |
| `POST` | `/api/v1/data-sources` | owner/admin | Create PostgreSQL/MySQL/MSSQL |
| `POST` | `/api/v1/data-sources/excel` | owner/admin | Multipart upload, returns `202` + materialization job |
| `GET` | `/api/v1/data-sources/{data_source_id}` | member | Details, no stored password |
| `PATCH` | `/api/v1/data-sources/{data_source_id}` | owner/admin | Name/config/credential/status update |
| `DELETE` | `/api/v1/data-sources/{data_source_id}` | owner/admin | Delete and managed-file cleanup |
| `POST` | `/api/v1/data-sources/{data_source_id}/test` | owner/admin | Async datasource-test job |
| `GET` | `/api/v1/data-sources/{data_source_id}/schema` | member | Immediate schema introspection |
| `POST` | `/api/v1/data-sources/{data_source_id}/excel/replace` | owner/admin | Multipart safe replacement; async job |

### Model configuration

| Method | Path | Role |
|---|---|---|
| `GET` | `/api/v1/models/connections` | member |
| `POST` | `/api/v1/models/connections` | owner/admin |
| `GET` | `/api/v1/models/connections/{connection_id}` | member |
| `PATCH` | `/api/v1/models/connections/{connection_id}` | owner/admin |
| `DELETE` | `/api/v1/models/connections/{connection_id}` | owner/admin |
| `POST` | `/api/v1/models/connections/{connection_id}/test` | owner/admin |
| `GET` | `/api/v1/models/profiles` | member |
| `POST` | `/api/v1/models/profiles` | owner/admin |
| `GET` | `/api/v1/models/profiles/default` | member |
| `GET` | `/api/v1/models/profiles/{profile_id}` | member |
| `PATCH` | `/api/v1/models/profiles/{profile_id}` | owner/admin |
| `POST` | `/api/v1/models/profiles/{profile_id}/default` | owner/admin |
| `DELETE` | `/api/v1/models/profiles/{profile_id}` | owner/admin |

### Knowledge

| Method | Path | Role |
|---|---|---|
| `GET` | `/api/v1/knowledge/data-sources/{data_source_id}` | member |
| `POST` | `/api/v1/knowledge/data-sources/{data_source_id}/generate` | owner/admin |
| `GET` | `/api/v1/knowledge/data-sources/{data_source_id}/versions` | member |
| `GET` | `/api/v1/knowledge/data-sources/{data_source_id}/index` | member |
| `GET` | `/api/v1/knowledge/data-sources/{data_source_id}/documents` | member |
| `GET` | `/api/v1/knowledge/data-sources/{data_source_id}/documents/{document_id}` | member |
| `GET` | `/api/v1/knowledge/data-sources/{data_source_id}/table?key=...` | member |
| `GET` | `/api/v1/knowledge/data-sources/{data_source_id}/annotations` | member |
| `POST` | `/api/v1/knowledge/data-sources/{data_source_id}/annotations` | owner/admin |
| `PATCH` | `/api/v1/knowledge/annotations/{annotation_id}` | owner/admin |
| `DELETE` | `/api/v1/knowledge/annotations/{annotation_id}` | owner/admin |

### Conversations

| Method | Path | Role |
|---|---|---|
| `POST` | `/api/v1/conversations` | member |
| `GET` | `/api/v1/conversations` | member |
| `GET` | `/api/v1/conversations/{conversation_id}` | member |
| `GET` | `/api/v1/conversations/{conversation_id}/messages` | member |
| `POST` | `/api/v1/conversations/{conversation_id}/messages` | member; returns async job |

### Jobs and execution trace

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/api/v1/jobs?status=&limit=` | member | Recent job list, limit 1–100 |
| `GET` | `/api/v1/jobs/{job_id}` | member | Durable job state |
| `POST` | `/api/v1/jobs/{job_id}/cancel` | member | Request cancellation |
| `GET` | `/api/v1/jobs/{job_id}/events` | member | SSE durable replay + realtime |
| `GET` | `/api/v1/jobs/{job_id}/execution` | member | Tools, SQL, models, artifacts |

### Dashboards

| Method | Path | Role |
|---|---|---|
| `GET` | `/api/v1/dashboards` | member |
| `POST` | `/api/v1/dashboards` | member |
| `GET` | `/api/v1/dashboards/{dashboard_id}` | member |
| `PATCH` | `/api/v1/dashboards/{dashboard_id}` | member |
| `DELETE` | `/api/v1/dashboards/{dashboard_id}` | member |
| `POST` | `/api/v1/dashboards/{dashboard_id}/refresh` | member; async |
| `POST` | `/api/v1/dashboards/{dashboard_id}/widgets` | member |
| `PATCH` | `/api/v1/dashboards/widgets/{widget_id}` | member |
| `DELETE` | `/api/v1/dashboards/widgets/{widget_id}` | member |
| `POST` | `/api/v1/dashboards/widgets/{widget_id}/refresh` | member; async |

### Administration/operations

| Method | Path | Role |
|---|---|---|
| `GET` | `/api/v1/audit?limit=100` | owner/admin |
| `GET` | `/api/v1/ops/status` | owner/admin |

## 7. Datasource integration

### 7.1 Create PostgreSQL

```http
POST /api/v1/data-sources
```

```json
{
  "kind": "postgres",
  "name": "Production PostgreSQL",
  "config": {
    "host": "db.example.com",
    "port": 5432,
    "database": "app",
    "schema_name": "public",
    "ssl_mode": "require"
  },
  "credentials": {
    "username": "readonly_user",
    "password": "secret"
  }
}
```

PostgreSQL `ssl_mode` values:

```text
disable | prefer | require | verify-ca | verify-full
```

### 7.2 Create MySQL

```json
{
  "kind": "mysql",
  "name": "Production MySQL",
  "config": {
    "host": "mysql.example.com",
    "port": 3306,
    "database": "app",
    "ssl": true
  },
  "credentials": {
    "username": "readonly_user",
    "password": "secret"
  }
}
```

### 7.3 Create MSSQL

```json
{
  "kind": "mssql",
  "name": "Warehouse SQL Server",
  "config": {
    "host": "sql.example.com",
    "port": 1433,
    "database": "warehouse",
    "schema_name": "dbo",
    "encrypt": true,
    "trust_server_certificate": false,
    "odbc_driver": "ODBC Driver 18 for SQL Server"
  },
  "credentials": {
    "username": "readonly_user",
    "password": "secret"
  }
}
```

### 7.4 Datasource response

Stored credentials are not returned:

```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "name": "Production PostgreSQL",
  "kind": "postgres",
  "display_type": "postgres",
  "status": "active",
  "config": {
    "host": "db.example.com",
    "port": 5432,
    "database": "app",
    "schema_name": "public",
    "ssl_mode": "require"
  },
  "created_by": "uuid",
  "last_tested_at": null,
  "last_error_code": null,
  "created_at": "...",
  "updated_at": "...",
  "active_file": null
}
```

For Excel, `display_type` is `excel` while internal `kind` is `duckdb`.

### 7.5 Update a datasource

```http
PATCH /api/v1/data-sources/{id}
```

Any subset can be sent:

```json
{
  "name": "Renamed source",
  "config": {"host": "new-host", "port": 5432, "database": "app", "schema_name": "public", "ssl_mode": "require"},
  "credentials": {"username": "new_user", "password": "new_secret"},
  "status": "active"
}
```

`status` accepts `active` or `disabled`.

### 7.6 Test a datasource

```http
POST /api/v1/data-sources/{id}/test
```

Response: `202 Accepted`

```json
{
  "job_id": "uuid"
}
```

Track the job globally; do not block the datasource screen until the HTTP request finishes.

### 7.7 Excel upload

```http
POST /api/v1/data-sources/excel
Content-Type: multipart/form-data
```

Form fields:

```text
name = Orders Workbook
file = <workbook.xlsx>
```

Browser example:

```ts
const form = new FormData();
form.append("name", "Orders Workbook");
form.append("file", file);

const response = await api.post("/api/v1/data-sources/excel", form);
```

Response: `202 Accepted`

```json
{
  "data_source": {
    "id": "uuid",
    "kind": "duckdb",
    "display_type": "excel",
    "status": "preparing"
  },
  "job_id": "uuid"
}
```

Materialization events include:

```text
excel.materialization.started
excel.sheet.started
excel.sheet.completed
excel.database.created
datasource.ready
excel.materialization.failed
excel.materialization.cancelled
```

When successful, refetch the datasource; its `status` becomes active and `active_file` contains workbook metadata/sheet mapping.

### 7.8 Replace an Excel workbook

```http
POST /api/v1/data-sources/{id}/excel/replace
Content-Type: multipart/form-data
```

Form field:

```text
file = <replacement.xlsx>
```

Response:

```json
{"job_id":"uuid"}
```

The backend builds a replacement DuckDB before atomic activation. The previous active database remains usable if replacement fails.

### 7.9 Schema introspection

```http
GET /api/v1/data-sources/{id}/schema
```

Response shape:

```json
{
  "tables": [
    {
      "schema": "public",
      "name": "orders",
      "object_type": "table",
      "columns": [
        {
          "name": "id",
          "native_type": "uuid",
          "nullable": false,
          "default": null
        }
      ],
      "primary_key": ["id"],
      "foreign_keys": []
    }
  ]
}
```

This endpoint performs introspection directly. For the knowledge UI, prefer the generated knowledge APIs after knowledge is ready rather than repeatedly introspecting the datasource.

## 8. Model configuration integration

### 8.1 Create an OpenAI-compatible connection

```http
POST /api/v1/models/connections
```

```json
{
  "name": "OpenAI",
  "base_url": "https://api.openai.com/v1",
  "api_key": "sk-..."
}
```

`api_key` is optional for compatible providers that do not require one. The base URL must be an absolute HTTP(S) URL and must not contain embedded credentials, a query string, or a fragment.

Response never returns the key:

```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "name": "OpenAI",
  "base_url": "https://api.openai.com/v1",
  "status": "active",
  "has_api_key": true,
  "last_tested_at": null,
  "last_error_code": null,
  "created_by": "uuid",
  "created_at": "...",
  "updated_at": "..."
}
```

### 8.2 Replace or clear an API key

```http
PATCH /api/v1/models/connections/{id}
```

Replace:

```json
{"api_key":"new-key"}
```

Clear:

```json
{"clear_api_key":true}
```

Never expect the backend to redisplay the saved credential.

### 8.3 Test model connection

```http
POST /api/v1/models/connections/{id}/test
```

This is a direct HTTP provider test, **not** a background job.

Response:

```json
{
  "ok": true,
  "model_count": 12,
  "sample_models": ["model-a", "model-b"],
  "tested_at": "..."
}
```

### 8.4 Create model profile

```http
POST /api/v1/models/profiles
```

```json
{
  "connection_id": "uuid",
  "display_name": "Default Analyst",
  "model_name": "provider-model-name",
  "settings": {
    "temperature": 0.2,
    "max_tokens": 4000
  },
  "enabled": true,
  "is_default": true
}
```

Reserved/sensitive settings such as `api_key`, `authorization`, `headers`, `base_url`, `model`, `messages`, `tools`, and `tool_choice` cannot be placed in the `settings` object.

Set an existing profile as default:

```http
POST /api/v1/models/profiles/{profile_id}/default
```

## 9. Knowledge integration

Knowledge is generated per datasource as an asynchronous job.

### 9.1 Check status

```http
GET /api/v1/knowledge/data-sources/{data_source_id}
```

Example empty state:

```json
{
  "data_source_id": "uuid",
  "knowledge_base_id": null,
  "status": "empty",
  "current_version_id": null,
  "current_version_number": null,
  "schema_fingerprint": null,
  "generated_at": null,
  "object_count": null,
  "last_error_code": null
}
```

### 9.2 Generate/regenerate

```http
POST /api/v1/knowledge/data-sources/{data_source_id}/generate
```

Response: `202 Accepted`

```json
{
  "job_id": "uuid",
  "knowledge_base_id": "uuid"
}
```

Relevant events:

```text
knowledge.generation.started
knowledge.schema.inspected
knowledge.index.generated
knowledge.documents.generated
knowledge.generation.completed
knowledge.generation.failed
knowledge.generation.cancelled
```

### 9.3 Read knowledge efficiently

The intended frontend navigation is:

```text
GET status
-> GET index
-> GET documents list
-> load one document/table only when opened
```

Endpoints:

```text
GET /api/v1/knowledge/data-sources/{id}/index
GET /api/v1/knowledge/data-sources/{id}/documents?document_type=table_schema&limit=500
GET /api/v1/knowledge/data-sources/{id}/documents/{document_id}
GET /api/v1/knowledge/data-sources/{id}/table?key=public.orders
```

Document response:

```json
{
  "id": "uuid",
  "document_type": "table_schema",
  "document_key": "public.orders",
  "title": "public.orders",
  "metadata": {},
  "estimated_tokens": 420,
  "created_at": "...",
  "content_markdown": "..."
}
```

Do not fetch every table document just to render the knowledge overview.

### 9.4 Business annotations

Scopes:

```text
datasource
table
column
metric
```

Create:

```http
POST /api/v1/knowledge/data-sources/{id}/annotations
```

Metric example:

```json
{
  "scope_type": "metric",
  "scope_key": "revenue",
  "content": "Successfully captured payments excluding refunds and cancelled orders."
}
```

For `table`, `column`, and `metric`, `scope_key` is required. Datasource annotations may omit it.

## 10. Conversation and analytical job integration

This is the primary asynchronous frontend workflow.

### 10.1 Create conversation

```http
POST /api/v1/conversations
```

```json
{
  "title": "Revenue analysis",
  "data_source_ids": ["datasource-uuid"],
  "model_profile_id": "profile-uuid"
}
```

Rules:

- 1–10 datasource IDs;
- no duplicate datasource IDs;
- `model_profile_id` may be omitted to use the configured default.

Response: `201 Created`

```json
{
  "id": "conversation-uuid",
  "organization_id": "organization-uuid",
  "title": "Revenue analysis",
  "created_by": "user-uuid",
  "model_profile_id": "profile-uuid",
  "data_source_ids": ["datasource-uuid"],
  "created_at": "...",
  "updated_at": "..."
}
```

### 10.2 Submit a question

```http
POST /api/v1/conversations/{conversation_id}/messages
```

```json
{
  "content": "What was monthly revenue for the last 12 months?",
  "model_profile_id": null
}
```

Response: `202 Accepted`

```json
{
  "message_id": "user-message-uuid",
  "job_id": "chat-job-uuid"
}
```

**Do not wait for an assistant answer in this HTTP request.** Immediately:

1. render the user message optimistically using the returned durable message ID;
2. add `job_id` to the global Job Center;
3. subscribe to `/jobs/{job_id}/events`;
4. allow navigation away;
5. on completion, refetch conversation/messages and execution trace.

### 10.3 Read conversation

```text
GET /api/v1/conversations
GET /api/v1/conversations/{id}?message_limit=200
GET /api/v1/conversations/{id}/messages?limit=200
```

Message shape:

```json
{
  "id": "uuid",
  "conversation_id": "uuid",
  "role": "user|assistant",
  "content": "Markdown/plain text",
  "job_id": "uuid-or-null",
  "metadata": {},
  "created_at": "..."
}
```

Assistant messages are persisted independently of the browser connection.

## 11. Global jobs API

### 11.1 Job states

```text
queued
running
succeeded
failed
cancelled
```

Retry/recovery can temporarily transition a running job back to queued.

### 11.2 List jobs

```http
GET /api/v1/jobs?status=running&limit=50
```

`limit` is 1–100, default 50.

Job response:

```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "job_type": "chat_query",
  "status": "running",
  "requested_by": "uuid",
  "conversation_id": "uuid-or-null",
  "input": {},
  "result": null,
  "attempt_count": 1,
  "max_attempts": 3,
  "cancel_requested_at": null,
  "error_code": null,
  "error_message": null,
  "created_at": "...",
  "started_at": "...",
  "finished_at": null
}
```

Recommended application startup behavior:

```text
restore auth + active organization
-> GET /jobs?status=queued
-> GET /jobs?status=running
-> reconnect SSE for active jobs
-> optionally GET recent completed/failed jobs for Job Center history
```

### 11.3 Cancel

```http
POST /api/v1/jobs/{job_id}/cancel
```

Queued jobs can be cancelled immediately. Running jobs receive a cancellation request and cooperate with it during model/tool/query work.

Closing an SSE stream is **not** cancellation.

## 12. SSE integration

Endpoint:

```http
GET /api/v1/jobs/{job_id}/events
Authorization: Bearer <access_token>
X-Organization-ID: <organization-id>
Accept: text/event-stream
```

Because authorization headers are required, use an SSE client that supports authenticated fetch requests (for example `@microsoft/fetch-event-source`) rather than the basic browser `EventSource` if your token is stored in JS-managed auth state.

### 12.1 Event frame

Example:

```text
id: 7
event: sql.completed
data: {"sequence":7,"event_type":"sql.completed","level":"info","payload":{"sql_execution_id":"...","row_count":12,"truncated":false,"duration_ms":183},"created_at":"2026-08-24T12:35:00+00:00"}
```

Parsed event shape:

```ts
type JobEvent = {
  sequence: number;
  event_type: string;
  level: string;
  payload: Record<string, unknown>;
  created_at: string;
};
```

The server also sends SSE comment keep-alives approximately when no event arrives during the realtime polling window. Ignore comment frames.

### 12.2 Resume/reconnect

The server supports either:

```http
Last-Event-ID: 7
```

or:

```text
GET /api/v1/jobs/{job_id}/events?after_sequence=7
```

The server replays durable PostgreSQL events and then continues with realtime Redis events. It discards replay/live overlap by sequence.

The frontend should still store the highest processed `sequence` per job and ignore any event with `sequence <= lastSeenSequence`.

Recommended reconnect behavior:

```text
remember last sequence
-> reconnect with Last-Event-ID or after_sequence
-> replay missing durable events
-> continue realtime
-> deduplicate by sequence
```

### 12.3 Important event types

Generic job lifecycle:

```text
job.queued
job.started
job.retry_scheduled
job.recovered
job.cancel_requested
job.cancelled
job.failed
job.completed
```

Datasource/Excel:

```text
datasource.test.started
datasource.test.succeeded
datasource.test.failed
excel.materialization.started
excel.sheet.started
excel.sheet.completed
excel.database.created
datasource.ready
excel.materialization.failed
excel.materialization.cancelled
```

Knowledge:

```text
knowledge.generation.started
knowledge.schema.inspected
knowledge.index.generated
knowledge.documents.generated
knowledge.generation.completed
knowledge.generation.failed
knowledge.generation.cancelled
```

Agent/analysis:

```text
agent.started
knowledge.index.loaded
knowledge.schema.loaded
model.request.started
model.request.completed
model.request.failed
tool.started
tool.completed
tool.failed
tool.cancelled
sql.started
sql.completed
sql.failed
sql.cancelled
chart.generated
answer.generated
```

Dashboard refresh additionally emits SQL lifecycle events and `dashboard.widget.refreshed` for completed widget refreshes.

Do not derive private model reasoning from events; the backend intentionally emits operational state only.

## 13. Execution trace and analytical artifacts

After or during an analytical job:

```http
GET /api/v1/jobs/{job_id}/execution
```

Response:

```json
{
  "tools": [],
  "sql": [],
  "models": [],
  "artifacts": []
}
```

### 13.1 SQL execution record

```json
{
  "id": "sql-execution-uuid",
  "tool_execution_id": "tool-execution-uuid",
  "data_source_id": "datasource-uuid",
  "sql_text": "SELECT ...",
  "status": "succeeded",
  "row_count": 12,
  "truncated": false,
  "columns": ["month", "revenue"],
  "result_bytes": 2048,
  "duration_ms": 183,
  "error_code": null,
  "error_message": null,
  "started_at": "...",
  "finished_at": "..."
}
```

Use this data for an expandable **View execution** UI. It is safe to show SQL text and sanitized execution errors; do not attempt to expose hidden prompts or chain-of-thought.

### 13.2 Model execution record

Token fields are nullable. `null` means the provider did not report usage; do not display `0` as if measured.

```json
{
  "model_name": "...",
  "phase": "...",
  "status": "succeeded",
  "input_tokens": 1200,
  "output_tokens": 250,
  "total_tokens": 1450
}
```

### 13.3 Text artifact

Final answer artifact:

```json
{
  "kind": "text",
  "name": "Answer",
  "payload": {
    "schema_version": 1,
    "markdown": "Final analytical answer..."
  }
}
```

### 13.4 Table artifact

```json
{
  "kind": "table",
  "source_sql_execution_id": "uuid",
  "payload": {
    "schema_version": 1,
    "data_source_id": "uuid",
    "columns": ["month", "revenue"],
    "rows": [
      ["2026-01", 100000],
      ["2026-02", 125000]
    ],
    "row_count": 2,
    "truncated": false
  }
}
```

`rows` are positional arrays aligned to `columns`.

### 13.5 Chart artifact

Charts are frontend-rendered and grounded in persisted SQL rows.

Cartesian example:

```json
{
  "kind": "chart",
  "source_sql_execution_id": "uuid",
  "payload": {
    "schema_version": 1,
    "renderer": "frontend",
    "chart_type": "line",
    "title": "Monthly revenue",
    "source_sql_execution_id": "uuid",
    "encoding": {
      "x": {"field": "month", "label": "Month"},
      "series": [
        {"field": "revenue", "label": "Revenue"}
      ]
    },
    "data": [
      {"month": "2026-01", "revenue": 100000},
      {"month": "2026-02", "revenue": 125000}
    ]
  }
}
```

Pie charts use:

```json
{
  "encoding": {
    "category": {"field": "segment"},
    "value": {"field": "revenue", "label": "Revenue"}
  }
}
```

Supported agent-generated chart types are `bar`, `line`, `area`, and `pie`. Dashboard widgets additionally support `metric` and `table`.

The frontend should map this schema to ECharts rather than treating the payload as arbitrary executable chart configuration.

## 14. Dashboard integration

### 14.1 Create dashboard

```http
POST /api/v1/dashboards
```

```json
{
  "title": "Executive Revenue",
  "description": "Key revenue metrics"
}
```

### 14.2 Save an analysis result as a widget

A widget requires provenance from a **successful** analysis job and one successful SQL execution within that job.

```http
POST /api/v1/dashboards/{dashboard_id}/widgets
```

```json
{
  "source_job_id": "successful-chat-job-uuid",
  "source_sql_execution_id": "sql-execution-uuid",
  "widget_type": "line",
  "title": "Monthly revenue",
  "visualization_config": {
    "x_field": "month",
    "x_label": "Month",
    "series": [
      {"field": "revenue", "label": "Revenue"}
    ]
  },
  "layout_config": {
    "w": 6,
    "h": 4
  }
}
```

Supported widget types:

```text
metric
table
bar
line
area
pie
```

Visualization config shapes expected by the current backend:

```json
// metric
{"field":"revenue"}

// table
{}

// bar / line / area
{
  "x_field":"month",
  "x_label":"Month",
  "series":[
    {"field":"revenue","label":"Revenue"}
  ]
}

// pie
{
  "category_field":"segment",
  "value_field":"revenue",
  "value_label":"Revenue"
}
```

If `title` is omitted, the backend defaults it from the originating user question when available.

The backend validates chart fields against the persisted SQL result. Do not allow the frontend to assume arbitrary field names are valid.

### 14.3 Dashboard detail

```http
GET /api/v1/dashboards/{dashboard_id}
```

Returns dashboard metadata plus `widgets`. Each widget may contain `latest_artifact`, for example:

```json
{
  "id": "artifact-uuid",
  "kind": "chart",
  "name": "Monthly revenue",
  "payload": {"schema_version": 1},
  "created_at": "..."
}
```

### 14.4 Refresh widget/dashboard

Widget:

```http
POST /api/v1/dashboards/widgets/{widget_id}/refresh
```

Dashboard:

```http
POST /api/v1/dashboards/{dashboard_id}/refresh
```

Both return:

```json
{"job_id":"uuid"}
```

Treat refresh exactly like other global jobs: subscribe to SSE, allow navigation, then refetch dashboard/widget data after `job.completed`.

## 15. Frontend application flow

Recommended end-to-end initialization:

```text
App starts
-> restore token pair from centralized auth storage
-> GET /auth/me
-> GET /organizations
-> select active organization
-> attach X-Organization-ID to scoped calls
-> GET queued/running jobs
-> reconnect SSE for active jobs
-> render application
```

Recommended first-time setup flow:

```text
Signup
-> organization created
-> create datasource or upload Excel
-> if async, track job until ready
-> generate knowledge
-> track knowledge job
-> create/test model connection
-> create model profile / set default
-> create conversation
-> submit question
-> track chat job via SSE
-> refetch messages + execution trace
-> optionally save a SQL result to dashboard
```

## 16. Global Job Center guidance

Because the backend decouples jobs from browser pages, the frontend should maintain a global job manager/provider rather than page-local polling.

Suggested behavior:

```text
On any async response containing job_id:
  register job globally
  fetch initial durable job state
  open authenticated SSE
  update current event/status
  persist only safe UI identifiers/preferences if desired

On job.completed / job.failed / job.cancelled:
  close/release stream
  invalidate relevant TanStack Query keys
  show one completion/failure notification
```

Do not show a toast for every event. Use the event stream for a Job Center/execution-progress UI.

## 17. Time handling

Backend timestamps are timezone-aware instants. Treat them as UTC/offset-aware server timestamps and format them in the user's local browser timezone.

Recommended frontend rule:

```text
server timestamp -> Date/Temporal instant -> local display
```

Do not render raw ISO strings in normal UI. Date-only business values inside query result data are different: do not shift a value such as `2026-08-24` into another date because of timezone conversion.

## 18. Security integration rules for the frontend

- Never persist passwords.
- Never persist datasource credentials after submission.
- Never expect stored datasource passwords back from the API.
- Never expect stored model API keys back from the API; use `has_api_key`.
- Keep token storage/refresh logic in one auth service/module.
- Attach `Authorization` and `X-Organization-ID` centrally.
- Do not log request bodies containing secrets.
- Do not render assistant Markdown as unsafe raw HTML.
- Do not expose hidden prompts or infer chain-of-thought from trace data.
- Treat `404` on organization-scoped resources as inaccessible/not found; do not leak cross-workspace existence.
- Do not build query safety in the frontend as a substitute for backend safety; the backend remains authoritative.

## 19. Cache/invalidation recommendations

Useful TanStack Query-style keys:

```text
["me"]
["organizations"]
["organization", activeOrganizationId]
["dataSources", activeOrganizationId]
["dataSource", activeOrganizationId, id]
["models", "connections", activeOrganizationId]
["models", "profiles", activeOrganizationId]
["knowledge", activeOrganizationId, dataSourceId]
["conversations", activeOrganizationId]
["conversation", activeOrganizationId, conversationId]
["jobs", activeOrganizationId, filters]
["job", activeOrganizationId, jobId]
["execution", activeOrganizationId, jobId]
["dashboards", activeOrganizationId]
["dashboard", activeOrganizationId, dashboardId]
```

Invalidate/refetch based on completed job type:

| Job type | Suggested invalidation |
|---|---|
| `datasource_test` | datasource list/detail |
| `excel_materialization` | datasource detail/list, knowledge status if relevant |
| `knowledge_generation` | knowledge status/index/documents |
| `chat_query` | conversation messages, job execution trace |
| `dashboard_refresh` | dashboard detail/widgets, execution trace |

## 20. Frontend implementation checklist

```text
[ ] Generate API types from `/openapi.json`
[ ] Central API client with error normalization
[ ] Central access-token injection
[ ] Serialized refresh-token rotation
[ ] Central active organization header (`X-Organization-ID`)
[ ] Central UTC/local timestamp formatter
[ ] Authenticated SSE implementation
[ ] Per-job last event sequence + deduplication
[ ] Global Job Center independent of page routes
[ ] Async datasource/Excel/knowledge/chat/dashboard flows use returned `job_id`
[ ] Conversation answer is refetched after job completion
[ ] Execution trace renders SQL/tool/model/artifact records safely
[ ] Chart renderer consumes `renderer=frontend` artifact schema
[ ] Credentials never redisplayed or persisted in feature state
[ ] Role-aware admin controls
[ ] 401 refresh/retry behavior is single-flight
[ ] 404 cross-organization resources handled as unavailable
```

## 21. Contract source of truth

For integration work, use this order of authority:

```text
1. Running backend `/openapi.json`
2. Pydantic schemas + routers in this repository
3. This integration guide
4. Older README/task notes
```

The existing root README still contains older Task 5 wording in places. The API contract described here was verified against the current Task 6 routers/schemas in the uploaded backend.
