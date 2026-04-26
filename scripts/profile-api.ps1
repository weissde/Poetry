param(
    [string]$BackendBaseUrl = "http://127.0.0.1:8000",
    [int]$Runs = 3,
    [int]$TimeoutSec = 15,
    [string]$BearerToken = "",
    [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"

function Get-PercentileValue {
    param(
        [double[]]$Values,
        [double]$Percentile
    )

    if (-not $Values -or $Values.Count -eq 0) {
        return 0
    }

    $sorted = $Values | Sort-Object
    $rank = [Math]::Ceiling(($Percentile / 100) * $sorted.Count)
    $idx = [Math]::Min([Math]::Max([int]$rank - 1, 0), $sorted.Count - 1)
    return [Math]::Round([double]$sorted[$idx], 2)
}

function New-ProfileResult {
    param(
        [string]$Name,
        [string]$Path,
        [bool]$RequiresAuth
    )

    return [ordered]@{
        name = $Name
        path = $Path
        requiresAuth = $RequiresAuth
        skipped = $false
        skipReason = ""
        runs = @()
        summary = [ordered]@{
            success = 0
            fail = 0
            avgClientMs = 0
            p90ClientMs = 0
            maxClientMs = 0
            avgServerMs = 0
        }
    }
}

function Invoke-ProfileEndpoint {
    param(
        [string]$BaseUrl,
        [hashtable]$Endpoint,
        [int]$Runs,
        [int]$TimeoutSec,
        [string]$Token
    )

    $name = [string]$Endpoint.name
    $path = [string]$Endpoint.path
    $requiresAuth = [bool]$Endpoint.requiresAuth
    $result = New-ProfileResult -Name $name -Path $path -RequiresAuth $requiresAuth

    if ($requiresAuth -and [string]::IsNullOrWhiteSpace($Token)) {
        $result.skipped = $true
        $result.skipReason = "missing bearer token"
        return $result
    }

    $uri = "{0}{1}" -f $BaseUrl.TrimEnd('/'), $path

    for ($i = 1; $i -le $Runs; $i++) {
        $headers = @{
            "Accept" = "application/json"
        }

        if (-not [string]::IsNullOrWhiteSpace($Token)) {
            $headers["Authorization"] = "Bearer $Token"
        }

        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $ok = $false
        $statusCode = 0
        $serverMs = 0
        $message = ""

        try {
            $response = Invoke-WebRequest -Uri $uri -Method Get -Headers $headers -TimeoutSec $TimeoutSec
            $sw.Stop()
            $ok = $true
            $statusCode = [int]$response.StatusCode
            if ($response.Headers["x-duration-ms"]) {
                $serverMs = [double]$response.Headers["x-duration-ms"]
            }
        }
        catch {
            $sw.Stop()
            $message = $_.Exception.Message
            $webResponse = $_.Exception.Response
            if ($webResponse -ne $null) {
                try {
                    $statusCode = [int]$webResponse.StatusCode
                } catch {
                    $statusCode = 0
                }
                try {
                    $headerValue = $webResponse.Headers["x-duration-ms"]
                    if ($headerValue) {
                        $serverMs = [double]$headerValue
                    }
                } catch {
                    $serverMs = 0
                }
            }
        }

        $clientMs = [Math]::Round([double]$sw.Elapsed.TotalMilliseconds, 2)

        $result.runs += [ordered]@{
            index = $i
            ok = $ok
            status = $statusCode
            clientMs = $clientMs
            serverMs = $serverMs
            message = $message
        }
    }

    $successful = @($result.runs | Where-Object { $_.ok })
    $failed = @($result.runs | Where-Object { -not $_.ok })
    $clientValues = @($result.runs | ForEach-Object { [double]$_.clientMs })
    $serverValues = @($result.runs | Where-Object { [double]$_.serverMs -gt 0 } | ForEach-Object { [double]$_.serverMs })

    $result.summary.success = $successful.Count
    $result.summary.fail = $failed.Count
    if ($clientValues.Count -gt 0) {
        $result.summary.avgClientMs = [Math]::Round((($clientValues | Measure-Object -Average).Average), 2)
        $result.summary.p90ClientMs = Get-PercentileValue -Values $clientValues -Percentile 90
        $result.summary.maxClientMs = [Math]::Round((($clientValues | Measure-Object -Maximum).Maximum), 2)
    }
    if ($serverValues.Count -gt 0) {
        $result.summary.avgServerMs = [Math]::Round((($serverValues | Measure-Object -Average).Average), 2)
    }

    return $result
}

function Get-SamplePoemId {
    param([string]$BaseUrl)

    $uri = "{0}/api/poems/search?page=1&pageSize=1" -f $BaseUrl.TrimEnd('/')
    try {
        $resp = Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec 8
        if ($resp -and $resp.code -eq 0 -and $resp.data -and $resp.data.items -and $resp.data.items.Count -gt 0) {
            return [string]$resp.data.items[0].id
        }
    } catch {
    }

    return ""
}

if ([string]::IsNullOrWhiteSpace($BearerToken)) {
    $BearerToken = [string]$env:PROFILE_BEARER_TOKEN
}

$Runs = [Math]::Max(1, $Runs)
$baseUrl = $BackendBaseUrl.TrimEnd('/')
$samplePoemId = Get-SamplePoemId -BaseUrl $baseUrl

$endpoints = @(
    @{ name = "health"; path = "/api/health"; requiresAuth = $false },
    @{ name = "poems_search"; path = "/api/poems/search?page=1&pageSize=24"; requiresAuth = $false },
    @{ name = "graph_poets"; path = "/api/graph/poets"; requiresAuth = $false },
    @{ name = "graph_imagery"; path = "/api/graph/imagery"; requiresAuth = $false },
    @{ name = "graph_node_poems"; path = "/api/graph/node-poems?kind=poet&value=%E6%9D%8E%E7%99%BD&page=1&pageSize=12"; requiresAuth = $false }
)

if (-not [string]::IsNullOrWhiteSpace($samplePoemId)) {
    $endpoints += @{ name = "poem_detail"; path = "/api/poems/$samplePoemId"; requiresAuth = $false }
}

$endpoints += @(
    @{ name = "weakness_profile"; path = "/api/weakness/profile"; requiresAuth = $true },
    @{ name = "memory_stats"; path = "/api/memory/stats"; requiresAuth = $true },
    @{ name = "wrongbook_dashboard"; path = "/api/wrongbook/dashboard?page=1&pageSize=24"; requiresAuth = $true },
    @{ name = "exam_history"; path = "/api/exam/history?page=1&pageSize=8"; requiresAuth = $true },
    @{ name = "review_plan_latest"; path = "/api/review-plan/latest"; requiresAuth = $true },
    @{ name = "create_history"; path = "/api/create/history?page=1&pageSize=8"; requiresAuth = $true }
)

$results = @()
foreach ($endpoint in $endpoints) {
    $result = Invoke-ProfileEndpoint -BaseUrl $baseUrl -Endpoint $endpoint -Runs $Runs -TimeoutSec $TimeoutSec -Token $BearerToken
    $results += $result
}

$timestamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
$projectRoot = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $projectRoot "logs"
New-Item -Path $logsDir -ItemType Directory -Force | Out-Null

if ([string]::IsNullOrWhiteSpace($OutputFile)) {
    $OutputFile = Join-Path $logsDir "api-latency-report-$timestamp.json"
} elseif (-not [System.IO.Path]::IsPathRooted($OutputFile)) {
    $OutputFile = Join-Path $projectRoot $OutputFile
}

$report = [ordered]@{
    generatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    backendBaseUrl = $baseUrl
    runsPerEndpoint = $Runs
    timeoutSec = $TimeoutSec
    tokenProvided = -not [string]::IsNullOrWhiteSpace($BearerToken)
    samplePoemId = $samplePoemId
    endpoints = $results
}

$report | ConvertTo-Json -Depth 8 | Set-Content -Path $OutputFile -Encoding UTF8

Write-Host "API latency profile finished."
Write-Host "Report: $OutputFile"
Write-Host ""

$rows = @()
foreach ($item in $results) {
    if ($item.skipped) {
        $rows += [pscustomobject]@{
            Endpoint = $item.name
            Status = "SKIPPED"
            AvgClientMs = "-"
            P90ClientMs = "-"
            AvgServerMs = "-"
            Notes = $item.skipReason
        }
        continue
    }

    $statusText = if ($item.summary.fail -eq 0) { "OK" } else { "WARN" }
    $rows += [pscustomobject]@{
        Endpoint = $item.name
        Status = $statusText
        AvgClientMs = $item.summary.avgClientMs
        P90ClientMs = $item.summary.p90ClientMs
        AvgServerMs = $item.summary.avgServerMs
        Notes = "success=$($item.summary.success), fail=$($item.summary.fail)"
    }
}

$rows | Format-Table -AutoSize
