param([Parameter(Mandatory=$true)][string]$CsvPath, [Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
$excel = $null
$book = $null
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.AutomationSecurity = 3
    $book = $excel.Workbooks.Open((Resolve-Path -LiteralPath $CsvPath).Path, 0, $true)
    $sheet = $book.Worksheets.Item(1)
    if ($sheet.UsedRange.Rows.Count -ne 13 -or $sheet.UsedRange.Columns.Count -ne 2) {
        throw "Unexpected imported shape: $($sheet.UsedRange.Rows.Count) rows, $($sheet.UsedRange.Columns.Count) columns"
    }
    $rows = @()
    for ($i = 2; $i -le 13; $i++) {
        $cell = $sheet.Cells.Item($i, 2)
        $rows += @{row=$i; value=$cell.Value2; hasFormula=[bool]$cell.HasFormula; display=$cell.Text}
        if ($cell.HasFormula) { throw "Formula executed in row $i" }
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($cell)
    }
    @{status='pass'; excelVersion=$excel.Version; build=$excel.Build; operatingSystem=$excel.OperatingSystem;
      sourceSha256=(Get-FileHash -LiteralPath $CsvPath -Algorithm SHA256).Hash;
      method='Excel Workbooks.Open, local CSV, read-only, updates disabled; harmless arithmetic prefixes only';
      checkedCells=$rows; limitations='This does not verify every spreadsheet, locale or import/re-save route.'} |
      ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
    Write-Output 'Excel imported all 12 text-prefix cases without formulas.'
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($sheet)
} finally {
    if ($book) { $book.Close($false); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($book) }
    if ($excel) { $excel.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
}
