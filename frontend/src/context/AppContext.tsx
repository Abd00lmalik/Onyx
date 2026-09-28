import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { useContract } from '@/hooks/useContract'
import { useMarketplace } from '@/hooks/useMarketplace'
import { AppContext, type AppContextValue } from './app-context'

/**
 * The three SDK hooks share one instance for the whole app: five pages each
 * opening their own contract connection would mean five indexer loops and five
 * `findDeployedContract` calls against the same private state.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet()
  const { serviceConfig, refreshBalance, connected, adapter } = wallet
  const config = useMemo(() => serviceConfig(), [serviceConfig])
  const contract = useContract(adapter, config)
  const { connect: connectContract, contract: contractHandle, loading: contractLoading } = contract
  const marketplace = useMarketplace(adapter, config)
  const { fetchListings } = marketplace

  // Auto-connect the contract once per wallet session. Failures are logged by
  // useContract; retrying in a render loop would just hammer the indexer.
  const autoConnectTried = useRef(false)
  useEffect(() => {
    if (!connected || !adapter) {
      autoConnectTried.current = false
      return
    }
    if (!contractHandle && !contractLoading && !autoConnectTried.current) {
      autoConnectTried.current = true
      void connectContract().catch(() => {})
    }
  }, [connected, adapter, contractHandle, contractLoading, connectContract])

  const ensureContract = useCallback(async () => {
    if (contractHandle) return
    // connectContract rethrows the underlying error — let it reach the form.
    await connectContract()
  }, [contractHandle, connectContract])

  const refresh = useCallback(async () => {
    await fetchListings()
    await refreshBalance()
  }, [fetchListings, refreshBalance])

  const value = useMemo<AppContextValue>(
    () => ({ wallet, contract, marketplace, ensureContract, refresh }),
    [wallet, contract, marketplace, ensureContract, refresh],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
