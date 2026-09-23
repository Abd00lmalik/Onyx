export type ListingState = 'active' | 'sold' | 'disputed' | 'completed'

export interface Listing {
  id: string
  seller: string
  dataCommitment: string
  price: bigint
  state: ListingState
  buyer: string
}

export interface WalletState {
  connected: boolean
  address: string | null
  shieldedAddress: string | null
  balance: bigint
  dustBalance: bigint
  networkId: string | null
}

export interface ContractConfig {
  indexerUri: string
  indexerWsUri: string
  proofServerUri: string
  nodeUri: string
}

export interface MarketplaceStats {
  totalListings: number
  completedSales: number
  totalVolume: bigint
}
