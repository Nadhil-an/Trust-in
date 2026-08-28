$content = [System.IO.File]::ReadAllText('bundle_new.js')
$lines = $content.Split("`n")
if ($lines.Count -gt 33963) {
    Write-Output "LINE 33963: $($lines[33962])"
    Write-Output "LINE 33964: $($lines[33963])"
} else {
    Write-Output "Not enough lines!"
}
