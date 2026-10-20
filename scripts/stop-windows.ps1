$ErrorActionPreference = 'Stop'
$appRoot = Split-Path -Parent $PSScriptRoot
$stateFile = Join-Path $appRoot '.runtime\server.json'
if (-not (Test-Path -LiteralPath $stateFile)) { Write-Output 'DataSense is already stopped.'; exit 0 }
$saved = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
$process = Get-Process -Id $saved.pid -ErrorAction SilentlyContinue
if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $saved.started) {
    $details = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.Id)"
    if ($process.Path -ne $saved.executable -or -not $details.CommandLine.Contains("`"$($saved.serverFile)`"")) {
        throw 'The recorded process is not this DataSense server; it was left untouched.'
    }
    Stop-Process -Id $process.Id
}
Remove-Item -LiteralPath $stateFile
Write-Output 'DataSense stopped.'
