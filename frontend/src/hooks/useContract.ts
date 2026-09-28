import { useCallback, useRef, useState } from 'react'
import {
  connectToContract,
  createProviders,
  defaultServiceConfig,
  type ServiceConfig,
} from '@/lib/midnight'
import { encodeMeta, hexToBytes, toAddressBytes, type ListingMeta } from '@/lib/hex'
import { CONTRACT_ADDRESS, PRIVATE_STATE_ID } from '@/lib/constants'
import type { OnyxPrivateState } from '@/lib/witnesses'
import type { OnyxWalletAdapter } from '@/lib/wallet-adapter'

type CircuitCallResult = { txId?: string; hash?: string }

type ContractHandle = {
  callTx: Record<string, (...args: unknown[]) => Promise<CircuitCallResult>>
}

/**
 * Thin wrapper around the deployed marketplace contract. Every method takes plain
 * strings/bigints and converts them to the byte shapes the circuits expect.
 */
export function useContract(adapter: OnyxWalletAdapter | null, config?: ServiceConfig) {
  const [contract, setContract] = useState<ContractHandle | null>(null)
  // State updates land after the current render, so callers that connect and
  // then immediately call a circuit must go through the ref.
  const contractRef = useRef<ContractHandle | null>(null)
  // Providers are needed after a circuit runs (e.g. to read the listing salt
  // the contract stored in private state) — keep them reachable too.
  const providersRef = useRef<Awaited<ReturnType<typeof createProviders>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async () => {
    if (!adapter) {
      setError('Wallet not connected')
      return null
    }
    setLoading(true)
    setError(null)
    try {
      const defaults = defaultServiceConfig()
      const providers = await createProviders(
        config ?? {
          indexerUri: adapter.config.indexerUri || defaults.indexerUri,
          indexerWsUri: adapter.config.indexerWsUri || defaults.indexerWsUri,
        },
        adapter,
      )
      const deployed = await connectToContract(providers, CONTRACT_ADDRESS)
      const handle = deployed as unknown as ContractHandle
      contractRef.current = handle
      providersRef.current = providers
      setContract(handle)
      return deployed
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to contract'
      // Surface the real cause (DevTools + the form's error box) instead of a
      // generic "could not connect" — fetch/CORS/private-state failures all
      // arrive here.
      console.error('[onyx] contract connection failed:', err)
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      setLoading(false)
    }
  }, [adapter, config])

  const callCircuit = useCallback(
    async (circuitName: string, ...args: unknown[]): Promise<CircuitCallResult> => {
      const handle = contractRef.current
      if (!handle) throw new Error('Contract not connected')
      const fn = handle.callTx[circuitName]
      if (typeof fn !== 'function') throw new Error(`Unknown circuit: ${circuitName}`)
      setLoading(true)
      setError(null)
      try {
        return await fn(...args)
      } catch (err) {
        const message = err instanceof Error ? err.message : `Failed to call ${circuitName}`
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const listData = useCallback(
    (input: {
      dataHashHex: string
      price: bigint
      meta: ListingMeta
      sellerAddrHex: string
    }) =>
      callCircuit(
        'listData',
        hexToBytes(input.dataHashHex, 'data hash'),
        input.price,
        encodeMeta(input.meta),
        toAddressBytes(input.sellerAddrHex, 'seller address'),
      ),
    [callCircuit],
  )

  const buyListing = useCallback(
    (listingIdHex: string, buyerAddrHex: string) =>
      callCircuit(
        'buyListing',
        toAddressBytes(listingIdHex, 'listing id'),
        toAddressBytes(buyerAddrHex, 'buyer address'),
      ),
    [callCircuit],
  )

  const confirmDelivery = useCallback(
    (listingIdHex: string) =>
      callCircuit('confirmDelivery', toAddressBytes(listingIdHex, 'listing id')),
    [callCircuit],
  )

  const disputeListing = useCallback(
    (listingIdHex: string) =>
      callCircuit('disputeListing', toAddressBytes(listingIdHex, 'listing id')),
    [callCircuit],
  )

  /**
   * The contract's own commitment salt for a listing: generated in-circuit by
   * `get_random_salt` and stored via `store_listing_salt` into this seller's
   * private state when `listData` executes. The exported package must commit
   * with THIS salt, otherwise its commitment will not equal the on-chain
   * `listingDataCommitment`.
   */
  const contractSalt = useCallback(async (listingIdHex: string): Promise<Uint8Array> => {
    const providers = providersRef.current
    if (!providers) throw new Error('Contract not connected')
    const state = (await providers.privateStateProvider.get(PRIVATE_STATE_ID)) as OnyxPrivateState | null
    const salt = state?.listingSalts?.[listingIdHex]
    if (!salt || salt.length !== 32) {
      throw new Error(
        `No contract salt stored for listing ${listingIdHex}. Re-run listData from this device's wallet.`,
      )
    }
    return salt
  }, [])

  const resolveDispute = useCallback(
    (listingIdHex: string, refundBuyer: boolean) =>
      callCircuit(
        'resolveDispute',
        toAddressBytes(listingIdHex, 'listing id'),
        refundBuyer,
      ),
    [callCircuit],
  )

  return {
    contract,
    loading,
    error,
    connect,
    callCircuit,
    listData,
    buyListing,
    confirmDelivery,
    disputeListing,
    resolveDispute,
    contractSalt,
  }
}
