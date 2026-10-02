# DB Assistant Backend — Setup Guide

This guide is for developers and DevOps engineers setting up the current DB Assistant backend contained in this repository. It is based on the implemented Task 6 code (`0.6.0`), not the older README heading.

## 1. Runtime architecture

DB Assistant runs as separate API and worker processes backed by PostgreSQL and Redis.

```text
Frontend
   |
   | HTTP + SSE
   v
FastAPI API  --------------------> PostgreSQL
   |                                durable application state
   |
   +-----------------------------> Redis
                                      |
                                      | Redis Streams + Pub/Sub
                                      v
                               Agent Worker(s)
                                      |
                    +-----------------+------------------+
                    |                 |                  |
                    v                 v                  v
                 Models           Knowledge         SQL execution
                                                      |
                                    +-----------------+----------------+
                                    |                 |                |
                                 PostgreSQL         MySQL            MSSQL
                                                                       \
                                                                        DuckDB
                                                                          ^
                                                                          |
                                                                       Excel
```

Important operational properties:

- PostgreSQL is the durable application database.
- Redis is used for job queue coordination and realtime job-event delivery.
- Long-running work is executed by `python -m app.worker`, not inside the API request.
- Closing the browser or SSE connection does not cancel a running job.
- Uploaded Excel workbooks are materialized to persistent DuckDB files under `DATA_DIRECTORY`.
- The API and worker can be deployed independently as long as they share PostgreSQL, Redis, configuration, and the managed data directory.

## 2. Prerequisites

For the standard local setup:

- Python 3.12+
- Docker with Docker Compose
- Git/terminal tooling

For Microsoft SQL Server connectivity when running the Python process directly on the host, install:

- unixODBC
- Microsoft ODBC Driver 18 for SQL Server

The provided `Dockerfile` installs `unixODBC` and `msodbcsql18` automatically.

## 3. Local setup

Run all commands from the repository's `backend/` directory.

### 3.1 Create the environment file

```bash
cp .env.example .env
```

For development, the example values are enough to start PostgreSQL and Redis. Before using the environment for anything beyond local development, replace the development secrets described below.

### 3.2 Generate a JWT secret

Generate a high-entropy secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Set the result as:

```env
JWT_SECRET=<generated value>
```

Production requires a JWT secret of at least 32 characters.

### 3.3 Generate the encrypted-secret key

Datasource passwords and model API keys are encrypted with a versioned 32-byte AES key. Generate a URL-safe base64 key:

```bash
python -c "import base64,secrets; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
```

Configure it as JSON:

```env
SECRET_ENCRYPTION_CURRENT_VERSION=v1
SECRET_ENCRYPTION_KEYS={"v1":"<generated base64 key>"}
```

Do not use the development key from `.env.example` in production. Back up this key securely. Losing all configured encryption keys makes stored datasource/model credentials undecryptable.

### 3.4 Start PostgreSQL and Redis

The included Compose file starts infrastructure only:

```bash
docker compose up -d postgres redis
```

Verify containers:

```bash
docker compose ps
```

Default local endpoints are:

```text
PostgreSQL: localhost:12202
Redis:      localhost:12203
```

### 3.5 Create and activate a virtual environment

Linux/macOS:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

Windows PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3.6 Install the backend

Development installation:

```bash
python -m pip install --upgrade pip
pip install -e '.[dev]'
```

Production/runtime-only installation:

```bash
pip install .
```

### 3.7 Run database migrations

Migrations are **not** run automatically by the API container or API process.

```bash
alembic upgrade head
```

Current migration chain:

```text
0001_task1_foundation.py
0002_task2_data_sources.py
0003_task3_models.py
0004_task4_knowledge.py
0005_task5_agent.py
0006_task6_reporting_hardening.py
```

Check the current database revision when needed:

```bash
alembic current
```

### 3.8 Start the API

Development:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 12201
```

Production-style local process:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 12201
```

Useful URLs:

```text
API:               http://localhost:12201
Health:            http://localhost:12201/health
Readiness:         http://localhost:12201/ready
Swagger UI:        http://localhost:12201/docs
OpenAPI JSON:      http://localhost:12201/openapi.json
```

### 3.9 Start at least one worker

Use a separate terminal/process with the same `.env`:

```bash
source .venv/bin/activate
python -m app.worker
```

The worker handles:

- `datasource_test`
- `excel_materialization`
- `knowledge_generation`
- `chat_query`
- `dashboard_refresh`

Without a worker, asynchronous API requests can return a `job_id`, but the job will remain queued.

Additional worker processes can be started with the same command. Redis consumer groups distribute jobs across workers. Each worker can process multiple jobs concurrently according to `WORKER_CONCURRENCY` (default: `4`).

### 3.10 Run maintenance periodically

The repository includes an explicit one-shot maintenance command:

```bash
python -m app.maintenance
```

It performs:

- cleanup of expired authentication sessions/action tokens beyond retention;
- recovery/requeue of abandoned jobs whose worker lease expired;
- cleanup of stale temporary `*.tmp.duckdb` files.

For a production single-server deployment, schedule this command periodically using cron, systemd timer, or the equivalent scheduler.

## 4. Required configuration

All settings are read from environment variables and, by default, a local `.env` file.

### 4.1 Core settings

| Variable | Development default | Purpose |
|---|---|---|
| `APP_ENV` | `development` | `development`, `test`, or `production` |
| `APP_NAME` | `DB Assistant API` | FastAPI application name |
| `API_V1_PREFIX` | `/api/v1` | Versioned API prefix |
| `DATABASE_URL` | `postgresql+asyncpg://dbassistant:dbassistant@localhost:12202/dbassistant` | Durable application PostgreSQL |
| `REDIS_URL` | `redis://localhost:12203/0` | Queue/realtime Redis |
| `LOG_LEVEL` | `INFO` | Application logging level |
| `CORS_ORIGINS` | `["http://localhost:12200"]` | Allowed frontend origins; JSON list |

### 4.2 Authentication and email

| Variable | Default | Notes |
|---|---:|---|
| `JWT_SECRET` | development value | Replace in production; minimum 32 chars in production |
| `JWT_ALGORITHM` | `HS256` | Supported: `HS256`, `HS384`, `HS512` |
| `ACCESS_TOKEN_TTL_MINUTES` | `15` | JWT lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Opaque refresh-token lifetime |
| `PASSWORD_RESET_TTL_MINUTES` | `30` | Reset-token lifetime |
| `PASSWORD_RESET_URL_BASE` | `http://localhost:12200/reset-password` | Frontend reset-password page |
| `EMAIL_BACKEND` | `console` | Must be `smtp` in production |
| `SMTP_HOST` | empty | Required when `EMAIL_BACKEND=smtp` |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USERNAME` | empty | Optional depending on server |
| `SMTP_PASSWORD` | empty | SMTP credential |
| `SMTP_FROM_EMAIL` | empty | Required for SMTP backend |
| `SMTP_STARTTLS` | `true` | Enable STARTTLS |

Development password-reset links are printed by the console email backend. In production, `APP_ENV=production` refuses to start unless `EMAIL_BACKEND=smtp` is configured.

### 4.3 Job/worker settings

| Variable | Default | Purpose |
|---|---:|---|
| `REDIS_JOB_STREAM` | `dbassistant:jobs` | Redis Stream name |
| `REDIS_JOB_GROUP` | `dbassistant-workers` | Redis consumer group |
| `WORKER_ID` | auto/empty | Optional explicit worker identity |
| `WORKER_BLOCK_MS` | `5000` | Redis stream blocking interval |
| `WORKER_LEASE_SECONDS` | `60` | PostgreSQL running-job lease |
| `WORKER_HEARTBEAT_SECONDS` | `20` | Lease heartbeat interval |
| `WORKER_STALE_IDLE_MS` | `60000` | Redis pending-message reclaim threshold |
| `WORKER_CONCURRENCY` | `4` | Concurrent jobs per worker process |
| `JOB_MAX_ATTEMPTS` | `3` | Maximum bounded attempts |
| `MAX_ACTIVE_JOBS_PER_USER` | `5` | Per-user active job cap |
| `MAX_ACTIVE_JOBS_PER_ORGANIZATION` | `20` | Per-workspace active job cap |

### 4.4 Local managed data and datasource settings

| Variable | Default | Purpose |
|---|---:|---|
| `DATA_DIRECTORY` | `./runtime-data` | Persistent managed Excel/DuckDB storage |
| `MAX_EXCEL_UPLOAD_BYTES` | `104857600` | Maximum Excel upload (100 MiB) |
| `EXCEL_BATCH_SIZE` | `2000` | Excel materialization batch size |
| `DATASOURCE_OPERATION_TIMEOUT_SECONDS` | `30` | Datasource operation timeout |
| `DATASOURCE_QUERY_MAX_ROWS` | `1000` | Generic datasource query cap |
| `SECRET_ENCRYPTION_CURRENT_VERSION` | `v1` | Active encryption-key version |
| `SECRET_ENCRYPTION_KEYS` | development key ring | JSON object of version -> base64 32-byte key |

`DATA_DIRECTORY` must be persistent and writable by both API and worker processes. If API and workers run in separate containers on one server, mount the same host directory/volume into both at the same path.

### 4.5 Model and analytical-agent limits

| Variable | Default | Purpose |
|---|---:|---|
| `MODEL_PROVIDER_TIMEOUT_SECONDS` | `30` | OpenAI-compatible provider timeout |
| `AGENT_JOB_TIMEOUT_SECONDS` | `180` | Maximum analytical job duration |
| `AGENT_MAX_TOOL_CALLS` | `12` | Maximum tool calls per analysis |
| `AGENT_MAX_SQL_ATTEMPTS` | `5` | Maximum SQL attempts |
| `AGENT_QUERY_TIMEOUT_SECONDS` | `30` | Per-query timeout |
| `AGENT_RESULT_MAX_ROWS` | `2000` | Maximum persisted query rows |
| `AGENT_RESULT_MAX_BYTES` | `1000000` | Maximum persisted result bytes |
| `AGENT_MODEL_RESULT_MAX_ROWS` | `200` | Maximum rows sent back to model preview |
| `AGENT_MODEL_RESULT_MAX_BYTES` | `200000` | Maximum model result-preview bytes |
| `AGENT_CHART_MAX_ROWS` | `500` | Maximum rows accepted by chart generation |
| `AGENT_MAX_HISTORY_MESSAGES` | `24` | Maximum conversation-history messages supplied to agent |

These limits are enforced server-side. The frontend must not assume an LLM-provided `LIMIT` is the safety mechanism.

### 4.6 Maintenance settings

| Variable | Default | Purpose |
|---|---:|---|
| `AUTH_EXPIRED_RETENTION_DAYS` | `30` | Retain expired auth records before cleanup |
| `STALE_JOB_GRACE_SECONDS` | `300` | Grace period before abandoned-job recovery |
| `TEMPORARY_FILE_RETENTION_HOURS` | `24` | Age threshold for temporary DuckDB cleanup |

## 5. Production deployment model

The provided `docker-compose.yml` is intentionally limited to PostgreSQL and Redis. For production, run the application image as at least two services/processes:

```text
api      -> uvicorn app.main:app --host 0.0.0.0 --port 8000 (container-internal)
worker   -> python -m app.worker
```

Use the same application image for both if convenient.

Before starting a new application release:

```bash
alembic upgrade head
```

Then start/restart API and workers.

### 5.1 Persistent state that must survive restarts

Back up/persist:

1. PostgreSQL database — authoritative durable application state.
2. `DATA_DIRECTORY` — uploaded Excel sources and materialized DuckDB files.
3. `SECRET_ENCRYPTION_KEYS` — required to decrypt stored datasource/model secrets.
4. Redis persistence is useful for queue continuity, but PostgreSQL remains authoritative for job state/events.

### 5.2 API restart behavior

The API process does not own job execution. Restarting the API does not intentionally cancel jobs already queued/running in workers.

### 5.3 Worker restart behavior

Jobs have Redis consumer-group state plus a PostgreSQL lease/heartbeat. Stale pending stream messages can be reclaimed, and expired running leases can be recovered/requeued. Keep maintenance/recovery enabled operationally.

## 6. Deployment checks

After deployment:

### API liveness

```bash
curl -s http://localhost:12201/health
```

Expected:

```json
{"status":"ok"}
```

### Dependency readiness

```bash
curl -i http://localhost:12201/ready
```

Expected HTTP `200` when PostgreSQL and Redis are available:

```json
{
  "status": "ready",
  "components": {
    "postgres": "ready",
    "redis": "ready"
  }
}
```

If either dependency is unavailable, `/ready` returns HTTP `503`.

### Verify migration state

```bash
alembic current
```

It should report the current head revision.

### Verify a worker is active

Create a datasource test/Excel/knowledge/chat job from the API and confirm it transitions:

```text
queued -> running -> succeeded|failed|cancelled
```

The admin-only endpoint below is also useful for operational inspection:

```text
GET /api/v1/ops/status
```

It returns job counts, Redis stream length, and configured concurrency/query limits.

## 7. Database datasource requirements

### PostgreSQL

The backend uses `asyncpg`. The configured database user should have only the access required by the product. Analytical SQL is validated as read-only by the backend.

### MySQL

The backend uses `asyncmy`.

### Microsoft SQL Server

The backend uses `aioodbc`/`pyodbc`. Ensure the configured ODBC driver exists. The default datasource configuration expects:

```text
ODBC Driver 18 for SQL Server
```

The provided Docker image installs this driver.

### Excel

Excel is user-facing as `display_type=excel`, but internally the datasource has `kind=duckdb`. Flow:

```text
.xlsx upload
-> datasource status preparing
-> excel_materialization job
-> workbook stored under DATA_DIRECTORY
-> temporary DuckDB generated
-> validation
-> atomic promotion
-> datasource active
```

Do not delete `DATA_DIRECTORY` between deployments.

## 8. Model provider requirement

DB Assistant accepts OpenAI-compatible API roots. A model connection stores:

- connection name;
- `base_url` such as `https://api.openai.com/v1` or a compatible self-hosted `/v1` root;
- optional encrypted API key.

At least one enabled model profile is required before analytical chat jobs can run successfully. The first enabled profile becomes the default automatically unless another default is explicitly set.

## 9. Tests and quality checks

Unit tests:

```bash
pytest tests/unit -q
```

Integration tests require PostgreSQL and Redis and are opt-in:

```bash
export RUN_INTEGRATION_TESTS=1
pytest tests/integration -q
```

E2E tests are opt-in:

```bash
export RUN_E2E_TESTS=1
pytest tests/e2e -q
```

Static checks:

```bash
ruff check app tests
mypy app
python -m compileall -q app migrations tests
```

Use a dedicated test database/environment for integration or E2E tests outside the provided local development stack.

## 10. Reset local test data

The repository includes a guarded reset command for returning the local Docker
Compose environment to an empty data state after manual testing:

```powershell
./scripts/reset-test-environment.ps1
```

The command only runs when the rendered Compose configuration uses
`APP_ENV=development`, the local `postgres` service, Redis database `0` on the
local `redis` service, and `/app/runtime-data`. It asks for confirmation and
then:

1. stops the API and worker so no writes can occur;
2. creates PostgreSQL and `application-data` backups outside the repository;
3. restore-tests PostgreSQL and validates both backup archives;
4. truncates application tables while preserving `alembic_version` and the
   current schema;
5. clears Redis, uploaded workbooks, generated artifacts, and artifact run
   files;
6. restarts the API and worker; and
7. verifies the empty state and API readiness before writing a JSON manifest.

Preview the targets without changing anything:

```powershell
./scripts/reset-test-environment.ps1 -WhatIf
```

For an explicitly non-interactive local run, suppress the confirmation prompt:

```powershell
./scripts/reset-test-environment.ps1 -Confirm:$false
```

Backups default to the sibling `bi-backups` directory. Use
`-BackupDirectory D:\path\to\backups` to select another location. The reset
removes users and authentication sessions, so clear the browser's site data or
sign in with a newly created account afterward.

Do not use `docker compose down -v` as a substitute: it removes the working
schema as well as the data and provides no verified backup.

## 11. Upgrade procedure

Recommended release sequence:

```text
1. Back up PostgreSQL and DATA_DIRECTORY.
2. Preserve/verify encryption key ring.
3. Deploy the new application image/code.
4. Run `alembic upgrade head` once.
5. Restart API process(es).
6. Restart worker process(es).
7. Verify `/health` and `/ready`.
8. Verify a background job completes.
9. Run `python -m app.maintenance` or ensure its scheduler is active.
```

Do not run multiple independent migrations against the same database concurrently.

## 12. Common troubleshooting

### `/ready` returns 503

Check:

- `DATABASE_URL`;
- PostgreSQL container/service health;
- `REDIS_URL`;
- Redis health/network access.

### Jobs stay `queued`

Check that at least one worker is running with the same:

- PostgreSQL database;
- Redis instance;
- `REDIS_JOB_STREAM`;
- `REDIS_JOB_GROUP`;
- encryption keys;
- `DATA_DIRECTORY`.

### Excel upload succeeds but never becomes active

Inspect the returned `job_id` using:

```text
GET /api/v1/jobs/{job_id}
GET /api/v1/jobs/{job_id}/events
```

Also verify the worker can write to `DATA_DIRECTORY`.

### MSSQL connection fails locally

Verify the ODBC driver:

```bash
odbcinst -q -d
```

The configured datasource defaults to `ODBC Driver 18 for SQL Server`.

### Production startup fails immediately

The settings validator intentionally refuses unsafe production configuration. Check especially:

- `JWT_SECRET` length;
- `EMAIL_BACKEND=smtp`;
- `SMTP_HOST`;
- `SMTP_FROM_EMAIL`;
- replacement of the development encryption key;
- presence of `SECRET_ENCRYPTION_CURRENT_VERSION` in `SECRET_ENCRYPTION_KEYS`.

## 13. Minimal local startup checklist

```text
[ ] Python 3.12+ installed
[ ] `cp .env.example .env`
[ ] JWT/encryption secrets configured
[ ] `docker compose up -d postgres redis`
[ ] virtualenv activated
[ ] `pip install -e '.[dev]'`
[ ] `alembic upgrade head`
[ ] API started with Uvicorn
[ ] worker started with `python -m app.worker`
[ ] `/health` = 200
[ ] `/ready` = 200
[ ] frontend origin included in `CORS_ORIGINS`
[ ] persistent `DATA_DIRECTORY` configured
```
