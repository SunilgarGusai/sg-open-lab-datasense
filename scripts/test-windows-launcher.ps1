param([string]$RuntimeRoot='_runtime',[string]$Output='evidence/windows-launcher')
$ErrorActionPreference='Stop'
$runtime=(Resolve-Path -LiteralPath $RuntimeRoot).Path
$outputPath=[IO.Path]::GetFullPath($Output)
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
$launcher=Join-Path $runtime 'scripts\start-windows.ps1'
$stopper=Join-Path $runtime 'scripts\stop-windows.ps1'
$serverFile=Join-Path $runtime 'scripts\serve.mjs'
$stateFile=Join-Path $runtime '.runtime\server.json'
function Get-TestServers {
    @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
        $_.CommandLine -and $_.CommandLine.Contains("`"$serverFile`"")
    })
}
function Start-TestLauncher([int]$Index) {
    Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$launcher`"",'-NoBrowser') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $outputPath "$Index.stdout.txt") -RedirectStandardError (Join-Path $outputPath "$Index.stderr.txt")
}
if ((Get-TestServers).Count) { throw 'This isolated test requires a stopped runtime.' }
$record=@{status='running';checks=@()}
try {
    $first=Start-TestLauncher 1
    $second=Start-TestLauncher 2
    for ($i = 0; $i -lt 2; $i++) {
        $process = @($first,$second)[$i]
        $exited = $process.WaitForExit(45000)
        if (-not $exited -or $process.ExitCode -ne 0) {
            $outFile = Join-Path $outputPath "$($i+1).stdout.txt"
            $errFile = Join-Path $outputPath "$($i+1).stderr.txt"
            $outText = if (Test-Path -LiteralPath $outFile) { Get-Content -LiteralPath $outFile -Raw } else { '' }
            $errText = if (Test-Path -LiteralPath $errFile) { Get-Content -LiteralPath $errFile -Raw } else { '' }
            $exitValue = if ($exited) { "$($process.ExitCode)" } else { 'timeout' }
            throw "Concurrent launcher $($i+1) failed: exit=$exitValue; stdout=$outText; stderr=$errText"
        }
    }
    $servers=@(Get-TestServers)
    if($servers.Count -ne 1) { throw "Expected one server; found $($servers.Count)" }
    $saved=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    $response=Invoke-WebRequest -Uri $saved.url -UseBasicParsing -TimeoutSec 5
    if($response.StatusCode -ne 200) { throw 'Started server is not reachable' }
    $record.checks+='Concurrent start creates one reachable instance'
    $third=Start-TestLauncher 3
    if(-not $third.WaitForExit(45000) -or $third.ExitCode -ne 0) { throw 'Reopen failed' }
    $reopened=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    if($saved.pid -ne $reopened.pid -or $saved.url -ne $reopened.url) { throw 'Reopen changed the instance' }
    $record.checks+='Reopen reuses the same PID and URL'
    # Simulate an abruptly closed server, leaving stale state for recovery.
    Stop-Process -Id $saved.pid
    $fourth=Start-TestLauncher 4
    if(-not $fourth.WaitForExit(45000) -or $fourth.ExitCode -ne 0) { throw 'Stale-state restart failed' }
    $restarted=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    if((Invoke-WebRequest -Uri $restarted.url -UseBasicParsing -TimeoutSec 5).StatusCode -ne 200) { throw 'Restart failed' }
    $record.checks+='Stale state replaced atomically and server restarted'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $stopper
    if($LASTEXITCODE -ne 0 -or (Test-Path -LiteralPath $stateFile)) { throw 'Stop failed to clear state' }
    if((Get-TestServers).Count) { throw 'Stop left an instance running' }
    $record.checks+='Stop removes owned process and state'
    $record.status='pass'
} catch {
    $record.status='fail';$record.error=$_.Exception.Message;throw
} finally {
    foreach($server in @(Get-TestServers)) { Stop-Process -Id $server.ProcessId -ErrorAction SilentlyContinue }
    $record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputPath 'report.json') -Encoding UTF8
}
$record | ConvertTo-Json -Depth 5
