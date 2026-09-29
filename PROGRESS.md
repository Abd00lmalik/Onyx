# Onyx — Phase Progress & Checklists

Rule: **no phase starts until the previous phase's checklist is 100% green.**

| Phase | Deliverable | Status |
|---|---|---|
| 0 | Repo hygiene, secrets scrub, wallet funded | ✅ Done |
| 1 | Contract: metadata + NIGHT escrow, deployed to preprod | ✅ Done |
| 2 | Frontend SDK foundations (providers, wallet adapter, hooks) | ✅ Done |
| 3 | P2P encrypted package module | ✅ Done |
| 4 | View layer rewire (no mock data left) | ✅ Done |
| 5 | Scripted Node E2E on preprod | 🔄 In progress |
| 6 | Verify & ship | ⬜ Planned |

---

## Phase 0 — Repo hygiene ✅

- [x] Mnemonic/seed scrubbed from tracked files (`handoff.md`, `launch-deploy.ps1`, `deploy-bg.bat`)
- [x] `.midnight-state.json` BOM-free, schema `{address, deployer, deployedAt}`
- [x] `.gitignore` extended (deploy logs, progress, `midnight-level-db/`, `*.png`)
- [x] Secrets grep = 0 matches in tracked files
- [x] `launch-deploy.ps1` parses; refuses to run without env var
- [x] `npx tsx src/network.ts` loads state
- [x] `npx tsc --noEmit` exit 0
- [x] Deployer wallet funded: 2,000,000,000 tNIGHT + 10^19 SPECK DUST

## Phase 1 — Contract ✅

- [x] Contract rewritten: `listingMeta` / `listingSellerAddr` / `listingBuyerAddr` maps + NIGHT escrow
- [x] `compact compile` in WSL, 15 circuits, fresh keys/zkir, exit 0
- [x] `src/cli.ts` updated to new circuit signatures
- [x] `npx tsc --noEmit` exit 0
- [x] Proof server healthy (`docker compose up -d proof-server`, HTTP 200)
- [x] Deployed to preprod → `a7791112a07144af7da22e51b0a504cc07df513585abf5066d333802e2ca4998`
- [x] Artifacts synced to `frontend/public/zk-artifacts/` (contract 3, keys 30, zkir 30, contract-info.json)
- [x] `scripts/read-contract.ts` address↔artifact decode PASS 9/9
- [x] Old address replaced everywhere (0 refs remain)

---

## Phase 2 — Frontend SDK foundations (gate for Phase 3)

**Write-ups before code.** Key facts locked in from research:

- Connector API speaks **hex-serialized transactions**: `tx.serialize()` → hex →
  `balanceUnsealedTransaction(hex)` → `{tx: hex}` → `Transaction.deserialize('signature','proof','binding', bytes)`.
- `CoinPublicKey` / `EncPublicKey` / `TransactionId` are plain `string`.
- `FetchZkConfigProvider` calls `new URL(baseURL)` → **must be absolute** (`origin + '/zk-artifacts'`),
  and reads `keys/<id>.prover|.verifier`, `zkir/<id>.bzkir` (matches our synced layout).
- Private-state password policy (`validatePassword`): ≥16 chars, ≥3 of 4 char classes,
  no 3 identical consecutive, no 4-char ascending/descending run.
- Unshielded bech32m payload **is** the 32 raw address bytes (codec type `addr`, identity mapping);
  test vector `mn_addr_preprod1xra3cc…qaupl0x` (deployer).
- Artifacts compiled with `compact-runtime@0.16.0` → frontend must pin `0.16.0` (currently wrongly `^0.19.0`).

Checklist:

- [x] **Deps**: pin `@midnight-ntwrk/compact-runtime@0.16.0`; add `midnight-js-dapp-connector-proof-provider@4.1.1` + `midnight-js-http-client-proof-provider@4.1.1`
- [x] `src/lib/hex.ts`: hex↔bytes, bech32m→32-byte address, meta encode/decode (`Bytes<512>`), listing state names
- [x] `src/lib/wallet-adapter.ts`: `ConnectedAPI` → `{ walletProvider, midnightProvider }` (hex balance/submit round-trip)
- [x] `src/lib/midnight.ts`: absolute zk base, static contract import (no `eval`), policy-compliant generated password, proof provider = wallet-delegated → HTTP fallback
- [x] `src/lib/constants.ts`: absolute `ZK_ARTIFACTS_URL`
- [x] `src/lib/witnesses.ts`: CSPRNG for `secretKey` / salts (no `Math.random`)
- [x] `src/hooks/useWallet.ts`: cache coin/enc public keys, expose 32-byte address hex, fix BigInt balance bug
- [x] `src/hooks/useContract.ts`: new circuit signatures (`dataHash`, `price`, `meta`, `addrBytes`, `listingIdBytes`)
- [x] `src/hooks/useMarketplace.ts`: ledger decode via typed `ledger()` import, enum→name, BigInt ids, meta decode
- [x] **Test A**: `npx tsc -b` exit 0
- [x] **Test B**: `npm run lint` (oxlint) exit 0 (2 pre-existing warnings: unused `Shield` import in `ListingCard.tsx:6`, unused `e` in `scripts/deps-inspect.mjs:40`)
- [x] **Test C**: `npm run build` (tsc + vite) exit 0 — `dist/assets/index-0cwxa9nN.js` 321.20 kB / gzip 97.26 kB
- [x] **Test D**: `npm run test:smoke` — 12/12: password passes `validatePassword`; bech32m test vector decodes to 32 bytes and re-encodes identically; meta encode/decode round-trips at the 512-byte boundary (oversized rejected, zero-pad safe); generated contract module + public/generated sync; `contract-info.json` matches frontend wrappers (15 circuits, `runtime-version 0.16.0`); artifacts present for every circuit
- [x] **Test E**: `npm run test:read` — 4/4 in Chromium against preprod: app loads without page errors, SDK module graph loads, `queryContractState` + `OnyxLedger.ledger()` decode succeeds (`listings=0`, so decode verified against empty state), no console/page errors

**Browser build fixes required for Test E** (Vite 8 / rolldown):

- `src/vendor/onchain-runtime-browser.js` + `src/vendor/ledger-wasm-browser.js` shims, wired via the `midnightWasmShims()` plugin and `optimizeDeps.exclude` — the packages' wasm-bindgen "bundler" entries break when Vite duplicates the `_bg.js` glue; also, Chrome rejects synchronous `WebAssembly.Instance` for the 10 MB ledger wasm.
- `vite-plugin-node-polyfills` (`events`, `assert`, `buffer`, `util`, …) — `abstract-level` does `class extends EventEmitter`; Vite otherwise replaces `events` with an empty `browser-external` stub → `Class extends value undefined is not a constructor or null`.
- `resolve.dedupe` for `compact-runtime` / `onchain-runtime-v3` — wasm-bindgen ties class identity to the WASM instance, so two copies silently break `instanceof`.

**Gate**: all boxes checked → report to user → start Phase 3.

---

## Phase 3 — P2P package module (gate for Phase 4)

**Write-ups before code.** Decisions locked in from research:

- On-chain state stores only `listingDataCommitment` + `meta`; the data itself never touches the
  chain. The seller keeps it locally and delivers it out of band (file handoff) — the user's
  decision: **no servers for data, privacy first**.
- `dataCommitment = persistentCommit(Vector<2, Bytes<32>>, [dataHash, pad(32, "onyx:data:")], salt)`.
  The generated contract wraps that exact expression in `_compute_data_commitment_0(dataHash, salt)`
  (`src/generated/contract/index.js:1176`; descriptors at `:12` and `:24`). Our module calls the same
  `persistentCommit` with the same `CompactTypeVector(2, CompactTypeBytes(32))` descriptor, and
  Test F cross-checks against the compiled method itself — no on-chain write needed to prove it.
- The salt is minted by our own `get_random_salt` witness and travels **inside the package** (the
  contract stores it only through the off-chain `store_listing_salt` witness).
- Midnight's account encryption key is a **JubJub point**; there is no JubJub ECDH in JS and no SDK
  helper for it, so packages are deliberately **not** keyed to the wallet encryption key.
- Recipient-scoped wrapping therefore uses **X25519 via Web Crypto** (verified in Node 24 and the
  Chrome that puppeteer ships; both support `X25519` in `crypto.subtle`), HKDF-SHA256 for the wrap
  key, AES-256-GCM for the content and for the wrapped key, SHA-256 for `dataHash`. A `raw` mode
  keeps the seller's own at-rest copy usable without a key handoff.
- Payment gating stays procedural (pay on-chain → request package → handoff), backed by the NIGHT
  escrow and the `disputeListing`/`resolveDispute` refund path — not by cryptography.

Checklist:

- [x] `src/lib/package.ts`: `hashData` (SHA-256), `randomSalt`/`randomDataKey`, `computeDataCommitment` (byte-identical to `_compute_data_commitment_0`), `createPackage`, `openPackage`, `serializePackage`/`parsePackage` (versioned JSON envelope), `generateRecipientKeys`, `wrapKeyForRecipient`/`unwrapKeyForRecipient`/`unwrapKey` (X25519 → HKDF-SHA256 → AES-256-GCM key wrap), `verifyPackage` (hash + commitment + meta)
- [x] `package.json`: `test:package` script (`tsx scripts/phase3-package-test.ts`)
- [x] **Test F**: `npm run test:package` — **22/22**: SHA-256 matches `node:crypto`; commitment matches the compiled contract's `_compute_data_commitment_0` on 5 random vectors + 1 fixed vector; hiding/binding sanity; create→open byte-identical; tampered ciphertext rejected; wrong data key rejected; X25519 wrap→unwrap→open round-trip; wrong recipient rejected; unwrapped package refuses recipient opening; wrap bound to listing id; serialize→parse round-trip; parse rejects unknown version / malformed JSON / array / short fields / wrong cipher; `verifyPackage` flags wrong salt, tampered plaintext, wrong meta and a foreign commitment
- [x] **Test E + browser probe**: `npm run test:read` — 5/5, including an in-Chrome run of the same module: X25519 keys, wrap→unwrap→open, wrong recipient rejected, commitment equal to the contract's `_compute_data_commitment_0` in the browser, `verifyPackage` ok
- [x] Gate re-run: `npm run lint` (0 warnings) && `npm run build` (0) && `npm run test:smoke` (12/12) && `npm run test:package` (22/22) && `npm run test:read` (5/5)
- [x] Cleanup: deleted the Phase 2 one-off debug probes (`wasm-debug`, `wasm-fetch`, `dev-graph-debug`, `module-probe`, `caller-probe`, `deps-inspect`) and the unused `Shield` import, so lint is clean

**Gate**: all boxes checked → report to user → start Phase 4.

---

## Phase 4 — View layer rewire (gate for Phase 5)

**Write-ups before code.** Decisions locked in from research:

- None of the three hooks (`useWallet`, `useContract`, `useMarketplace`) is imported by any
  component; every page serves `MOCK_LISTINGS` / `MOCK_WALLET`, `WalletConnect` runs an 800 ms fake
  timer, `BuyDialog` fakes a 2 s purchase, `ListDataForm` fakes a 1.5 s tx with a random hash, and
  "Confirm Delivery" / "File Dispute" are buttons with no `onClick` at all.
- One app-level context mounts the three hooks **once** (`src/context/AppContext.tsx`, provided in
  `App.tsx`, consumed as `useApp()`); otherwise each of the five pages opens its own contract
  connection and indexer polling loop.
- `src/lib/mockData.ts` is deleted. Its formatters move to `src/lib/format.ts`:
  `formatNight` (÷10^6, 2 dp — NIGHT balances **and** prices are both smallest NIGHT units),
  `formatRaw` (DUST balance, raw integer the way `check-balance.ts` prints it),
  `nightToStar` (decimal NIGHT input → STAR `bigint` for `listData`).
  Price labels change **DUST → NIGHT** and the form's "Price (DUST)" becomes "Price (NIGHT)":
  the contract prices in STAR (smallest NIGHT unit, `onyx-marketplace.compact:18`), so the current
  "… DUST" labels are wrong.
- `Listing` / `ListingState` come from `src/types/index.ts` only; the duplicate definitions in
  `mockData.ts` go away with that file.
- `resolveDispute` stays out of the UI: the admin key is `get_public_key(local_secret_key)` from
  the constructor, not the wallet's coin key, so admin detection needs the witness secret key.
  Dispute **filing** is wired; resolution runs from the Phase 5/6 script.

Checklist:

- [x] `src/lib/format.ts`: `formatNight`, `formatRaw`, `nightToStar`, `shortAddress`, `addressDisplay` (hex → bech32m), `formatFileSize`; every price label now says "NIGHT"
- [x] `src/context/app-context.ts` (`AppContext` + `useApp`) + `src/context/AppContext.tsx` (`AppProvider` composing `useWallet` → `useContract` → `useMarketplace`); mounted in `App.tsx`; contract connects automatically once a wallet is connected. Split into two files so oxlint's fast-refresh rule stays clean
- [x] `components/wallet/WalletConnect.tsx`: real `connect`/`disconnect`, address + NIGHT + DUST balances, error text, loading state (replaces local state + `MOCK_WALLET` + the 800 ms timer)
- [x] `pages/BrowsePage.tsx`: marketplace listings + spinner/error/empty states, search and state filter kept local
- [x] `pages/HomePage.tsx`: `stats` (listings, completed sales, total volume in NIGHT) instead of `MOCK_STATS`
- [x] `pages/DashboardPage.tsx`: wallet state + listings filtered by `sellerAddr`/`buyerAddr` against the connected address, NIGHT/DUST cards, connect prompt when disconnected
- [x] `pages/ListingDetailPage.tsx`: async `fetchListing` with derived loading/ready/missing status, Buy / Confirm Delivery / File Dispute wired to `buyListing` / `confirmDelivery` / `disputeListing`, each polling up to 30 s for the state to settle, seller/buyer gating on the on-chain addresses
- [x] `components/marketplace/BuyDialog.tsx`: real `onConfirm` that surfaces transaction errors (the 2 s fake timer and fake success are gone)
- [x] `components/marketplace/ListDataForm.tsx`: file picker → `hashData` + `encodeMeta` → `listData` → diff the indexer to learn the new listing id (the id comes from an in-circuit random nonce) → `createPackage` → download the seller vault (`.onyx-vault.json`, round-tripped through `parseVault` before it is offered); price entered in NIGHT, converted with `nightToStar`
- [x] Package handoff UI in `components/marketplace/DeliveryPanel.tsx`: buyer "Create package request" (X25519 keypair persisted per listing in localStorage, `.onyx-request.json` download), seller vault + request pickers → `recipientBuild` → `.onyx-package.json` download, buyer "Import delivered package" → `unwrapKeyForRecipient` → `openPackage` → `verifyPackage` against the on-chain commitment and re-encoded metadata → three check badges + plaintext download
- [x] **Test G**: `npm run test:wiring` — **36/36**: `mockData.ts` deleted and unreferenced, no `MOCK_` constants, no fake `setTimeout` delays or random tx hashes in components, `Listing`/`ListingState` defined only in `types/index.ts`, `WalletConnect`/four pages consume `useApp`, `onConfirm` present, NIGHT labels everywhere, the three circuits called from the detail page, delivery helpers present, `contractRef` in `useContract`
- [x] **Test H**: `npm run test:ui` — **15/15** in Chromium on a clean dep cache: `/`, `/browse`, `/list`, `/dashboard`, `/listing/:id` all render their headings, no mock titles or `MOCK_` markers, connect affordance on `/`, graceful "connect a wallet" states, "Listing not found" for an unknown id, zero console/page errors
- [x] Gate re-run, all green: `lint` 0 errors 0 warnings · `build` exit 0 (`index--YRbQlYA.js` 841 kB) · `test:smoke` 12/12 · `test:package` 22/22 · `test:read` 5/5 (preprod reports **0 listings**) · `test:wiring` 36/36 · `test:ui` 15/15

**Gate**: all boxes checked → report to user → start Phase 5 (scripted Node E2E on preprod).

---

## Phase 5 — Scripted Node E2E on preprod (gate for Phase 6)

**Write-ups before code.** Decisions locked in from research:

- The write path has **never run** on preprod: Phase 1 proved deploy + reads (`read-contract.ts`,
  9/9) and the indexer still reports 0 listings. `src/cli.ts` exists but was never exercised, and
  reading the SDK source shows two defects in it that the E2E must not copy:
  1. `findDeployedContract(..., initialPrivateState: {})` **overwrites** the stored private state
     (`midnight-js-contracts/dist/index.mjs:1815-1819`) — it wipes the deploy-time `secretKey`
     that `admin = disclose(get_public_key(local_secret_key()))` was sealed from, after which
     `resolveDispute` can never pass its admin check.
  2. Its `balanceTx` runs `balanceUnboundTransaction` → `finalizeRecipe` with **no signing step**.
     `finalizeRecipe` does not sign (facade `dist/index.js:414-437`), and `callTx` is literally
     `balanceTx(tx)` then `submitTx` (`index.mjs:28-29`), so any circuit that takes a NIGHT input
     (`buyListing` → `receiveUnshielded`) would submit an unshielded input with no signature.
- Correct signing recipe for NIGHT-input transactions:
  `balanceUnboundTransaction` → `signRecipe(recipe, (d) => unshieldedKeystore.signData(d))` →
  `finalizeRecipe` → `submitTransaction`. Shielded/DUST signatures are already produced during
  balancing (the deploy tx proved that), so non-NIGHT calls keep the deploy path exactly as is.
- A **second wallet is mandatory**: `buyListing` asserts `buyerPk != listingSeller`
  ("Cannot buy your own listing", `onyx-marketplace.compact:191`). Buyer seed is derived from the
  deployer seed (`sha256(seed || "onyx:buyer:v1")`), and it gets its **own sync-cache cwd** so
  `saveWalletState` can never clobber the deployer's `.midnight-wallet-state`.
- No faucet API exists for a second address, so the buyer is funded by a real
  `WalletFacade.transferTransaction` (unshielded output) from the deployer, then registered for
  DUST generation and waited on (the `deploy.ts` DUST loop). Both steps are skipped on later runs
  once the buyer is funded, so the suite stays fast on retry.
- The listing id comes from an in-circuit random nonce (`get_random_salt`), so the script learns it
  by diffing `ledger.listingSeller` keys before/after `listData` — the same technique the UI uses.
- Escrow is real NIGHT bookkeeping: `buyListing` does `receiveUnshielded(nativeToken, price)` and
  `confirmDelivery` / `resolveDispute` do `sendUnshielded` to the stored payout address after
  `unshieldedBalanceGte` passes. That makes balances exactly assertable: **seller +price on
  confirm, buyer +price on refund**.
- Admin identity is checked up front: re-derive `get_public_key(stored secretKey)` and compare it
  with the sealed `ledger.admin` before ever calling `resolveDispute`, so a clobbered private state
  fails loudly in preflight instead of mid-run.
- The package half runs in Node by importing `frontend/src/lib/package.ts` cross-package under
  `tsx` (no browser APIs: Web Crypto is global, `btoa`/`atob` exist in Node) — proving the exact
  module the UI ships does create → wrap → open → verify against on-chain data.

Checklist (the tests, written before the code):

- [x] `onyx-contracts/scripts/phase5-e2e.ts` + `npm run test:phase5` — one script, assertion
      counter, non-zero exit on any failure — final run **49/49 PASS**
- [x] **Preflight**: deployment record + proof server (HTTP 200) + indexer reachable; deployer
      NIGHT/DUST balances > 0; stored private state exists and derives the sealed `ledger.admin`
- [x] **Buyer wallet**: derived seed, separate sync cache, funded by `transferTransaction` from the
      deployer, registered for DUST generation, DUST wait with timeout (skipped when already funded)
- [x] **Listing A**: sample dataset → `hashData` + meta → `listData` → id diff → on-chain
      assertions (seller pk, price, state = active, meta decodes to our JSON, sellerAddr = deployer)
- [x] **Package**: `createPackage` → `computeDataCommitment` equals the on-chain
      `listingDataCommitment`, key wrapped to the buyer's X25519 recipient, serialize → parse round
      trip — package must salt with the contract's stored witness salt
      (`store_listing_salt` → `privateState.listingSalts[id]`), not a fresh `randomSalt()`
- [x] **Buy A**: `buyListing` on the signing path → state = sold, buyer = buyer pk, escrow = price
- [x] **Handoff**: buyer unwraps → `openPackage` → `verifyPackage` against the on-chain commitment
      and re-encoded meta; plaintext byte-equals the original dataset
- [x] **Confirm A**: `confirmDelivery` by the buyer → state = completed, escrow entry removed,
      `completedCount` incremented, seller NIGHT delta = +price
- [x] **Dispute B**: second listing → buy → `disputeListing` by the buyer → state = disputed →
      `resolveDispute(refundBuyer = true)` by the admin → state = completed, escrow removed,
      buyer NIGHT delta = +price
- [x] **Negative guards** (must fail locally before any tx is submitted): self-purchase,
      `buyListing` on a completed listing, `confirmDelivery` by the seller,
      `resolveDispute` by a non-admin
- [x] Fix `src/cli.ts`: keep the stored private state (no `initialPrivateState: {}` clobber) and
      sign unshielded inputs in `balanceTx` — the interactive tool ships in Phase 6 too
- [x] **Gate re-run** all green: frontend `lint` 0/0 · `build` · `test:smoke` 12/12 ·
      `test:package` 22/22 · `test:read` 5/5 · `test:wiring` 36/36 · `test:ui` 15/15, plus
      onyx-contracts `test:e2e` (read-only, retargeted from hello-world to onyx-marketplace) and
      the new `test:phase5` (49/49)

Fixes landed during Phase 5 debugging (all verified by the 49/49 run):

- **`expected instance of StateValue`** in `mergeUnsubmittedCallTxData`: duplicate
  `@midnight-ntwrk/onchain-runtime-v3` (3.1.1 top-level vs 3.0.0 nested under
  midnight-js-protocol). Fixed with `"overrides": { "@midnight-ntwrk/onchain-runtime-v3": "3.0.0" }`
  in **both** package.json files + `npm dedupe`.
- **`expected a cell, received null`** reading `listingBuyerAddr` for listings that never
  bought — map lookup on a missing key throws; guarded with `.member(key)` in
  `phase5-e2e.ts` and `frontend/src/hooks/useMarketplace.ts`.
- **Commitment mismatch (3 FAILs)** — the package was salted with a client-side
  `randomSalt()` while the contract committed with its own in-circuit salt; now read from
  `privateState.listingSalts` (`contractSalt()` in `phase5-e2e.ts`, `contractSalt` in
  `useContract.ts`, used by `ListDataForm.tsx`).
- DUST: `fundBuyer` settles the stale Merkle root (`InvalidDustSpendProof`, error 170) and
  retries; `callTx` retries transient `Wallet.Sync`/indexer failures (observed recoveries).

**Gate**: all boxes checked → report to user → start Phase 6 (verify & ship).

---

## Phase 6 — headless Chrome E2E (list + buy through the real frontend)

Full list-and-buy cycle driven by puppeteer against the production React UI, no Lace available
headlessly, so a Node bridge stands in for the injected wallet:

- [x] **Bridge server** `onyx-contracts/scripts/e2e-bridge.ts` (port 8787): serves the two synced
      wallets (deployer = seller, buyer) over HTTP — `GET /{role}/config|balances`,
      `POST /{role}/balance|submit`. Browser hex → Node `Transaction.deserialize` →
      `balanceUnboundTransaction` → `signRecipe` (signed variant preferred; unsigned fallback
      for `InputsSignaturesLengthMismatch`) → back to the page. Serial per-wallet mutex,
      self-healing submit retries (variant swap on signature mismatch, re-balance on dust-root
      error 170), dust refill via ported `settleDust`/`ensureDust` with
      `TRANSIENT_RE`/`DUST_STALE_RE` classification, buyer funded 1000 NIGHT at startup when low
- [x] **Frontend injection** `frontend/src/lib/e2e-api.ts` + `useWallet.ts`: when
      `window.__ONYX_E2E__` is set (via `page.evaluateOnNewDocument`), `connect()` returns a
      bridge-backed `ConnectedAPI` instead of `getInjectedWallet()`; everything downstream
      (adapter, contract calls, HTTP proof server, indexer polling) is the real production path.
      Added `getCoinPublicKey()`/`getEncryptionPublicKey()` to `OnyxWalletAdapter`
- [x] **Harness** `frontend/scripts/phase6-ui-e2e.mjs`: spawns bridge + `vite preview`, two
      incognito contexts (seller/buyer), connect → /list → fill → upload → List Dataset →
      /browse → buy → sold state; screenshots to `frontend/.e2e-artifacts/` (gitignored)
- [x] **Stable green**: back-to-back PASS runs on the final code (run8 16:29, run9 16:32 local),
      5 PASSes total across the loop
- [x] **Gate re-run** all green after harness changes: frontend `lint` 0/0 · `build` ·
      `test:smoke` 12/12 · `test:package` 22/22 · `test:read` · `test:wiring` · `test:ui`, plus
      bridge `tsc --noEmit` clean

Fixes landed during Phase 6 debugging:

- **No `while…else` in JS** — harness loop syntax error.
- **Session wallet role mapping** — `seller → deployer` for bridge routes.
- **State loss on navigation** — `page.goto` resets the React wallet context; every step now
  re-checks and clicks Connect Wallet (`ensureConnected`).
- **IPv6 localhost** — Chrome resolves `localhost` → `::1` while the proof server binds IPv4;
  puppeteer runs with `--host-resolver-rules=MAP localhost 127.0.0.1`.
- **False-positive error detection** — destructive `bg-danger` styling on "File Dispute" counted
  as an error; errors now exclude buttons and require 2 consecutive strikes.
- **Dust exhaustion** — buyer fee burn left <1e15 DUST and the generic
  `balancing failed for both variants` masked the real cause: `balanceTxOnce` now carries the
  inner error text so the retry wrapper classifies dust/transient; bridge startup funds the
  buyer and tops dust up to 3e15; harness preflight waits for refill.
- **`estimateTransactionFee` hang** — the wasm fee-estimation call blocks the Node event loop
  for minutes (timers can't fire → CLOSE_WAIT zombie sockets, UI stalls). Removed; a 300s
  `Promise.race` watchdog on `POST /balance` keeps the handler honest.
- Harness catches now log the underlying exception message + `page.on('crash')` for diagnosis.

**Gate**: all boxes checked → headless list+buy stable → report to user → ship.

### Phase 6 addendum — deployed-site `'check' / Failed to fetch` fix

The Vercel build failed every proof op (`Unexpected error submitting scoped
transaction ... 'check' returned an error: TypeError: Failed to fetch`) while
local/headless worked. Diagnosed with `frontend/scripts/proof-probe.mjs` (live
origin in headless Chrome + CDP network capture):

- The deployed bundle baked `http://localhost:6300` (no `VITE_PROOF_SERVER_URL`).
- Chrome 153 Local Network Access **denied** the public-origin → loopback request
  (`Permission was denied for this request to access the 'loopback' address
  space`); the stock `midnightntwrk/proof-server:8.1.0` emits no
  `Access-Control-Allow-Private-Network` grant either.
- `localhost` resolves to IPv6 where the Docker proof server RSTs
  (same quirk that forced `--host-resolver-rules` in the harness).

Fix (both layers shipped):

- **Public tunnel (steady state)**: `cloudflared tunnel --url http://127.0.0.1:6300`
  → Vercel project env `VITE_PROOF_SERVER_URL=https://*.trycloudflare.com` →
  `vercel redeploy`. Probe now returns `REACHED SERVER` from the live origin;
  bundle grep confirms the tunnel URL and no `localhost:6300`.
- **Local fallback**: `onyx-contracts/scripts/proof-proxy.mjs` mirrors CORS and
  adds `Access-Control-Allow-Private-Network: true` on 127.0.0.1:6301 (verified
  via preflight curl); using it from the deployed site still requires allowing
  "Local network access" for the origin in Chrome site settings (the user's
  profile had it dismissed/blocked).
- Docs in README (`Deploy on Vercel → Proof server for the deployed site`),
  `.vercel/` gitignored, gate re-run green (lint/build).

