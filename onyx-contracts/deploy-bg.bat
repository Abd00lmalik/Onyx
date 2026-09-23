@echo off
setlocal
set MIDNIGHT_WALLET_MNEMONIC=federal dumb raven sun suffer solution equip trap glue obey crumble marble pitch wisdom profit under viable nuclear boy road public curtain model fiscal
set NODE_OPTIONS=--max-old-space-size=8192
cd /d "C:\Users\USER\OneDrive\Documents\midnight\Onyx\onyx-contracts"
npx tsx src/deploy.ts --network preprod >> ".deploy-detached.log" 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> ".deploy-detached.log"
