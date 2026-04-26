param(
    [string]$BindHost = "127.0.0.1",
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"
$VenvUvicorn = Join-Path $BackendDir ".venv\Scripts\uvicorn.exe"

Set-Location $BackendDir

if ((Test-Path $VenvPython) -and (Test-Path $VenvUvicorn)) {
    & $VenvPython -m uvicorn app.main:app --reload --host $BindHost --port $Port
    exit $LASTEXITCODE
}

if (Test-Path $VenvPython) {
    Write-Host "Detected backend/.venv but uvicorn is missing. Falling back to system Python..."
}

python -m uvicorn app.main:app --reload --host $BindHost --port $Port
exit $LASTEXITCODE
