param(
    [string]$BindHost = "127.0.0.1",
    [int]$Port = 5173,
    [switch]$StrictPort
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $ProjectRoot "frontend"

Set-Location $FrontendDir

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

$args = @("run", "dev", "--", "--host", $BindHost, "--port", $Port)
if ($StrictPort) {
    $args += "--strictPort"
}

npm @args
exit $LASTEXITCODE
