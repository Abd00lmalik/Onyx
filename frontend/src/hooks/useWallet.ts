import { useState, useCallback } from 'react'
import type { WalletState } from '@/types'

const initialWalletState: WalletState = {
  connected: false,
  address: null,
  shieldedAddress: null,
  balance: 0n,
  dustBalance: 0n,
  networkId: null,
}

export function useWallet() {
  const [state, setState] = useState<WalletState>(initialWalletState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [walletAPI, setWalletAPI] = useState<any>(null)

  const getInjectedWallet = useCallback(() => {
    const injected = (window as any).midnight
    if (!injected) return null
    const wallets = Object.values(injected)
    return wallets.length > 0 ? wallets[0] as any : null
  }, [])

  const connect = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const wallet = getInjectedWallet()
      if (!wallet) {
        throw new Error('No Midnight wallet found. Please install the Lace wallet extension.')
      }

      const connectedApi = await wallet.connect('preprod')
      const config = await connectedApi.getConfiguration()
      const unshieldedAddr = await connectedApi.getUnshieldedAddress()
      const shieldedAddrs = await connectedApi.getShieldedAddresses()
      const unshieldedBalances = await connectedApi.getUnshieldedBalances()
      const dustBalance = await connectedApi.getDustBalance()

      const nightBalance = unshieldedBalances?.NIGHT ?? unshieldedBalances?.night ?? 0n

      setState({
        connected: true,
        address: unshieldedAddr?.unshieldedAddress ?? null,
        shieldedAddress: shieldedAddrs?.shieldedAddress ?? null,
        balance: typeof nightBalance === 'bigint' ? nightBalance : BigInt(nightBalance || 0),
        dustBalance: typeof dustBalance === 'bigint' ? dustBalance : BigInt(dustBalance || 0),
        networkId: config?.networkId ?? 'preprod',
      })
      setWalletAPI(connectedApi)
    } catch (err: any) {
      setError(err?.message || 'Failed to connect wallet')
      setState(initialWalletState)
      setWalletAPI(null)
    } finally {
      setLoading(false)
    }
  }, [getInjectedWallet])

  const disconnect = useCallback(() => {
    setState(initialWalletState)
    setWalletAPI(null)
    setError(null)
  }, [])

  const refreshBalance = useCallback(async () => {
    if (!walletAPI || !state.connected) return
    try {
      const unshieldedBalances = await walletAPI.getUnshieldedBalances()
      const dustBalance = await walletAPI.getDustBalance()
      const nightBalance = unshieldedBalances?.NIGHT ?? unshieldedBalances?.night ?? 0n

      setState(prev => ({
        ...prev,
        balance: typeof nightBalance === 'bigint' ? nightBalance : BigInt(nightBalance || 0),
        dustBalance: typeof dustBalance === 'bigint' ? dustBalance : BigInt(dustBalance || 0),
      }))
    } catch {
      // Silently fail on refresh
    }
  }, [walletAPI, state.connected])

  return {
    ...state,
    loading,
    error,
    walletAPI,
    connect,
    disconnect,
    refreshBalance,
  }
}
