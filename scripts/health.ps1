param(
    [string]$BackendBaseUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"

$healthUrl = "$BackendBaseUrl/api/health"
$searchUrl = "$BackendBaseUrl/api/poems/search?page=1&page_size=1"

$health = Invoke-RestMethod -Method Get -Uri $healthUrl -TimeoutSec 8
if (-not $health -or $health.code -ne 0) {
    throw "Backend health check failed: $healthUrl"
}

$search = Invoke-RestMethod -Method Get -Uri $searchUrl -TimeoutSec 8
if (-not $search -or $search.code -ne 0) {
    throw "Poems search smoke test failed: $searchUrl"
}

$count = 0
if ($search.data -and $search.data.items) {
    $count = $search.data.items.Count
}

Write-Host "Health OK: $healthUrl"
Write-Host "Search OK: returned $count item(s)"
