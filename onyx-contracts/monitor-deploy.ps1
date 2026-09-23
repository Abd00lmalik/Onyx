$progressFile = "C:\Users\USER\OneDrive\Documents\midnight\Onyx\onyx-contracts\.deploy-progress.json"
Write-Host "=== Onyx Deploy Monitor ===" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop monitoring`n"

while ($true) {
    if (Test-Path $progressFile) {
        $data = Get-Content $progressFile -Raw | ConvertFrom-Json
        $elapsed = [math]::Round($data.elapsed / 60, 1)
        $ts = $data.timestamp.Substring(11, 8)
        Write-Host "[$ts] Phase: $($data.phase) | $($data.detail) | ${elapsed}m elapsed" -ForegroundColor $(
            switch ($data.phase) {
                "done" { "Green" }
                "error" { "Red" }
                default { "Yellow" }
            }
        )
        if ($data.phase -eq "done") { break }
        if ($data.phase -eq "error") { break }
    } else {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Waiting for deploy to start..." -ForegroundColor Gray
    }
    Start-Sleep -Seconds 15
}
