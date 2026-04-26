param(
    [string]$BackendBaseUrl = "http://127.0.0.1:8000",
    [int]$TimeoutSec = 15,
    [string]$BearerToken = "",
    [string]$OutputFile = "",
    [switch]$RequireAuth,
    [string]$SupabaseUrl = "",
    [string]$SupabaseAnonKey = "",
    [string]$Email = "",
    [string]$Password = ""
)

$ErrorActionPreference = "Stop"

function Resolve-EnvValue {
    param(
        [string]$CurrentValue,
        [string]$EnvName
    )
    if (-not [string]::IsNullOrWhiteSpace($CurrentValue)) {
        return $CurrentValue
    }
    return [string](Get-Item -Path "Env:$EnvName" -ErrorAction SilentlyContinue).Value
}

function Resolve-BearerTokenFromSupabasePassword {
    param(
        [string]$SupabaseUrl,
        [string]$SupabaseAnonKey,
        [string]$Email,
        [string]$Password,
        [int]$TimeoutSec = 10
    )

    if ([string]::IsNullOrWhiteSpace($SupabaseUrl) -or
        [string]::IsNullOrWhiteSpace($SupabaseAnonKey) -or
        [string]::IsNullOrWhiteSpace($Email) -or
        [string]::IsNullOrWhiteSpace($Password)) {
        return ""
    }

    $url = "{0}/auth/v1/token?grant_type=password" -f $SupabaseUrl.TrimEnd('/')
    $headers = @{
        "apikey" = $SupabaseAnonKey
        "Content-Type" = "application/json"
        "Accept" = "application/json"
    }
    $body = @{
        email = $Email
        password = $Password
    } | ConvertTo-Json -Compress

    try {
        $resp = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body -TimeoutSec $TimeoutSec
        if ($resp -and $resp.access_token) {
            return [string]$resp.access_token
        }
        return ""
    } catch {
        return ""
    }
}

function New-StepResult {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Path,
        [bool]$RequiresAuth
    )

    return [ordered]@{
        name = $Name
        method = $Method
        path = $Path
        requiresAuth = $RequiresAuth
        skipped = $false
        ok = $false
        status = 0
        elapsedMs = 0
        message = ""
    }
}

function Invoke-ApiStep {
    param(
        [hashtable]$Step,
        [string]$BaseUrl,
        [int]$TimeoutSec,
        [string]$Token
    )

    $result = New-StepResult -Name $Step.name -Method $Step.method -Path $Step.path -RequiresAuth ([bool]$Step.requiresAuth)
    $method = [string]$Step.method
    $path = [string]$Step.path
    $requiresAuth = [bool]$Step.requiresAuth

    if ($requiresAuth -and [string]::IsNullOrWhiteSpace($Token)) {
        $result.skipped = $true
        $result.message = "missing bearer token"
        return @{
            result = $result
            body = $null
        }
    }

    $uri = "{0}{1}" -f $BaseUrl.TrimEnd('/'), $path
    $headers = @{
        "Accept" = "application/json"
    }
    if (-not [string]::IsNullOrWhiteSpace($Token)) {
        $headers["Authorization"] = "Bearer $Token"
    }

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        if ($method -eq "GET") {
            $response = Invoke-WebRequest -Method Get -Uri $uri -Headers $headers -TimeoutSec $TimeoutSec
        } elseif ($method -eq "POST") {
            $payload = "{}"
            if ($Step.body) {
                $payload = ($Step.body | ConvertTo-Json -Depth 8 -Compress)
            }
            $headers["Content-Type"] = "application/json"
            $response = Invoke-WebRequest -Method Post -Uri $uri -Headers $headers -Body $payload -TimeoutSec $TimeoutSec
        } else {
            throw "unsupported method: $method"
        }

        $sw.Stop()
        $result.status = [int]$response.StatusCode
        $result.elapsedMs = [Math]::Round([double]$sw.Elapsed.TotalMilliseconds, 2)

        $body = $null
        if ($response.Content) {
            $body = $response.Content | ConvertFrom-Json
        }
        if ($body -and $body.code -eq 0) {
            $result.ok = $true
        } else {
            $result.ok = $false
            $result.message = "api code != 0"
        }

        return @{
            result = $result
            body = $body
        }
    } catch {
        $sw.Stop()
        $result.ok = $false
        $result.elapsedMs = [Math]::Round([double]$sw.Elapsed.TotalMilliseconds, 2)
        $result.message = $_.Exception.Message
        $webResponse = $_.Exception.Response
        if ($webResponse -ne $null) {
            try {
                $result.status = [int]$webResponse.StatusCode
            } catch {
                $result.status = 0
            }
        }
        return @{
            result = $result
            body = $null
        }
    }
}

function Wait-BackendReady {
    param(
        [string]$BaseUrl,
        [int]$TimeoutSec = 30
    )
    $healthUrl = "{0}/api/health" -f $BaseUrl.TrimEnd('/')
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-RestMethod -Method Get -Uri $healthUrl -TimeoutSec 2
            if ($resp -and $resp.code -eq 0) {
                return $true
            }
        } catch {
        }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

if ([string]::IsNullOrWhiteSpace($BearerToken)) {
    $BearerToken = [string]$env:PROFILE_BEARER_TOKEN
}

$SupabaseUrl = Resolve-EnvValue -CurrentValue $SupabaseUrl -EnvName "PROFILE_SUPABASE_URL"
$SupabaseAnonKey = Resolve-EnvValue -CurrentValue $SupabaseAnonKey -EnvName "PROFILE_SUPABASE_ANON_KEY"
$Email = Resolve-EnvValue -CurrentValue $Email -EnvName "PROFILE_EMAIL"
$Password = Resolve-EnvValue -CurrentValue $Password -EnvName "PROFILE_PASSWORD"

if ($RequireAuth -and [string]::IsNullOrWhiteSpace($BearerToken)) {
    $resolvedToken = Resolve-BearerTokenFromSupabasePassword `
        -SupabaseUrl $SupabaseUrl `
        -SupabaseAnonKey $SupabaseAnonKey `
        -Email $Email `
        -Password $Password `
        -TimeoutSec ([Math]::Min([Math]::Max($TimeoutSec, 8), 20))
    if (-not [string]::IsNullOrWhiteSpace($resolvedToken)) {
        $BearerToken = $resolvedToken
    }
}

$baseUrl = $BackendBaseUrl.TrimEnd('/')
if (-not (Wait-BackendReady -BaseUrl $baseUrl -TimeoutSec 35)) {
    throw "Backend is not ready: $baseUrl/api/health"
}

$steps = @(
    @{ name = "health"; method = "GET"; path = "/api/health"; requiresAuth = $false },
    @{ name = "poems_search"; method = "GET"; path = "/api/poems/search?page=1&pageSize=1"; requiresAuth = $false },
    @{ name = "poems_search_grade_primary"; method = "GET"; path = "/api/poems/search?page=1&pageSize=5&gradeLevel=primary"; requiresAuth = $false },
    @{ name = "graph_poets"; method = "GET"; path = "/api/graph/poets"; requiresAuth = $false },
    @{ name = "graph_imagery"; method = "GET"; path = "/api/graph/imagery"; requiresAuth = $false },
    @{ name = "graph_timeline"; method = "GET"; path = "/api/graph/timeline"; requiresAuth = $false },
    @{ name = "graph_node_poems"; method = "GET"; path = "/api/graph/node-poems?kind=poet&value=%E6%9D%8E%E7%99%BD&page=1&pageSize=5"; requiresAuth = $false },
    @{ name = "weakness_profile"; method = "GET"; path = "/api/weakness/profile"; requiresAuth = $true },
    @{ name = "memory_stats"; method = "GET"; path = "/api/memory/stats"; requiresAuth = $true },
    @{ name = "review_plan_latest"; method = "GET"; path = "/api/review-plan/latest"; requiresAuth = $true },
    @{ name = "nav_pending_summary"; method = "GET"; path = "/api/nav/pending-summary"; requiresAuth = $true },
    @{ name = "wrongbook_dashboard"; method = "GET"; path = "/api/wrongbook/dashboard?page=1&pageSize=10"; requiresAuth = $true },
    @{ name = "exam_history"; method = "GET"; path = "/api/exam/history?page=1&pageSize=5"; requiresAuth = $true },
    @{ name = "create_history"; method = "GET"; path = "/api/create/history?page=1&pageSize=5"; requiresAuth = $true },
    @{ name = "chat_summaries"; method = "GET"; path = "/api/ai/chat/summaries?page=1&pageSize=5"; requiresAuth = $true },
    @{ name = "practice_session_summaries"; method = "GET"; path = "/api/practice/session-summaries?source=graph_compare&page=1&pageSize=5"; requiresAuth = $true }
)

$results = @()
$samplePoemId = ""

foreach ($step in $steps) {
    $out = Invoke-ApiStep -Step $step -BaseUrl $baseUrl -TimeoutSec $TimeoutSec -Token $BearerToken
    $results += $out.result

    if ($step.name -eq "poems_search" -and $out.body -and $out.body.data -and $out.body.data.items -and $out.body.data.items.Count -gt 0) {
        $samplePoemId = [string]$out.body.data.items[0].id
    }
}

if (-not [string]::IsNullOrWhiteSpace($samplePoemId)) {
    $detailStep = @{
        name = "poem_detail"
        method = "GET"
        path = "/api/poems/$samplePoemId"
        requiresAuth = $false
    }
    $detailOut = Invoke-ApiStep -Step $detailStep -BaseUrl $baseUrl -TimeoutSec $TimeoutSec -Token $BearerToken
    $results += $detailOut.result
}

$timestamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
$projectRoot = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $projectRoot "logs"
New-Item -Path $logsDir -ItemType Directory -Force | Out-Null

if ([string]::IsNullOrWhiteSpace($OutputFile)) {
    $OutputFile = Join-Path $logsDir "api-smoke-report-$timestamp.json"
} elseif (-not [System.IO.Path]::IsPathRooted($OutputFile)) {
    $OutputFile = Join-Path $projectRoot $OutputFile
}

$executed = @($results | Where-Object { -not $_.skipped })
$failed = @($executed | Where-Object { -not $_.ok })
$skipped = @($results | Where-Object { $_.skipped })

$report = [ordered]@{
    generatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    backendBaseUrl = $baseUrl
    timeoutSec = $TimeoutSec
    tokenProvided = -not [string]::IsNullOrWhiteSpace($BearerToken)
    samplePoemId = $samplePoemId
    requireAuth = [bool]$RequireAuth
    summary = [ordered]@{
        total = $results.Count
        executed = $executed.Count
        passed = @($executed | Where-Object { $_.ok }).Count
        failed = $failed.Count
        skipped = $skipped.Count
    }
    steps = $results
}

$report | ConvertTo-Json -Depth 8 | Set-Content -Path $OutputFile -Encoding UTF8

Write-Host "API smoke finished."
Write-Host "Report: $OutputFile"
Write-Host ""

$rows = @()
foreach ($item in $results) {
    $statusText = if ($item.skipped) {
        "SKIPPED"
    } elseif ($item.ok) {
        "OK"
    } else {
        "FAIL"
    }

    $rows += [pscustomobject]@{
        Step = $item.name
        Status = $statusText
        Http = $item.status
        ElapsedMs = $item.elapsedMs
        Notes = $item.message
    }
}

$rows | Format-Table -AutoSize

if ($RequireAuth -and [string]::IsNullOrWhiteSpace($BearerToken)) {
    throw "RequireAuth is set but bearer token is missing. Provide -BearerToken or Supabase credentials (PROFILE_SUPABASE_URL/PROFILE_SUPABASE_ANON_KEY/PROFILE_EMAIL/PROFILE_PASSWORD)."
}

if ($failed.Count -gt 0) {
    throw "Smoke failed: $($failed.Count) step(s) failed."
}

Write-Host ""
Write-Host "Smoke passed."
