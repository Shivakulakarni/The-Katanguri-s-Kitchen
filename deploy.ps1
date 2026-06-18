# ═══════════════════════════════════════════════════════════════
# The Katanguri's Kitchen — Production Deployment Script (PowerShell)
# ═══════════════════════════════════════════════════════════════

Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Cyan

# Check if Docker command exists
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Docker not found. Please install Docker Desktop from https://docs.docker.com/desktop/setup/install/windows-install/" -ForegroundColor Red
    exit 1
}

# Check if Docker is running
docker info >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker Desktop is installed but not running." -ForegroundColor Red
    Write-Host "Please start it from the Start Menu or: 'C:\Program Files\Docker\Docker\Docker Desktop.exe'" -ForegroundColor Yellow
    exit 1
}

# Determine which env file to use
if (Test-Path .env.production) {
    $envFile = ".env.production"
    Write-Host "Using .env.production for deployment" -ForegroundColor Green
} elseif (Test-Path .env) {
    $envFile = ".env"
    Write-Host "Using .env for deployment" -ForegroundColor Yellow
} else {
    Write-Host "ERROR: No .env file found. Copy .env.production to .env first." -ForegroundColor Red
    exit 1
}

Write-Host "[2/6] Installing dependencies..." -ForegroundColor Cyan
npm ci --omit=dev

Write-Host "[3/6] Building Docker images..." -ForegroundColor Cyan
docker compose --env-file $envFile build --parallel

Write-Host "[4/6] Stopping any existing containers..." -ForegroundColor Cyan
docker compose --env-file $envFile down --remove-orphans

Write-Host "[5/6] Starting all services..." -ForegroundColor Cyan
docker compose --env-file $envFile up -d

Write-Host "[6/6] Verifying deployment (waiting 5 seconds)..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host "`n── Checking API health ──" -ForegroundColor Yellow
try {
    $apiHealth = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/health" -Method Get
    Write-Host "API Health: OK" -ForegroundColor Green
} catch {
    Write-Host "WARNING: API health check failed." -ForegroundColor Red
}

Write-Host "`n── Checking Web app ──" -ForegroundColor Yellow
try {
    $webResponse = Invoke-WebRequest -Uri "http://localhost:3000/" -Method Head -UseBasicParsing -TimeoutSec 5
    Write-Host "HTTP Status: $($webResponse.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "WARNING: Web app check failed." -ForegroundColor Red
}

Write-Host "`n── Checking Grafana dashboard ──" -ForegroundColor Yellow
try {
    $grafanaResponse = Invoke-WebRequest -Uri "http://localhost:3003/" -Method Head -UseBasicParsing -TimeoutSec 5
    Write-Host "HTTP Status: $($grafanaResponse.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "INFO: Grafana may not be ready yet (Prometheus/Grafana take longer)." -ForegroundColor DarkYellow
}

Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Deployment complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Web App:      http://localhost:3000"
Write-Host "  Admin Panel:  http://localhost:3002"
Write-Host "  API Health:   http://localhost:3001/api/v1/health"
Write-Host "  API Metrics:  http://localhost:3001/api/v1/metrics"
Write-Host "  Prometheus:   http://localhost:9090"
Write-Host "  Grafana:      http://localhost:3003 (admin / GRAFANA_PASSWORD)"
Write-Host "═══════════════════════════════════════════════════════════════`n" -ForegroundColor Green
