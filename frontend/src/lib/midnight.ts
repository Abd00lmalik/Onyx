import { ZK_ARTIFACTS_PATH } from './constants'
import { witnesses, createInitialPrivateState } from './witnesses'

let compiledContract: any = null
let contractModule: any = null
let findDeployedContractRef: any = null
let cachedLedger: any = null

export async function loadLedger() {
  if (cachedLedger) return cachedLedger
  const baseUrl = window.location.origin
  const url = `${baseUrl}/zk-artifacts/contract/index.js`
  const mod = await eval(`import("${url}")`)
  cachedLedger = mod
  return mod
}

export async function loadContract() {
  if (compiledContract) return { compiledContract, contractModule }

  const [
    { findDeployedContract },
    { CompiledContract },
  ] = await Promise.all([
    import('@midnight-ntwrk/midnight-js-contracts'),
    import('@midnight-ntwrk/midnight-js-protocol/compact-js'),
  ])

  findDeployedContractRef = findDeployedContract

  const mod = await loadLedger()
  contractModule = mod

  compiledContract = (CompiledContract as any)
    .make('onyx-marketplace', mod.Contract)
    .pipe((CompiledContract as any).withWitnesses(witnesses))
    .pipe((CompiledContract as any).withCompiledFileAssets(ZK_ARTIFACTS_PATH))

  return { compiledContract, contractModule }
}

export async function createProviders(config: {
  indexerUri: string
  indexerWsUri: string
}, walletAPI: any, accountId: string) {
  const [
    { FetchZkConfigProvider },
    { indexerPublicDataProvider },
    { levelPrivateStateProvider },
  ] = await Promise.all([
    import('@midnight-ntwrk/midnight-js-fetch-zk-config-provider'),
    import('@midnight-ntwrk/midnight-js-indexer-public-data-provider'),
    import('@midnight-ntwrk/midnight-js-level-private-state-provider'),
  ])

  const zkConfigProvider = new FetchZkConfigProvider(ZK_ARTIFACTS_PATH)

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'onyx-marketplace-frontend',
      accountId,
      privateStoragePasswordProvider: () => 'onyx-browser-session',
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    zkConfigProvider,
    proofProvider: walletAPI?.getProvingProvider
      ? walletAPI.getProvingProvider(zkConfigProvider)
      : undefined,
    walletProvider: walletAPI,
    midnightProvider: walletAPI,
  }
}

export async function connectToContract(
  providers: any,
  contractAddress?: string,
) {
  const { compiledContract } = await loadContract()

  if (!findDeployedContractRef) {
    const { findDeployedContract } = await import('@midnight-ntwrk/midnight-js-contracts')
    findDeployedContractRef = findDeployedContract
  }

  return findDeployedContractRef(providers, {
    compiledContract,
    contractAddress: contractAddress || '1a7dabae6289b10f94636458b2c749b2396a3c9edc1e46877d4bb8a35a839b51',
    privateStateId: 'onyxMarketplacePrivateState',
    initialPrivateState: createInitialPrivateState(),
  })
}
