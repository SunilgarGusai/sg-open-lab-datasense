# Load the matching Windows PowerShell modules even when started by PowerShell 7.
$env:PSModulePath = (Join-Path $PSHOME 'Modules') + [IO.Path]::PathSeparator + $env:PSModulePath
function Enter-DataSenseMutex([string]$Root) {
    $hasher = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes([IO.Path]::GetFullPath($Root).ToUpperInvariant())
        $name = 'Local\SGDataSense-' + [BitConverter]::ToString($hasher.ComputeHash($bytes)).Replace('-', '')
    } finally { $hasher.Dispose() }
    $mutex = New-Object Threading.Mutex($false, $name)
    try {
        try { $entered = $mutex.WaitOne(30000) }
        catch [Threading.AbandonedMutexException] { $entered = $true }
        if (-not $entered) { throw 'Another DataSense start/stop operation is still running. Try again shortly.' }
        return $mutex
    } catch { $mutex.Dispose(); throw }
}
function Write-DataSenseState([string]$Path, $State) {
    $temporary = $Path + '.tmp'
    $State | ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding UTF8
    if (Test-Path -LiteralPath $Path) { [IO.File]::Replace($temporary, $Path, [NullString]::Value) }
    else { [IO.File]::Move($temporary, $Path) }
}
