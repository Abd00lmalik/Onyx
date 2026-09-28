import type { Configuration, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api'
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger'
import { NETWORK } from './constants'

/**
 * Headless-test wallet path: when `window.__ONYX_E2E__` is set (see
 * `scripts/phase6-ui-e2e.mjs`), the wallet connects to the local Node bridge
 * (`scripts/e2e-bridge.ts` in the contracts workspace) instead of Lace.
 * The bridge serves the same ConnectedAPI surface the real extension does,
 * so everything downstream — adapter, contract calls, proving — is unchanged.
 */

export interface E2EOpts {
  bridge?: string
  wallet?: string
}

export function e2eOpts(): E2EOpts | null {
  const flag = (window as unknown as { __ONYX_E2E__?: E2EOpts | boolean }).__ONYX_E2E__
  if (!flag) return null
  const opts = typeof flag === 'object' ? flag : {}
  return { bridge: opts.bridge ?? 'http://127.0.0.1:8787', wallet: opts.wallet ?? 'deployer' }
}

async function bridgeCall<T>(root: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${root}${path}`, init)
  const body = (await res.json().catch(() => null)) as T & { error?: string } | null
  if (!res.ok) throw new Error(body?.error ?? `bridge ${path} failed with HTTP ${res.status}`)
  return body as T
}

interface BridgeConfig {
  networkId: string
  indexerUri: string
  indexerWsUri: string
  address: string
  addressHex: string
  shieldedAddress: string
  coinPublicKey: string
  encryptionPublicKey: string
  contractAddress: string
}

export async function createBridgeApi(opts: E2EOpts): Promise<ConnectedAPI> {
  const root = `${opts.bridge ?? 'http://127.0.0.1:8787'}/${opts.wallet ?? 'deployer'}`
  const config = await bridgeCall<BridgeConfig>(root, '/config')

  const api = {
    getConfiguration: async () =>
      ({
        networkId: NETWORK,
        indexerUri: config.indexerUri,
        indexerWsUri: config.indexerWsUri,
      }) as unknown as Configuration,
    getUnshieldedAddress: async () => ({ unshieldedAddress: config.address }),
    getShieldedAddresses: async () => ({
      shieldedAddress: config.shieldedAddress,
      shieldedCoinPublicKey: config.coinPublicKey,
      shieldedEncryptionPublicKey: config.encryptionPublicKey,
    }),
    getUnshieldedBalances: async () => {
      const b = await bridgeCall<{ night: string }>(root, '/balances')
      return { [unshieldedToken().raw]: BigInt(b.night) } as Record<string, bigint>
    },
    getDustBalance: async () => {
      const b = await bridgeCall<{ dust: string }>(root, '/balances')
      return { balance: BigInt(b.dust) }
    },
    balanceUnsealedTransaction: async (tx: string) => {
      const r = await bridgeCall<{ tx: string }>(root, '/balance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ txHex: tx }),
      })
      return { tx: r.tx }
    },
    submitTransaction: async (tx: string) => {
      await bridgeCall(root, '/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ txHex: tx }),
      })
      return tx
    },
  }
  return api as unknown as ConnectedAPI
}
