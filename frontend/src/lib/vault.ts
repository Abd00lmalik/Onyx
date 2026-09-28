/**
 * File formats and browser plumbing for the peer-to-peer handoff.
 *
 * Three JSON files move between the seller and the buyer:
 *
 *   `.onyx-vault.json`     seller's at-rest copy: ciphertext + its own data key
 *   `.onyx-request.json`   buyer's ask: listing id + X25519 public key
 *   `.onyx-package.json`   delivery: the ciphertext with the key wrapped to that
 *                          public key, which is the only file that leaves the
 *                          seller's device unlocked
 */
import type { DataPackage, RecipientKeys } from './package'
import { parsePackage, wrapKeyForRecipient } from './package'
import { bytesToHex, hexToBytes } from './hex'

export type VaultFile = {
  type: 'onyx:vault'
  version: 1
  listingId: string
  /** Hex data key - the vault is private to the seller. */
  dataKey: string
  package: DataPackage
}

export type RequestFile = {
  type: 'onyx:package-request'
  version: 1
  listingId: string
  /** Hex X25519 public key. */
  publicKey: string
}

function requireHex32(value: string, label: string): string {
  try {
    if (hexToBytes(value, label).length !== 32) throw new Error('length')
  } catch {
    throw new Error(`${label} must be 32 bytes of hex`)
  }
  return value
}

export function serializeVault(vault: VaultFile): string {
  return JSON.stringify(vault, null, 2)
}

export function parseVault(json: string): VaultFile {
  const raw = JSON.parse(json) as Partial<VaultFile>
  if (raw.type !== 'onyx:vault' || raw.version !== 1) {
    throw new Error('Not an Onyx vault file')
  }
  if (typeof raw.listingId !== 'string' || typeof raw.dataKey !== 'string') {
    throw new Error('Vault file is missing listingId or dataKey')
  }
  const pkg = parsePackage(JSON.stringify(raw.package))
  if (pkg.listingId !== raw.listingId) {
    throw new Error('Vault package belongs to a different listing')
  }
  return {
    type: 'onyx:vault',
    version: 1,
    listingId: requireHex32(raw.listingId, 'vault.listingId'),
    dataKey: requireHex32(raw.dataKey, 'vault.dataKey'),
    package: pkg,
  }
}

export function serializeRequest(request: RequestFile): string {
  return JSON.stringify(request, null, 2)
}

export function parseRequest(json: string): RequestFile {
  const raw = JSON.parse(json) as Partial<RequestFile>
  if (raw.type !== 'onyx:package-request' || raw.version !== 1) {
    throw new Error('Not an Onyx package request')
  }
  if (typeof raw.listingId !== 'string' || typeof raw.publicKey !== 'string') {
    throw new Error('Request file is missing listingId or publicKey')
  }
  return {
    type: 'onyx:package-request',
    version: 1,
    listingId: requireHex32(raw.listingId, 'request.listingId'),
    publicKey: requireHex32(raw.publicKey, 'request.publicKey'),
  }
}

/** Seller-side: same package, key wrapped to the requesting buyer. */
export async function recipientBuild(
  pkg: DataPackage,
  dataKey: Uint8Array,
  recipientPublicKey: Uint8Array,
): Promise<DataPackage> {
  const listingId = hexToBytes(pkg.listingId, 'package.listingId')
  const wrap = await wrapKeyForRecipient(dataKey, recipientPublicKey, listingId)
  return { ...pkg, wrap }
}

/* ------------------------------------------------------- recipient keys -- */

const recipientKey = (listingId: string) => `onyx.recipient.${listingId}`

export function saveRecipientKeys(listingId: string, keys: RecipientKeys): void {
  window.localStorage.setItem(
    recipientKey(listingId),
    JSON.stringify({ publicKey: bytesToHex(keys.publicKey), secretKey: bytesToHex(keys.secretKey) }),
  )
}

export function loadRecipientKeys(listingId: string): RecipientKeys | null {
  const stored = window.localStorage.getItem(recipientKey(listingId))
  if (!stored) return null
  try {
    const parsed = JSON.parse(stored) as { publicKey?: string; secretKey?: string }
    return {
      publicKey: hexToBytes(parsed.publicKey ?? '', 'recipient.publicKey'),
      secretKey: hexToBytes(parsed.secretKey ?? '', 'recipient.secretKey'),
    }
  } catch {
    return null
  }
}

export function hasRecipientKeys(listingId: string): boolean {
  return window.localStorage.getItem(recipientKey(listingId)) !== null
}

/* ------------------------------------------------------------ downloads -- */

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function downloadText(filename: string, text: string): void {
  triggerDownload(filename, new Blob([text], { type: 'application/json' }))
}

export function downloadBytes(filename: string, bytes: Uint8Array, mime = 'application/octet-stream'): void {
  // TS 6 types `BlobPart` as `ArrayBufferView<ArrayBuffer>`, which a plain
  // `Uint8Array` (ArrayBufferLike) does not satisfy.
  const part = new Uint8Array(bytes) as unknown as BlobPart
  triggerDownload(filename, new Blob([part], { type: mime }))
}

/** Safe file-name fragment for downloads, e.g. "Financial-Market-Data". */
export function slugify(name: string): string {
  const slug = name.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug.slice(0, 48) || 'dataset'
}
