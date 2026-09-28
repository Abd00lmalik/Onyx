/**
 * E2E bridge — serves two synced wallets (deployer + buyer) over HTTP so the
 * real frontend can be driven from headless Chrome without a Lace extension.
 *
 *   GET  /health                      -> { ready, phase }
 *   GET  /{role}/config               -> configuration + addresses + keys
 *   GET  /{role}/balances             -> { night, dust }   (decimal strings)
 *   POST /{role}/balance {txHex}      -> { tx, signed }    (signed variant preferred)
 *   POST /{role}/submit  {txHex}      -> { ok }            (self-healing retries)
 *
 * roles: deployer | buyer
 *
 * The submit endpoint caches both balancing variants (signed + unsigned) from
 * the preceding /balance call and heals two known failure classes without any
 * frontend knowledge:
 *   - InputsSignaturesLengthMismatch -> resubmit the other variant
 *   - stale DUST root (error 170)    -> re-balance from the stored unbound tx
 *     after a pause, then resubmit
 *
 * Usage: npx tsx scripts/e2e-bridge.ts   (BRIDGE_PORT overrides 8787)
 */
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { createServer, type ServerResponse } from 'node:http';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';

import { Transaction, unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk';

import { resolveNetwork, getOrCreateWallet, getDeployment, type NetworkConfig } from '../src/network';
import { createWallet, persistWalletState, type WalletContext } from '../src/wallet';
import {
  addressBytesToBech32m,
  bech32mToAddressBytes,
  bytesToHex,
  hexToBytes,
} from '../../frontend/src/lib/hex';

// @ts-expect-error wallet sync requires WebSocket
globalThis.WebSocket = WebSocket;

const PORT = Number(process.env.BRIDGE_PORT ?? 8787);
const BUYER_SEED_LABEL = 'onyx:buyer:v1';
const TTL_MS = 30 * 60 * 1000;

type Role = 'deployer' | 'buyer';

/* ------------------------------------------------------------- utilities -- */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function syncedState(ctx: WalletContext) {
  // No parameter type annotation — it would narrow the state and break nightOf/dustOf.
  return Rx.firstValueFrom(ctx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
}

/* ---------------------------------------------------------- bridge wallet -- */

interface Variant {
  unboundHex: string;
  signedHex: string | null;
  unsignedHex: string | null;
}

interface BridgeWallet {
  role: Role;
  ctx: WalletContext;
  config: NetworkConfig;
  addressHex: string;
  address: string;
  addressCheck: string;
  coinPublicKey: string;
  encryptionPublicKey: string;
  ready: boolean;
  queue: Promise<unknown>;
  /** keyed by sha256(unbound hex) and by each balanced output hex */
  variants: Map<string, Variant>;
}

function serial<T>(w: BridgeWallet, fn: () => Promise<T>): Promise<T> {
  const run = w.queue.then(fn, fn);
  w.queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function openWallet(
  role: Role,
  seed: string,
  config: NetworkConfig,
  stateCwd: string | undefined,
): Promise<BridgeWallet> {
  const started = Date.now();
  console.log(`[bridge] opening ${role} wallet…`);
  const ctx = await createWallet({
    network: config.networkId,
    networkConfig: config,
    seed,
    cwd: stateCwd,
  });

  let latest: unknown = null;
  const stateSub = ctx.wallet.state().subscribe((s: unknown) => {
    latest = s;
  });
  const ticker = setInterval(() => {
    if (!latest) return;
    const state = latest as Record<string, any>;
    const gap = (p: any): string =>
      p && p.highestRelevantWalletIndex !== undefined
        ? String(p.highestRelevantWalletIndex - p.appliedIndex)
        : 'n/a';
    console.log(
      `  … ${role} sync: shGap=${gap(state.shielded?.state?.progress)} ` +
        `duGap=${gap(state.dust?.state?.progress)} synced=${state.isSynced}`,
    );
  }, 20_000);

  try {
    await ctx.wallet.waitForSyncedState();
  } finally {
    clearInterval(ticker);
    stateSub.unsubscribe();
  }
  await persistWalletState(config.networkId, ctx, stateCwd);

  const addressHex = ctx.unshieldedKeystore.getAddress() as unknown as string;
  const address = addressBytesToBech32m(hexToBytes(addressHex, `${role} address`), config.networkId);
  // Round-trip guard: a wrong HRP would make the frontend reject the address.
  const addressCheck = bytesToHex(bech32mToAddressBytes(address, 'addr'));
  if (addressCheck !== addressHex) {
    throw new Error(`${role}: bech32m round-trip mismatch (${addressCheck} != ${addressHex})`);
  }

  console.log(
    `[bridge] ${role} ready in ${Math.round((Date.now() - started) / 1000)}s ` +
      `(${addressHex.slice(0, 12)}…)`,
  );
  return {
    role,
    ctx,
    config,
    addressHex,
    address,
    addressCheck,
    coinPublicKey: String(ctx.shieldedSecretKeys.coinPublicKey),
    encryptionPublicKey: String(ctx.shieldedSecretKeys.encryptionPublicKey),
    ready: true,
    queue: Promise.resolve(),
    variants: new Map(),
  };
}

async function readBalances(w: BridgeWallet): Promise<{ night: string; dust: string }> {
  const state = await syncedState(w.ctx);
  return { night: BigInt(nightOf(state)).toString(), dust: BigInt(dustOf(state)).toString() };
}

function nightOf(state: any): bigint {
  return state.unshielded.balances[unshieldedToken().raw] ?? 0n;
}

function dustOf(state: any): bigint {
  return state.dust.balance(new Date());
}

/* --------------------------------------------------------- dust plumbing -- */
/* Ported from phase5-e2e.ts: the buyer's DUST pays transaction fees and runs
 * out after a few purchases, so the bridge settles the dust root before
 * balancing and tops the wallet up when a balance attempt fails. */

const DUST_STALE_RE = /custom error: 170|InvalidDustSpendProof/i;
const TRANSIENT_RE =
  /Encountered unexpected error|An unknown error occurred|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|socket disconnected/i;

let INDEXER_URL = '';

async function chainDustTip(): Promise<{ height: number; root: string | null; genRoot: string | null } | null> {
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
    const json = (await res.json()) as {
      data?: { block?: { height: number; dustCommitmentMerkleTreeRoot?: string; dustGenerationMerkleTreeRoot?: string } };
    };
    const block = json.data?.block;
    if (!block) return null;
    const norm = (v: unknown): string | null => (typeof v === 'string' ? v.replace(/^0x/, '').toLowerCase() : null);
    return { height: block.height, root: norm(block.dustCommitmentMerkleTreeRoot), genRoot: norm(block.dustGenerationMerkleTreeRoot) };
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
function walletDustRoots(state: any): { root: string | null; genRoot: string | null; connected: boolean | null } {
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

function dustLine(label: string, state: any, tip: { height: number; root: string | null; genRoot: string | null } | null): string {
  const w = walletDustRoots(state);
  const match = w.root && tip?.root && w.root === tip.root ? 'yes' : 'no';
  const prog = state?.dust?.state?.progress;
  const gap =
    prog && prog.highestRelevantWalletIndex !== undefined ? `${prog.appliedIndex}/${prog.highestRelevantWalletIndex}` : 'n/a';
  return (
    `  dust[${label}] walletRoot=${(w.root ?? 'none').slice(0, 16)} ` +
    `chainRoot=${(tip?.root ?? 'none').slice(0, 16)} match=${match} applied=${gap} chainH=${tip?.height ?? '?'}`
  );
}

/**
 * Block until the wallet's DUST commitment root is safe to build against:
 * either it equals the chain's root, or it is still changing (the stream is
 * live, so any lag is a block at most). A frozen wallet root while the chain
 * advances is exactly the stale-root condition that produces error 170.
 */
async function settleDust(ctx: WalletContext, label: string, timeoutMs = 120_000): Promise<void> {
  let latest: any = null;
  const sub = ctx.wallet.state().subscribe((s: any) => {
    latest = s;
  });
  const deadline = Date.now() + timeoutMs;
  let lastReport = 0;
  let previousRoot: string | null = null;
  let lastRootChangeAt = 0;
  try {
    while (Date.now() < deadline) {
      const tip = await chainDustTip();
      if (latest) {
        const w = walletDustRoots(latest);
        if (w.root === null) return;
        if (previousRoot !== null && previousRoot !== w.root) lastRootChangeAt = Date.now();
        previousRoot = w.root;
        if (tip?.root && w.root === tip.root) {
          console.log(`[bridge] dust[${label}] root matches the chain (height ${tip.height})`);
          return;
        }
        if (Date.now() - lastRootChangeAt <= 20_000) {
          console.log(`[bridge] dust[${label}] root is live - proceeding`);
          return;
        }
        if (Date.now() - lastReport >= 15_000) {
          lastReport = Date.now();
          console.log(dustLine(label, latest, tip));
        }
      }
      await sleep(2000);
    }
    console.log(`[bridge] dust[${label}] root neither matched nor changed in time - proceeding anyway`);
  } finally {
    sub.unsubscribe();
  }
}

/**
 * Register NIGHT UTXOs for DUST generation until the balance reaches `min`.
 * The registration fee is paid from projected dust, so a young coin must age
 * first (estimateRegistration -> waitForGeneratedDust -> register is the
 * SDK's sanctioned sequence).
 */
async function ensureDust(w: BridgeWallet, min: bigint, timeoutMs = 8 * 60_000): Promise<void> {
  const label = w.role;
  const deadline = Date.now() + timeoutMs;
  let registered = false;
  let consecutiveFailures = 0;

  while (Date.now() < deadline) {
    try {
      const state = await syncedState(w.ctx);
      const current = dustOf(state);
      if (current >= min) {
        if (current > 0n) console.log(`[bridge] ${label} dust ok: ${current} >= ${min}`);
        return;
      }
      console.log(`[bridge] ${label} dust low: ${current} < ${min}`);

      const unregistered = state.unshielded.availableCoins.filter(
        (coin: { meta?: { registeredForDustGeneration?: boolean } }) => !coin.meta?.registeredForDustGeneration,
      );

      if (unregistered.length > 0 && !registered) {
        console.log(`[bridge] registering ${unregistered.length} NIGHT UTXO(s) for DUST generation (${label})`);
        await settleDust(w.ctx, label, 60_000);
        const estimate = await w.ctx.wallet.estimateRegistration(unregistered);
        const fee: bigint = estimate.fee;
        try {
          await w.ctx.wallet.waitForGeneratedDust(unregistered, fee, { timeoutMs: 5 * 60_000 });
        } catch (waitErr) {
          console.log(`[bridge] ${label}: projected DUST not covering fee yet (${errorText(waitErr).slice(0, 140)}) - waiting`);
          await sleep(5000);
          continue;
        }
        const recipe = await w.ctx.wallet.registerNightUtxosForDustGeneration(
          unregistered,
          w.ctx.unshieldedKeystore.getPublicKey(),
          (payload: Uint8Array) => w.ctx.unshieldedKeystore.signData(payload),
        );
        const finalized = await w.ctx.wallet.finalizeRecipe(recipe);
        await w.ctx.wallet.submitTransaction(finalized);
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
      console.log(`[bridge] ${label} DUST step failed (${text.slice(0, 160)}) - retry ${consecutiveFailures}/12 in 10s`);
      await sleep(10_000);
    }
  }
  const finalState = await syncedState(w.ctx);
  console.log(`[bridge] ${label} dust top-up timed out (balance ${dustOf(finalState)})`);
}

async function balanceOnce(w: BridgeWallet, txHex: string) {
  return w.ctx.wallet.balanceUnboundTransaction(
    Transaction.deserialize('signature', 'proof', 'pre-binding', hexToBytes(txHex, 'unbound transaction')) as never,
    { shieldedSecretKeys: w.ctx.shieldedSecretKeys, dustSecretKey: w.ctx.dustSecretKey },
    { ttl: new Date(Date.now() + TTL_MS) },
  );
}

/** 1 NIGHT = 10^6 STAR. */
const STAR = 1_000_000n;
/** DUST the bridge keeps per wallet - a buy costs ~1.8e15, so hold two fees. */
const DUST_TARGET = 3_000_000_000_000_000n;
/** Fund the buyer up to this NIGHT balance so registered value drives a dust rate
 *  that can actually refill a ~1.8e15 fee between test runs. */
const BUYER_NIGHT_FLOOR = 500n * STAR;
const BUYER_NIGHT_TOPUP = 1_000n * STAR;

/** Send NIGHT from the deployer to the buyer (phase5's fundBuyer, standalone). */
async function fundBuyer(deployer: BridgeWallet, buyerAddressHex: string, amount: bigint): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await settleDust(deployer.ctx, 'deployer', 60_000).catch(() => {});
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
        {
          shieldedSecretKeys: deployer.ctx.shieldedSecretKeys,
          dustSecretKey: deployer.ctx.dustSecretKey,
        },
        { ttl: new Date(Date.now() + 30 * 60 * 1000), payFees: true },
      );
      // A transfer takes NIGHT from the deployer's unshielded wallet, so it
      // needs the account signature finalizeRecipe alone does not produce.
      const signed = await deployer.ctx.wallet.signRecipe(recipe, (data: Uint8Array) =>
        deployer.ctx.unshieldedKeystore.signData(data),
      );
      const finalized = await deployer.ctx.wallet.finalizeRecipe(signed);
      await deployer.ctx.wallet.submitTransaction(finalized);
      console.log(`[bridge] funded buyer with ${amount / STAR} NIGHT`);
      return;
    } catch (err) {
      lastError = err;
      const text = errorText(err);
      console.log(`[bridge] fundBuyer attempt ${attempt}/3: ${text.slice(0, 300)}`);
      if (!DUST_STALE_RE.test(text) && !TRANSIENT_RE.test(text)) throw err;
      await sleep(20_000);
    }
  }
  throw lastError;
}

/**
 * Balance the unbound transaction twice: once to produce a signed variant and
 * once (from a fresh recipe, since signing may consume the first) to produce
 * an unsigned variant. Both are cached so /submit can swap between them.
 *
 * Retries settle the dust root first and top the wallet up from phase5's
 * ensureDust when the failure smells like dust or a transient indexer blip -
 * the same classes phase5's callTx wrapper absorbs.
 */
async function balanceTx(w: BridgeWallet, txHex: string): Promise<{ tx: string; signed: boolean }> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await balanceTxOnce(w, txHex);
    } catch (err) {
      lastError = err;
      const text = errorText(err);
      console.log(`[bridge] ${w.role} balance attempt ${attempt} failed: ${text.slice(0, 300)}`);
      const dustish = /could not balance dust|Insufficient Funds|dust/i.test(text);
      const transient = TRANSIENT_RE.test(text) || DUST_STALE_RE.test(text);
      if (!dustish && !transient) throw err;
      if (attempt >= 4) break;
      await settleDust(w.ctx, w.role, 45_000).catch(() => {});
      if (dustish) await ensureDust(w, DUST_TARGET, 5 * 60_000).catch((e2) => {
        console.log(`[bridge] ${w.role} dust top-up failed: ${errorText(e2).slice(0, 200)}`);
      });
      await sleep(8000);
    }
  }
  throw lastError;
}

async function balanceTxOnce(w: BridgeWallet, txHex: string): Promise<{ tx: string; signed: boolean }> {
  const key = createHash('sha256').update(txHex).digest('hex');
  const existing = w.variants.get(key);
  if (existing && (existing.signedHex || existing.unsignedHex)) {
    const tx = existing.signedHex ?? existing.unsignedHex!;
    return { tx, signed: existing.signedHex !== null };
  }

  let signedHex: string | null = null;
  let signedErr = '';
  try {
    const recipe = await balanceOnce(w, txHex);
    const signedRecipe = await w.ctx.wallet.signRecipe(recipe, (data: Uint8Array) =>
      w.ctx.unshieldedKeystore.signData(data),
    );
    signedHex = bytesToHex((await w.ctx.wallet.finalizeRecipe(signedRecipe)).serialize());
  } catch (err) {
    signedErr = errorText(err);
    console.log(`[bridge] ${w.role} sign variant unavailable: ${signedErr.slice(0, 240)}`);
  }

  let unsignedHex: string | null = null;
  let unsignedErr = '';
  try {
    const recipe = await balanceOnce(w, txHex);
    unsignedHex = bytesToHex((await w.ctx.wallet.finalizeRecipe(recipe)).serialize());
  } catch (err) {
    unsignedErr = errorText(err);
    console.log(`[bridge] ${w.role} unsigned variant unavailable: ${unsignedErr.slice(0, 240)}`);
  }

  if (!signedHex && !unsignedHex) {
    // Carry the inner failure text so the retry wrapper can classify it
    // (dust / transient) instead of seeing a generic message.
    throw new Error(`balancing failed for both variants: signed=[${signedErr}] unsigned=[${unsignedErr}]`);
  }

  const variant: Variant = { unboundHex: txHex, signedHex, unsignedHex };
  w.variants.set(key, variant);
  for (const hex of [signedHex, unsignedHex]) {
    if (hex) w.variants.set(hex, variant);
  }
  console.log(
    `[bridge] ${w.role} balanced (signed=${signedHex !== null}, unsigned=${unsignedHex !== null})`,
  );
  return { tx: signedHex ?? unsignedHex!, signed: signedHex !== null };
}

function classify(text: string): 'signature' | 'dust' | 'other' {
  if (/InputsSignatures|mismatch.*signature|signature.*mismatch|expected \d+ input signatures/i.test(text)) {
    return 'signature';
  }
  if (/InvalidDustSpendProof|\b170\b|dust root|dust spend/i.test(text)) return 'dust';
  return 'other';
}

async function submitTx(w: BridgeWallet, txHex: string): Promise<{ ok: true; variant: string }> {
  let entry = w.variants.get(txHex) ?? null;
  let currentHex = txHex;
  let lastError = '';
  const tried = new Set<string>();

  for (let attempt = 1; attempt <= 5; attempt++) {
    if (tried.has(currentHex)) {
      const swap = entry && currentHex === entry.signedHex ? entry.unsignedHex : entry?.signedHex;
      if (!swap || tried.has(swap)) break;
      currentHex = swap;
    }
    tried.add(currentHex);
    try {
      const tx = Transaction.deserialize('signature', 'proof', 'binding', hexToBytes(currentHex, 'balanced transaction'));
      await w.ctx.wallet.submitTransaction(tx as never);
      const variant = currentHex === entry?.signedHex ? 'signed' : currentHex === entry?.unsignedHex ? 'unsigned' : 'passthrough';
      console.log(`[bridge] ${w.role} submitted (attempt ${attempt}, ${variant})`);
      return { ok: true, variant };
    } catch (err) {
      lastError = errorText(err);
      const kind = classify(lastError);
      console.log(`[bridge] ${w.role} submit attempt ${attempt} failed [${kind}]: ${lastError.slice(0, 300)}`);
      if (!entry) throw new Error(lastError);

      if (kind === 'signature') {
        const other = currentHex === entry.signedHex ? entry.unsignedHex : entry.signedHex;
        if (other) {
          currentHex = other;
          continue;
        }
        throw new Error(lastError);
      }
      if (kind === 'dust') {
        // Stale DUST root: wait for the wallet state to settle, then rebalance
        // from the original unbound bytes so the retry uses a fresh root.
        await sleep(6000);
        const fresh = await balanceTx(w, entry.unboundHex);
        entry = w.variants.get(createHash('sha256').update(entry.unboundHex).digest('hex')) ?? entry;
        currentHex = fresh.tx;
        continue;
      }
      throw new Error(lastError);
    }
  }
  throw new Error(`submit retries exhausted: ${lastError}`);
}

/* ------------------------------------------------------------ http layer -- */

function json(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(text);
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function main(): Promise<void> {
  const { network, config } = resolveNetwork();
  const deployment = getDeployment(network);
  if (!deployment?.address) throw new Error(`no recorded deployment for network "${network}"`);
  console.log(`[bridge] network=${network} contract=${deployment.address.slice(0, 16)}…`);

  const deployerSeed = getOrCreateWallet(network).seed;
  const buyerSeed = createHash('sha256')
    .update(Buffer.from(deployerSeed, 'hex'))
    .update(BUYER_SEED_LABEL)
    .digest('hex');

  const deployer = await openWallet('deployer', deployerSeed, config, undefined);
  const buyer = await openWallet('buyer', buyerSeed, config, path.join(process.cwd(), '.buyer-wallet'));

  const wallets: Record<Role, BridgeWallet> = { deployer, buyer };
  INDEXER_URL = config.indexer;

  // A well-funded buyer registers more NIGHT value, which is what actually
  // drives the dust generation rate - 16 NIGHT refills too slowly to cover
  // the ~1.8e15 a buy costs, so top the wallet up before the UI starts.
  const buyerNight = BigInt(nightOf(await syncedState(buyer.ctx)));
  if (buyerNight < BUYER_NIGHT_FLOOR) {
    console.log(`[bridge] buyer holds ${buyerNight} NIGHT (< floor ${BUYER_NIGHT_FLOOR}) - funding…`);
    await fundBuyer(deployer, buyer.addressHex, BUYER_NIGHT_TOPUP);
    await sleep(15_000);
  }

  // Keep a fee buffer in both wallets before the UI starts spending - the
  // buyer's DUST runs dry after a few purchases otherwise.
  for (const w of [deployer, buyer]) {
    const dust = dustOf(await syncedState(w.ctx));
    if (dust < DUST_TARGET) {
      console.log(`[bridge] topping up ${w.role} DUST (${dust} < ${DUST_TARGET})…`);
      await ensureDust(w, DUST_TARGET, 10 * 60_000).catch((err) => {
        console.log(`[bridge] ${w.role} startup DUST top-up failed: ${errorText(err).slice(0, 300)}`);
      });
    }
  }

  let phase = 'ready';
  console.log(`[bridge] READY on http://127.0.0.1:${PORT}`);

  const server = createServer(async (req, res) => {
    const started = Date.now();
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const parts = url.pathname.split('/').filter(Boolean);

      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'content-type',
        });
        res.end();
        return;
      }

      if (parts[0] === 'health') {
        json(res, 200, {
          ready: deployer.ready && buyer.ready,
          phase,
          contract: deployment!.address,
          deployer: { address: deployer.address, addressHex: deployer.addressHex },
          buyer: { address: buyer.address, addressHex: buyer.addressHex },
        });
        return;
      }

      const role = parts[0] as Role;
      const w = wallets[role];
      if (!w) {
        json(res, 404, { error: `unknown role "${parts[0]}" (use deployer|buyer)` });
        return;
      }
      if (!w.ready) {
        json(res, 503, { error: `${role} wallet is still syncing` });
        return;
      }

      const action = parts[1];

      if (req.method === 'GET' && action === 'config') {
        json(res, 200, {
          networkId: config.networkId,
          indexerUri: config.indexer,
          indexerWsUri: config.indexerWS,
          address: w.address,
          addressHex: w.addressHex,
          shieldedAddress: w.coinPublicKey,
          coinPublicKey: w.coinPublicKey,
          encryptionPublicKey: w.encryptionPublicKey,
          contractAddress: deployment!.address,
        });
        return;
      }

      if (req.method === 'GET' && action === 'balances') {
        json(res, 200, await serial(w, () => readBalances(w)));
        return;
      }

      if (req.method === 'POST' && action === 'balance') {
        const body = JSON.parse((await readBody(req)) || '{}') as { txHex?: string };
        if (!body.txHex) {
          json(res, 400, { error: 'txHex is required' });
          return;
        }
        json(
          res,
          200,
          await serial(w, () =>
            Promise.race([
              balanceTx(w, body.txHex!),
              new Promise<never>((_, rej) =>
                setTimeout(() => rej(new Error('balance request timed out after 300s')), 300_000),
              ),
            ]),
          ),
        );
        return;
      }

      if (req.method === 'POST' && action === 'submit') {
        const body = JSON.parse((await readBody(req)) || '{}') as { txHex?: string };
        if (!body.txHex) {
          json(res, 400, { error: 'txHex is required' });
          return;
        }
        json(res, 200, await serial(w, () => submitTx(w, body.txHex!)));
        return;
      }

      json(res, 404, { error: `no route ${req.method} ${url.pathname}` });
    } catch (err) {
      const text = errorText(err);
      console.error(`[bridge] request failed: ${text.slice(0, 500)}`);
      json(res, 500, { error: text });
    } finally {
      console.log(`[bridge] ${req.method} ${req.url} -> ${res.statusCode} (${Date.now() - started}ms)`);
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[bridge] listening on http://127.0.0.1:${PORT}`);
  });
}

main().catch((err) => {
  console.error(`[bridge] fatal: ${errorText(err)}`);
  process.exit(1);
});
