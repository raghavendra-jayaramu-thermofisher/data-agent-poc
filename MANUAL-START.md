# Manual startup on Windows

This guide starts the existing installation at `C:\Projects\data-agent\space\poc` without Docker. PostgreSQL, Node.js, the backend virtual environment, and frontend dependencies are already installed. The application database and migrations have already been created.

Start services in this order:

**PostgreSQL → Ubuntu/Redis → backend API → backend worker → frontend.**

Use Windows PowerShell for the Windows commands below. Only the Redis commands run inside Ubuntu. Keep the Ubuntu, API, worker, and frontend windows open while using the application.

## 1. Start PostgreSQL

Open **Windows PowerShell as Administrator** and run:

```powershell
Get-Service -Name postgresql-x64-18
Start-Service -Name postgresql-x64-18
Get-Service -Name postgresql-x64-18
```

Expected status: `Running`.

The service is configured to start automatically when Windows boots. If it is already running, proceed to the next step. Keep this administrator window available for stopping PostgreSQL later; run the application processes in ordinary PowerShell windows.

## 2. Start Ubuntu and Redis

Open a new ordinary **Windows PowerShell** window:

```powershell
wsl -d Ubuntu
```

The prompt changes to an Ubuntu/Linux prompt. Run these commands **inside Ubuntu**:

```bash
sudo systemctl start redis-server
redis-cli ping
```

Expected response:

```text
PONG
```

If `sudo` asks for a password, enter the Ubuntu password created during WSL setup. The password does not appear while typing.

Redis is enabled to start when Ubuntu starts; the explicit start command also works if it is already running. Keep this Ubuntu window open. Systemd services alone do not keep the WSL instance alive.

## 3. Start the backend API

Open another ordinary **Windows PowerShell** window:

```powershell
Set-Location C:\Projects\data-agent\space\poc\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 12201
```

Wait for the application startup message. The API runs at:

- API documentation: <http://127.0.0.1:12201/docs>
- Readiness check: <http://127.0.0.1:12201/ready>

Keep this window open. The command uses the existing virtual environment directly, so activating it is unnecessary.

## 4. Start the backend worker

Open another ordinary **Windows PowerShell** window:

```powershell
Set-Location C:\Projects\data-agent\space\poc\backend
.\.venv\Scripts\python.exe -m app.worker
```

Expected log message: `worker_started`.

Keep this window open. The worker handles background operations such as connection tests, knowledge generation, and analytical jobs. It uses the same backend configuration as the API.

## 5. Start the frontend

Open another ordinary **Windows PowerShell** window. Use a new window if Node.js was installed after the window was opened.

```powershell
Set-Location C:\Projects\data-agent\space\poc\frontend
node --version
npm.cmd --version
npm.cmd run dev
```

Expected Vite startup address:

```text
http://127.0.0.1:12200/
```

Keep this window open and open <http://127.0.0.1:12200> in your browser. Use **Sign up** for a new application account or **Sign in** for an existing account. PostgreSQL accounts are separate from application accounts.

`npm.cmd` runs the Windows npm command directly and does not require changing PowerShell's script execution policy. This starts the frontend development server.

## 6. Verify the startup

In an available **Windows PowerShell** window, run:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:12201/health
Invoke-RestMethod -Uri http://127.0.0.1:12201/ready | ConvertTo-Json -Depth 4
(Invoke-WebRequest -Uri http://127.0.0.1:12200 -UseBasicParsing).StatusCode
```

Expected results:

- `/health`: `status` is `ok`.
- `/ready`: `status` is `ready`, and both `postgres` and `redis` are `ready`.
- Frontend HTTP status: `200`.
- The worker window shows `worker_started` and stays running.

The readiness endpoint checks PostgreSQL and Redis. Verify a real operation in the application to confirm its datasource and model-provider configuration.

## Configuration files

| File | Used by | Settings to review |
| --- | --- | --- |
| `backend\.env` | API and worker | PostgreSQL connection, Redis connection, local data directory, browser origins, application secrets |
| `frontend\.env.local` | Frontend | Backend API address |
| Project root `.env` | Docker Compose | Container settings; the manual commands above do not load this file automatically |

For this installation, edit these settings in the existing `backend\.env` if the endpoints change. Retain its other settings and application secrets.

```dotenv
DATABASE_URL=postgresql+asyncpg://<database-user>:<database-password>@127.0.0.1:5432/dbassistant
REDIS_URL=redis://127.0.0.1:6379/0
DATA_DIRECTORY=./runtime-data
CORS_ORIGINS=["http://localhost:12200","http://127.0.0.1:12200"]
PASSWORD_RESET_URL_BASE=http://127.0.0.1:12200/reset-password
```

The angle-bracket values are placeholders; keep the actual database credentials in the local `.env` file. Preserve `SECRET_ENCRYPTION_KEYS` when retaining existing database data, because saved datasource and model credentials depend on those keys.

The frontend's `frontend\.env.local` contains:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:12201
```

Restart the affected process after changing its environment file. Actual environment files are excluded from Git; the tracked `.env.example` files are templates. The backend template uses PostgreSQL port `12202` and Redis port `12203`, so adjust those to `5432` and `6379` for this installation.

## Database migrations after an update

The current database is already migrated. When a future code update adds database migrations, stop the API and worker, then run this in **Windows PowerShell** while PostgreSQL is running:

```powershell
Set-Location C:\Projects\data-agent\space\poc\backend
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Then start the API and worker again. Starting the existing application does not require recreating its database or reinstalling dependencies.

## Stop everything

1. Press **Ctrl+C** in the frontend window.
2. Press **Ctrl+C** in the worker window and wait for it to exit.
3. Press **Ctrl+C** in the API window and wait for it to exit.
4. In the **Ubuntu** window, stop Redis:

   ```bash
   sudo systemctl stop redis-server
   exit
   ```

5. In **Windows PowerShell**, stop Ubuntu:

   ```powershell
   wsl --terminate Ubuntu
   ```

6. In **Windows PowerShell as Administrator**, stop PostgreSQL:

   ```powershell
   Stop-Service -Name postgresql-x64-18
   Get-Service -Name postgresql-x64-18
   ```

   Expected PostgreSQL status: `Stopped`.

This preserves the project, database, environment files, and uploaded data. PostgreSQL remains configured for automatic startup on the next Windows boot. Ubuntu termination also ends any other processes running in that Ubuntu distribution.

## Troubleshooting

- **`node` or `npm.cmd` is not recognized:** open a new PowerShell window. Node.js is installed under `C:\Program Files\nodejs`; verify that this directory is on Windows PATH.
- **Redis connection refused:** open Ubuntu, start `redis-server`, and verify `redis-cli ping` returns `PONG`.
- **PostgreSQL connection refused:** verify `postgresql-x64-18` is running and `DATABASE_URL` uses the correct port.
- **PostgreSQL authentication failure:** review the database username/password in `backend\.env` and ensure that account has access to `dbassistant`.
- **API or frontend port already in use:** stop the existing instance before starting another. Docker and manual startup use the same default API/frontend ports.
- **Jobs stay queued:** check that the worker is running from the `backend` directory with the same `.env` as the API.
- **Browser cannot reach the API:** check `frontend\.env.local`, backend `CORS_ORIGINS`, and the API readiness endpoint.

## MSSQL Windows authentication

1. Start the API and worker using the PowerShell commands above, under the same Windows account. Run `whoami` in each terminal to confirm the account.
2. That Windows account must have a SQL Server login and access to the selected database, schema and tables. Verify it in SQL Server Management Studio using **Windows Authentication**.
3. In the application, create or edit a **Microsoft SQL Server** datasource and select **Windows Authentication**. Enter the host, port, database and schema. No database username or password is needed.
4. Keep the correct ODBC driver and encryption settings. Both API and worker need Microsoft ODBC Driver 18 for SQL Server (or the configured driver).
5. Save, test the connection, then generate or regenerate knowledge. Queries use the same Windows account.

This uses the Windows account running the backend, regardless of who signs into the web application. A frontend running in a browser or Docker does not change that account.

The API and worker must run directly on Windows for this mode. For the project's Linux Docker API/worker, select **SQL Authentication** and enter SQL Server credentials. Existing MSSQL connections continue using SQL authentication unless you change the selection.

Switching to Windows authentication deletes the saved SQL credentials and clears the connection test and knowledge version. Switching back requires a new SQL username/password. Test the connection and regenerate knowledge after changing modes. No additional `.env` setting or database migration is required.
