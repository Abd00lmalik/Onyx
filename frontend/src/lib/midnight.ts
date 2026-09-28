import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id'
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js'
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider'
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider'
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts'
import { createProofProvider, type ProofProvider } from '@midnight-ntwrk/midnight-js-types'
import type { PrivateStateProvider, PublicDataProvider, ZKConfigProvider } from '@midnight-ntwrk/midnight-js-types'

import * as OnyxLedger from '../generated/contract/index.js'
import { createInitialPrivateState, witnesses, type OnyxPrivateState } from './witnesses'
import {
  CONTRACT_ADDRESS,
  DEFAULT_INDEXER_URI,
  DEFAULT_INDEXER_WS_URI,
  NETWORK,
  PRIVATE_STATE_ID,
  ZK_ARTIFACTS_PATH,
  proofServerUrl,
  zkArtifactsUrl,
} from './constants'
import { generatePassword } from './secure-password'
import type { OnyxWalletAdapter } from './wallet-adapter'

export type ServiceConfig = {
  indexerUri: string
  indexerWsUri: string
}

export const defaultServiceConfig = (): ServiceConfig => ({
  indexerUri: DEFAULT_INDEXER_URI,
  indexerWsUri: DEFAULT_INDEXER_WS_URI,
})

let networkReady = false
export function initNetwork() {
  if (networkReady) return
  setNetworkId(NETWORK)
  networkReady = true
}

let zkConfig: FetchZkConfigProvider<string> | null = null
function zkConfigProvider(): ZKConfigProvider<string> {
  initNetwork()
  if (!zkConfig) zkConfig = new FetchZkConfigProvider<string>(zkArtifactsUrl())
  return zkConfig
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let compiledContract: any = null
function getCompiledContract() {
  initNetwork()
  if (!compiledContract) {
    const cc = CompiledContract as unknown as {
      make: (
        tag: string,
        ctor: unknown,
      ) => {
        pipe: (fn: (self: unknown) => unknown) => { pipe: (fn: (self: unknown) => unknown) => unknown }
      }
      withWitnesses: (w: unknown) => (self: unknown) => unknown
      withCompiledFileAssets: (path: string) => (self: unknown) => unknown
    }
    compiledContract = cc
      .make('onyx-marketplace', OnyxLedger.Contract)
      .pipe(cc.withWitnesses(witnesses))
      .pipe(cc.withCompiledFileAssets(ZK_ARTIFACTS_PATH))
  }
  return compiledContract
}

export { OnyxLedger, getCompiledContract, zkConfigProvider }

const PASSWORD_KEY = 'onyx.privateStatePassword'
function privateStatePassword(): string {
  try {
    const existing = window.localStorage.getItem(PASSWORD_KEY)
    if (existing) return existing
    const generated = generatePassword()
    window.localStorage.setItem(PASSWORD_KEY, generated)
    return generated
  } catch {
    // Storage unavailable (private mode): a per-session password keeps the provider
    // usable; private state simply will not survive a reload in that case.
    return generatePassword()
  }
}

function privateStateProviderFor(accountId: string): PrivateStateProvider {
  return levelPrivateStateProvider({
    midnightDbName: 'onyx-marketplace',
    privateStateStoreName: 'onyx-listings',
    signingKeyStoreName: 'onyx-signing-keys',
    accountId,
    privateStoragePasswordProvider: () => privateStatePassword(),
  })
}

/**
 * Providers needed to read contract state. Works without a connected wallet so the
 * marketplace can be browsed before connecting one.
 */
export function createReadProviders(config: ServiceConfig = defaultServiceConfig()): {
  publicDataProvider: PublicDataProvider
  zkConfigProvider: ZKConfigProvider<string>
} {
  initNetwork()
  return {
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    zkConfigProvider: zkConfigProvider(),
  }
}

async function buildProofProvider(api: OnyxWalletAdapter['api']): Promise<ProofProvider> {
  const zk = zkConfigProvider()
  const { httpClientProofProvider } = await import('@midnight-ntwrk/midnight-js-http-client-proof-provider')
  const httpProvider = httpClientProofProvider(proofServerUrl(), zk)

  let walletProvider: ProofProvider | null = null
  try {
    const { dappConnectorProvingProvider } = await import(
      '@midnight-ntwrk/midnight-js-dapp-connector-proof-provider'
    )
    walletProvider = createProofProvider(await dappConnectorProvingProvider(api, zk))
  } catch (err) {
    console.warn('[onyx] wallet proving unavailable, using proof server:', err)
  }

  if (!walletProvider) return httpProvider

  return {
    async proveTx(unprovenTx, proveTxConfig) {
      try {
        return await walletProvider!.proveTx(unprovenTx, proveTxConfig)
      } catch (err) {
        console.warn('[onyx] wallet proving failed, retrying with proof server:', err)
        return httpProvider.proveTx(unprovenTx, proveTxConfig)
      }
    },
  }
}

/** Full provider set for transactions. Requires a connected wallet adapter. */
export async function createProviders(config: ServiceConfig, adapter: OnyxWalletAdapter) {
  initNetwork()
  return {
    privateStateProvider: privateStateProviderFor(adapter.unshieldedAddressHex),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    zkConfigProvider: zkConfigProvider(),
    proofProvider: await buildProofProvider(adapter.api),
    walletProvider: adapter,
    midnightProvider: adapter,
  }
}

export async function connectToContract(
  providers: Awaited<ReturnType<typeof createProviders>>,
  contractAddress: string = CONTRACT_ADDRESS,
) {
  // `findDeployedContract` unconditionally overwrites stored private state when
  // `initialPrivateState` is supplied, which would rotate the seller identity and
  // drop stored listing salts. Only seed a fresh state on first connect.
  const privateStateProvider = providers.privateStateProvider
  privateStateProvider.setContractAddress(contractAddress as never)
  const stored = await privateStateProvider.get(PRIVATE_STATE_ID)

  return findDeployedContract(providers as never, {
    compiledContract: getCompiledContract(),
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    ...(stored ? {} : { initialPrivateState: createInitialPrivateState() }),
  } as never)
}

export type { OnyxPrivateState }
