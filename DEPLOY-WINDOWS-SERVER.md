# Deploying to Windows Server (no Docker)

This guide installs the POC on a Windows Server from the Git repository, runs every process as a Windows service, and serves the app to users over one HTTPS address. For running it on a developer machine, use `MANUAL-START.md` instead.

## What runs on the server

| Component | How it runs | Port (local only unless noted) |
| --- | --- | --- |
| PostgreSQL 16+ | Windows service from the EDB installer | 5432 |
| Redis-compatible server | Windows service (see step 3) | 6379 |
| Backend API (`uvicorn app.main:app`) | Windows service via NSSM | 12201 |
| Backend worker (`python -m app.worker`) | Windows service via NSSM | none |
| Reverse proxy (Caddy) | Windows service via NSSM: serves `frontend\dist`, forwards `/api`, `/health`, `/ready` to the API | **443 (open to users)** |

Users only reach port 443. The frontend is a static build, so Node.js is needed only to build it, not to run it. In production builds the frontend calls the API on its own origin (`window.location.origin`), so the proxy serving both from one address needs no CORS setup beyond `CORS_ORIGINS`.

Paths below assume:

- Code: `C:\apps\data-agent` (the Git checkout)
- Data: `C:\apps\data-agent-data` (uploads, exports, logs; outside the checkout)
- Tools: `C:\apps\tools` (NSSM, Caddy)

## 1. Install prerequisites

Install as Administrator, for all users:

| Software | Notes |
| --- | --- |
| Git for Windows | To clone and update the repository |
| Python 3.12 or 3.13 (64-bit, python.org installer) | Tick **Add to PATH** and **Install for all users**. `pyproject.toml` requires 3.12+. |
| Node.js 22 LTS | Build time only |
| PostgreSQL 16+ (EDB installer) | Installs the `postgresql-x64-<version>` service, set to Automatic |
| Microsoft ODBC Driver 18 for SQL Server | Required by the API and worker for MSSQL datasources |
| Microsoft Visual C++ Redistributable (x64) | Needed by some Python wheels (`pyodbc`, `duckdb`) |
| NSSM 2.24 | Unzip `win64\nssm.exe` to `C:\apps\tools\nssm.exe` |
| Caddy 2 (Windows amd64 `caddy.exe`) | Save to `C:\apps\tools\caddy.exe` |

Open a **new** Administrator PowerShell afterwards so PATH changes apply, then check:

```powershell
git --version; python --version; node --version; npm.cmd --version
Get-OdbcDriver -Name "ODBC Driver 18 for SQL Server" -Platform 64-bit
Get-Service postgresql*
```

## 2. Clone the repository

```powershell
New-Item -ItemType Directory -Force C:\apps, C:\apps\data-agent-data\runtime-data, C:\apps\data-agent-data\logs
git clone https://github.com/raghavendra-jayaramu-thermofisher/data-agent-poc.git C:\apps\data-agent
```

The repository is private: sign in with a GitHub account or deploy key that has read access. `.env` files and `backend/runtime-data/` are not in Git; you create them on the server.

## 3. Install Redis

The API and worker use Redis Streams with consumer groups (`XREADGROUP`, `XAUTOCLAIM`) for the job queue and Pub/Sub for live job events. Redis has no official Windows build. Choose one:

- **An existing Redis 6.2+ server** on the network (a Linux VM or a managed service such as Azure Cache for Redis). Nothing to install; set `REDIS_URL` in step 5. Simplest if your infrastructure team already runs one.
- **Memurai** (Redis 7 compatible, native Windows service). The installer creates the `Memurai` service on port 6379. The free Developer edition is licensed for development and testing only; production use needs a Memurai Enterprise licence.
- **Redis inside WSL2** (Windows Server 2022/2025). This is what `MANUAL-START.md` uses, but WSL does not start without a signed-in user, so it is a poor fit for an unattended server.

Check it responds (Memurai ships `memurai-cli.exe`; with a remote Redis, use any `redis-cli`):

```powershell
& "C:\Program Files\Memurai\memurai-cli.exe" ping   # expect PONG
```

Bind it to `127.0.0.1` (or protect it with a password and firewall) if it runs on this server.

## 4. Create the application database

In **SQL Shell (psql)** or `psql -U postgres`:

```sql
CREATE ROLE dbassistant LOGIN PASSWORD '<strong-password>';
CREATE DATABASE dbassistant OWNER dbassistant;
```

Keep PostgreSQL listening on `localhost` only (the default) unless it runs on a separate server.

## 5. Install and configure the backend

```powershell
Set-Location C:\apps\data-agent\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e .
Copy-Item .env.example .env
```

Generate the secrets:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"            # JWT_SECRET
.\.venv\Scripts\python.exe -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"  # encryption key
```

Edit `backend\.env` and change these lines (keep the rest of the template). Replace `dataagent.example.com` with the server's DNS name:

```dotenv
APP_ENV=production
DATABASE_URL=postgresql+asyncpg://dbassistant:<strong-password>@127.0.0.1:5432/dbassistant
REDIS_URL=redis://127.0.0.1:6379/0
JWT_SECRET=<first generated value>
SECRET_ENCRYPTION_CURRENT_VERSION=v1
SECRET_ENCRYPTION_KEYS={"v1":"<second generated value>"}
DATA_DIRECTORY=C:/apps/data-agent-data/runtime-data
CORS_ORIGINS=["https://dataagent.example.com"]
PASSWORD_RESET_URL_BASE=https://dataagent.example.com/reset-password
EMAIL_BACKEND=smtp
SMTP_HOST=<smtp relay>
SMTP_PORT=587
SMTP_USERNAME=<if required>
SMTP_PASSWORD=<if required>
SMTP_FROM_EMAIL=<sender address>
SMTP_STARTTLS=true
```

Notes:

- `APP_ENV=production` refuses to start unless `JWT_SECRET` is at least 32 characters, the development encryption key is replaced, and `EMAIL_BACKEND=smtp` with `SMTP_HOST` and `SMTP_FROM_EMAIL` set. If no SMTP relay is available yet, `APP_ENV=development` with `EMAIL_BACKEND=console` runs, but password-reset emails are only written to the API log.
- `SECRET_ENCRYPTION_KEYS` encrypts saved datasource and model-provider credentials. **Back it up.** Losing or changing it makes saved credentials unreadable.
- Restrict `backend\.env` so only Administrators and the service account can read it.

Create the database tables:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current     # shows the head revision
```

## 6. Build the frontend

```powershell
Set-Location C:\apps\data-agent\frontend
npm.cmd ci --legacy-peer-deps
npm.cmd run build
```

The output is `frontend\dist`. Do **not** create `frontend\.env.local` or `.env.production` on the server: Vite bakes `VITE_API_BASE_URL` into the build, and leaving it unset makes the app call the API on the address it was loaded from, which is what the proxy expects.

## 7. Choose the service account

The API and worker connect to MSSQL as the Windows account the services run under when a datasource uses **Windows Authentication**.

- MSSQL **SQL Authentication** only: `LocalSystem` or a local service account is enough.
- MSSQL **Windows Authentication**: run both services as a domain service account (a gMSA is best). Give that account a SQL Server login with read access to the reporting database, **Log on as a service** rights, and Modify rights on `C:\apps\data-agent-data`.

## 8. Install the API and worker as services

Administrator PowerShell:

```powershell
$nssm = "C:\apps\tools\nssm.exe"
$backend = "C:\apps\data-agent\backend"
$py = "$backend\.venv\Scripts\python.exe"
$logs = "C:\apps\data-agent-data\logs"
# Use the Redis service you installed; omit it for a remote Redis.
$deps = "postgresql-x64-18 Memurai"

& $nssm install DataAgentApi $py "-m uvicorn app.main:app --host 127.0.0.1 --port 12201 --proxy-headers --timeout-graceful-shutdown 3"
& $nssm set DataAgentApi AppDirectory $backend
& $nssm set DataAgentApi AppStdout "$logs\api.out.log"
& $nssm set DataAgentApi AppStderr "$logs\api.err.log"
& $nssm set DataAgentApi DependOnService $deps

& $nssm install DataAgentWorker $py "-m app.worker"
& $nssm set DataAgentWorker AppDirectory $backend
& $nssm set DataAgentWorker AppStdout "$logs\worker.out.log"
& $nssm set DataAgentWorker AppStderr "$logs\worker.err.log"
& $nssm set DataAgentWorker DependOnService $deps

foreach ($svc in "DataAgentApi", "DataAgentWorker") {
    & $nssm set $svc Start SERVICE_AUTO_START
    & $nssm set $svc AppRotateFiles 1
    & $nssm set $svc AppRotateOnline 1
    & $nssm set $svc AppRotateBytes 10485760
    & $nssm set $svc AppStopMethodConsole 15000
}
```

`AppDirectory` must be the `backend` folder: the backend reads `.env` from its working directory.

For Windows Authentication to MSSQL, set the account on both services (for a gMSA, use `DOMAIN\name$` and an empty password):

```powershell
& $nssm set DataAgentApi ObjectName "DOMAIN\svc-dataagent" "<password>"
& $nssm set DataAgentWorker ObjectName "DOMAIN\svc-dataagent" "<password>"
```

Start them:

```powershell
Start-Service DataAgentApi, DataAgentWorker
Invoke-RestMethod http://127.0.0.1:12201/ready | ConvertTo-Json -Depth 4
Get-Content C:\apps\data-agent-data\logs\worker.out.log -Tail 20   # look for worker_started
```

`/ready` should report `ready` for both `postgres` and `redis`. Startup failures (for example a settings error) appear in the `*.err.log` files.

## 9. Serve the app with Caddy

Get a TLS certificate for `dataagent.example.com` from your internal CA (PEM certificate and key) and save them under `C:\apps\tools\certs\`. Create `C:\apps\tools\Caddyfile`:

```caddyfile
dataagent.example.com {
	tls C:/apps/tools/certs/dataagent.crt C:/apps/tools/certs/dataagent.key

	request_body {
		max_size 110MB
	}

	@backend path /api/* /health /ready
	handle @backend {
		# Job progress streams over Server-Sent Events: flush immediately.
		reverse_proxy 127.0.0.1:12201 {
			flush_interval -1
		}
	}

	handle {
		root * C:/apps/data-agent/frontend/dist
		header /assets/* Cache-Control "public, max-age=31536000, immutable"
		try_files {path} /index.html
		file_server
	}
}
```

`110MB` matches the 100 MB Excel upload limit. Users who sign in from the browser use `/api/...`; the interactive API docs stay reachable on the server itself at `http://127.0.0.1:12201/docs`.

Check the file, then install Caddy as a service:

```powershell
C:\apps\tools\caddy.exe validate --config C:\apps\tools\Caddyfile
& $nssm install DataAgentProxy C:\apps\tools\caddy.exe "run --config C:\apps\tools\Caddyfile"
& $nssm set DataAgentProxy AppDirectory C:\apps\tools
& $nssm set DataAgentProxy AppStdout "$logs\proxy.out.log"
& $nssm set DataAgentProxy AppStderr "$logs\proxy.err.log"
& $nssm set DataAgentProxy DependOnService DataAgentApi
& $nssm set DataAgentProxy Start SERVICE_AUTO_START
Start-Service DataAgentProxy

New-NetFirewallRule -DisplayName "Data Agent HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

Do not open 12201, 5432 or 6379 in the firewall.

**Using IIS instead of Caddy** is possible: install URL Rewrite and Application Request Routing, enable the ARR proxy, point the site at `frontend\dist`, add rewrite rules sending `/api/*`, `/health` and `/ready` to `http://127.0.0.1:12201`, and an SPA fallback rule to `/index.html`. Also set ARR's response buffer threshold to `0` and disable dynamic compression for `/api/`, otherwise live job progress (Server-Sent Events) stalls until the job ends; and raise `maxAllowedContentLength` to 115343360 for uploads.

## 10. Verify

From another machine on the network:

```powershell
Invoke-RestMethod https://dataagent.example.com/health
Invoke-RestMethod https://dataagent.example.com/ready | ConvertTo-Json -Depth 4
```

Then open `https://dataagent.example.com`, sign up, add the MSSQL datasource and model provider, test the connection, generate knowledge, and ask a question. The answer streaming in step by step confirms the worker, Redis and the SSE proxy settings all work.

## Updating to a new version

```powershell
Stop-Service DataAgentProxy, DataAgentApi, DataAgentWorker
Set-Location C:\apps\data-agent
git pull --ff-only

Set-Location backend
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic upgrade head

Set-Location ..\frontend
npm.cmd ci --legacy-peer-deps
npm.cmd run build

Start-Service DataAgentApi, DataAgentWorker, DataAgentProxy
```

Back up the database before pulling a version that adds migrations. Never run `alembic downgrade` against the live database to test a migration. To roll back, check out the earlier commit and restore the backup.

## Backups

| What | How |
| --- | --- |
| Application database | Scheduled `pg_dump -Fc -U dbassistant dbassistant > dbassistant.dump` |
| Uploaded files, exports | `C:\apps\data-agent-data\runtime-data` |
| Secrets | `backend\.env`, especially `SECRET_ENCRYPTION_KEYS` and `JWT_SECRET` |

Redis holds only the job queue and live events; it does not need a backup.

## Troubleshooting

- **A service stops immediately:** read its `*.err.log` in `C:\apps\data-agent-data\logs`. A settings error such as `EMAIL_BACKEND must be smtp in production` names the `.env` line to fix.
- **`/ready` shows Redis not ready / jobs stay queued:** check the Redis service and `REDIS_URL`, then restart `DataAgentWorker`.
- **The page loads but sign-in fails with a network error:** the frontend was built with a `VITE_API_BASE_URL`; delete any `frontend\.env*` file other than `.env.example` and rebuild.
- **Answers only appear when the job finishes:** the proxy is buffering Server-Sent Events (see the Caddy `flush_interval` and IIS buffering notes).
- **MSSQL `Login failed for user 'NT AUTHORITY\...'`:** the services are running as a local account; set `ObjectName` to the domain account that has the SQL login (step 7).
- **Uploads fail with 413:** raise the proxy body limit.
