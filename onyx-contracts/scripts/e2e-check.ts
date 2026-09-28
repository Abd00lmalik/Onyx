/**
 * End-to-end smoke check for onyx-contracts.
 *
 * Reconnects to the deployed Onyx marketplace contract, reads its ledger state
 * through the indexer, and exits 0 on success. Read-only: it never balances or
 * submits transactions — full transaction flows are covered by
 * `npm run test:phase5`. Used by `npm run test:e2e` and by CI workflows.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { resolveNetwork, getOrCreateWallet, formatWalletBackupNotice, getDeployment } from '../src/network';
import { createWallet, persistWalletState } from '../src/wallet';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

// @ts-expect-error wallet sync requires WebSocket
globalThis.WebSocket = WebSocket;

// Must match the privateStateId used by the deploy and Phase 5 scripts.
const PRIVATE_STATE_ID = 'onyxMarketplacePrivateState';
const PRIVATE_STATE_STORE = 'onyx-marketplace-state';
const PRIVATE_STATE_PASSWORD =
  process.env.PRIVATE_STATE_PASSWORD?.trim() || 'Local-Devnet-Development-Placeholder-1';

// ─── Network configuration ─────────────────────────────────────────────────────

const { network, config: networkConfig } = resolveNetwork();
const WALLET = getOrCreateWallet(network);
const SEED = WALLET.seed;
{
  const notice = formatWalletBackupNotice(WALLET, network);
  if (notice) console.log(notice);
}

function fail(msg: string): never {
  console.error(`❌ e2e-check failed: ${msg}`);
  process.exit(1);
}

function isHexAddress(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-fA-F]+$/.test(s) && s.length >= 32;
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
    randomBytes(32),
  ],
  store_listing_salt: (
    ctx: { privateState: OnyxPrivateState },
    listingId: Uint8Array,
    salt: Uint8Array,
  ): [OnyxPrivateState, []] => {
    const key = Array.from(listingId)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return [{ ...ctx.privateState, listingSalts: { ...ctx.privateState.listingSalts, [key]: salt } }, []];
  },
};

async function main() {
  // 1. Deployment sanity
  const deployment = getDeployment(network);
  if (!deployment) {
    console.error(`No deploy on file for network ${network}.`);
    process.exit(1);
  }
  if (!isHexAddress(deployment.address)) {
    fail(`Deployment address missing or invalid: ${JSON.stringify(deployment, null, 2)}`);
  }

  // 2. Build the compiled contract handle
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'onyx-marketplace');
  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
  if (!fs.existsSync(contractPath)) fail('Compiled contract missing — run `npm run compile`.');
  const Onyx = await import(pathToFileURL(contractPath).href);
  const compiledContract: any = (CompiledContract as any)
    .make('onyx-marketplace', Onyx.Contract)
    .pipe(
      (CompiledContract as any).withWitnesses(witnesses),
      (CompiledContract as any).withCompiledFileAssets(zkConfigPath),
    );

  const walletCtx = await createWallet({ network, networkConfig, seed: SEED });
  await walletCtx.wallet.waitForSyncedState();
  // Persist the sync state — saves time on the next e2e-check invocation in CI
  // when run against the same persistent wallet directory.
  await persistWalletState(network, walletCtx);

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const walletProvider = {
    // Midnight.js 4.1.x returns the key objects (CoinPublicKey / EncPublicKey).
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx() {
      throw new Error('e2e-check is read-only and should not balance transactions');
    },
    submitTx() {
      throw new Error('e2e-check is read-only and should not submit transactions');
    },
  } as any;

  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: PRIVATE_STATE_STORE,
      accountId: walletCtx.unshieldedKeystore.getBech32Address().toString(),
      privateStoragePasswordProvider: async () => PRIVATE_STATE_PASSWORD,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };

  providers.privateStateProvider.setContractAddress(deployment.address as never);
  // Seed a fresh private state only when none is stored: `findDeployedContract`
  // unconditionally overwrites when `initialPrivateState` is supplied, which
  // would drop the deploy-time secretKey (the sealed admin identity) and any
  // stored listing salts.
  const stored = await providers.privateStateProvider.get(PRIVATE_STATE_ID as never);

  // 3. Reconnect to the deployed contract — proves callTx interface is wired
  try {
    await findDeployedContract(providers as never, {
      contractAddress: deployment.address,
      compiledContract: compiledContract as any,
      privateStateId: PRIVATE_STATE_ID,
      ...(stored ? {} : { initialPrivateState: { secretKey: randomBytes(32), listingSalts: {} } }),
    } as never);
  } catch (err: any) {
    await walletCtx.wallet.stop();
    fail(`findDeployedContract threw: ${err?.message ?? err}`);
  }

  // 4. Read the on-chain contract state via the public data provider — proves
  // the contract is indexed and queryable on the chain itself, not just that
  // we know how to construct the local handle.
  const onChainState = await providers.publicDataProvider.queryContractState(deployment.address);
  if (!onChainState) {
    await walletCtx.wallet.stop();
    fail(`queryContractState returned null for ${deployment.address}`);
  }

  // 5. Decode the ledger so the read is proven against real structure, not
  // just raw bytes.
  let listingCount = -1;
  let completedCount = -1;
  try {
    const led = Onyx.ledger(onChainState.data);
    listingCount = Number(led.listingCount);
    completedCount = Number(led.completedCount);
  } catch (err: any) {
    await walletCtx.wallet.stop();
    fail(`ledger decode threw: ${err?.message ?? err}`);
  }

  console.log(`✅ e2e-check passed`);
  console.log(`   contractAddress: ${deployment.address}`);
  console.log(`   network:         ${network}`);
  console.log(`   listings:        ${listingCount} (${completedCount} completed)`);

  await walletCtx.wallet.stop();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
