import { useCallback, useState } from 'react'
import type { WalletState } from '@/types'
import { NETWORK } from '@/lib/constants'
import { defaultServiceConfig, initNetwork } from '@/lib/midnight'
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger'
import { createWalletAdapter, type OnyxWalletAdapter } from '@/lib/wallet-adapter'
import { createBridgeApi, e2eOpts } from '@/lib/e2e-api'

const initialWalletState: WalletState = {
  connected: false,
  address: null,
  addressHex: null,
  shieldedAddress: null,
  balance: 0n,
  dustBalance: 0n,
  networkId: null,
}

function getInjectedWallet() {
  const injected = (window as unknown as { midnight?: Record<string, unknown> }).midnight
  if (!injected) return null
  const entries = Object.values(injected)
  const candidate = entries.find(
    (entry): entry is { connect: (networkId: string) => Promise<unknown> } =>
      typeof (entry as { connect?: unknown })?.connect === 'function',
  )
  return candidate ?? null
}

export function useWallet() {
  const [state, setState] = useState<WalletState>(initialWalletState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adapter, setAdapter] = useState<OnyxWalletAdapter | null>(null)

  const connect = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      initNetwork()
      // Headless-test path: window.__ONYX_E2E__ routes the connection to the
      // local bridge instead of the Lace extension (scripts/phase6-ui-e2e.mjs).
      const e2e = e2eOpts()
      const wallet = e2e
        ? { connect: async () => createBridgeApi(e2e) }
        : getInjectedWallet()
      if (!wallet) {
        throw new Error('No Midnight wallet found. Please install the Lace wallet extension.')
      }

      const api = (await wallet.connect(NETWORK)) as Parameters<typeof createWalletAdapter>[0]
      const connected = await createWalletAdapter(api)

      if (connected.config.networkId && connected.config.networkId !== NETWORK) {
        console.warn(
          `[onyx] wallet is on "${connected.config.networkId}", expected "${NETWORK}"`,
        )
      }

      const [unshieldedBalances, dustBalance, shielded] = await Promise.all([
        api.getUnshieldedBalances(),
        api.getDustBalance(),
        api.getShieldedAddresses(),
      ])

      const nightBalance = unshieldedBalances[unshieldedToken().raw] ?? 0n

      setState({
        connected: true,
        address: connected.unshieldedAddress,
        addressHex: connected.unshieldedAddressHex,
        shieldedAddress: shielded.shieldedAddress ?? null,
        balance: typeof nightBalance === 'bigint' ? nightBalance : BigInt(nightBalance || 0),
        dustBalance:
          typeof dustBalance?.balance === 'bigint' ? dustBalance.balance : 0n,
        networkId: connected.config.networkId ?? NETWORK,
      })
      setAdapter(connected)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
      setState(initialWalletState)
      setAdapter(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setState(initialWalletState)
    setAdapter(null)
    setError(null)
  }, [])

  const refreshBalance = useCallback(async () => {
    if (!adapter) return
    try {
      const [unshieldedBalances, dustBalance] = await Promise.all([
        adapter.api.getUnshieldedBalances(),
        adapter.api.getDustBalance(),
      ])
      const nightBalance = unshieldedBalances[unshieldedToken().raw] ?? 0n
      setState(prev => ({
        ...prev,
        balance: typeof nightBalance === 'bigint' ? nightBalance : BigInt(nightBalance || 0),
        dustBalance:
          typeof dustBalance?.balance === 'bigint' ? dustBalance.balance : 0n,
      }))
    } catch {
      // balance refresh is best-effort
    }
  }, [adapter])

  /** Indexer/websocket URIs: prefer whatever the wallet is configured to use. */
  const serviceConfig = useCallback(() => {
    if (!adapter) return defaultServiceConfig()
    return {
      indexerUri: adapter.config.indexerUri || defaultServiceConfig().indexerUri,
      indexerWsUri: adapter.config.indexerWsUri || defaultServiceConfig().indexerWsUri,
    }
  }, [adapter])

  return {
    ...state,
    loading,
    error,
    adapter,
    /** @deprecated use `adapter` - kept so existing call sites keep working. */
    walletAPI: adapter,
    connect,
    disconnect,
    refreshBalance,
    serviceConfig,
  }
}
