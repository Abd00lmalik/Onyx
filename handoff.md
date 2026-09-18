# Onyx — Handoff Document

Everything a new developer (or future AI session) needs to pick up this project without repeating our pain.

---

## Quick Facts

| Item | Value |
|---|---|
| **Project** | Onyx — encrypted data marketplace on Midnight Network |
| **Repo** | `https://github.com/Abd00lmalik/Onyx` |
| **Local path** | `C:\Users\USER\OneDrive\Documents\midnight\Onyx` |
| **Platform** | Windows + WSL Ubuntu |
| **Status** | Level 1 complete — contract compiled and deployed to Preprod |

## Deployed Contract

| Item | Value |
|---|---|
| **Contract Address** | `1a7dabae6289b10f94636458b2c749b2396a3c9edc1e46877d4bb8a35a839b51` |
| **Network** | Preprod |
| **Wallet Address** | `mn_addr_preprod1xra3cc9jxvnjk7l9q8wauxh3mztqvm9yze7u9a2mq6f94ztkxmvqaupl0x` |
| **Deployer Seed** | `8e4a39bd7c76e8308ff4da71100fa6f2ede92519c4224bdfc98f24b29a066c4501accef5a8d7820bfa6795c31729afdf49b38ff630347aff385b73be5d97dafd` |
| **Deployer Mnemonic** | `federal dumb raven sun suffer solution equip trap glue obey crumble marble pitch wisdom profit under viable nuclear boy road public curtain model fiscal` |

---

## Architecture

### File Structure

```
Onyx/
├── onyx-contracts/
│   ├── contracts/
│   │   ├── onyx-marketplace.compact    # The Compact contract (14 circuits)
│   │   ├── managed/onyx-marketplace/   # Compiled artifacts
│   │   ├── witnesses.mjs               # Moth-compatible witness file
│   │   └── witnesses.cjs               # CJS witness file
│   ├── src/
│   │   ├── deploy.ts                   # Deploy script
│   │   ├── cli.ts                      # CLI entry point
│   │   ├── wallet.ts                   # Wallet construction
│   │   ├── wallet-state.ts             # Wallet state persistence
│   │   └── network.ts                  # Network config + wallet mgmt
│   ├── package.json
│   ├── .midnight-state.json            # Wallet seed + deployment state
│   └── .deploy-detached.log            # Full deploy output
├── screenshots/
│   ├── compile.png                     # Proof: 14 circuits compiled
│   └── deploy.png                      # Proof: contract deployed
├── README.md
├── LICENSE                             # Apache 2.0
└── handoff.md                          # This file
```

---

## CRITICAL: Version Compatibility Matrix

**This is the single most important thing in this document.** Getting these versions wrong wastes hours.

### The Official Supported Stack (Preprod)

| Component | Version | Source |
|---|---|---|
| Compact devtools (`compact` CLI) | **0.5.1** | Install in WSL |
| Compact compiler | **0.31.1** | Shipped with CLI 0.5.1 |
| Compact runtime | **0.16.0** | npm `@midnight-ntwrk/compact-runtime` |
| Compact JS | **2.5.1** | npm `@midnight-ntwrk/compact-js` |
| Midnight JS | **4.1.1** | npm `@midnight-ntwrk/midnight-js-*` |

### What Happens If You Get It Wrong

| Mistake | Symptom | Fix |
|---|---|---|
| Compiler too new (0.34.0) + runtime 0.19.0 | `coinPublicKey` error during deploy | Downgrade compiler to 0.31.1, pin runtime to 0.16.0 |
| Runtime 0.19.0 + compact-js 2.5.1 | `Expected string, actual {tag:"schnorr", value:"..."}` | `SigningKey` changed format between 0.16.0 and 0.19.0 — compact-js 2.5.1 expects a plain hex string |
| npm overrides forcing wrong runtime | Weird runtime errors that don't make sense | Remove overrides, reinstall, recompile |
| Using `compact` CLI 0.5.2 | Ships compiler 0.34.0 — see above | Downgrade: `compact update 0.31.1` in WSL |

### How to Check Your Versions

```bash
# In onyx-contracts/ directory:
node -e "const p = require('./node_modules/@midnight-ntwrk/compact-runtime/package.json'); console.log('runtime:', p.version)"
node -e "const p = require('./node_modules/@midnight-ntwrk/compact-js/package.json'); console.log('compact-js:', p.version)"

# In WSL:
compact --version          # CLI version
compact list               # available compiler versions
```

### How to Fix Version Mismatch

```bash
# 1. Downgrade compact CLI in WSL
compact update 0.31.1

# 2. Remove any npm overrides in package.json
# Delete this block if it exists:
# "overrides": { "@midnight-ntwrk/compact-runtime": "0.19.0" }

# 3. Set correct version in package.json
# "@midnight-ntwrk/compact-runtime": "0.16.0"

# 4. Reinstall
npm install

# 5. Recompile contract
compact compile contracts/onyx-marketplace.compact contracts/managed/onyx-marketplace

# 6. Verify contract expects correct runtime
# Should show: __compactRuntime.checkRuntimeVersion('0.16.0');
head -2 contracts/managed/onyx-marketplace/contract/index.js
```

---

## Docker / Proof Server

### The Rule

**Docker Desktop MUST be running before ANY wallet sync or deploy.**

The proof server runs inside Docker on port 6300. Without it, every sync fails with cryptic errors.

### Start Proof Server

```bash
# Check if Docker is running
docker ps

# If not running, start Docker Desktop first, then:
docker run -d --name onyx-proof-server -p 6300:6300 midnightnetwork/proof-server -- \
  'midnight-proof-server --network testnet'

# Or use docker-compose
cd onyx-contracts
docker-compose up -d
```

### Verify Proof Server Is Healthy

```bash
docker ps --format "{{.Names}} {{.Status}}"
# Should show: onyx-proof-server Up X hours (healthy)
```

### What Happens If Docker Is Down

| Phase | Error | What It Actually Means |
|---|---|---|
| Wallet sync | `Wallet.Sync` timeout | Proof server unreachable (port 6300) |
| Wallet sync | RPC disconnection messages | Usually harmless during sync — just noise |
| Deploy | `Proof server not ready` | Docker/proof server not running |
| Deploy | Various cryptic errors | Check Docker first — 90% of deploy failures = Docker down |

### Docker Keeps Dying

Docker Desktop on Windows has a habit of shutting down. Before every deploy, check:

```bash
docker ps
```

If proof server is not listed, start Docker Desktop and recreate the container.

---

## WSL Setup

### Key Paths

| Item | Path |
|---|---|
| WSL user home | `/home/imaarm/` |
| Compact binary | `/home/imaarm/.local/bin/compact` |
| Compact versions | `/home/imaarm/.compact/versions/` |
| Contract (WSL path) | `/mnt/c/Users/USER/OneDrive/Documents/midnight/Onyx/onyx-contracts` |
| Contract (Windows path) | `C:\Users\USER\OneDrive\Documents\midnight\Onyx\onyx-contracts` |

### PATH for compact to work

The `compact compile` command needs full system PATH (not just user PATH):

```bash
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/imaarm/.local/bin
```

Without this, you get: `/usr/bin/env: 'bash': No such file or directory`

### Running WSL from PowerShell

```powershell
# Open WSL terminal
wsl -d Ubuntu

# Or run a single command from PowerShell
wsl -d Ubuntu -- bash -c "export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/imaarm/.local/bin && compact --version"
```

---

## Wallet

### Moth Wallet (CLI)

```bash
# Wallet name: onyx-deployer
# Passphrase: onyx-admin-2024
```

### Wallet State Cache

Wallet state is cached in `.midnight-wallet-state/preprod/` — subsequent deploys sync fast from cache (5 seconds vs 3.5 hours from scratch).

**Do NOT delete `.midnight-wallet-state/`** unless you want to resync from scratch.

### Deployer Balance

After successful sync, wallet shows:
```
Balance: 2,000,000,000 tNight
```

---

## Deployment

### Pre-Deploy Checklist

- [ ] Docker Desktop is running
- [ ] Proof server container is up and healthy (`docker ps`)
- [ ] WSL compact compiler is 0.31.1 (`compact --version` then `compact list`)
- [ ] `package.json` has `@midnight-ntwrk/compact-runtime: "0.16.0"` (no overrides)
- [ ] Contract compiled with compiler 0.31.1 (check `index.js` line 2: `checkRuntimeVersion('0.16.0')`)
- [ ] `.midnight-wallet-state/preprod/` exists (cached sync state)

### Deploy

```bash
# From PowerShell in onyx-contracts/
node dist/cli.js deploy:marketplace

# Or detached (survives bash timeout):
Start-Process cmd.exe /c deploy-bg.bat
```

### Monitor Deploy

```powershell
# Check progress
Get-Content .deploy-progress.json -Raw

# Check full log
Get-Content .deploy-detached.log -Tail 20

# Check for contract address
Select-String -Path ".deploy-detached.log" -Pattern "Contract Address"
```

### Deploy Output

Successful deploy shows:
```
Contract deployed successfully!
Contract Address: 1a7dabae6289b10f94636458b2c749b2396a3c9edc1e46877d4bb8a35a839b51
```

Deploy takes ~274 seconds (4.5 minutes) with cached wallet state.

### Post-Deploy: Fix .midnight-state.json

If deploy succeeds but `.midnight-state.json` is corrupted (BOM/encoding issue), rewrite it:

```powershell
# Nuclear option — rewrite from scratch
Remove-Item .midnight-state.json
```

Then redeploy. The wallet seed is in this file.

---

## Compilation

### Compile Command (WSL)

```bash
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/imaarm/.local/bin
cd /mnt/c/Users/USER/OneDrive/Documents/midnight/Onyx/onyx-contracts
compact compile contracts/onyx-marketplace.compact contracts/managed/onyx-marketplace
```

### Our 14 Circuits

| Circuit | Purpose |
|---|---|
| `listData` | Seller lists encrypted dataset |
| `buyListing` | Buyer initiates purchase |
| `confirmDelivery` | Buyer confirms receipt |
| `disputeListing` | Buyer disputes listing |
| `resolveDispute` | Admin resolves dispute |
| `getListingSeller` | Get seller address |
| `getListingDataCommitment` | Get data commitment |
| `getListingPrice` | Get listing price |
| `getListingState` | Get listing state |
| `getListingBuyer` | Get buyer address |
| `getEscrow` | Get escrow amount |
| `getTotalListings` | Get total listings count |
| `getCompletedSales` | Get completed sales count |
| `getAdmin` | Get admin address |

---

## Common Pitfalls & Solutions

### 1. `coinPublicKey` error during deploy
**Cause:** compact-runtime version mismatch (0.19.0 vs 0.16.0)
**Fix:** Pin runtime to 0.16.0, recompile with compiler 0.31.1

### 2. `Expected string, actual {tag:"schnorr", value:"..."}`
**Cause:** compact-runtime 0.19.0 changed SigningKey from string to structured object
**Fix:** Downgrade to runtime 0.16.0

### 3. `Wallet.Sync` hangs forever
**Cause:** Docker/proof server not running
**Fix:** Start Docker Desktop, ensure proof server container is healthy

### 4. `npm run build` fails with TypeScript errors
**Cause:** Wrong compact-runtime version in node_modules
**Fix:** Remove overrides, `npm install`, rebuild

### 5. `/usr/bin/env: 'bash': No such file or directory`
**Cause:** WSL PATH incomplete when running compact
**Fix:** Set full PATH: `export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH`

### 6. Deploy hangs after "Deploying contract..."
**Cause:** Proof server died mid-deploy
**Fix:** Check `docker ps`, restart if needed, redeploy

### 7. `.midnight-state.json` parse error after successful deploy
**Cause:** PowerShell UTF-16 encoding vs JSON
**Fix:** Delete file and redeploy, or rewrite with UTF-8 encoding

---

## Rules for This Project

1. **Never write Compact code without midnight-expert MCP** — 16 plugins + 53 reference files in `.midnight-expert/`
2. **Always check Docker before deploy** — `docker ps` first
3. **Never use npm overrides for compact-runtime** — pin the correct version in package.json
4. **Always compile in WSL** — compact CLI is Linux-only
5. **Always screenshot compile + deploy output** for Rise In submission

---

## Rise In Submission

### Screenshots Location
- `screenshots/compile.png` — 14 circuits compiled
- `screenshots/deploy.png` — Contract deployed with address

### Contract Address for Submission
```
1a7dabae6289b10f94636458b2c749b2396a3c9edc1e46877d4bb8a35a839b51
```
