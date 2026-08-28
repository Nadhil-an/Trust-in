$content = [System.IO.File]::ReadAllText('bundle_debug.js')

$pos = 33963
$start = [Math]::Max(0, $pos - 100)
$len = [Math]::Min(200, $content.Length - $start)
Write-Output "=== CONTEXT AROUND CHAR POS 33963 ==="
Write-Output $content.Substring($start, $len)

# Look for nearest __d( before 33963
$searchFrom = [Math]::Max(0, $pos - 2000)
$chunk = $content.Substring($searchFrom, 2000)
$lastD = $chunk.LastIndexOf('__d(')
if ($lastD -ge 0) {
    Write-Output "`n=== MODULE DEF AROUND CHAR POS 33963 ==="
    Write-Output $chunk.Substring($lastD, [Math]::Min(200, $chunk.Length - $lastD))
}
