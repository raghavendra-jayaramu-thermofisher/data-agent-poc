@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   Data Agent - Windows Server Startup Script
echo ===================================================
echo.

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"

:: Check if backend virtual environment exists
if not exist "%BACKEND_DIR%\.venv\Scripts\activate.bat" (
    echo [1/3] Creating backend virtual environment...
    cd /d "%BACKEND_DIR%"
    python -m venv .venv
    call .venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -e .
) else (
    echo [1/3] Backend virtual environment found.
)

:: Run database schema migrations
echo [2/3] Running database schema migrations...
cd /d "%BACKEND_DIR%"
call .venv\Scripts\activate.bat
alembic upgrade head

:: Check frontend build
if not exist "%FRONTEND_DIR%\dist\index.html" (
    echo [3/3] Building frontend bundle...
    cd /d "%FRONTEND_DIR%"
    call npm install
    call npm run build
) else (
    echo [3/3] Frontend build found.
)

echo.
echo ===================================================
echo   Launching All Services on Ports 12201 and 12200
echo ===================================================
echo.

:: Launch FastAPI Server on port 12201
start "Data Agent - API Server (Port 12201)" cmd /k "cd /d "%BACKEND_DIR%" && call .venv\Scripts\activate.bat && uvicorn app.main:app --host 127.0.0.1 --port 12201"

:: Launch Background Agent Worker
start "Data Agent - Worker Service" cmd /k "cd /d "%BACKEND_DIR%" && call .venv\Scripts\activate.bat && python -m app.worker"

:: Launch Frontend Web UI on port 12200 (with automatic API proxy to port 12201)
start "Data Agent - Frontend UI (Port 12200)" cmd /k "cd /d "%FRONTEND_DIR%" && npm run preview -- --port 12200 --host 127.0.0.1"

echo.
echo ===================================================
echo   Data Agent is now live!
echo   Web App URL: http://localhost:12200
echo   API URL:     http://localhost:12201
echo ===================================================
echo.
pause
