# DB Assistant Backend — Task 5

This repository contains the completed backend through **Task 5**. It continues the validated Task 1–4 implementation and adds conversations, asynchronous analytical jobs, Deep Agents/LangGraph orchestration, deterministic SQL safety, persistent execution traces, bounded query results, and frontend-rendered chart artifacts.

Task 5 deliberately keeps infrastructure and security outside the agent harness: PostgreSQL remains durable state, Redis remains queue/realtime coordination, datasource adapters own engine details, and the SQL/tool layer enforces authorization and resource limits independently of the model. Dashboards/reporting remain deferred to Task 6.

## What Task 5 adds

- organization-scoped conversations and conversation-to-datasource associations
- durable user/assistant messages
- one user question -> one `chat_query` background job
- Deep Agents `0.6.x` as the production orchestration harness on top of LangGraph/LangChain
- OpenAI-compatible model profiles resolved from the Task 3 encrypted model configuration
- stable DB Assistant tools: `read_knowledge_index`, `read_table_schema`, `execute_sql`, `create_chart`
- deterministic index-before-table-schema enforcement outside the model prompt
- multiple SQL executions and multi-step tool workflows within one bounded job
- parser-based read-only SQL validation with SQLGlot and dialect selection for PostgreSQL/MySQL/MSSQL/DuckDB
- one-statement enforcement and write/admin SQL rejection
- bounded query rows, bounded serialized bytes, bounded model previews, query timeout, job timeout, tool-call limits, and SQL-attempt limits
- persisted `tool_executions`, `sql_executions`, and `model_executions`
- provider-reported token usage only; missing usage is never fabricated
- bounded table artifacts persisted from SQL results
- grounded frontend chart artifacts (`bar`, `line`, `area`, `pie`, `donut`, `metric`) created from a prior successful SQL execution
- chart values are read from persisted SQL rows; the model cannot provide arbitrary chart datapoints
- no Python/matplotlib/image chart generation
- job cancellation polling during model/tool/query work
- sanitized provider/tool/query failures
- execution-trace API for completed or running analytical jobs
- Task 5 migration, orchestration contract tests, chart tests, SQL safety tests, and a real Deep Agents smoke test that runs when Task 5 dependencies are installed

### Task 5 APIs

```text
POST /api/v1/conversations
GET  /api/v1/conversations
GET  /api/v1/conversations/{conversation_id}
GET  /api/v1/conversations/{conversation_id}/messages
POST /api/v1/conversations/{conversation_id}/messages

GET  /api/v1/jobs/{job_id}
POST /api/v1/jobs/{job_id}/cancel
GET  /api/v1/jobs/{job_id}/events
GET  /api/v1/jobs/{job_id}/execution
```

Submitting a conversation message returns immediately with the durable message/job IDs. The worker performs the analysis independently of the HTTP/SSE connection.

Final answers stream over the same authenticated job-event connection after analysis and evidence
checks finish. `answer.started` identifies the model execution; batched `answer.delta` events carry
only public Markdown, a stream ID, and a UTF-16 text offset. Private analyst/tool content and the
follow-up suggestions block are excluded. Each batch is durable, so reconnects replay from the
last accepted sequence. These text batches are not displayed in the activity log.

`FINAL_ANSWER_STREAMING_ENABLED=true` enables this behavior (the default).
`FINAL_ANSWER_STREAM_FLUSH_MS=200` controls batching (50–1000 ms). Set streaming to `false` and
restart the worker to use the original whole-response path. Compatible providers that explicitly
reject streaming before producing text fall back to that path; interrupted generations do not
start another model request. Missing provider token usage remains unknown.

The growing answer is a preview. The normal cleanup, quality checks, assistant-message persistence,
and answer artifact remain authoritative on completion. Failed or cancelled previews stay marked
as incomplete in the live view and are not added to model conversation history. The question queue
continues to process one turn at a time.

### Agent execution model

```text
Question
  -> chat_query job
  -> Deep Agents / LangGraph
       -> read_knowledge_index
       -> read only relevant table schemas
       -> execute one or more validated SQL queries
       -> optionally create one or more frontend chart specs
       -> final Markdown answer
  -> persist answer + artifacts + tool/SQL/model trace
  -> job completed
```

Deep Agents may use its own harness planning/context-management capabilities, but DB Assistant product tools remain the only path to business data. The frontend never receives private chain-of-thought or hidden prompts. Built-in Deep Agents tool activity is recorded only as safe status metadata.

### Frontend chart artifact

A chart is persisted as JSON for the future React/ECharts frontend, for example:

```json
{
  "schema_version": 1,
  "renderer": "frontend",
  "chart_type": "line",
  "title": "Monthly revenue trend",
  "source_sql_execution_id": "...",
  "encoding": {
    "x": {"field": "month", "label": "Month"},
    "series": [{"field": "revenue", "label": "Revenue"}]
  },
  "data": [
    {"month": "Jan", "revenue": 100},
    {"month": "Feb", "revenue": 120}
  ]
}
```

The `data` array comes from the persisted, bounded SQL result referenced by `source_sql_execution_id`; it is not supplied by the model.

`create_chart` supports generic bar variants through `orientation` (`vertical` or
`horizontal`) and `stacked` (boolean). Defaults produce grouped vertical columns.
Stacked charts require complete additive components in the same unit, with one numeric
column per series and one row per category. The same options and all series are preserved
when saving, editing and refreshing dashboard widgets.

`donut` uses the same `category_field` and `value_field` mapping as `pie`. Donut values
must be non-negative and complete, with a positive total. Existing artifact schema version
1 remains supported; older bar artifacts use the default orientation and grouping.

Apply `alembic upgrade head` before saving donut widgets, then restart the API and worker
to load the updated chart contracts. Frontend development mode reloads the renderer;
production frontend deployments require a new build.

## What Task 4 adds

- one organization-scoped knowledge base per datasource
- background `knowledge_generation` jobs using the existing Redis Streams worker architecture
- deterministic adapter-driven schema introspection; no LLM is required to restate schema facts
- compact schema index containing table/view names and minimal structural hints
- separate per-table schema documents containing columns, types, primary keys, and foreign keys
- identical knowledge abstraction for PostgreSQL, MySQL, MSSQL, and DuckDB/Excel
- stable SHA-256 schema fingerprints over canonicalized schema metadata
- immutable knowledge versions with atomic current-version promotion
- failed regeneration preserves the previous current version
- regeneration cancellation restores the previous usable knowledge status
- manually authored datasource/table/column/metric annotations stored outside generated versions
- annotations survive schema regeneration
- side-effect-free knowledge status/index/document read APIs
- admin-controlled generation and annotation mutation; organization isolation on all resources
- per-document estimated token counts for observability only; provider token usage is never fabricated
- Task 4 migration, focused unit tests, and opt-in multi-engine integration coverage

### Knowledge API

```text
GET    /api/v1/knowledge/data-sources/{data_source_id}
POST   /api/v1/knowledge/data-sources/{data_source_id}/generate
GET    /api/v1/knowledge/data-sources/{data_source_id}/versions
GET    /api/v1/knowledge/data-sources/{data_source_id}/index
GET    /api/v1/knowledge/data-sources/{data_source_id}/documents
GET    /api/v1/knowledge/data-sources/{data_source_id}/documents/{document_id}
GET    /api/v1/knowledge/data-sources/{data_source_id}/table?key=public.orders
GET    /api/v1/knowledge/data-sources/{data_source_id}/annotations
POST   /api/v1/knowledge/data-sources/{data_source_id}/annotations
PATCH  /api/v1/knowledge/annotations/{annotation_id}
DELETE /api/v1/knowledge/annotations/{annotation_id}
```

Knowledge generation follows this shape:

```text
Datasource adapter introspection
        |
        v
Canonical schema metadata
        |
        +--> schema fingerprint
        |
        +--> compact index document
        |
        +--> one table-schema document per table/view
        |
        v
new immutable knowledge version
        |
        v
atomic current-version promotion
```

Human business annotations are attached to the stable knowledge base, not to a generated version. Regenerating schema knowledge therefore cannot erase definitions such as `revenue`, table explanations, or column semantics.

The Task 5 Deep Agent uses the selective context sequence:

```text
read knowledge index
-> choose relevant tables
-> load only those table documents
-> execute validated SQL
```

The complete schema is never collapsed into one generated prompt document.

## What Task 3 adds

- organization-scoped model connections
- organization-scoped model profiles
- encrypted model API credentials using the Task 2 secret subsystem
- API-key redaction from API responses
- OpenAI-compatible API-root configuration
- connection testing through the compatible `/models` endpoint
- sanitized timeout/provider/invalid-response errors
- provider-independent model client protocol
- OpenAI-compatible chat-completions client for later agent use
- typed model completion and usage structures
- exact usage parsing: missing token counts remain `null`/`None` rather than being invented
- generation settings with validation of common fields while allowing provider-specific compatible options
- first enabled profile becomes the organization default automatically
- explicit default-model selection
- disabling/deleting a default profile promotes another enabled profile when available
- database-level partial unique index preventing multiple defaults per organization
- Task 3 migration, unit tests, and opt-in integration coverage

### Model configuration API

```text
GET    /api/v1/models/connections
POST   /api/v1/models/connections
GET    /api/v1/models/connections/{connection_id}
PATCH  /api/v1/models/connections/{connection_id}
DELETE /api/v1/models/connections/{connection_id}
POST   /api/v1/models/connections/{connection_id}/test

GET    /api/v1/models/profiles
POST   /api/v1/models/profiles
GET    /api/v1/models/profiles/default
GET    /api/v1/models/profiles/{profile_id}
PATCH  /api/v1/models/profiles/{profile_id}
POST   /api/v1/models/profiles/{profile_id}/default
DELETE /api/v1/models/profiles/{profile_id}
```

A model connection `base_url` is the OpenAI-compatible API root, for example:

```text
https://api.openai.com/v1
http://localhost:8000/v1
```

The API key is optional so local/self-hosted compatible endpoints that do not require authentication can also be configured. If supplied, it is encrypted using `encrypted_secrets` and is never returned by the API.

Connection testing is asynchronous HTTP I/O but is intentionally not a background job in Task 3. The database transaction is released before the provider call so a slow provider does not pin a PostgreSQL connection.

## What Task 2 adds

- explicit datasource adapter registry
- PostgreSQL adapter
- MySQL adapter
- Microsoft SQL Server adapter
- DuckDB adapter
- encrypted datasource-secret storage with key versioning
- organization-scoped datasource CRUD
- datasource connection-test jobs
- schema introspection contract
- managed local datasource storage
- Excel `.xlsx` upload and background materialization
- one persistent DuckDB database per active Excel datasource version
- safe replacement using a new database version before activation
- failed replacement preserves the previously active database
- original worksheet names preserved alongside normalized table names
- conservative Excel typing with mixed-value preservation
- datasource/file cleanup
- Task 2 migration and unit/integration/E2E coverage


## Task 1 foundation retained

- FastAPI application with `/api/v1` versioning
- centralized Pydantic settings and `.env.example`
- PostgreSQL via SQLAlchemy 2 async sessions
- Alembic migration for all Task 1 tables
- Redis Streams job queue
- independent worker process
- worker consumer-group acknowledgement
- worker leases/heartbeats and stale-message claiming
- bounded retry support for explicitly retryable infrastructure failures
- durable job events in PostgreSQL
- Redis Pub/Sub copies for low-latency live events
- SSE replay + realtime delivery
- email/password signup and login
- Argon2 password hashing
- JWT access tokens
- opaque rotating refresh tokens stored only as SHA-256 hashes
- logout/revocation
- forgot/reset password tokens stored only as hashes
- initial workspace/organization creation on signup
- `owner`, `admin`, and `member` membership roles
- organization-scoped authorization
- structured JSON logs
- request IDs
- consistent API error envelope
- health and readiness endpoints
- Docker Compose for PostgreSQL and Redis

## Runtime architecture

```text
Browser / Frontend
       |
       | HTTP + SSE
       v
   FastAPI API ----------------> PostgreSQL
       |                         durable state
       |
       +-----------------------> Redis
                                  Streams queue
                                  Pub/Sub live events
                                      |
                                      v
                               Worker process(es)
```

The browser does **not** own running work. A worker can continue a job after a browser disconnects. PostgreSQL remains authoritative for status and event history; Redis is transport/coordination.

## Database schema through Task 5

```text
users
organizations
organization_memberships
auth_sessions
auth_action_tokens
jobs
job_events
encrypted_secrets
data_sources
data_source_files
model_connections
model_profiles
knowledge_bases
knowledge_versions
knowledge_documents
knowledge_annotations
conversations
conversation_data_sources
messages
tool_executions
sql_executions
model_executions
job_artifacts
```

All timestamp columns that represent instants use PostgreSQL timezone-aware timestamps (`TIMESTAMPTZ` semantics through `DateTime(timezone=True)`). Application-created timestamps are generated as timezone-aware UTC values.

## Requirements

- Python 3.12+
- Docker + Docker Compose, or separately managed PostgreSQL 16+ and Redis 7+

## Local setup

```bash
cp .env.example .env
```

Replace `JWT_SECRET` with a long random value.

Start infrastructure:

```bash
docker compose up -d postgres redis
```

Create a virtual environment and install the application plus development dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
```

Run migrations:

```bash
alembic upgrade head
```

Start the API:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 12201
```

Start one worker in another terminal:

```bash
python -m app.worker
```

Additional workers can be started as separate processes using the same command. Redis consumer groups distribute stream messages across workers.

## API endpoints in Task 1

### Health

```text
GET /health
GET /ready
```

`/health` confirms that the API process is running. `/ready` checks PostgreSQL and Redis and returns HTTP 503 until both dependencies are usable.

### Authentication

```text
POST /api/v1/auth/signup
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/auth/me
```

The default development email service logs a password-reset link to the application console. Production configuration requires `EMAIL_BACKEND=smtp`; the built-in SMTP transport uses environment configuration and does not add another framework dependency.

### Organizations

```text
GET   /api/v1/organizations
GET   /api/v1/organizations/current
PATCH /api/v1/organizations/{organization_id}
```

If a user belongs to multiple organizations, send:

```text
X-Organization-ID: <organization UUID>
```

All organization-scoped endpoints verify membership instead of trusting a supplied resource UUID.

### Jobs

```text
GET  /api/v1/jobs
GET  /api/v1/jobs/{job_id}
POST /api/v1/jobs/{job_id}/cancel
GET  /api/v1/jobs/{job_id}/events
```

Jobs are created by application services. Task 2 uses `datasource_test` and `excel_materialization`; Task 4 uses `knowledge_generation`. Task 5 uses `chat_query`; Task 6 adds `dashboard_refresh` using the same infrastructure.

## SSE resume behavior

The job event endpoint supports either:

```text
Last-Event-ID: 15
```

or:

```text
?after_sequence=15
```

The server subscribes to the live Redis channel before replaying PostgreSQL events. Every event has a monotonically increasing per-job `sequence`; duplicates caused by the replay/live overlap are discarded.

Important job events are committed to PostgreSQL before realtime publication. If Pub/Sub delivery is temporarily lost, clients recover through replay.

## Job state model

```text
queued -> running -> succeeded
   |         |          
   |         +-------> failed
   |         +-------> cancelled
   +-----------------> cancelled

running -> queued
```

`running -> queued` is reserved for bounded retry/recovery behavior.

Terminal jobs cannot be restarted through the Task 1 state machine.

## Worker recovery

Redis Streams consumer groups retain unacknowledged messages. If a worker disappears while handling a job, another worker can claim the stale pending message with `XAUTOCLAIM` after the configured idle threshold.

The PostgreSQL job lease is checked independently. A new worker cannot take a still-valid running lease, but it can reclaim a job whose lease has expired.

Workers heartbeat running leases using separate short-lived database sessions.

## Cancellation

Queued jobs are cancelled immediately in PostgreSQL. Running jobs receive `cancel_requested_at` and a durable `job.cancel_requested` event. Later task handlers must cooperate with cancellation and database-specific cancellation APIs where supported.

Closing an SSE connection never cancels a job.

## Error format

Application errors use a stable structure:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password."
  }
}
```

Validation errors use the same envelope and can include `field_errors`.

Raw database/Redis exceptions and stack traces are not intentionally returned to clients.

## Security notes

- Passwords are hashed with Argon2.
- Refresh tokens are high-entropy opaque values; only SHA-256 hashes are stored.
- Password-reset tokens are high-entropy opaque values; only hashes are stored.
- Access tokens are short-lived JWTs.
- Rotated refresh-token replay revokes remaining sessions for that user.
- Forgot-password responses do not reveal whether an email exists.
- Cross-organization resource access returns `404` rather than exposing resource existence.
- Secrets should be supplied only through environment configuration.

## Testing

Unit tests do not require PostgreSQL or Redis:

```bash
pytest tests/unit -q
```

Integration tests require installed project dependencies plus running PostgreSQL/Redis:

```bash
export RUN_INTEGRATION_TESTS=1
pytest tests/integration -q
```

The integration suite runs the Alembic migration and clears Task 1–3 test data between tests. Use a dedicated test environment/database when running it against anything other than the provided local Docker Compose services.

E2E tests are opt-in:

```bash
export RUN_E2E_TESTS=1
pytest tests/e2e -q
```

Static/project checks:

```bash
ruff check app tests
mypy app
python -m compileall -q app migrations tests
```

## Migration troubleshooting and checks

From `space/poc`, inspect migration failures with
`docker compose logs --no-color migrate`. After fixing the migration, run
`docker compose up --build -d` again. Keep the database volume; deleting volumes
or stamping Alembic to head is not a repair for failed schema changes.

The check-constraint convention is `ck_%(table_name)s_%(constraint_name)s`.
Use a logical name such as `valid_kind`, or wrap an already-expanded name in
`op.f("ck_job_artifacts_valid_kind")`. Migration 0005 historically created
`ck_job_artifacts_ck_job_artifacts_valid_kind`; migration 0008 handles both that
legacy name and the canonical name, then creates the canonical constraint.

Before releasing migrations, test `alembic upgrade head` on a disposable
PostgreSQL database, an upgrade from the previous release, and a downgrade then
re-upgrade where supported. Run `pytest tests/unit/test_html_artifact_migration.py`
from `backend` with development dependencies installed. DDL tests supplement
actual PostgreSQL migration tests; text-only contract tests cannot establish
that an upgrade works.

## Configuration

See `.env.example`. Important settings include:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `ACCESS_TOKEN_TTL_MINUTES`
- `REFRESH_TOKEN_TTL_DAYS`
- `PASSWORD_RESET_TTL_MINUTES`
- `PASSWORD_RESET_URL_BASE`
- `EMAIL_BACKEND` / SMTP settings
- `REDIS_JOB_STREAM`
- `REDIS_JOB_GROUP`
- `WORKER_LEASE_SECONDS`
- `WORKER_HEARTBEAT_SECONDS`
- `WORKER_STALE_IDLE_MS`
- `JOB_MAX_ATTEMPTS`
- `CORS_ORIGINS`
- `MODEL_PROVIDER_TIMEOUT_SECONDS`

## Intentionally deferred

Task 3 intentionally does **not** implement:

- knowledge bases or schema-document generation
- model routing/fallback orchestration
- model execution audit records
- conversations
- analytical agent tools
- SQL generation/validation/execution
- dashboards/reporting

Those belong to Tasks 4–6 and should build on the Task 1–3 contracts rather than rewriting them.
