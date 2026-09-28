/**
 * Phase 5 — scripted end-to-end test on preprod (gate for Phase 6).
 *
 * One script, real transactions, no interaction:
 *
 *   preflight  deployment + proof server + indexer + wallet balances + admin identity
 *   buyer      derived wallet, funded from the deployer, registered for DUST
 *   listing A  list -> package -> buy -> package handoff -> confirm  (happy path)
 *   listing B  list -> buy -> dispute -> admin resolve (refund)      (dispute path)
 *   guards     four in-circuit assertions that must fail before any tx is submitted
 *
 * The package half imports the *same* module the UI ships
 * (`frontend/src/lib/package.ts`), so create -> wrap -> open -> verify runs
 * against bytes that actually came from the chain.
 *
 * Usage: npm run test:phase5
 */
import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk';
import { CompactTypeBytes, CompactTypeVector, persistentHash } from '@midnight-ntwrk/compact-runtime';

import { resolveNetwork, getOrCreateWallet, getDeployment, type NetworkConfig } from '../src/network';
import { createWallet, persistWalletState, unshieldedToken, type WalletContext } from '../src/wallet';

// The exact modules the frontend ships — same bytes, same code paths.
import { bytesToHex, decodeMeta, encodeMeta, hexToBytes, stateName } from '../../frontend/src/lib/hex';
import {
  computeDataCommitment,
  createPackage,
  generateRecipientKeys,
  hashData,
  openPackage,
  parsePackage,
  serializePackage,
  verifyPackage,
  wrapKeyForRecipient,
  type DataPackage,
  type RecipientKeys,
} from '../../frontend/src/lib/package';

// @ts-expect-error wallet sync requires WebSocket
globalThis.WebSocket = WebSocket;

const PRIVATE_STATE_ID = 'onyxMarketplacePrivateState';
const PRIVATE_STATE_STORE = 'onyx-marketplace-state';
const PRIVATE_STATE_PASSWORD =
  process.env.PRIVATE_STATE_PASSWORD?.trim() || 'Local-Devnet-Development-Placeholder-1';

// Buyer seed: derived from the deployer seed, so the second wallet is
// reproducible without storing another secret (see PROGRESS.md Phase 5).
const BUYER_SEED_LABEL = 'onyx:buyer:v1';

/** 1 NIGHT = 10^6 STAR (onyx-marketplace.compact prices in STAR). */
const STAR_PER_NIGHT = 1_000_000n;
const PRICE_A = 2n * STAR_PER_NIGHT;
const PRICE_B = 15n * STAR_PER_NIGHT / 10n;
const BUYER_FUND = 10n * STAR_PER_NIGHT;

const LISTING_STATE = { active: 0, sold: 1, disputed: 2, completed: 3 } as const;

const PK_VECTOR = new CompactTypeVector(2, new CompactTypeBytes(32));
const PK_DOMAIN = (() => {
  const out = new Uint8Array(32);
  out.set(new TextEncoder().encode('onyx:pk:'));
  return out;
})();

/* ------------------------------------------------------------- assertions -- */

let passed = 0;
const failures: string[] = [];

function check(cond: boolean, label: string, detail?: unknown): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.error(`  FAIL  ${label}${detail === undefined ? '' : ` — ${formatDetail(detail)}`}`);
  }
}

function formatDetail(detail: unknown): string {
  if (typeof detail === 'bigint') return detail.toString();
  if (typeof detail === 'string') return detail;
  try {
    return JSON.stringify(detail, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
  } catch {
    return String(detail);
  }
}

function errorText(err: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let cur: unknown = err;
  for (let i = 0; cur && typeof cur === 'object' && !seen.has(cur) && i < 8; i++) {
    seen.add(cur);
    const e = cur as Record<string, unknown>;
    const msg = e.message ?? e.reason ?? e.cause ?? e;
    parts.push(typeof msg === 'string' ? msg : formatDetail(msg));
    cur = e.cause;
  }
  if (parts.length === 0) parts.push(String(err));
  return parts.join(' | ');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function banner(title: string): void {
  console.log(`\n─── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

async function expectRejection(label: string, needle: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    check(false, label, 'expected a rejection, but the call succeeded');
  } catch (err) {
    const text = errorText(err);
    check(
      text.toLowerCase().includes(needle.toLowerCase()),
      label,
      `rejected for a different reason: ${text.slice(0, 300)}`,
    );
  }
}

/* ---------------------------------------------------------------- helpers -- */

function publicKeyFromSecret(secretKey: Uint8Array): Uint8Array {
  return persistentHash(PK_VECTOR, [PK_DOMAIN, secretKey]);
}

async function syncedState(ctx: WalletContext) {
  // NOTE: no parameter type annotation here — annotating it would narrow the
  // emitted state to { isSynced } and break nightOf/dustOf.
  return Rx.firstValueFrom(
    ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)),
  );
}

function nightOf(state: { unshielded: { balances: Record<string, bigint> } }): bigint {
  return state.unshielded.balances[unshieldedToken().raw] ?? 0n;
}

function dustOf(state: { dust: { balance: (now: Date) => bigint } }): bigint {
  return state.dust.balance(new Date());
}

async function waitForNight(ctx: WalletContext, min: bigint, timeoutMs = 90_000): Promise<bigint> {
  const deadline = Date.now() + timeoutMs;
  let current = 0n;
  while (Date.now() < deadline) {
    current = nightOf(await syncedState(ctx));
    if (current >= min) return current;
    await sleep(3000);
  }
  return current;
}

/* -------------------------------------------------------------- ledger I/O -- */

type LedgerRow = {
  id: string;
  seller: string;
  sellerAddr: string;
  buyer: string;
  buyerAddr: string;
  commitment: string;
  price: bigint;
  state: number;
  escrow: bigint;
  metaBytes: Uint8Array;
};

type LedgerSnapshot = {
  rows: Map<string, LedgerRow>;
  listingCount: number;
  completedCount: number;
  admin: string;
};

let OnyxMarketplace: any;

function readLedger(contractState: { data: unknown }): LedgerSnapshot {
  const led = OnyxMarketplace.ledger(contractState.data);
  const rows = new Map<string, LedgerRow>();
  for (const [id, seller] of led.listingSeller as Map<Uint8Array, Uint8Array>) {
    const key = id;
    const idHex = bytesToHex(key);
    rows.set(idHex, {
      id: idHex,
      seller: bytesToHex(seller),
      sellerAddr: bytesToHex(led.listingSellerAddr.lookup(key)),
      buyer: bytesToHex(led.listingBuyer.lookup(key)),
      // listingBuyerAddr and escrow only exist after buyListing — Compact
      // Map.lookup throws on a missing key ("expected a cell, received null").
      buyerAddr: bytesToHex(
        led.listingBuyerAddr.member(key) ? led.listingBuyerAddr.lookup(key) : new Uint8Array(32),
      ),
      commitment: bytesToHex(led.listingDataCommitment.lookup(key)),
      price: BigInt(led.listingPrice.lookup(key)),
      state: Number(led.listingState.lookup(key)),
      escrow: led.escrow.member(key) ? BigInt(led.escrow.lookup(key)) : 0n,
      metaBytes: led.listingMeta.lookup(key) as Uint8Array,
    });
  }
  return {
    rows,
    listingCount: Number(led.listingCount),
    completedCount: Number(led.completedCount),
    admin: bytesToHex(led.admin as Uint8Array),
  };
}

async function queryLedger(provider: unknown, address: string): Promise<LedgerSnapshot | null> {
  const state = await (provider as { queryContractState: (a: string) => Promise<{ data: unknown } | null> })
    .queryContractState(address);
  return state ? readLedger(state) : null;
}

/**
 * The contract's own commitment salt: generated in-circuit by
 * `get_random_salt`, stored via `store_listing_salt` into the seller's
 * private state when `listData` executes. The package must commit with THIS
 * salt — a fresh `randomSalt()` would produce a different commitment than
 * `listingDataCommitment` on chain.
 */
async function contractSalt(bundle: Bundle, listingId: string): Promise<Uint8Array> {
  const state = (await bundle.providers.privateStateProvider.get(PRIVATE_STATE_ID)) as OnyxPrivateState;
  const salt = state.listingSalts[listingId];
  if (!salt || salt.length !== 32) {
    throw new Error(
      `no contract salt stored for listing ${listingId} (have ${Object.keys(state.listingSalts).length} salts)`,
    );
  }
  return salt;
}

async function waitForLedger(
  provider: unknown,
  address: string,
  pred: (snap: LedgerSnapshot) => boolean,
  timeoutMs = 45_000,
): Promise<LedgerSnapshot | null> {
  const deadline = Date.now() + timeoutMs;
  let last: LedgerSnapshot | null = null;
  while (Date.now() < deadline) {
    last = await queryLedger(provider, address);
    if (last && pred(last)) return last;
    await sleep(2000);
  }
  return last;
}

/* ----------------------------------------------------------------- bundles -- */

type ContractFlags = { signUnshielded: boolean };

type Bundle = {
  label: string;
  ctx: WalletContext;
  providers: any;
  deployed: any;
  flags: ContractFlags;
  addressHex: string;
  addressBytes: Uint8Array;
  publicKeyHex: string;
  privateState: { secretKey: Uint8Array; listingSalts: Record<string, Uint8Array> };
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'onyx-marketplace');
const contractPath = path.join(zkConfigPath, 'contract', 'index.js');

if (!fs.existsSync(contractPath)) {
  console.error('❌ Contract not compiled — run `npm run compile` first.');
  process.exit(1);
}

type OnyxPrivateState = { secretKey: Uint8Array; listingSalts: Record<string, Uint8Array> };

// Same witnesses the deploy used. `local_secret_key` must keep returning the
// deploy-time secret key, otherwise the sealed admin identity is lost.
const witnesses = {
  local_secret_key: (ctx: { privateState: OnyxPrivateState }): [OnyxPrivateState, Uint8Array] => [
    ctx.privateState,
    ctx.privateState.secretKey,
  ],
  get_random_salt: (ctx: { privateState: OnyxPrivateState }): [OnyxPrivateState, Uint8Array] => [
    ctx.privateState,
    nodeRandomBytes(32),
  ],
  store_listing_salt: (
    ctx: { privateState: OnyxPrivateState },
    listingId: Uint8Array,
    salt: Uint8Array,
  ): [OnyxPrivateState, []] => {
    const key = bytesToHex(listingId);
    return [{ ...ctx.privateState, listingSalts: { ...ctx.privateState.listingSalts, [key]: salt } }, []];
  },
};

const module_: any = await import(pathToFileURL(contractPath).href);
OnyxMarketplace = module_;

const compiledContract: any = (CompiledContract as any)
  .make('onyx-marketplace', module_.Contract)
  .pipe(
    (CompiledContract as any).withWitnesses(witnesses),
    (CompiledContract as any).withCompiledFileAssets(zkConfigPath),
  );

function makeProviders(ctx: WalletContext, flags: ContractFlags, networkConfig: NetworkConfig) {
  const walletProvider = {
    getCoinPublicKey: () => ctx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => ctx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: unknown, ttl?: Date) {
      const recipe = await ctx.wallet.balanceUnboundTransaction(
        tx as never,
        { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      // `finalizeRecipe` does not sign: shielded/DUST signatures are produced
      // during balancing, but an unshielded (NIGHT) input needs an explicit
      // signRecipe with the account keystore — see PROGRESS.md Phase 5.
      if (!flags.signUnshielded) return ctx.wallet.finalizeRecipe(recipe);
      const signed = await ctx.wallet.signRecipe(recipe, (data: Uint8Array) =>
        ctx.unshieldedKeystore.signData(data),
      );
      return ctx.wallet.finalizeRecipe(signed);
    },
    submitTx: (tx: never) => ctx.wallet.submitTransaction(tx) as never,
  };

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: PRIVATE_STATE_STORE,
      accountId: ctx.unshieldedKeystore.getBech32Address().toString(),
      privateStoragePasswordProvider: async () => PRIVATE_STATE_PASSWORD,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider: new NodeZkConfigProvider(zkConfigPath),
    proofProvider: httpClientProofProvider(networkConfig.proofServer, new NodeZkConfigProvider(zkConfigPath)),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

async function buildBundle(opts: {
  label: string;
  seed: string;
  networkConfig: NetworkConfig;
  contractAddress: string;
  stateCwd?: string;
  requireExistingState?: boolean;
  restore?: boolean;
}): Promise<Bundle> {
  const started = Date.now();
  const flags: ContractFlags = { signUnshielded: false };
  const ctx = await createWallet({
    network: opts.networkConfig.networkId,
    networkConfig: opts.networkConfig,
    seed: opts.seed,
    cwd: opts.stateCwd,
    restore: opts.restore,
  });

  // A first-ever wallet scans the whole chain (shielded + dust) before the
  // facade reports `isSynced`; print the remaining gaps so the wait is
  // observable instead of a silent hang.
  let latest: any = null;
  const stateSub = ctx.wallet.state().subscribe((s: any) => {
    latest = s;
  });
  const ticker = setInterval(() => {
    if (!latest) return;
    const gap = (p: any): string =>
      p && p.highestRelevantWalletIndex !== undefined
        ? String(p.highestRelevantWalletIndex - p.appliedIndex)
        : 'n/a';
    console.log(
      `  … ${opts.label} sync: shGap=${gap(latest.shielded?.state?.progress)} ` +
        `duGap=${gap(latest.dust?.state?.progress)} synced=${latest.isSynced}`,
    );
  }, 20_000);

  try {
    await ctx.wallet.waitForSyncedState();
  } finally {
    clearInterval(ticker);
    stateSub.unsubscribe();
  }
  // Persist even when no stateCwd was given (the deployer): a catch-up sync
  // costs ~8 min, and every later run restores this snapshot instead.
  await persistWalletState(opts.networkConfig.networkId, ctx, opts.stateCwd);
  const providers = makeProviders(ctx, flags, opts.networkConfig);
  providers.privateStateProvider.setContractAddress(opts.contractAddress as never);

  const existing = (await providers.privateStateProvider.get(PRIVATE_STATE_ID as never)) as OnyxPrivateState | null;
  if (opts.requireExistingState && !existing) {
    throw new Error(
      `No stored private state at '${PRIVATE_STATE_ID}' for ${opts.label} — the deploy-time secretKey is gone, ` +
        'so the admin identity cannot be recovered.',
    );
  }
  const privateState: OnyxPrivateState = existing ?? {
    secretKey: nodeRandomBytes(32),
    listingSalts: {},
  };
  if (!existing) await providers.privateStateProvider.set(PRIVATE_STATE_ID as never, privateState as never);

  const deployed: any = await findDeployedContract(providers as never, {
    compiledContract: compiledContract as never,
    contractAddress: opts.contractAddress,
    privateStateId: PRIVATE_STATE_ID,
  } as never);

  const addressHex = ctx.unshieldedKeystore.getAddress() as unknown as string;
  console.log(
    `  ${opts.label} ready in ${Math.round((Date.now() - started) / 1000)}s — ${addressHex.slice(0, 12)}…`,
  );

  return {
    label: opts.label,
    ctx,
    providers,
    deployed,
    flags,
    addressHex,
    addressBytes: hexToBytes(addressHex, `${opts.label} address`),
    publicKeyHex: bytesToHex(publicKeyFromSecret(privateState.secretKey)),
    privateState,
  };
}

/**
 * Contract call with an explicit "does this transaction take a NIGHT input"
 * switch. `buyListing` does (`receiveUnshielded`) and therefore needs an
 * unshielded signature; the other circuits do not, and signing them risks an
 * extra signature the ledger rejects as InputsSignaturesLengthMismatch.
 */
async function callTx<T>(label: string, bundle: Bundle, signUnshielded: boolean, fn: () => Promise<T>): Promise<T> {
  bundle.flags.signUnshielded = signUnshielded;
  let signRetried = false;
  let dustRetried = false;
  let transientRetried = 0;
  try {
    for (;;) {
      try {
        return await fn();
      } catch (err) {
        const text = errorText(err);
        // A stale DUST root rejects any fee-paying submission; the rebuilt
        // call re-reads the wallet state, so one wait-and-retry is enough.
        if (DUST_STALE_RE.test(text) && !dustRetried) {
          dustRetried = true;
          console.log(`  ! ${label}: DUST spend rejected (${text.slice(0, 120)}) - waiting for the root, then retrying`);
          await sleep(15_000);
          continue;
        }
        // Indexer HTTP blips are transient - the SDK sync retries, so do we.
        if (TRANSIENT_RE.test(text) && transientRetried < 2) {
          transientRetried++;
          console.log(`  ! ${label}: transient indexer error (${text.slice(0, 120)}) - retrying in 10s`);
          await sleep(10_000);
          continue;
        }
        const signatureProblem = /signature|InputsSignatures|unbalanced/i.test(text);
        const contractGuard = /listing|buyer|seller|admin|price|dispute|delivery/i.test(text);
        if (signatureProblem && !contractGuard && !signRetried) {
          console.log(`  ! ${label}: retrying with signUnshielded=${!signUnshielded} (${text.slice(0, 140)})`);
          bundle.flags.signUnshielded = !signUnshielded;
          signRetried = true;
          continue;
        }
        throw err;
      }
    }
  } finally {
    bundle.flags.signUnshielded = false;
  }
}

async function withFlag<T>(bundle: Bundle, signUnshielded: boolean, fn: () => Promise<T>): Promise<T> {
  bundle.flags.signUnshielded = signUnshielded;
  try {
    return await fn();
  } finally {
    bundle.flags.signUnshielded = false;
  }
}

/* ------------------------------------------------------------ dust fees -- */

/**
 * The node verifies a DUST spend proof against the chain's *current*
 * commitment Merkle root. A wallet whose event stream went stale (e.g. while
 * idle for hours) builds against an old root and is rejected with
 * `1010 Invalid Transaction: Custom error: 170` — the indexer's own QA notes
 * call this "building against a stale DUST Merkle root".
 */
const DUST_STALE_RE = /custom error: 170|InvalidDustSpendProof/i;

/**
 * The indexer occasionally drops an HTTP query (wallet-sdk's HttpQueryClient
 * reports a missing `error.response` as "An unknown error occurred", wrapped
 * by the dust wallet's Sync as "Encountered unexpected error: ..."). The SDK's
 * sync fiber retries; our own awaited calls must not abort the run for it.
 */
const TRANSIENT_RE =
  /Encountered unexpected error|An unknown error occurred|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|socket disconnected/i;

let INDEXER_URL = '';

async function chainDustTip(): Promise<{
  height: number;
  root: string | null;
  genRoot: string | null;
} | null> {
  if (!INDEXER_URL) return null;
  try {
    const res = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: '{ block { height dustCommitmentMerkleTreeRoot dustGenerationMerkleTreeRoot } }',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as { data?: { block?: { height: number; dustCommitmentMerkleTreeRoot?: string; dustGenerationMerkleTreeRoot?: string } } };
    const block = json.data?.block;
    if (!block) return null;
    const norm = (v: unknown): string | null =>
      typeof v === 'string' ? v.replace(/^0x/, '').toLowerCase() : null;
    return {
      height: block.height,
      root: norm(block.dustCommitmentMerkleTreeRoot),
      genRoot: norm(block.dustGenerationMerkleTreeRoot),
    };
  } catch {
    return null;
  }
}

function toRootHex(value: unknown): string | null {
  if (typeof value === 'bigint') return value.toString(16).padStart(64, '0');
  if (typeof value === 'string') return value.replace(/^0x/, '').toLowerCase();
  return null;
}

// FacadeState.dust is a DustWalletState: `.state` is the CoreWallet, whose
// `.state` is the DustLocalState holding both Merkle roots.
function walletDustRoots(state: any): {
  root: string | null;
  genRoot: string | null;
  connected: boolean | null;
} {
  const local = state?.dust?.state?.state;
  const progress = state?.dust?.state?.progress;
  if (typeof local?.commitmentTreeRoot !== 'function') {
    return { root: null, genRoot: null, connected: null };
  }
  return {
    root: toRootHex(local.commitmentTreeRoot()),
    genRoot: toRootHex(local.generatingTreeRoot?.()),
    connected: progress?.isConnected ?? null,
  };
}

function dustLine(
  label: string,
  state: any,
  tip: { height: number; root: string | null; genRoot: string | null } | null,
): string {
  const w = walletDustRoots(state);
  const match = w.root && tip?.root && w.root === tip.root ? 'yes' : 'no';
  const genMatch =
    w.genRoot && tip?.genRoot ? (w.genRoot === tip.genRoot ? 'yes' : 'no') : 'n/a';
  const prog = state?.dust?.state?.progress;
  const gap =
    prog && prog.highestRelevantWalletIndex !== undefined
      ? `${prog.appliedIndex}/${prog.highestRelevantWalletIndex}`
      : 'n/a';
  return (
    `  dust[${label}] walletRoot=${(w.root ?? 'none').slice(0, 16)}… ` +
    `chainRoot=${(tip?.root ?? 'none').slice(0, 16)}… match=${match} ` +
    `genMatch=${genMatch} applied=${gap} conn=${String(w.connected)} ` +
    `chainH=${tip?.height ?? '?'}`
  );
}

/**
 * Block until the wallet's DUST commitment root is safe to build against:
 * either it equals the chain's root, or it is still changing (the stream is
 * live and applying dust events, so any lag is a block at most). A frozen
 * wallet root while the chain advances is exactly the stale-root condition
 * that produces error 170.
 */
async function settleDust(ctx: WalletContext, label: string, timeoutMs = 120_000): Promise<void> {
  let latest: any = null;
  const sub = ctx.wallet.state().subscribe((s: any) => {
    latest = s;
  });
  const deadline = Date.now() + timeoutMs;
  let lastReport = 0;
  let previousRoot: string | null = null;
  // 0 = "never observed changing" - a frozen root must NOT count as live.
  let lastRootChangeAt = 0;
  const startTip = await chainDustTip();
  try {
    while (Date.now() < deadline) {
      const tip = await chainDustTip();
      if (latest) {
        const w = walletDustRoots(latest);
        if (w.root === null) {
          console.log(
            `  dust[${label}] local commitment root unavailable - skipping settle ` +
              `(dust keys: [${Object.keys(latest?.dust ?? {})}], state keys: [${Object.keys(latest?.dust?.state ?? {})}])`,
          );
          return;
        }
        if (previousRoot !== null && previousRoot !== w.root) lastRootChangeAt = Date.now();
        previousRoot = w.root;
        if (tip?.root && w.root === tip.root) {
          console.log(`  dust[${label}] commitment root matches the chain (height ${tip.height})`);
          return;
        }
        if (Date.now() - lastRootChangeAt <= 20_000) {
          console.log(
            `  dust[${label}] commitment root is live (changed ${Math.round((Date.now() - lastRootChangeAt) / 1000)}s ago) - proceeding`,
          );
          return;
        }
        if (Date.now() - lastReport >= 15_000) {
          lastReport = Date.now();
          console.log(dustLine(label, latest, tip));
        }
      }
      await sleep(2000);
    }
    const endTip = await chainDustTip();
    const chainMoved = !!(startTip && endTip && endTip.height > startTip.height);
    console.log(
      `  ! dust[${label}] root neither matched nor changed within ${Math.round(timeoutMs / 1000)}s ` +
        `(chainMoved=${chainMoved}) - stream looks stale; proceeding anyway`,
    );
    if (latest) console.log(dustLine(label, latest, endTip));
  } finally {
    sub.unsubscribe();
  }
}

/* ----------------------------------------------------------------- funding -- */

async function fundBuyer(deployer: Bundle, buyerAddressHex: string, amount: bigint): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    // Settle first: the deployer has been idle while the buyer synced, so its
    // DUST stream may be stale even though it reported itself synced earlier.
    await settleDust(deployer.ctx, 'deployer');
    try {
      const recipe = await deployer.ctx.wallet.transferTransaction(
        [
          {
            type: 'unshielded' as const,
            outputs: [
              {
                type: unshieldedToken().raw,
                receiverAddress: new UnshieldedAddress(Buffer.from(buyerAddressHex, 'hex')) as never,
                amount,
              },
            ],
          },
        ],
        { shieldedSecretKeys: deployer.ctx.shieldedSecretKeys, dustSecretKey: deployer.ctx.dustSecretKey },
        { ttl: new Date(Date.now() + 30 * 60 * 1000), payFees: true },
      );
      // A transfer takes NIGHT from the deployer's unshielded wallet, so it needs
      // the account signature that `finalizeRecipe` alone does not produce.
      const signed = await deployer.ctx.wallet.signRecipe(recipe, (data: Uint8Array) =>
        deployer.ctx.unshieldedKeystore.signData(data),
      );
      const finalized = await deployer.ctx.wallet.finalizeRecipe(signed);
      await deployer.ctx.wallet.submitTransaction(finalized);
      return;
    } catch (err) {
      lastError = err;
      const text = errorText(err);
      console.error(`  ! fundBuyer attempt ${attempt}/3: ${text.slice(0, 300)}`);
      if (!DUST_STALE_RE.test(text) && !TRANSIENT_RE.test(text)) throw err;
      await sleep(20_000);
    }
  }
  throw lastError;
}

/**
 * Register NIGHT UTXOs for DUST generation, then wait for a balance.
 *
 * The registration fee is paid from the DUST a UTXO *projects* to have
 * generated since its creation time (`ledger.updatedValue`, capped at 7 days),
 * so a freshly funded coin must age first. The SDK's sanctioned sequence is
 * estimateRegistration -> waitForGeneratedDust -> register (the facade rejects
 * with "Insufficient generated dust to cover registration fee" otherwise, as
 * happened when the buyer's coin was ~1 minute old and projected 3.7e12
 * against a 3.0e14 fee).
 */
async function ensureDust(ctx: WalletContext, label: string, timeoutMs = 100 * 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let registered = false;
  let consecutiveFailures = 0;

  while (Date.now() < deadline) {
    try {
      const state = await syncedState(ctx);
      if (dustOf(state) > 0n) return;

      const unregistered = state.unshielded.availableCoins.filter(
        (coin: { meta?: { registeredForDustGeneration?: boolean } }) => !coin.meta?.registeredForDustGeneration,
      );

      if (unregistered.length > 0 && !registered) {
        console.log(`  registering ${unregistered.length} NIGHT UTXO(s) for DUST generation…`);
        await settleDust(ctx, label, 60_000);
        const estimate = await ctx.wallet.estimateRegistration(unregistered);
        const fee: bigint = estimate.fee;
        let projected = 0n;
        let rate = 0n;
        for (const e of estimate.dustGenerationEstimations ?? []) {
          const generated: bigint = BigInt((e as any).dust?.generatedNow ?? 0n);
          const perSecond: bigint = BigInt((e as any).dust?.rate ?? 0n);
          if (generated > projected) projected = generated;
          if (perSecond > rate) rate = perSecond;
        }
        if (fee > 0n && projected < fee) {
          const etaSec = rate > 0n ? Math.ceil(Number((fee - projected) / rate)) : -1;
          console.log(
            `  ${label}: registration fee ${fee}, projected ${projected} ` +
              `(${rate}/s) - coin ages for ~${etaSec}s before it covers the fee`,
          );
        }
        try {
          // Re-checked every second inside the SDK; chunked so a young coin's
          // long aging wait logs progress instead of blocking for an hour.
          await ctx.wallet.waitForGeneratedDust(unregistered, fee, { timeoutMs: 5 * 60_000 });
        } catch (waitErr) {
          console.log(
            `  ${label}: projected DUST not yet covering the fee (${errorText(waitErr).slice(0, 140)}) - waiting`,
          );
          await sleep(5000);
          continue;
        }
        // The signDustRegistration callback signs its own inputs - do not
        // signRecipe again (that yields InputsSignaturesLengthMismatch, 192).
        const recipe = await ctx.wallet.registerNightUtxosForDustGeneration(
          unregistered,
          ctx.unshieldedKeystore.getPublicKey(),
          (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload),
        );
        const finalized = await ctx.wallet.finalizeRecipe(recipe);
        await ctx.wallet.submitTransaction(finalized);
        registered = true;
        await sleep(6000);
      } else {
        await sleep(5000);
      }
      consecutiveFailures = 0;
    } catch (err) {
      const text = errorText(err);
      const tolerated =
        DUST_STALE_RE.test(text) ||
        /Insufficient generated dust/i.test(text) ||
        TRANSIENT_RE.test(text);
      if (!tolerated) throw err;
      consecutiveFailures++;
      if (consecutiveFailures >= 12) {
        throw new Error(`DUST setup for ${label} kept failing: ${text.slice(0, 200)}`);
      }
      console.log(`  ! ${label} DUST step failed (${text.slice(0, 160)}) - retry ${consecutiveFailures}/12 in 10s`);
      await sleep(10_000);
    }
  }

  const finalState = await syncedState(ctx);
  throw new Error(`DUST never generated for ${label} (balance ${dustOf(finalState)})`);
}

/* -------------------------------------------------------------------- data -- */

function buildDataset(rows: number): Uint8Array {
  const lines: string[] = ['id,value,category'];
  for (let i = 0; i < rows; i++) {
    lines.push(`${i},${(i * 7919) % 100000},cat-${i % 12}`);
  }
  return new TextEncoder().encode(lines.join('\n'));
}

/* -------------------------------------------------------------------- main -- */

async function main(): Promise<void> {
  const { network, config } = resolveNetwork();
  INDEXER_URL = config.indexer;

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           Onyx Phase 5 — scripted E2E (preprod)              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  network: ${network}`);

  banner('Preflight');

  const deployment = getDeployment(network) as { address: string; deployer: string } | null;
  check(!!deployment && /^[0-9a-f]{64}$/.test(deployment!.address), 'deployment record present with a hex address', deployment);

  const proofOk = await fetch(config.proofServer, { method: 'GET', signal: AbortSignal.timeout(5000) })
    .then((r) => r.ok)
    .catch(() => false);
  check(proofOk, `proof server responds at ${config.proofServer}`);

  const deployerSeed = getOrCreateWallet(network).seed;
  const deployer = await buildBundle({
    label: 'deployer',
    seed: deployerSeed,
    networkConfig: config,
    contractAddress: deployment!.address,
    requireExistingState: true,
  });

  const publicDataProvider = deployer.providers.publicDataProvider;
  const initialLedger = await waitForLedger(publicDataProvider, deployment!.address, () => true, 30_000);
  check(!!initialLedger, 'contract state readable from the indexer');

  if (initialLedger) {
    check(
      initialLedger.admin === bytesToHex(publicKeyFromSecret(deployer.privateState.secretKey)),
      'stored secretKey still derives the sealed admin',
      { stored: initialLedger.admin },
    );
  }

  const deployerNight = nightOf(await syncedState(deployer.ctx));
  const deployerDust = dustOf(await syncedState(deployer.ctx));
  check(deployerNight > 0n, 'deployer holds NIGHT', deployerNight);
  if (deployerDust > 0n) {
    check(true, 'deployer holds DUST for fees', deployerDust);
  } else {
    // Registration alone does not top dust back up if it was spent; wait for it.
    await ensureDust(deployer.ctx, 'deployer');
    check(dustOf(await syncedState(deployer.ctx)) > 0n, 'deployer holds DUST for fees (regenerated)');
  }

  banner('Buyer wallet');

  const buyerSeed = createHash('sha256')
    .update(Buffer.from(deployerSeed, 'hex'))
    .update(BUYER_SEED_LABEL)
    .digest('hex');
  const buyerStateCwd = path.join(process.cwd(), '.buyer-wallet');

  const buyer = await buildBundle({
    label: 'buyer',
    seed: buyerSeed,
    networkConfig: config,
    contractAddress: deployment!.address,
    stateCwd: buyerStateCwd,
  });

  check(buyer.publicKeyHex !== deployer.publicKeyHex, 'buyer identity differs from the seller (self-buy is guarded)');

  let buyerNight = nightOf(await syncedState(buyer.ctx));
  if (buyerNight < BUYER_FUND) {
    console.log(`  funding the buyer with ${BUYER_FUND / STAR_PER_NIGHT} NIGHT…`);
    await fundBuyer(deployer, buyer.addressHex, BUYER_FUND);
    buyerNight = await waitForNight(buyer.ctx, BUYER_FUND, 180_000);
    check(buyerNight >= BUYER_FUND, 'buyer received NIGHT from the deployer', buyerNight);
  } else {
    check(true, 'buyer already funded (skipped transfer)', buyerNight);
  }

  await ensureDust(buyer.ctx, 'buyer');
  check(dustOf(await syncedState(buyer.ctx)) > 0n, 'buyer holds DUST for fees');

  const ledgerAfterPrep = await queryLedger(publicDataProvider, deployment!.address);
  const beforeA = new Set(ledgerAfterPrep ? [...ledgerAfterPrep.rows.keys()] : []);

  banner('Listing A — list, package, buy, handoff, confirm');

  const dataA = buildDataset(1024);
  const dataHashA = await hashData(dataA);
  const metaA = encodeMeta({
    title: 'Phase 5 dataset A',
    description: 'Scripted E2E listing (happy path)',
    category: 'test',
    size: `${dataA.length} bytes`,
    records: '1024',
  });

  await callTx('listData A', deployer, false, () =>
    deployer.deployed.callTx.listData(dataHashA, PRICE_A, metaA, deployer.addressBytes),
  );

  const listedA = await waitForLedger(
    publicDataProvider,
    deployment!.address,
    (snap) => [...snap.rows.keys()].some((id) => !beforeA.has(id)),
  );
  const newIds = [...(listedA?.rows.keys() ?? [])].filter((id) => !beforeA.has(id));
  check(newIds.length === 1, 'listData A produced exactly one new listing id', newIds);
  const idA = newIds[0];

  const rowA = listedA?.rows.get(idA);
  check(!!rowA, 'listing A readable on-chain');
  if (rowA && listedA) {
    check(rowA.seller === deployer.publicKeyHex, 'listing A seller = deployer public key');
    check(rowA.sellerAddr === deployer.addressHex, 'listing A payout address = deployer address');
    check(rowA.price === PRICE_A, 'listing A price', rowA.price);
    check(rowA.state === LISTING_STATE.active, 'listing A state = active', stateName(rowA.state));
    check(rowA.escrow === 0n, 'listing A escrow empty before purchase', rowA.escrow);
    const metaAOnChain = decodeMeta(rowA.metaBytes);
    check(metaAOnChain.title === 'Phase 5 dataset A' && metaAOnChain.category === 'test', 'listing A metadata decodes', metaAOnChain);
    check(listedA.listingCount >= 1, 'listingCount incremented', listedA.listingCount);
  }

  // Package: created by the seller, commitment cross-checked against the chain.
  // The salt is the contract's OWN in-circuit salt (get_random_salt →
  // store_listing_salt), fetched from the seller's private state — a fresh
  // randomSalt() here would commit to a different value than the ledger holds.
  const saltA = await contractSalt(deployer, idA);
  const created = await createPackage({ listingId: idA, data: dataA, salt: saltA, meta: metaA });
  check(created.pkg.dataHash === bytesToHex(dataHashA), 'package dataHash matches the listed hash');
  check(
    bytesEqualLocal(computeDataCommitment(dataHashA, saltA), hexToBytes(rowA!.commitment, 'commitment')),
    'package commitment matches the on-chain listingDataCommitment',
  );

  const recipient: RecipientKeys = await generateRecipientKeys();
  const wrap = await wrapKeyForRecipient(created.dataKey, recipient.publicKey, hexToBytes(idA, 'listing id'));
  const pkg: DataPackage = { ...created.pkg, wrap };
  const wire = serializePackage(pkg);
  const roundTripped = parsePackage(wire);
  check(roundTripped.listingId === idA && roundTripped.salt === bytesToHex(saltA), 'package serialize/parse round trip');

  // Guard: the seller may not buy their own listing (circuit assert).
  await expectRejection(
    'guard: seller cannot buy own listing',
    'cannot buy your own listing',
    () => withFlag(deployer, false, () => deployer.deployed.callTx.buyListing(hexToBytes(idA, 'id'), deployer.addressBytes)),
  );

  // Buy.
  await callTx('buyListing A', buyer, true, () =>
    buyer.deployed.callTx.buyListing(hexToBytes(idA, 'id'), buyer.addressBytes),
  );
  const soldA = await waitForLedger(publicDataProvider, deployment!.address, (snap) => snap.rows.get(idA)?.state === LISTING_STATE.sold);
  const soldRowA = soldA?.rows.get(idA);
  check(soldRowA?.state === LISTING_STATE.sold, 'listing A state = sold after purchase', soldRowA && stateName(soldRowA.state));
  check(soldRowA?.buyer === buyer.publicKeyHex, 'listing A buyer = buyer public key');
  check(soldRowA?.buyerAddr === buyer.addressHex, 'listing A buyer address recorded');
  check(soldRowA?.escrow === PRICE_A, 'escrow locked at the listing price', soldRowA?.escrow);

  // Handoff: the buyer opens the delivered package against on-chain values.
  const plaintext = await openPackage(roundTripped, { recipient });
  check(bytesEqualLocal(plaintext, dataA), 'buyer decrypted the delivered package');
  const verdict = await verifyPackage(plaintext, roundTripped, {
    dataCommitment: hexToBytes(rowA!.commitment, 'commitment'),
    meta: rowA!.metaBytes,
  });
  check(
    verdict.ok && verdict.hashOk && verdict.commitmentOk && verdict.metaOk,
    'verifyPackage against on-chain commitment and metadata',
    verdict,
  );

  // Guard: only the buyer may confirm delivery.
  await expectRejection(
    'guard: only the buyer can confirm delivery',
    'only buyer can confirm delivery',
    () => withFlag(deployer, false, () => deployer.deployed.callTx.confirmDelivery(hexToBytes(idA, 'id'))),
  );

  const sellerNightBefore = nightOf(await syncedState(deployer.ctx));
  const completedBefore = listedA?.completedCount ?? 0;

  await callTx('confirmDelivery A', buyer, false, () =>
    buyer.deployed.callTx.confirmDelivery(hexToBytes(idA, 'id')),
  );
  const doneA = await waitForLedger(publicDataProvider, deployment!.address, (snap) => snap.rows.get(idA)?.state === LISTING_STATE.completed);
  const doneRowA = doneA?.rows.get(idA);
  check(doneRowA?.state === LISTING_STATE.completed, 'listing A state = completed after confirm', doneRowA && stateName(doneRowA.state));
  check(doneRowA?.escrow === 0n, 'escrow released (entry removed)', doneRowA?.escrow);
  check((doneA?.completedCount ?? -1) === completedBefore + 1, 'completedCount incremented', doneA?.completedCount);

  const sellerNightAfter = await waitForNight(deployer.ctx, sellerNightBefore + PRICE_A, 90_000);
  check(
    sellerNightAfter - sellerNightBefore === PRICE_A,
    'seller NIGHT balance grew by exactly the escrowed price',
    { before: sellerNightBefore, after: sellerNightAfter, price: PRICE_A },
  );

  // Guard: a completed listing can no longer be bought.
  await expectRejection(
    'guard: completed listing cannot be bought again',
    'listing not active',
    () => withFlag(buyer, false, () => buyer.deployed.callTx.buyListing(hexToBytes(idA, 'id'), buyer.addressBytes)),
  );

  banner('Listing B — list, buy, dispute, admin resolve');

  const dataB = buildDataset(512);
  const dataHashB = await hashData(dataB);
  const metaB = encodeMeta({
    title: 'Phase 5 dataset B',
    description: 'Scripted E2E listing (dispute path)',
    category: 'test',
    size: `${dataB.length} bytes`,
    records: '512',
  });

  await callTx('listData B', deployer, false, () =>
    deployer.deployed.callTx.listData(dataHashB, PRICE_B, metaB, deployer.addressBytes),
  );
  const listedB = await waitForLedger(
    publicDataProvider,
    deployment!.address,
    (snap) => [...snap.rows.keys()].some((id) => !beforeA.has(id) && id !== idA),
  );
  const newIdsB = [...(listedB?.rows.keys() ?? [])].filter((id) => !beforeA.has(id) && id !== idA);
  check(newIdsB.length === 1, 'listData B produced exactly one new listing id', newIdsB);
  const idB = newIdsB[0];
  if (!idB) throw new Error('listing B was not indexed — cannot continue');

  const rowB = listedB?.rows.get(idB);
  check(rowB?.state === LISTING_STATE.active, 'listing B state = active', rowB && stateName(rowB.state));
  check(rowB?.price === PRICE_B, 'listing B price', rowB?.price);

  const saltB = await contractSalt(deployer, idB);
  const createdB = await createPackage({ listingId: idB, data: dataB, salt: saltB, meta: metaB });
  check(
    bytesEqualLocal(computeDataCommitment(dataHashB, saltB), hexToBytes(rowB!.commitment, 'commitment')),
    'listing B commitment matches its package',
  );
  check(createdB.pkg.dataHash === bytesToHex(dataHashB), 'listing B package hash matches');

  await callTx('buyListing B', buyer, true, () =>
    buyer.deployed.callTx.buyListing(hexToBytes(idB, 'id'), buyer.addressBytes),
  );
  const soldB = await waitForLedger(publicDataProvider, deployment!.address, (snap) => snap.rows.get(idB)?.state === LISTING_STATE.sold);
  check(soldB?.rows.get(idB)?.state === LISTING_STATE.sold, 'listing B state = sold after purchase', soldB && stateName(soldB.rows.get(idB)!.state));
  check(soldB?.rows.get(idB)?.escrow === PRICE_B, 'listing B escrow locked', soldB?.rows.get(idB)?.escrow);

  // Dispute filed by the buyer (the UI wires this; resolution runs here).
  await callTx('disputeListing B', buyer, false, () =>
    buyer.deployed.callTx.disputeListing(hexToBytes(idB, 'id')),
  );
  const disputedB = await waitForLedger(publicDataProvider, deployment!.address, (snap) => snap.rows.get(idB)?.state === LISTING_STATE.disputed);
  check(disputedB?.rows.get(idB)?.state === LISTING_STATE.disputed, 'listing B state = disputed', disputedB && stateName(disputedB.rows.get(idB)!.state));

  // Guard: only the admin may resolve.
  await expectRejection(
    'guard: non-admin cannot resolve a dispute',
    'only admin can resolve disputes',
    () => withFlag(buyer, false, () => buyer.deployed.callTx.resolveDispute(hexToBytes(idB, 'id'), true)),
  );

  const buyerNightBeforeRefund = nightOf(await syncedState(buyer.ctx));
  const completedBeforeResolve = disputedB?.completedCount ?? 0;

  await callTx('resolveDispute B (refund)', deployer, false, () =>
    deployer.deployed.callTx.resolveDispute(hexToBytes(idB, 'id'), true),
  );
  const resolvedB = await waitForLedger(publicDataProvider, deployment!.address, (snap) => snap.rows.get(idB)?.state === LISTING_STATE.completed);
  const resolvedRowB = resolvedB?.rows.get(idB);
  check(resolvedRowB?.state === LISTING_STATE.completed, 'listing B state = completed after resolve', resolvedRowB && stateName(resolvedRowB.state));
  check(resolvedRowB?.escrow === 0n, 'listing B escrow returned (entry removed)', resolvedRowB?.escrow);
  check(
    (resolvedB?.completedCount ?? -1) === completedBeforeResolve,
    'refund path does not increment completedCount',
    resolvedB?.completedCount,
  );

  const buyerNightAfterRefund = await waitForNight(buyer.ctx, buyerNightBeforeRefund + PRICE_B, 90_000);
  check(
    buyerNightAfterRefund - buyerNightBeforeRefund === PRICE_B,
    'disputed buyer refunded by exactly the escrowed price',
    { before: buyerNightBeforeRefund, after: buyerNightAfterRefund, price: PRICE_B },
  );

  // Final tally from the chain.
  const finalLedger = await queryLedger(publicDataProvider, deployment!.address);
  if (finalLedger) {
    const states = [...finalLedger.rows.values()].map((r) => stateName(r.state));
    check(
      finalLedger.rows.get(idA)?.state === LISTING_STATE.completed &&
        finalLedger.rows.get(idB)?.state === LISTING_STATE.completed,
      'final ledger: both listings completed',
      states,
    );
    check(finalLedger.listingCount >= 2, 'final ledger: listingCount >= 2', finalLedger.listingCount);
  }

  await deployer.ctx.wallet.stop();
  await buyer.ctx.wallet.stop();

  const total = passed + failures.length;
  console.log(`\nphase5-e2e: ${passed}/${total} PASS${failures.length ? ` (${failures.length} FAILED)` : ''}`);
  if (failures.length) {
    console.error('Failed assertions:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  process.exit(0);
}

function bytesEqualLocal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

main().catch(async (err) => {
  console.error(`\n❌ phase5-e2e aborted: ${errorText(err)}`);
  // Print the full cause chain with stacks: the node/sdk layering hides the
  // real line (e.g. "expected instance of StateValue" only makes sense with
  // the wasm-bindgen frame that raised it).
  let cur: unknown = err;
  const seen = new Set<unknown>();
  for (let i = 0; cur && typeof cur === 'object' && !seen.has(cur) && i < 8; i++) {
    seen.add(cur);
    const e = cur as { name?: string; message?: string; stack?: string };
    console.error(`  cause[${i}] ${e.name ?? 'Error'}: ${e.message ?? String(cur)}`);
    if (e.stack) console.error(`    ${e.stack.split('\n').slice(0, 6).join('\n    ')}`);
    cur = (cur as { cause?: unknown }).cause;
  }
  const total = passed + failures.length;
  console.log(`phase5-e2e: ${passed}/${total} PASS (aborted)`);
  process.exit(1);
});
