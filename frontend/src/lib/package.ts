/**
 * P2P data package: the artifact a seller hands to a buyer out of band.
 *
 * The chain never sees the data - only `persistentCommit(dataHash, salt)` lives
 * in `listingDataCommitment` - so this module owns the three properties the
 * buyer needs to trust a delivered file:
 *
 *   1. confidentiality: AES-256-GCM under a random 32-byte data key,
 *   2. delivery: that key can be wrapped to a recipient's X25519 public key, so
 *      a leaked package file stays unreadable,
 *   3. authenticity: `sha256(plaintext)` and the recomputed data commitment are
 *      checked against the on-chain values.
 *
 * `computeDataCommitment` is byte-identical to the compiled contract's own
 * `_compute_data_commitment_0` (same `persistentCommit`, same
 * `CompactTypeVector(2, CompactTypeBytes(32))` descriptor, same
 * `pad(32, "onyx:data:")` domain separator) - scripts/phase3-package-test.ts
 * cross-checks it against that method directly.
 */
import { CompactTypeBytes, CompactTypeVector, persistentCommit } from '@midnight-ntwrk/compact-runtime'
import { bytesToHex, hexToBytes, utf8ToBytes } from './hex'

export const PACKAGE_VERSION = 1

export const KEY_WRAP_ALG = 'X25519-HKDF-SHA256+AES-256-GCM'

const HASH_BYTES = 32
const KEY_BYTES = 32
const IV_BYTES = 12
/** AES-GCM appends a 16-byte tag, so a wrapped 32-byte key is 48 bytes. */
const WRAPPED_KEY_BYTES = KEY_BYTES + 16
const META_BYTES = 512

/** `pad(32, "onyx:data:")` - the domain separator the contract commits over. */
const DATA_DOMAIN: Uint8Array = (() => {
  const out = new Uint8Array(HASH_BYTES)
  out.set(utf8ToBytes('onyx:data:'))
  return out
})()

/** `Vector<2, Bytes<32>>` - the exact descriptor the generated contract uses. */
const VECTOR_OF_BYTES32 = new CompactTypeVector(2, new CompactTypeBytes(HASH_BYTES))

const HKDF_INFO = utf8ToBytes('onyx:package-key:v1')

export type WrappedKey = {
  alg: string
  /** Ephemeral X25519 public key, raw 32 bytes. */
  ephPublicKey: string
  iv: string
  wrappedKey: string
}

export type DataPackage = {
  version: number
  /** 32-byte listing id, hex. Binds the key wrap to this listing. */
  listingId: string
  /** sha256 of the plaintext, hex. */
  dataHash: string
  /** 32-byte commitment opening, hex - travels with the package. */
  salt: string
  /** `Bytes<512>` listing metadata, hex (the same bytes stored on chain). */
  meta: string
  cipher: { alg: 'AES-256-GCM'; iv: string; ct: string }
  /** Null for the seller's own at-rest copy; set for recipient delivery. */
  wrap: WrappedKey | null
}

export type RecipientKeys = {
  /** Raw 32-byte X25519 public key - safe to publish in a request file. */
  publicKey: Uint8Array
  /** Raw 32-byte X25519 secret scalar - stays with the recipient. */
  secretKey: Uint8Array
}

export type CreatePackageInput = {
  listingId: string
  data: Uint8Array
  salt: Uint8Array
  meta: Uint8Array
  dataKey?: Uint8Array
}

export type CreatedPackage = { pkg: DataPackage; dataKey: Uint8Array }

export type PackageKeySource = { dataKey: Uint8Array } | { recipient: RecipientKeys }

export type PackageVerification = {
  hashOk: boolean
  commitmentOk: boolean
  metaOk: boolean
  ok: boolean
}

function requireBytes(value: Uint8Array, length: number, label: string): Uint8Array {
  if (!(value instanceof Uint8Array) || value.length !== length) {
    throw new Error(`${label} must be ${length} bytes, got ${value?.length ?? typeof value}`)
  }
  return value
}

/**
 * WebCrypto's `BufferSource` only accepts ArrayBuffer-backed views, while the
 * byte helpers here are typed as plain `Uint8Array` (i.e. ArrayBufferLike).
 */
const buf = (bytes: Uint8Array): BufferSource => bytes as unknown as BufferSource

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

export function randomSalt(): Uint8Array {
  return randomBytes(HASH_BYTES)
}

export function randomDataKey(): Uint8Array {
  return randomBytes(KEY_BYTES)
}

/** SHA-256 over the raw bytes - the `dataHash` the contract commits to. */
export async function hashData(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf(data)))
}

/** Same expression as the contract's `_compute_data_commitment_0`. */
export function computeDataCommitment(dataHash: Uint8Array, salt: Uint8Array): Uint8Array {
  requireBytes(dataHash, HASH_BYTES, 'dataHash')
  requireBytes(salt, HASH_BYTES, 'salt')
  return persistentCommit(VECTOR_OF_BYTES32, [dataHash, DATA_DOMAIN], salt)
}

export async function createPackage(input: CreatePackageInput): Promise<CreatedPackage> {
  const listingId = hexToBytes(input.listingId, 'listingId')
  requireBytes(listingId, HASH_BYTES, 'listingId')
  requireBytes(input.salt, HASH_BYTES, 'salt')
  requireBytes(input.meta, META_BYTES, 'meta')

  const dataKey = input.dataKey ? requireBytes(input.dataKey, KEY_BYTES, 'dataKey') : randomDataKey()
  const iv = randomBytes(IV_BYTES)
  const key = await crypto.subtle.importKey('raw', buf(dataKey), 'AES-GCM', false, ['encrypt'])
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv) }, key, buf(input.data)))

  return {
    dataKey,
    pkg: {
      version: PACKAGE_VERSION,
      listingId: bytesToHex(listingId),
      dataHash: bytesToHex(await hashData(input.data)),
      salt: bytesToHex(input.salt),
      meta: bytesToHex(input.meta),
      cipher: { alg: 'AES-256-GCM', iv: bytesToHex(iv), ct: bytesToHex(ct) },
      wrap: null,
    },
  }
}

/** Decrypt the payload; throws if the key is wrong or the ciphertext was touched. */
export async function openPackage(pkg: DataPackage, source: PackageKeySource): Promise<Uint8Array> {
  const dataKey =
    'dataKey' in source
      ? requireBytes(source.dataKey, KEY_BYTES, 'dataKey')
      : await unwrapKeyForRecipient(pkg, source.recipient)

  const iv = hexToBytes(pkg.cipher.iv, 'cipher.iv')
  const ct = hexToBytes(pkg.cipher.ct, 'cipher.ct')
  const key = await crypto.subtle.importKey('raw', buf(dataKey), 'AES-GCM', false, ['decrypt'])
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(iv) }, key, buf(ct)))
  } catch {
    throw new Error('Package could not be opened: wrong data key or tampered ciphertext')
  }
}

/* ------------------------------------------------------ recipient wrapping -- */

export async function generateRecipientKeys(): Promise<RecipientKeys> {
  const pair = (await crypto.subtle.generateKey({ name: 'X25519' } as unknown as EcKeyGenParams, true, [
    'deriveBits',
  ])) as unknown as CryptoKeyPair
  return {
    publicKey: new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)),
    secretKey: new Uint8Array(await exportPrivateScalar(pair.privateKey)),
  }
}

/**
 * Wrap `dataKey` so only `recipientPublicKey` can open it: ephemeral X25519 ->
 * HKDF-SHA256 (salted with the listing id) -> AES-256-GCM.
 */
export async function wrapKeyForRecipient(
  dataKey: Uint8Array,
  recipientPublicKey: Uint8Array,
  listingId: Uint8Array,
): Promise<WrappedKey> {
  requireBytes(dataKey, KEY_BYTES, 'dataKey')
  requireBytes(recipientPublicKey, HASH_BYTES, 'recipientPublicKey')
  requireBytes(listingId, HASH_BYTES, 'listingId')

  const pair = (await crypto.subtle.generateKey({ name: 'X25519' } as unknown as EcKeyGenParams, true, [
    'deriveBits',
  ])) as unknown as CryptoKeyPair
  const wrapKey = await deriveWrapKey(pair.privateKey, recipientPublicKey, listingId)
  const iv = randomBytes(IV_BYTES)
  const aesKey = await crypto.subtle.importKey('raw', buf(wrapKey), 'AES-GCM', false, ['encrypt'])
  const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv) }, aesKey, buf(dataKey)))

  return {
    alg: KEY_WRAP_ALG,
    ephPublicKey: bytesToHex(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))),
    iv: bytesToHex(iv),
    wrappedKey: bytesToHex(wrapped),
  }
}

/** Open a package's wrapped key with the recipient's own X25519 key pair. */
export async function unwrapKeyForRecipient(pkg: DataPackage, recipient: RecipientKeys): Promise<Uint8Array> {
  const wrap = pkg.wrap
  if (!wrap) throw new Error('Package has no wrapped key: ask the seller for a recipient build')
  return unwrapKey(wrap, recipient, hexToBytes(pkg.listingId, 'listingId'))
}

export async function unwrapKey(
  wrap: WrappedKey,
  recipient: RecipientKeys,
  listingId: Uint8Array,
): Promise<Uint8Array> {
  requireBytes(recipient.publicKey, HASH_BYTES, 'recipient.publicKey')
  requireBytes(recipient.secretKey, KEY_BYTES, 'recipient.secretKey')
  requireBytes(listingId, HASH_BYTES, 'listingId')
  if (wrap.alg !== KEY_WRAP_ALG) throw new Error(`Unsupported key wrap "${wrap.alg}"`)

  const ephPublicKey = hexToBytes(wrap.ephPublicKey, 'wrap.ephPublicKey')
  const priv = await importRecipientPrivateKey(recipient)
  const wrapKey = await deriveWrapKey(priv, ephPublicKey, listingId)
  const iv = hexToBytes(wrap.iv, 'wrap.iv')
  const aesKey = await crypto.subtle.importKey('raw', buf(wrapKey), 'AES-GCM', false, ['decrypt'])
  try {
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: buf(iv) },
        aesKey,
        buf(hexToBytes(wrap.wrappedKey, 'wrap.wrappedKey')),
      ),
    )
  } catch {
    throw new Error('Package key could not be unwrapped: this package was not addressed to this key')
  }
}

async function deriveWrapKey(ephPrivate: CryptoKey, peerPublic: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  const peer = await crypto.subtle.importKey(
    'raw',
    buf(peerPublic),
    { name: 'X25519' } as unknown as EcKeyImportParams,
    false,
    [],
  )
  const shared = await crypto.subtle.deriveBits({ name: 'X25519', public: peer }, ephPrivate, 256)
  const hkdf = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: buf(salt), info: buf(HKDF_INFO) },
    hkdf,
    256,
  )
  return new Uint8Array(bits)
}

/** Node refuses `exportKey('raw')` for OKP private keys, both runtimes take JWK. */
async function exportPrivateScalar(key: CryptoKey): Promise<Uint8Array> {
  const jwk = await crypto.subtle.exportKey('jwk', key)
  if (!jwk.d) throw new Error('X25519 private key is not extractable')
  return base64UrlToBytes(jwk.d)
}

async function importRecipientPrivateKey(recipient: RecipientKeys): Promise<CryptoKey> {
  const jwk: JsonWebKey = {
    kty: 'OKP',
    crv: 'X25519',
    d: bytesToBase64Url(recipient.secretKey),
    x: bytesToBase64Url(recipient.publicKey),
    key_ops: ['deriveBits'],
    ext: true,
  }
  return crypto.subtle.importKey('jwk', jwk, { name: 'X25519' } as unknown as EcKeyImportParams, false, ['deriveBits'])
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/* ------------------------------------------------------------ serialisation -- */

export function serializePackage(pkg: DataPackage): string {
  return JSON.stringify(pkg, null, 2)
}

export function parsePackage(json: string): DataPackage {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('Package is not valid JSON')
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Package must be a JSON object')
  }
  const pkg = raw as Partial<DataPackage>

  if (pkg.version !== PACKAGE_VERSION) {
    throw new Error(`Unsupported package version ${String(pkg.version)}, expected ${PACKAGE_VERSION}`)
  }
  if (hexToBytes(String(pkg.listingId), 'package.listingId').length !== HASH_BYTES) {
    throw new Error('package.listingId must be 32 bytes')
  }
  if (hexToBytes(String(pkg.dataHash), 'package.dataHash').length !== HASH_BYTES) {
    throw new Error('package.dataHash must be 32 bytes')
  }
  if (hexToBytes(String(pkg.salt), 'package.salt').length !== HASH_BYTES) {
    throw new Error('package.salt must be 32 bytes')
  }
  if (hexToBytes(String(pkg.meta), 'package.meta').length !== META_BYTES) {
    throw new Error(`package.meta must be ${META_BYTES} bytes`)
  }

  const cipher = pkg.cipher as DataPackage['cipher'] | undefined
  if (!cipher || cipher.alg !== 'AES-256-GCM') throw new Error('package.cipher.alg must be "AES-256-GCM"')
  if (hexToBytes(String(cipher.iv), 'package.cipher.iv').length !== IV_BYTES) {
    throw new Error(`package.cipher.iv must be ${IV_BYTES} bytes`)
  }
  if (hexToBytes(String(cipher.ct), 'package.cipher.ct').length === 0) throw new Error('package.cipher.ct is empty')

  if (pkg.wrap !== null && pkg.wrap !== undefined) {
    const wrap = pkg.wrap
    if (wrap.alg !== KEY_WRAP_ALG) throw new Error(`Unsupported key wrap "${String(wrap.alg)}"`)
    if (hexToBytes(String(wrap.ephPublicKey), 'package.wrap.ephPublicKey').length !== HASH_BYTES) {
      throw new Error('package.wrap.ephPublicKey must be 32 bytes')
    }
    if (hexToBytes(String(wrap.iv), 'package.wrap.iv').length !== IV_BYTES) {
      throw new Error(`package.wrap.iv must be ${IV_BYTES} bytes`)
    }
    if (hexToBytes(String(wrap.wrappedKey), 'package.wrap.wrappedKey').length !== WRAPPED_KEY_BYTES) {
      throw new Error(`package.wrap.wrappedKey must be ${WRAPPED_KEY_BYTES} bytes`)
    }
  }

  return pkg as DataPackage
}

/* -------------------------------------------------------------- verification -- */

/**
 * Check a delivered file against what the chain promises. Checks whose
 * expected value is omitted are reported as passed.
 */
export async function verifyPackage(
  plaintext: Uint8Array,
  pkg: DataPackage,
  expected: { dataCommitment?: Uint8Array; meta?: Uint8Array } = {},
): Promise<PackageVerification> {
  const dataHash = hexToBytes(pkg.dataHash, 'package.dataHash')
  const salt = hexToBytes(pkg.salt, 'package.salt')

  const hashOk = bytesEqual(await hashData(plaintext), dataHash)
  const commitmentOk = expected.dataCommitment
    ? bytesEqual(computeDataCommitment(dataHash, salt), expected.dataCommitment)
    : true
  const metaOk = expected.meta ? bytesEqual(hexToBytes(pkg.meta, 'package.meta'), expected.meta) : true

  return { hashOk, commitmentOk, metaOk, ok: hashOk && commitmentOk && metaOk }
}
