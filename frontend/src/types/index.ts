export type ListingState = 'active' | 'sold' | 'disputed' | 'completed'

export interface Listing {
  id: string
  seller: string
  dataCommitment: string
  price: bigint
  state: ListingState
  buyer: string
  /** Decoded on-chain metadata (`listingMeta`). Optional until Phase 4 rewires the view layer. */
  title?: string
  description?: string
  category?: string
  size?: string
  records?: string
  /** Seller payout address (32-byte hex) recorded by `listData`. */
  sellerAddr?: string
  /** Buyer address (32-byte hex) recorded by `buyListing`. */
  buyerAddr?: string
  /** NIGHT currently held in escrow for this listing, in STAR. */
  escrow?: bigint
}

export interface WalletState {
  connected: boolean
  address: string | null
  addressHex: string | null
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
