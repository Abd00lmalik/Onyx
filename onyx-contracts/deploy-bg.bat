@echo off
setlocal
set NODE_OPTIONS=--max-old-space-size=8192
cd /d "C:\Users\USER\OneDrive\Documents\midnight\Onyx\onyx-contracts"
if "%MIDNIGHT_WALLET_MNEMONIC%"=="" (
  echo MIDNIGHT_WALLET_MNEMONIC is not set. Set it before running this script. 1>&2
  exit /b 1
)
npx tsx src/deploy.ts --network preprod >> ".deploy-detached.log" 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> ".deploy-detached.log"
