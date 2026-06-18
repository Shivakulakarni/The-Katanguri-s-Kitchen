param (
    [string]$TestFile = "k6/load-test-1000.js",
    [string]$BaseUrl = "http://host.docker.internal:3001"
)

if (-not (Test-Path $TestFile)) {
    Write-Error "Test file '$TestFile' not found."
    exit 1
}

Write-Host "Running k6 load test via Docker: $TestFile" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Cyan

docker run --rm -i --add-host=host.docker.internal:host-gateway grafana/k6 run -e BASE_URL=$BaseUrl - < $TestFile
