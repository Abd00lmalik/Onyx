/**
 * CLI for interacting with onyx-contracts contract
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';

// Midnight SDK imports
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { resolveNetwork, getOrCreateWallet, formatWalletBackupNotice, getDeployment } from './network';
import { createWallet, persistWalletState, unshieldedToken, type WalletContext } from './wallet';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { randomBytes } from 'node:crypto';

// Enable WebSocket for GraphQL subscriptions
// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

// ─── Private State & Witness Types ──────────────────────────────────────────

type OnyxPrivateState = {
  readonly secretKey: Uint8Array;
  readonly listingSalts: Record<string, Uint8Array>;
};

const witnesses = {
  local_secret_key: (
    ctx: { privateState: OnyxPrivateState },
  ): [OnyxPrivateState, Uint8Array] => [ctx.privateState, ctx.privateState.secretKey],

  get_random_salt: (
    ctx: { privateState: OnyxPrivateState },
  ): [OnyxPrivateState, Uint8Array] => [ctx.privateState, randomBytes(32)],

  store_listing_salt: (
    ctx: { privateState: OnyxPrivateState; contractAddress: string },
    listingId: Uint8Array,
    salt: Uint8Array,
  ): [OnyxPrivateState, []] => {
    const key = Buffer.from(listingId).toString('hex');
    const updatedSalts = { ...ctx.privateState.listingSalts, [key]: salt };
    return [{ ...ctx.privateState, listingSalts: updatedSalts }, []];
  },
};

// Must match the privateStateId used at deploy time so the CLI reconnects to
// the same private state.
const PRIVATE_STATE_ID = 'onyxMarketplacePrivateState';

// True only while building a circuit that takes a NIGHT input
// (buyListing -> receiveUnshielded). Those transactions need an unshielded
// signature that `finalizeRecipe` alone does not produce; the other circuits
// must NOT be signed, because an extra unshielded signature is rejected by the
// chain (InputsSignaturesLengthMismatch).
let signUnshieldedInput = false;

const { network, config: networkConfig } = resolveNetwork();
const WALLET = getOrCreateWallet(network);
const SEED = WALLET.seed;
{
  const notice = formatWalletBackupNotice(WALLET, network);
  if (notice) console.log(notice);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'onyx-marketplace');

// ─── Contract input helpers ─────────────────────────────────────────────────

const META_MAX_BYTES = 512;

/** 64 hex chars -> Bytes<32> */
function hexToBytes(hex: string, label: string): Uint8Array {
  const h = hex.trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(h)) {
    throw new Error(`${label} must be 64 hex characters (32 bytes), got ${h.length}`);
  }
  return new Uint8Array(Buffer.from(h, 'hex'));
}

/** Public listing metadata -> Bytes<512> (UTF-8 JSON, zero-padded) */
function encodeMeta(meta: Record<string, string>): Uint8Array {
  const json = JSON.stringify(meta);
  const raw = Buffer.from(json, 'utf8');
  if (raw.length > META_MAX_BYTES) {
    throw new Error(`Listing metadata is ${raw.length} bytes, max ${META_MAX_BYTES}`);
  }
  const out = new Uint8Array(META_MAX_BYTES);
  out.set(raw);
  return out;
}

/** This wallet's unshielded payout address as Bytes<32> */
function myAddress(walletCtx: WalletContext): Uint8Array {
  const hex = walletCtx.unshieldedKeystore.getAddress() as unknown as string;
  return hexToBytes(hex, 'Wallet address');
}

const STATE_NAMES = ['active', 'sold', 'disputed', 'completed'] as const;
function stateName(state: number): string {
  return STATE_NAMES[state] ?? `unknown(${state})`;
}

// Load compiled contract
const contractPath = path.join(zkConfigPath, 'contract', 'index.js');

// Check if contract is compiled
if (!fs.existsSync(contractPath)) {
  console.error('\n❌ Contract not compiled! Run: npm run compile\n');
  process.exit(1);
}

const OnyxMarketplace = await import(pathToFileURL(contractPath).href);

const compiledContract = (CompiledContract as any).make('onyx-marketplace', OnyxMarketplace.Contract).pipe(
  (CompiledContract as any).withWitnesses(witnesses),
  (CompiledContract as any).withCompiledFileAssets(zkConfigPath),
);

// ─── Providers ─────────────────────────────────────────────────────────────────

async function createProviders(walletCtx: WalletContext) {
  // The SDK requires the private-state password to be at least 16 characters.
  // The default below is a placeholder for local devnet only — set a strong
  // password via PRIVATE_STATE_PASSWORD when you move to a non-local target.
  const privateStatePassword = process.env.PRIVATE_STATE_PASSWORD?.trim() || 'Local-Devnet-Development-Placeholder-1';

  const walletProvider = {
    // In Midnight.js 4.1.x the WalletProvider interface returns the key objects
    // (CoinPublicKey / EncPublicKey) directly — no longer hex strings.
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: any, ttl?: Date) {
      // balanceUnboundTransaction -> finalizeRecipe is the complete balancing
      // path in wallet-sdk 1.x, but finalizeRecipe never signs: an unshielded
      // (NIGHT) input needs an explicit signRecipe with the account keystore.
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      if (signUnshieldedInput) {
        const signed = await walletCtx.wallet.signRecipe(recipe, (data: Uint8Array) =>
          walletCtx.unshieldedKeystore.signData(data),
        );
        return walletCtx.wallet.finalizeRecipe(signed);
      }
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'onyx-marketplace-state',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

// ─── Main CLI ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║              Onyx Marketplace CLI                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const rl = createInterface({ input: stdin, output: stdout });

  // Check for deployment
  const deployment = getDeployment(network);
  if (!deployment) {
    console.error(`No deploy on file for network ${network}. Run \`npm run setup -- --network ${network}\` first.`);
    process.exit(1);
  }
  console.log(`  Contract: ${deployment.address}`);
  console.log(`  Network: ${network}\n`);

  try {
    const seed = SEED;

    console.log('  Connecting to wallet...');
    const walletCtx = await createWallet({ network, networkConfig, seed });
    const restoredCount = Object.values(walletCtx.restored).filter(Boolean).length;
    if (restoredCount > 0) {
      console.log(`  Restored ${restoredCount}/3 child wallets from .midnight-wallet-state — sync will resume from saved point.`);
    }

    console.log('  Syncing with network...');
    console.log('  ℹ  This may take several minutes depending on network size.');
    console.log('     RPC disconnection messages during sync are normal and can be safely ignored.\n');
    const syncStart = Date.now();
    const syncInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - syncStart) / 1000);
      process.stdout.write(`\r  ⏳ Still syncing... (${elapsed}s elapsed)   `);
    }, 5000);
    const state = await walletCtx.wallet.waitForSyncedState();
    clearInterval(syncInterval);
    process.stdout.write('\r  ✓ Synced with network.                                      \n');

    // Persist sync state so the next run doesn't have to redo this work.
    await persistWalletState(network, walletCtx);
    const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
    console.log(`  Balance: ${balance.toLocaleString()} tNight\n`);

    // Surface a faucet hint when a public-network wallet has 0 tNIGHT.
    // Reads (option 2) work without funds, but writes (option 1) need DUST
    // generated from registered NIGHT — without this hint the next failure
    // mode is a confusing "Insufficient Funds" deep inside the tx builder.
    if (balance === 0n && network !== 'undeployed' && networkConfig.faucet) {
      const address = walletCtx.unshieldedKeystore.getBech32Address();
      console.log('  ⚠ Wallet has no tNight. Fund it from the faucet to send transactions:');
      console.log(`     ${networkConfig.faucet}`);
      console.log(`     Wallet address: ${address}\n`);
    }

    // Setup providers and connect to contract
    console.log('  Connecting to contract...');
    const providers = await createProviders(walletCtx);

    // findDeployedContract *stores* whatever `initialPrivateState` it is given,
    // so passing `{}` would wipe the deploy-time secretKey that the sealed
    // admin identity is derived from. Reconnect to the stored state instead,
    // creating one only if this contract has never been initialised here.
    providers.privateStateProvider.setContractAddress(deployment.address);
    const storedPrivateState = await providers.privateStateProvider.get(PRIVATE_STATE_ID);
    if (!storedPrivateState) {
      await providers.privateStateProvider.set(PRIVATE_STATE_ID, { secretKey: randomBytes(32), listingSalts: {} });
      console.log('  ℹ  No stored private state for this contract — initialised a fresh one.');
    }

    const deployed: any = await findDeployedContract(providers, {
      compiledContract: compiledContract as any,
      contractAddress: deployment.address,
      privateStateId: PRIVATE_STATE_ID,
    });

    console.log('  ✅ Connected!\n');

    // Interactive CLI loop
    let running = true;
    while (running) {
      console.log('─── Menu ───────────────────────────────────────────────────────');
      console.log('  1. List data for sale');
      console.log('  2. Buy a listing');
      console.log('  3. Confirm delivery');
      console.log('  4. Dispute a listing');
      console.log('  5. View listing');
      console.log('  6. Check wallet balance');
      console.log('  7. Exit\n');

      const choice = await rl.question('  Your choice: ');

      switch (choice.trim()) {
        case '1': {
          const dataHashHex = await rl.question('  Enter data hash (64 hex chars): ');
          const priceStr = await rl.question('  Enter price in STAR (1 NIGHT = 1,000,000 STAR): ');
          const title = await rl.question('  Title: ');
          const description = await rl.question('  Description: ');
          const category = await rl.question('  Category: ');
          const size = await rl.question('  Size (e.g. 2.4 GB): ');
          const records = await rl.question('  Records (e.g. 48200): ');
          try {
            const dataHash = hexToBytes(dataHashHex, 'Data hash');
            const price = BigInt(priceStr);
            const meta = encodeMeta({ t: title, d: description, c: category, s: size, r: records });
            const sellerAddr = myAddress(walletCtx);
            console.log('\n  Submitting listing (this may take 30-60 seconds)...');
            const tx = await deployed.callTx.listData(dataHash, price, meta, sellerAddr);
            console.log(`\n  ✅ Data listed successfully!`);
            console.log(`  Transaction ID: ${tx.public.txId}`);
            console.log(`  Block height: ${tx.public.blockHeight}\n`);
          } catch (error) {
            console.error('\n  ❌ Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '2': {
          const listingIdHex = await rl.question('  Enter listing ID (64 hex chars): ');
          try {
            const listingId = hexToBytes(listingIdHex, 'Listing ID');
            const buyerAddr = myAddress(walletCtx);
            console.log('\n  Submitting purchase (pays the price in tNight)...');
            // buyListing takes a NIGHT input (receiveUnshielded) -> the
            // balancing recipe must be signed with the account keystore.
            signUnshieldedInput = true;
            const tx = await deployed.callTx.buyListing(listingId, buyerAddr);
            signUnshieldedInput = false;
            console.log(`\n  ✅ Purchase successful!`);
            console.log(`  Transaction ID: ${tx.public.txId}\n`);
          } catch (error) {
            signUnshieldedInput = false;
            console.error('\n  ? Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '3': {
          const listingIdHex = await rl.question('  Enter listing ID to confirm (64 hex chars): ');
          console.log('\n  Confirming delivery (releases escrow to the seller)...');
          try {
            const tx = await deployed.callTx.confirmDelivery(hexToBytes(listingIdHex, 'Listing ID'));
            console.log(`\n  ✅ Delivery confirmed!`);
            console.log(`  Transaction ID: ${tx.public.txId}\n`);
          } catch (error) {
            console.error('\n  ❌ Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '4': {
          const listingIdHex = await rl.question('  Enter listing ID to dispute (64 hex chars): ');
          console.log('\n  Submitting dispute...');
          try {
            const tx = await deployed.callTx.disputeListing(hexToBytes(listingIdHex, 'Listing ID'));
            console.log(`\n  ✅ Dispute filed!`);
            console.log(`  Transaction ID: ${tx.public.txId}\n`);
          } catch (error) {
            console.error('\n  ❌ Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '5': {
          const listingIdHex = await rl.question('  Enter listing ID (64 hex chars): ');
          console.log('\n  Fetching listing...');
          try {
            const listingId = hexToBytes(listingIdHex, 'Listing ID');
            const contractState = await providers.publicDataProvider.queryContractState(deployment.address);
            if (!contractState) {
              console.log('\n  📋 No contract state found\n');
              break;
            }
            const ledgerState = OnyxMarketplace.ledger(contractState.data);
            if (!ledgerState.listingSeller.member(listingId)) {
              console.log('\n  📋 Listing not found\n');
              break;
            }
            const metaRaw = Buffer.from(ledgerState.listingMeta.lookup(listingId)).toString('utf8').replace(/\0+$/, '');
            let meta = '';
            try {
              const parsed = JSON.parse(metaRaw || '{}');
              meta = `  Title:       ${parsed.t ?? '-'}\n  Category:    ${parsed.c ?? '-'}\n  Size:        ${parsed.s ?? '-'}\n  Records:     ${parsed.r ?? '-'}\n  Description: ${parsed.d ?? '-'}\n`;
            } catch {
              meta = `  Metadata:    (unparseable) ${metaRaw}\n`;
            }
            console.log(`
  Listing:       ${listingIdHex}
  Seller:        ${Buffer.from(ledgerState.listingSeller.lookup(listingId)).toString('hex')}
  Seller payout: ${Buffer.from(ledgerState.listingSellerAddr.lookup(listingId)).toString('hex')}
  Price:         ${ledgerState.listingPrice.lookup(listingId).toString()} STAR
  State:         ${stateName(ledgerState.listingState.lookup(listingId) as unknown as number)}
  Buyer:         ${Buffer.from(ledgerState.listingBuyer.lookup(listingId)).toString('hex')}
  Commitment:    ${Buffer.from(ledgerState.listingDataCommitment.lookup(listingId)).toString('hex')}
${meta}`);
          } catch (error) {
            console.error('\n  ❌ Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '6': {
          console.log('\n  Checking balance...');
          const currentState = await walletCtx.wallet.waitForSyncedState();
          const currentBalance = currentState.unshielded.balances[unshieldedToken().raw] ?? 0n;
          const dustBalance = currentState.dust.balance(new Date());
          console.log(`\n  tNight: ${currentBalance.toLocaleString()}`);
          console.log(`  DUST: ${dustBalance.toLocaleString()}\n`);
          break;
        }

        case '7':
          running = false;
          console.log('\n  👋 Goodbye!\n');
          break;

        default:
          console.log('\n  ❌ Invalid choice. Please enter 1-7.\n');
      }
    }

    await persistWalletState(network, walletCtx);
    await walletCtx.wallet.stop();
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
