param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173,
    [switch]$NoPortFallback
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PidFile = Join-Path $ProjectRoot "logs\dev.pids.json"

function Get-ListeningProcessIds {
    param([int]$Port)
    try {
        $conns = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop
        if (-not $conns) {
            return @()
        }
        return @($conns | Select-Object -ExpandProperty OwningProcess -Unique)
    } catch {
        return @()
    }
}

function Stop-IfAlive {
    param(
        [int]$ProcessId,
        [string]$Reason
    )
    if ($ProcessId -le 0 -or $ProcessId -eq $PID) {
        return $false
    }
    $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $proc) {
        return $false
    }
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped ($Reason): PID=$ProcessId Name=$($proc.ProcessName)"
    return $true
}

$stoppedAny = $false
$trackedPids = @()

if (Test-Path $PidFile) {
    try {
        $pidInfo = Get-Content -Path $PidFile -Raw | ConvertFrom-Json
        foreach ($name in @("backendPid", "frontendPid")) {
            $targetPid = [int]($pidInfo.$name)
            if ($targetPid -gt 0) {
                $trackedPids += $targetPid
            }
        }
    } catch {
        Write-Host "PID file is invalid. Will remove it and use port fallback."
    }
} else {
    Write-Host "No PID file found. Using port fallback..."
}

foreach ($pidValue in ($trackedPids | Select-Object -Unique)) {
    if (Stop-IfAlive -ProcessId ([int]$pidValue) -Reason "pid-file") {
        $stoppedAny = $true
    }
}

if (-not $NoPortFallback) {
    $portPids = @()
    $portPids += Get-ListeningProcessIds -Port $BackendPort
    $portPids += Get-ListeningProcessIds -Port $FrontendPort
    foreach ($pidValue in ($portPids | Select-Object -Unique)) {
        if (Stop-IfAlive -ProcessId ([int]$pidValue) -Reason "port:$BackendPort/$FrontendPort") {
            $stoppedAny = $true
        }
    }
}

Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue

if ($stoppedAny) {
    Write-Host "Done."
} else {
    Write-Host "Done. No running dev processes found."
}
