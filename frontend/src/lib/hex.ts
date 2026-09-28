/** Hex, byte, metadata and address helpers shared by the SDK layer and the UI. */

export const META_MAX_BYTES = 512

export const ADDRESS_BYTES = 32

/** Public listing metadata, encoded as zero-padded UTF-8 JSON in `Bytes<512>`. */
export type ListingMeta = {
  title: string
  description: string
  category: string
  size: string
  records: string
}

const HEX_RE = /^[0-9a-fA-F]+$/

export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

/** 0x-optional, any even length. */
export function hexToBytes(hex: string, label = 'value'): Uint8Array {
  const h = hex.trim().replace(/^0x/i, '')
  if (h.length % 2 !== 0 || !HEX_RE.test(h)) {
    throw new Error(`${label} must be an even-length hex string, got "${hex}"`)
  }
  const out = new Uint8Array(h.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

/** Strict 32-byte hex, the shape contract circuits expect for addresses and ids. */
export function toAddressBytes(hex: string, label = 'address'): Uint8Array {
  const bytes = hexToBytes(hex, label)
  if (bytes.length !== ADDRESS_BYTES) {
    throw new Error(`${label} must be 32 bytes, got ${bytes.length}`)
  }
  return bytes
}

export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

/** Contract metadata -> `Bytes<512>` (UTF-8 JSON, zero-padded). */
export function encodeMeta(meta: ListingMeta): Uint8Array {
  const json = JSON.stringify({
    t: meta.title ?? '',
    d: meta.description ?? '',
    c: meta.category ?? '',
    s: meta.size ?? '',
    r: meta.records ?? '',
  })
  const raw = utf8ToBytes(json)
  if (raw.length > META_MAX_BYTES) {
    throw new Error(`Listing metadata is ${raw.length} bytes, max ${META_MAX_BYTES}`)
  }
  const out = new Uint8Array(META_MAX_BYTES)
  out.set(raw)
  return out
}

/** `Bytes<512>` -> metadata; tolerates zero padding and non-JSON payloads. */
export function decodeMeta(bytes: Uint8Array): ListingMeta {
  let end = bytes.length
  while (end > 0 && bytes[end - 1] === 0) end--
  const empty: ListingMeta = { title: '', description: '', category: '', size: '', records: '' }
  if (end === 0) return empty
  try {
    const parsed = JSON.parse(bytesToUtf8(bytes.subarray(0, end))) as Record<string, string>
    return {
      title: parsed.t ?? '',
      description: parsed.d ?? '',
      category: parsed.c ?? '',
      size: parsed.s ?? '',
      records: parsed.r ?? '',
    }
  } catch {
    return empty
  }
}

export const STATE_NAMES = ['active', 'sold', 'disputed', 'completed'] as const
export type ListingStateName = (typeof STATE_NAMES)[number]

export function stateName(state: number): ListingStateName {
  return STATE_NAMES[state] ?? 'active'
}

/* ---------------------------------------------------------------- bech32m -- */

const BECH32M_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const BECH32M_CONST = 0x2bc830a3

function polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
  let chk = 1
  for (const v of values) {
    const top = chk >> 25
    chk = ((chk & 0x1ffffff) << 5) ^ v
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) chk ^= GEN[i]
    }
  }
  return chk >>> 0
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = []
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5)
  out.push(0)
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31)
  return out
}

function convertBits(data: number[], from: number, to: number, pad: boolean): number[] {
  let acc = 0
  let bits = 0
  const out: number[] = []
  const maxv = (1 << to) - 1
  for (const value of data) {
    if (value < 0 || value >> from) throw new Error('invalid value in bech32m data')
    acc = (acc << from) | value
    bits += from
    while (bits >= to) {
      bits -= to
      out.push((acc >> bits) & maxv)
    }
  }
  if (pad) {
    if (bits > 0) out.push((acc << (to - bits)) & maxv)
  } else if (bits >= from || ((acc << (to - bits)) & maxv)) {
    throw new Error('invalid bech32m padding')
  }
  return out
}

export type Bech32mParts = { prefix: string; type: string; network: string; bytes: Uint8Array }

/** Decode a Midnight bech32m string (`mn_<type>[_<network>]<data>`). */
export function decodeBech32m(input: string): Bech32mParts {
  const str = input.trim()
  const sep = str.lastIndexOf('1')
  if (sep < 1 || sep + 7 > str.length) throw new Error(`not a bech32m string: ${input}`)
  const hrp = str.slice(0, sep)
  const dataPart = str.slice(sep + 1)
  const data: number[] = []
  for (const ch of dataPart) {
    const idx = BECH32M_CHARSET.indexOf(ch)
    if (idx === -1) throw new Error(`invalid bech32m character "${ch}"`)
    data.push(idx)
  }
  const check = polymod([...hrpExpand(hrp), ...data])
  if (check !== BECH32M_CONST) throw new Error('invalid bech32m checksum')

  const words = data.slice(0, data.length - 6)
  const bytes = new Uint8Array(convertBits(words, 5, 8, false))
  const segments = hrp.split('_')
  if (segments[0] !== 'mn') throw new Error(`expected "mn" prefix, got "${segments[0]}"`)
  return {
    prefix: segments[0],
    type: segments[1] ?? '',
    network: segments.slice(2).join('_') || 'mainnet',
    bytes,
  }
}

function encodeBech32m(hrp: string, bytes: Uint8Array): string {
  const words = convertBits(Array.from(bytes), 8, 5, true)
  const checksum: number[] = []
  const values = [...hrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0]
  const mod = polymod(values) ^ BECH32M_CONST
  for (let i = 0; i < 6; i++) checksum.push((mod >> (5 * (5 - i))) & 31)
  const all = [...words, ...checksum]
  let out = `${hrp}1`
  for (const w of all) out += BECH32M_CHARSET[w]
  return out
}

/** Wallet unshielded address (`mn_addr_<network>...`) -> 32 raw bytes. */
export function bech32mToAddressBytes(input: string, expectedType = 'addr'): Uint8Array {
  const { type, bytes } = decodeBech32m(input)
  if (type !== expectedType) throw new Error(`expected bech32m type "${expectedType}", got "${type}"`)
  if (bytes.length !== ADDRESS_BYTES) {
    throw new Error(`expected ${ADDRESS_BYTES} address bytes, got ${bytes.length}`)
  }
  return bytes
}

/** 32 raw bytes -> `mn_addr_<network>...` (used for round-trip verification). */
export function addressBytesToBech32m(bytes: Uint8Array, network: string): string {
  if (bytes.length !== ADDRESS_BYTES) {
    throw new Error(`expected ${ADDRESS_BYTES} address bytes, got ${bytes.length}`)
  }
  return encodeBech32m(`mn_addr_${network}`, bytes)
}
