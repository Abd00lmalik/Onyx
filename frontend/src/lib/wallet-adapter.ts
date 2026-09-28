import type { ConnectedAPI, Configuration } from '@midnight-ntwrk/dapp-connector-api'
import { Transaction } from '@midnight-ntwrk/midnight-js-protocol/ledger'
import type { FinalizedTransaction, TransactionId } from '@midnight-ntwrk/midnight-js-protocol/ledger'
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types'
import { bech32mToAddressBytes, bytesToHex, hexToBytes } from './hex'

/**
 * The DApp Connector API speaks serialized transactions as hex strings, while the
 * Midnight.js SDK speaks typed `Transaction` objects. This adapter is the bridge.
 *
 *  tx.serialize() -> hex -> wallet.balanceUnsealedTransaction(hex) -> hex
 *                 -> Transaction.deserialize('signature','proof','binding', bytes)
 */
export type OnyxWalletAdapter = {
  readonly api: ConnectedAPI
  readonly config: Configuration
  /** Bech32m unshielded address, for display. */
  readonly unshieldedAddress: string
  /** Same address as 32 raw bytes in hex - the value contract circuits expect. */
  readonly unshieldedAddressHex: string
  readonly coinPublicKey: string
  readonly encryptionPublicKey: string
  /** midnight-js-contracts calls these as methods when building call txs. */
  getCoinPublicKey(): string
  getEncryptionPublicKey(): string
  balanceTx(tx: UnboundTransaction, ttl?: Date): Promise<FinalizedTransaction>
  submitTx(tx: FinalizedTransaction): Promise<TransactionId>
}

function keyToHex(bech32m: string, type: string): string {
  try {
    return bytesToHex(bech32mToAddressBytes(bech32m, type))
  } catch {
    return bech32m
  }
}

export async function createWalletAdapter(api: ConnectedAPI): Promise<OnyxWalletAdapter> {
  const [config, unshielded, shielded] = await Promise.all([
    api.getConfiguration(),
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
  ])

  const unshieldedAddress = unshielded.unshieldedAddress
  const unshieldedAddressHex = bytesToHex(bech32mToAddressBytes(unshieldedAddress, 'addr'))

  return {
    api,
    config,
    unshieldedAddress,
    unshieldedAddressHex,
    coinPublicKey: keyToHex(shielded.shieldedCoinPublicKey, 'shield-cpk'),
    encryptionPublicKey: keyToHex(shielded.shieldedEncryptionPublicKey, 'shield-epk'),

    getCoinPublicKey(): string {
      return keyToHex(shielded.shieldedCoinPublicKey, 'shield-cpk')
    },

    getEncryptionPublicKey(): string {
      return keyToHex(shielded.shieldedEncryptionPublicKey, 'shield-epk')
    },

    async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
      const hex = bytesToHex(tx.serialize())
      const result = await api.balanceUnsealedTransaction(hex, { payFees: true })
      if (!result?.tx) {
        throw new Error('balanceUnsealedTransaction returned no transaction')
      }
      const bytes = hexToBytes(result.tx, 'balanced transaction')
      return Transaction.deserialize('signature', 'proof', 'binding', bytes)
    },

    async submitTx(tx: FinalizedTransaction): Promise<TransactionId> {
      const identifiers = tx.identifiers()
      const txId = identifiers[0]
      await api.submitTransaction(bytesToHex(tx.serialize()))
      return txId
    },
  }
}
