param(
    [string]$BackendHost = "127.0.0.1",
    [int]$BackendPort = 8000,
    [string]$FrontendHost = "127.0.0.1",
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogsDir = Join-Path $ProjectRoot "logs"
New-Item -Path $LogsDir -ItemType Directory -Force | Out-Null

$BackendScript = Join-Path $PSScriptRoot "backend.ps1"
$FrontendScript = Join-Path $PSScriptRoot "frontend.ps1"

$BackendOut = Join-Path $LogsDir "backend.out.log"
$BackendErr = Join-Path $LogsDir "backend.err.log"
$FrontendOut = Join-Path $LogsDir "frontend.out.log"
$FrontendErr = Join-Path $LogsDir "frontend.err.log"
$PidFile = Join-Path $LogsDir "dev.pids.json"

function Get-ListeningProcessId {
    param([int]$Port)

    try {
        $conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object -First 1
        if ($conn) {
            return [int]$conn.OwningProcess
        }
    } catch {
    }

    return 0
}

function Test-ProcessAlive {
    param([int]$ProcessId)
    if ($ProcessId -le 0) {
        return $false
    }
    $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    return $null -ne $proc
}

function Get-TrackedPid {
    param(
        [string]$PidFilePath,
        [string]$FieldName
    )
    if (-not (Test-Path $PidFilePath)) {
        return 0
    }
    try {
        $obj = Get-Content -Path $PidFilePath -Raw | ConvertFrom-Json
        $value = [int]($obj.$FieldName)
        if ($value -gt 0) {
            return $value
        }
    } catch {
    }
    return 0
}

function Wait-BackendReady {
    param(
        [string]$Url,
        [int]$TimeoutSec = 30
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec 2
            if ($resp -and $resp.code -eq 0) {
                return $true
            }
        } catch {
        }
        Start-Sleep -Milliseconds 400
    }
    return $false
}

function Wait-FrontendReady {
    param(
        [string]$Url,
        [int]$TimeoutSec = 30
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Method Get -Uri $Url -TimeoutSec 2
            if ($resp -and [int]$resp.StatusCode -ge 200 -and [int]$resp.StatusCode -lt 500) {
                return $true
            }
        } catch {
        }
        Start-Sleep -Milliseconds 400
    }
    return $false
}

$backendCommand = "& '$BackendScript' -BindHost '$BackendHost' -Port $BackendPort"
$frontendCommand = "& '$FrontendScript' -BindHost '$FrontendHost' -Port $FrontendPort -StrictPort"

$existingBackendPid = Get-ListeningProcessId -Port $BackendPort
$existingFrontendPid = Get-ListeningProcessId -Port $FrontendPort
$trackedBackendPid = Get-TrackedPid -PidFilePath $PidFile -FieldName "backendPid"
$trackedFrontendPid = Get-TrackedPid -PidFilePath $PidFile -FieldName "frontendPid"

$backendStartedPid = 0
$frontendStartedPid = 0

if ($existingBackendPid -gt 0 -or (Test-ProcessAlive -ProcessId $trackedBackendPid)) {
    if ($existingBackendPid -le 0) {
        $existingBackendPid = $trackedBackendPid
    }
    Write-Host "Backend port $BackendPort is already in use (PID=$existingBackendPid). Skipping backend start."
} else {
    $backendProcess = Start-Process -FilePath "powershell.exe" `
        -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $backendCommand) `
        -RedirectStandardOutput $BackendOut `
        -RedirectStandardError $BackendErr `
        -PassThru
    $backendStartedPid = $backendProcess.Id
    Write-Host "Backend started:  PID=$backendStartedPid  URL=http://$BackendHost`:$BackendPort"
}

if ($existingFrontendPid -gt 0 -or (Test-ProcessAlive -ProcessId $trackedFrontendPid)) {
    if ($existingFrontendPid -le 0) {
        $existingFrontendPid = $trackedFrontendPid
    }
    Write-Host "Frontend port $FrontendPort is already in use (PID=$existingFrontendPid). Skipping frontend start."
} else {
    $frontendProcess = Start-Process -FilePath "powershell.exe" `
        -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $frontendCommand) `
        -RedirectStandardOutput $FrontendOut `
        -RedirectStandardError $FrontendErr `
        -PassThru
    $frontendStartedPid = $frontendProcess.Id
    Write-Host "Frontend started: PID=$frontendStartedPid URL=http://$FrontendHost`:$FrontendPort"
}

$backendHealthUrl = "http://$BackendHost`:$BackendPort/api/health"
$frontendHomeUrl = "http://$FrontendHost`:$FrontendPort/"

if (-not (Wait-BackendReady -Url $backendHealthUrl -TimeoutSec 30)) {
    Write-Host "Backend readiness check failed: $backendHealthUrl"
    if (Test-Path $BackendErr) {
        Write-Host "---- backend.err.log (tail) ----"
        Get-Content $BackendErr -Tail 40
    }
    throw "Backend did not become ready in time."
}

if (-not (Wait-FrontendReady -Url $frontendHomeUrl -TimeoutSec 30)) {
    Write-Host "Frontend readiness check failed: $frontendHomeUrl"
    if (Test-Path $FrontendErr) {
        Write-Host "---- frontend.err.log (tail) ----"
        Get-Content $FrontendErr -Tail 40
    }
    throw "Frontend did not become ready in time."
}

@{
    startedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    backendPid = $backendStartedPid
    frontendPid = $frontendStartedPid
    backendUrl = "http://$BackendHost`:$BackendPort"
    frontendUrl = "http://$FrontendHost`:$FrontendPort"
    existingBackendPid = $existingBackendPid
    existingFrontendPid = $existingFrontendPid
} | ConvertTo-Json | Set-Content -Path $PidFile -Encoding UTF8

Write-Host "Logs: $LogsDir"
Write-Host "Stop newly started processes: powershell -ExecutionPolicy Bypass -File scripts/stop-dev.ps1"
