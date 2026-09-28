import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
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

  useEffect(() => {
    if (connected && adapter && !contractHandle && !contractLoading) {
      void connectContract()
    }
  }, [connected, adapter, contractHandle, contractLoading, connectContract])

  const ensureContract = useCallback(async () => {
    if (contractHandle) return
    const deployed = await connectContract()
    if (!deployed) throw new Error('Could not connect to the Onyx contract')
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
