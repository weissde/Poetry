param(
    [string]$BackendEnvPath = "backend/.env",
    [string]$ProfileEnvPath = "",
    [int]$RuntimeAuditTimeoutSec = 15,
    [int]$RuntimeAuditRetries = 1
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

function Resolve-PathSafe {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }
    if ([System.IO.Path]::IsPathRooted($Path)) {
        return $Path
    }
    return Join-Path $projectRoot $Path
}

function Import-EnvFile {
    param([string]$FilePath)

    $result = @{}
    if ([string]::IsNullOrWhiteSpace($FilePath) -or -not (Test-Path -LiteralPath $FilePath)) {
        return $result
    }

    Get-Content -LiteralPath $FilePath | ForEach-Object {
        $line = $_.Trim()
        if ([string]::IsNullOrWhiteSpace($line)) { return }
        if ($line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }

        $key = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1).Trim()

        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            if ($value.Length -ge 2) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }

        $result[$key] = $value
    }

    return $result
}

$backendEnvAbs = Resolve-PathSafe -Path $BackendEnvPath
$profileEnvAbs = Resolve-PathSafe -Path $ProfileEnvPath

$backendEnv = Import-EnvFile -FilePath $backendEnvAbs
$profileEnv = Import-EnvFile -FilePath $profileEnvAbs

function Pick-Value {
    param(
        [string[]]$Keys,
        [hashtable]$Primary,
        [hashtable]$Secondary
    )

    foreach ($key in $Keys) {
        if ($Primary.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($Primary[$key])) {
            return [string]$Primary[$key]
        }
    }
    foreach ($key in $Keys) {
        if ($Secondary.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($Secondary[$key])) {
            return [string]$Secondary[$key]
        }
    }
    return ""
}

$resolvedSupabaseUrl = Pick-Value -Keys @("PROFILE_SUPABASE_URL", "SUPABASE_URL") -Primary $profileEnv -Secondary $backendEnv
$resolvedSupabaseAnon = Pick-Value -Keys @("PROFILE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY") -Primary $profileEnv -Secondary $backendEnv
$resolvedEmail = Pick-Value -Keys @("PROFILE_EMAIL", "AUDIT_EMAIL", "DEV_EMAIL") -Primary $profileEnv -Secondary $backendEnv
$resolvedPassword = Pick-Value -Keys @("PROFILE_PASSWORD", "AUDIT_PASSWORD", "DEV_PASSWORD") -Primary $profileEnv -Secondary $backendEnv

if (-not [string]::IsNullOrWhiteSpace($resolvedSupabaseUrl)) { $env:PROFILE_SUPABASE_URL = $resolvedSupabaseUrl }
if (-not [string]::IsNullOrWhiteSpace($resolvedSupabaseAnon)) { $env:PROFILE_SUPABASE_ANON_KEY = $resolvedSupabaseAnon }
if (-not [string]::IsNullOrWhiteSpace($resolvedEmail)) { $env:PROFILE_EMAIL = $resolvedEmail }
if (-not [string]::IsNullOrWhiteSpace($resolvedPassword)) { $env:PROFILE_PASSWORD = $resolvedPassword }

$missing = @()
if ([string]::IsNullOrWhiteSpace($env:PROFILE_SUPABASE_URL)) { $missing += "PROFILE_SUPABASE_URL" }
if ([string]::IsNullOrWhiteSpace($env:PROFILE_SUPABASE_ANON_KEY)) { $missing += "PROFILE_SUPABASE_ANON_KEY" }
if ([string]::IsNullOrWhiteSpace($env:PROFILE_EMAIL)) { $missing += "PROFILE_EMAIL" }
if ([string]::IsNullOrWhiteSpace($env:PROFILE_PASSWORD)) { $missing += "PROFILE_PASSWORD" }

if ($missing.Count -gt 0) {
    Write-Host "audit:all:auth notice -> Missing profile credentials: $($missing -join ', ')"
    Write-Host "Auth-only steps may be SKIPPED."
}

if ([string]::IsNullOrWhiteSpace($env:RUNTIME_AUDIT_TIMEOUT_SEC)) {
    $env:RUNTIME_AUDIT_TIMEOUT_SEC = [string]([Math]::Max(5, $RuntimeAuditTimeoutSec))
}
if ([string]::IsNullOrWhiteSpace($env:RUNTIME_AUDIT_RETRIES)) {
    $env:RUNTIME_AUDIT_RETRIES = [string]([Math]::Max(0, $RuntimeAuditRetries))
}

Write-Host "audit:all:auth runtime params -> RUNTIME_AUDIT_TIMEOUT_SEC=$($env:RUNTIME_AUDIT_TIMEOUT_SEC), RUNTIME_AUDIT_RETRIES=$($env:RUNTIME_AUDIT_RETRIES)"

$python = "python"
$script = Join-Path $projectRoot "scripts/audit-all.py"
& $python $script
exit $LASTEXITCODE
