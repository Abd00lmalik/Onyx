/**
 * Read-only verifier: query the deployed contract's state from the indexer and
 * decode it with the compiled ledger module. Proves the address in
 * .midnight-state.json matches the artifacts on disk.
 *
 * Usage: npx tsx scripts/read-contract.ts [address]
 */
import { WebSocket } from 'ws';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';

import { resolveNetwork, getDeployment } from '../src/network';

// @ts-expect-error Required for indexer subscriptions
globalThis.WebSocket = WebSocket;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractDir = path.resolve(__dirname, '..', 'contracts', 'managed', 'onyx-marketplace');

const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

async function main(): Promise<void> {
  const { network, config } = resolveNetwork();
  const address = process.argv[2] ?? getDeployment(network)?.address;
  if (!address) {
    console.error('No address: pass one as argv[2] or deploy first.');
    process.exit(1);
  }

  console.log(`network : ${network}`);
  console.log(`address : ${address}`);

  const provider = indexerPublicDataProvider(config.indexer, config.indexerWS);

  // Indexer can lag a freshly-deployed contract by a few seconds.
  let state: Awaited<ReturnType<typeof provider.queryContractState>> = null;
  for (let attempt = 1; attempt <= 10; attempt++) {
    state = await provider.queryContractState(address);
    if (state) break;
    console.log(`  state not indexed yet (attempt ${attempt}), waiting 3s...`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (!state) {
    console.error('FAIL: contract state not found on the indexer');
    process.exit(1);
  }

  const mod: any = await import(pathToFileURL(path.join(contractDir, 'contract', 'index.js')).href);
  const ledgerState = mod.ledger(state.data);

  const requiredMaps = [
    'listingSeller',
    'listingDataCommitment',
    'listingPrice',
    'listingState',
    'listingBuyer',
    'listingMeta',
    'listingSellerAddr',
    'listingBuyerAddr',
    'escrow',
  ];
  const missing = requiredMaps.filter(
    (m) => !ledgerState[m] || typeof ledgerState[m].member !== 'function',
  );
  if (missing.length) {
    console.error(`FAIL: ledger decode missing maps: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log(`admin          : ${hex(ledgerState.admin)}`);
  console.log(`listingCount   : ${ledgerState.listingCount}`);
  console.log(`completedCount : ${ledgerState.completedCount}`);
  console.log(`maps           : ${requiredMaps.length}/${requiredMaps.length} present`);

  if (typeof mod.contractEntryPoints === 'undefined' && !mod.Contract) {
    console.error('FAIL: compiled module has no Contract export');
    process.exit(1);
  }
  console.log('PASS: address state decoded by the compiled artifacts');
}

main().catch((e) => {
  console.error('FAIL:', e instanceof Error ? e.message : e);
  process.exit(1);
});
