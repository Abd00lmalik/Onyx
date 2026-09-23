$ErrorActionPreference = "Stop"
$deployDir = "C:\Users\USER\OneDrive\Documents\midnight\Onyx\onyx-contracts"
$logFile = "$deployDir\.deploy-detached.log"
$progressFile = "$deployDir\.deploy-progress.json"

# Clean old progress
Remove-Item $progressFile -ErrorAction SilentlyContinue

# Set environment
$env:MIDNIGHT_WALLET_MNEMONIC = "federal dumb raven sun suffer solution equip trap glue obey crumble marble pitch wisdom profit under viable nuclear boy road public curtain model fiscal"
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:PATH = "$env:APPDATA\npm;$env:LOCALAPPDATA\pnpm;$env:PATH"

# Launch completely detached
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "cmd.exe"
$psi.Arguments = "/c npx tsx src/deploy.ts --network preprod > `"$logFile`" 2>&1"
$psi.WorkingDirectory = $deployDir
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardOutput = $false
$psi.RedirectStandardError = $false

$proc = [System.Diagnostics.Process]::Start($psi)
Write-Host "Deploy launched as PID $($proc.Id)"
Write-Host "Log: $logFile"
Write-Host "Progress: $progressFile"
Write-Host "Monitor: Get-Content '$progressFile' -Raw"
