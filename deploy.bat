@echo off
REM ═══════════════════════════════════════════════════════════════
REM The Katanguri's Kitchen — Production Deployment Script (Batch)
REM ═══════════════════════════════════════════════════════════════
REM Usage: .\deploy.bat
REM ═══════════════════════════════════════════════════════════════

echo [1/6] Checking prerequisites...
where docker >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Docker not found. Please install Docker Desktop from https://docs.docker.com/desktop/setup/install/windows-install/
    pause
    exit /b 1
)

docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Docker Desktop is installed but not running. Start it from Start Menu or:
    echo   "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Then wait for the Docker whale icon to appear in your system tray.
    pause
    exit /b 1
)

set "ENV_FILE=.env"
if exist .env.production set "ENV_FILE=.env.production"
if not exist .env.production if not exist .env (
    echo ERROR: No .env file found. Copy .env.production to .env first.
    pause
    exit /b 1
)
echo Using %ENV_FILE% for deployment

echo [2/6] Installing dependencies...
call npm ci --omit=dev

echo [3/6] Building Docker images...
docker compose --env-file %ENV_FILE% build --parallel

echo [4/6] Stopping any existing containers...
docker compose --env-file %ENV_FILE% down --remove-orphans

echo [5/6] Starting all services...
docker compose --env-file %ENV_FILE% up -d

echo [6/6] Verifying deployment...
timeout /t 5 /nobreak >nul

echo.
echo ── Checking API health ──
curl -s http://localhost:3001/api/v1/health || echo WARNING: API health check failed

echo.
echo ── Checking Web app ──
curl -s -o nul -w "HTTP Status: %%{http_code}" http://localhost:3000/ || echo WARNING: Web app check failed

echo.
echo ── Checking Grafana dashboard ──
curl -s -o nul -w "HTTP Status: %%{http_code}" http://localhost:3003/ || echo INFO: Grafana may not be ready yet (Prometheus/Grafana take longer)

echo.
echo ── Checking Prometheus targets ──
curl -s http://localhost:9090/api/v1/targets | findstr "health" || echo INFO: Prometheus may not be ready yet

echo.
echo ═══════════════════════════════════════════════════════════════
echo  Deployment complete!
echo ═══════════════════════════════════════════════════════════════
echo  Web App:      http://localhost:3000
echo  Admin Panel:  http://localhost:3002
echo  API Health:   http://localhost:3001/api/v1/health
echo  API Metrics:  http://localhost:3001/api/v1/metrics
echo  Prometheus:   http://localhost:9090
echo  Grafana:      http://localhost:3003 (admin / GRAFANA_PASSWORD)
echo ═══════════════════════════════════════════════════════════════
echo.
echo NOTE: If you're deploying to a server with an IP, update CORS_ORIGINS in .env
echo and replace "localhost" with your server IP in the URLs above.
echo.
pause
