param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'windows-common.ps1')
$mutex = Enter-DataSenseMutex $appRoot
$process = $null
$recorded = $false
try {
$siteRoot = Join-Path $appRoot '_site'
$runtimeRoot = Join-Path $appRoot '.runtime'
$stateFile = Join-Path $runtimeRoot 'server.json'
$serverFile = Join-Path $PSScriptRoot 'serve.mjs'
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$nodeFile = if ($nodeCommand) { $nodeCommand.Source } else {
    Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if (-not (Test-Path -LiteralPath $nodeFile)) { throw 'Install Node.js 22 or newer from https://nodejs.org, then reopen DataSense.' }
$nodeVersion = & $nodeFile --version
if ([int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 22) { throw 'DataSense requires Node.js 22 or newer.' }
$manifestFile = Join-Path $siteRoot 'staging-manifest.json'
if (-not (Test-Path -LiteralPath $manifestFile)) { throw 'This package needs its prepared _site folder. Use the runtime ZIP or run the documented build.' }
$manifestHash = (Get-FileHash -LiteralPath $manifestFile -Algorithm SHA256).Hash
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
if (Test-Path -LiteralPath $stateFile) {
    $saved = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    $existing = Get-Process -Id $saved.pid -ErrorAction SilentlyContinue
    if ($existing -and $existing.StartTime.ToUniversalTime().ToString('o') -eq $saved.started) {
        $response = Invoke-WebRequest -Uri ($saved.url + 'staging-manifest.json') -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -eq 200 -and $saved.manifestHash -eq $manifestHash) {
            if (-not $NoBrowser) { Start-Process $saved.url }
            Write-Output "DataSense is ready: $($saved.url)"
            exit 0
        }
        throw 'A different build is running. Use Stop DataSense, then start this package again.'
    }
}
$outLog = Join-Path $runtimeRoot 'server-output.txt'
$errLog = Join-Path $runtimeRoot 'server-errors.txt'
$process = Start-Process -FilePath $nodeFile -ArgumentList @(
    "`"$serverFile`"", '--root', "`"$siteRoot`"", '--port', '0'
) -WorkingDirectory $appRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
$ready = $null
for ($attempt = 0; $attempt -lt 100; $attempt++) {
    Start-Sleep -Milliseconds 100
    $process.Refresh()
    if ($process.HasExited) { throw (Get-Content -LiteralPath $errLog -Raw) }
    $line = Get-Content -LiteralPath $outLog -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($line) { $ready = $line | ConvertFrom-Json; break }
}
if (-not $ready -or $ready.status -ne 'ready') {
    Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
    throw 'DataSense did not become ready. Read .runtime/server-errors.txt.'
}
Write-DataSenseState $stateFile @{
    pid = $process.Id
    started = $process.StartTime.ToUniversalTime().ToString('o')
    url = $ready.url
    executable = $nodeFile
    serverFile = $serverFile
    manifestHash = $manifestHash
}
$recorded = $true
if (-not $NoBrowser) { Start-Process $ready.url }
Write-Output "DataSense is ready: $($ready.url)"
Write-Output 'Use Stop DataSense when finished. Your CSV stays in the browser tab.'
} catch {
    if ($process -and -not $recorded) {
        $process.Refresh()
        if (-not $process.HasExited) { Stop-Process -Id $process.Id -ErrorAction SilentlyContinue }
    }
    throw
} finally { $mutex.ReleaseMutex(); $mutex.Dispose() }
