import { useCallback, useState } from 'react'
import type { Listing, ListingState as ListingStateName, MarketplaceStats } from '@/types'
import { OnyxLedger, createReadProviders, defaultServiceConfig, initNetwork, type ServiceConfig } from '@/lib/midnight'
import { bytesToHex, decodeMeta, stateName } from '@/lib/hex'
import { CONTRACT_ADDRESS } from '@/lib/constants'
import type { OnyxWalletAdapter } from '@/lib/wallet-adapter'

const ZERO_ADDRESS = '0'.repeat(64)

function addressHex(bytes: Uint8Array): string {
  const hex = bytesToHex(bytes)
  return hex === ZERO_ADDRESS ? '' : hex
}

type ContractStateLike = { data: Parameters<typeof OnyxLedger.ledger>[0] }

function readAllListings(contractState: ContractStateLike | null): Listing[] {
  if (!contractState) return []
  const state = OnyxLedger.ledger(contractState.data)
  const result: Listing[] = []

  for (const [id, seller] of state.listingSeller) {
    const key = id
    const meta = decodeMeta(state.listingMeta.lookup(key))
    result.push({
      id: bytesToHex(key),
      seller: bytesToHex(seller),
      sellerAddr: addressHex(state.listingSellerAddr.lookup(key)),
      buyer: addressHex(state.listingBuyer.lookup(key)),
      // Only written by buyListing — Map.lookup throws on a missing key.
      buyerAddr: addressHex(
        state.listingBuyerAddr.member(key) ? state.listingBuyerAddr.lookup(key) : new Uint8Array(32),
      ),
      dataCommitment: bytesToHex(state.listingDataCommitment.lookup(key)),
      price: state.listingPrice.lookup(key),
      state: stateName(state.listingState.lookup(key) as number) as ListingStateName,
      escrow: state.escrow.member(key) ? state.escrow.lookup(key) : 0n,
      title: meta.title,
      description: meta.description,
      category: meta.category,
      size: meta.size,
      records: meta.records,
    })
  }

  // Listing ids are hashes, so there is no timestamp to order by; sort by id to
  // keep the rendered order stable across reloads.
  result.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return result
}

export function useMarketplace(adapter?: OnyxWalletAdapter | null, config?: ServiceConfig) {
  const [listings, setListings] = useState<Listing[]>([])
  const [stats, setStats] = useState<MarketplaceStats>({
    totalListings: 0,
    completedSales: 0,
    totalVolume: 0n,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serviceConfig = useCallback((): ServiceConfig => {
    const defaults = defaultServiceConfig()
    if (config) return config
    if (adapter) {
      return {
        indexerUri: adapter.config.indexerUri || defaults.indexerUri,
        indexerWsUri: adapter.config.indexerWsUri || defaults.indexerWsUri,
      }
    }
    return defaults
  }, [adapter, config])

  /** Reads every listing from the indexer; also refreshes stats. Returns the
   *  decoded list so callers can diff before/after a transaction. */
  const fetchListings = useCallback(async (): Promise<Listing[]> => {
    setLoading(true)
    setError(null)
    try {
      initNetwork()
      const { publicDataProvider } = createReadProviders(serviceConfig())
      const contractState = await publicDataProvider.queryContractState(CONTRACT_ADDRESS)
      const decoded = readAllListings(contractState as never)
      setListings(decoded)

      const state = contractState ? OnyxLedger.ledger(contractState.data as never) : null
      setStats({
        totalListings: state ? Number(state.listingCount) : decoded.length,
        completedSales: state ? Number(state.completedCount) : 0,
        totalVolume: decoded.reduce((acc, listing) => acc + listing.price, 0n),
      })
      return decoded
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch listings')
      return []
    } finally {
      setLoading(false)
    }
  }, [serviceConfig])

  const fetchListing = useCallback(
    async (id: string): Promise<Listing | null> => {
      try {
        initNetwork()
        const { publicDataProvider } = createReadProviders(serviceConfig())
        const contractState = await publicDataProvider.queryContractState(CONTRACT_ADDRESS)
        setError(null)
        if (!contractState) return null
        return readAllListings(contractState as never).find(listing => listing.id === id) ?? null
      } catch (err) {
        // Surface the failure so a detail page can tell "not found" from "unreachable".
        setError(err instanceof Error ? err.message : 'Failed to fetch listing')
        return null
      }
    },
    [serviceConfig],
  )

  return {
    listings,
    stats,
    loading,
    error,
    fetchListings,
    fetchListing,
  }
}
