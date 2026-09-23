import { useState, useCallback } from 'react'
import { createProviders, connectToContract, loadContract } from '../lib/midnight'

const CONTRACT_ADDRESS = '1a7dabae6289b10f94636458b2c749b2396a3c9edc1e46877d4bb8a35a839b51'

export function useContract(walletAPI: any, walletAddress: string | null) {
  const [contract, setContract] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async () => {
    if (!walletAPI || !walletAddress) {
      setError('Wallet not connected')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const config = await walletAPI.getConfiguration()
      const providers = await createProviders({
        indexerUri: config.indexerUri,
        indexerWsUri: config.indexerWsUri,
      }, walletAPI, walletAddress)

      const deployed = await connectToContract(providers, CONTRACT_ADDRESS)
      setContract(deployed)
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to contract')
    } finally {
      setLoading(false)
    }
  }, [walletAPI, walletAddress])

  const callCircuit = useCallback(async (circuitName: string, ...args: any[]) => {
    if (!contract) {
      throw new Error('Contract not connected')
    }
    setLoading(true)
    setError(null)
    try {
      const result = await contract.callTx[circuitName](...args)
      return result
    } catch (err: any) {
      setError(err?.message || `Failed to call ${circuitName}`)
      throw err
    } finally {
      setLoading(false)
    }
  }, [contract])

  const listData = useCallback((dataHash: string, price: bigint) => {
    return callCircuit('listData', dataHash, price)
  }, [callCircuit])

  const buyListing = useCallback((listingId: string) => {
    return callCircuit('buyListing', listingId)
  }, [callCircuit])

  const confirmDelivery = useCallback((listingId: string) => {
    return callCircuit('confirmDelivery', listingId)
  }, [callCircuit])

  const disputeListing = useCallback((listingId: string) => {
    return callCircuit('disputeListing', listingId)
  }, [callCircuit])

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
  }
}
