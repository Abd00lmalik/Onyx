/** Display helpers for money, addresses and file sizes. */
import { NETWORK } from './constants'
import { addressBytesToBech32m, hexToBytes } from './hex'

const STAR_PER_NIGHT = 1_000_000n

/** Smallest NIGHT unit (STAR) -> `1,500.00` NIGHT, without float rounding. */
export function formatNight(value: bigint): string {
  const negative = value < 0n
  const abs = negative ? -value : value
  const whole = abs / STAR_PER_NIGHT
  const hundredths = (abs % STAR_PER_NIGHT) / 10_000n
  const text = `${whole.toLocaleString('en-US')}.${hundredths.toString().padStart(2, '0')}`
  return negative ? `-${text}` : text
}

/** Raw integer grouping for DUST, the way `check-balance.ts` prints it. */
export function formatRaw(value: bigint): string {
  return value.toLocaleString('en-US')
}

/**
 * User-entered NIGHT (up to 6 decimals) -> STAR for `listData`.
 * Throws on anything that is not a positive NIGHT amount.
 */
export function nightToStar(input: string): bigint {
  const text = input.trim()
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new Error(`"${input}" is not a NIGHT amount`)
  }
  const [whole, fraction = ''] = text.split('.')
  if (fraction.length > 6) {
    throw new Error('NIGHT amounts have at most 6 decimal places')
  }
  const star = BigInt(whole) * STAR_PER_NIGHT + BigInt(fraction.padEnd(6, '0'))
  if (star <= 0n) {
    throw new Error('Price must be greater than zero')
  }
  return star
}

/** `mn_addr_preprod1…` for compact display in the header and cards. */
export function shortAddress(address: string, head = 10, tail = 6): string {
  if (address.length <= head + tail + 1) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}

/** On-chain 32-byte address hex -> bech32m for display, hex as fallback. */
export function addressDisplay(addressHex: string): string {
  if (!addressHex) return ''
  try {
    return addressBytesToBech32m(hexToBytes(addressHex, 'address'), NETWORK)
  } catch {
    return addressHex
  }
}

/** Byte count -> `2.4 MB`, used as listing metadata and in delivery details. */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = Math.abs(bytes)
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const rounded = unit === 0 || value >= 100 ? Math.round(value) : Number(value.toFixed(1))
  return `${rounded} ${units[unit]}`
}
