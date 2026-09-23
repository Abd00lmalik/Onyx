import { useState, useCallback } from 'react'
import type { Listing, MarketplaceStats } from '../types'
import { createProviders } from '../lib/midnight'

const CONTRACT_ADDRESS = '1a7dabae6289b10f94636458b2c749b2396a3c9edc1e46877d4bb8a35a839b51'

function bigintToHex(val: any): string {
  if (typeof val === 'string') return val
  if (val instanceof Uint8Array) {
    return Array.from(val).map(b => b.toString(16).padStart(2, '0')).join('')
  }
  return String(val)
}

export function useMarketplace(walletAPI: any, walletAddress: string | null) {
  const [listings, setListings] = useState<Listing[]>([])
  const [stats, setStats] = useState<MarketplaceStats>({
    totalListings: 0,
    completedSales: 0,
    totalVolume: 0n,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchListings = useCallback(async () => {
    if (!walletAPI || !walletAddress) return
    setLoading(true)
    setError(null)
    try {
      const config = await walletAPI.getConfiguration()
      const providers = await createProviders({
        indexerUri: config.indexerUri,
        indexerWsUri: config.indexerWsUri,
      }, walletAPI, walletAddress)

      const publicState = await providers.publicDataProvider.queryContractState(CONTRACT_ADDRESS)
      if (!publicState) {
        setListings([])
        return
      }

      const { ledger } = await import('/zk-artifacts/contract/index.js' as string)
      const ledgerState = ledger(publicState.data)

      const result: Listing[] = []

      if (ledgerState?.listingSeller && typeof ledgerState.listingSeller[Symbol.iterator] === 'function') {
        for (const [id, seller] of ledgerState.listingSeller) {
          const idHex = bigintToHex(id)
          const price = ledgerState.listingPrice?.lookup?.(id) ?? 0n
          const state = ledgerState.listingState?.lookup?.(id) ?? 'active'
          const buyer = ledgerState.listingBuyer?.lookup?.(id) ?? ''
          const dataCommitment = ledgerState.listingDataCommitment?.lookup?.(id) ?? ''

          result.push({
            id: idHex,
            seller: bigintToHex(seller),
            dataCommitment: bigintToHex(dataCommitment),
            price: typeof price === 'bigint' ? price : BigInt(price),
            state: String(state) as any,
            buyer: bigintToHex(buyer),
          })
        }
      }

      setListings(result)

      const totalListings = Number(ledgerState?.listingCount ?? result.length)
      const completedSales = Number(ledgerState?.completedCount ?? 0)
      const totalVolume = result.reduce((acc, l) => acc + l.price, 0n)

      setStats({
        totalListings: Number(totalListings),
        completedSales: Number(completedSales),
        totalVolume,
      })
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch listings')
    } finally {
      setLoading(false)
    }
  }, [walletAPI, walletAddress])

  const fetchListing = useCallback(async (id: string): Promise<Listing | null> => {
    if (!walletAPI || !walletAddress) return null
    try {
      const config = await walletAPI.getConfiguration()
      const providers = await createProviders({
        indexerUri: config.indexerUri,
        indexerWsUri: config.indexerWsUri,
      }, walletAPI, walletAddress)

      const publicState = await providers.publicDataProvider.queryContractState(CONTRACT_ADDRESS)
      if (!publicState) return null

      const { ledger } = await import('/zk-artifacts/contract/index.js' as string)
      const ledgerState = ledger(publicState.data)

      if (ledgerState?.listingSeller && typeof ledgerState.listingSeller[Symbol.iterator] === 'function') {
        for (const [listingId, seller] of ledgerState.listingSeller) {
          const listingIdHex = bigintToHex(listingId)
          if (listingIdHex === id) {
            const price = ledgerState.listingPrice?.lookup?.(listingId) ?? 0n
            const state = ledgerState.listingState?.lookup?.(listingId) ?? 'active'
            const buyer = ledgerState.listingBuyer?.lookup?.(listingId) ?? ''
            const dataCommitment = ledgerState.listingDataCommitment?.lookup?.(listingId) ?? ''

            return {
              id: listingIdHex,
              seller: bigintToHex(seller),
              dataCommitment: bigintToHex(dataCommitment),
              price: typeof price === 'bigint' ? price : BigInt(price),
              state: String(state) as any,
              buyer: bigintToHex(buyer),
            }
          }
        }
      }
      return null
    } catch {
      return null
    }
  }, [walletAPI, walletAddress])

  return {
    listings,
    stats,
    loading,
    error,
    fetchListings,
    fetchListing,
  }
}
