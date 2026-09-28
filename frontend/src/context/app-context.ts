import { createContext, useContext } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { useContract } from '@/hooks/useContract'
import { useMarketplace } from '@/hooks/useMarketplace'

export type AppContextValue = {
  wallet: ReturnType<typeof useWallet>
  contract: ReturnType<typeof useContract>
  marketplace: ReturnType<typeof useMarketplace>
  /** Connect the contract handle if it is not up yet; throws when that fails. */
  ensureContract: () => Promise<void>
  /** Re-read listings and balances after a mutation. */
  refresh: () => Promise<void>
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside <AppProvider>')
  return context
}
