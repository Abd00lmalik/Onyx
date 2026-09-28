/**
 * Phase 3 package test - run with: npm run test:package
 *
 * Pure checks only (no chain access): hashing, the data commitment against the
 * compiled contract's own implementation, package create/open, tamper and
 * wrong-key rejection, X25519 recipient wrapping, serialisation, and the
 * verification report a buyer uses after delivery.
 */
import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto'

import { bytesToHex, encodeMeta, hexToBytes, utf8ToBytes } from '../src/lib/hex.ts'
import {
  PACKAGE_VERSION,
  computeDataCommitment,
  createPackage,
  generateRecipientKeys,
  hashData,
  openPackage,
  parsePackage,
  randomSalt,
  serializePackage,
  verifyPackage,
  wrapKeyForRecipient,
  type DataPackage,
} from '../src/lib/package.ts'

let passed = 0
let failed = 0

function check(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  PASS  ${name}`)
  } catch (err) {
    failed++
    console.error(`  FAIL  ${name}`)
    console.error(`        ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function checkAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`  PASS  ${name}`)
  } catch (err) {
    failed++
    console.error(`  FAIL  ${name}`)
    console.error(`        ${err instanceof Error ? err.message : String(err)}`)
  }
}

const assert = (cond: unknown, message: string) => {
  if (!cond) throw new Error(message)
}

const assertThrows = async (fn: () => Promise<unknown>, match: RegExp, message: string) => {
  try {
    await fn()
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err)
    assert(match.test(text), `${message}: unexpected error "${text}"`)
    return
  }
  throw new Error(`${message}: expected it to throw`)
}

const hex = (bytes: Uint8Array) => bytesToHex(bytes)

const randomHex32 = () => hex(new Uint8Array(nodeRandomBytes(32)))

const nodeSha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex')

console.log('\nPhase 3 package test\n')

/* 1. hashing ------------------------------------------------------------ */
await checkAsync('hashData matches node:crypto SHA-256', async () => {
  const vectors = [new Uint8Array(0), new Uint8Array([1, 2, 3]), new Uint8Array(nodeRandomBytes(1024))]
  for (const data of vectors) {
    assert(hex(await hashData(data)) === nodeSha256(data), `mismatch for ${data.length}-byte input`)
  }
})

/* 2. commitment vs the compiled contract -------------------------------- */
const contractModule = (await import('../src/generated/contract/index.js')) as unknown as {
  Contract: new (witnesses: Record<string, unknown>) => {
    _compute_data_commitment_0: (dataHash: Uint8Array, salt: Uint8Array) => Uint8Array
  }
}

const stubWitnesses = {
  local_secret_key: (ctx: { privateState: unknown }) => [ctx.privateState, new Uint8Array(32)],
  get_random_salt: (ctx: { privateState: unknown }) => [ctx.privateState, new Uint8Array(32)],
  store_listing_salt: (ctx: { privateState: unknown }) => [ctx.privateState, []],
}
const contract = new contractModule.Contract(stubWitnesses)

await checkAsync('computeDataCommitment matches the compiled contract on 5 random vectors', async () => {
  for (let i = 0; i < 5; i++) {
    const dataHash = new Uint8Array(nodeRandomBytes(32))
    const salt = new Uint8Array(nodeRandomBytes(32))
    const ours = computeDataCommitment(dataHash, salt)
    const theirs = contract._compute_data_commitment_0(dataHash, salt)
    assert(hex(ours) === hex(theirs), `vector ${i}: ours ${hex(ours)} != contract ${hex(theirs)}`)
    assert(ours.length === 32, `vector ${i}: expected 32-byte commitment`)
  }
})

await checkAsync('computeDataCommitment matches the contract for a fixed dataHash and salt', async () => {
  const dataHash = hexToBytes(nodeSha256(utf8ToBytes('onyx fixed vector')), 'dataHash')
  const salt = hexToBytes('11'.repeat(32), 'salt')
  assert(
    hex(computeDataCommitment(dataHash, salt)) === hex(contract._compute_data_commitment_0(dataHash, salt)),
    'fixed vector mismatch',
  )
})

check('commitment is hiding and binding (salt and dataHash both change it)', () => {
  const dataHash = new Uint8Array(nodeRandomBytes(32))
  const salt = new Uint8Array(nodeRandomBytes(32))
  const base = hex(computeDataCommitment(dataHash, salt))
  const otherSalt = hex(computeDataCommitment(dataHash, randomSalt()))
  const otherHash = hex(computeDataCommitment(new Uint8Array(nodeRandomBytes(32)), salt))
  assert(otherSalt !== base, 'changing the salt did not change the commitment')
  assert(otherHash !== base, 'changing dataHash did not change the commitment')
})

check('computeDataCommitment rejects inputs that are not 32 bytes', () => {
  let threw = 0
  try {
    computeDataCommitment(new Uint8Array(31), new Uint8Array(32))
  } catch {
    threw++
  }
  try {
    computeDataCommitment(new Uint8Array(32), new Uint8Array(16))
  } catch {
    threw++
  }
  assert(threw === 2, `expected 2 throws, got ${threw}`)
})

/* 3. package round trip -------------------------------------------------- */
const listingIdHex = randomHex32()
const salt = new Uint8Array(nodeRandomBytes(32))
const meta = encodeMeta({
  title: 'Census extract',
  description: 'Anonymised district counts',
  category: 'Public data',
  size: '12 KB',
  records: '4,318',
})
const payload = new Uint8Array(nodeRandomBytes(4096))

const created = await createPackage({ listingId: listingIdHex, data: payload, salt, meta })

await checkAsync('createPackage -> openPackage returns the original bytes', async () => {
  const opened = await openPackage(created.pkg, { dataKey: created.dataKey })
  assert(hex(opened) === hex(payload), 'plaintext does not match')
})

check('package carries the hash, salt, metadata and listing id', () => {
  assert(created.pkg.version === PACKAGE_VERSION, 'wrong version')
  assert(created.pkg.listingId === listingIdHex, 'listing id mismatch')
  assert(created.pkg.dataHash === nodeSha256(payload), 'dataHash mismatch')
  assert(created.pkg.salt === hex(salt), 'salt mismatch')
  assert(created.pkg.meta === hex(meta), 'meta mismatch')
  assert(created.pkg.wrap === null, 'raw package should not carry a wrapped key')
  assert(hexToBytes(created.pkg.cipher.ct, 'ct').length > payload.length, 'ciphertext shorter than plaintext')
})

await checkAsync('tampered ciphertext is rejected', async () => {
  const tampered: DataPackage = {
    ...created.pkg,
    cipher: { ...created.pkg.cipher, ct: flipHexByte(created.pkg.cipher.ct, 0) },
  }
  await assertThrows(() => openPackage(tampered, { dataKey: created.dataKey }), /wrong data key or tampered/i, 'tamper')
})

await checkAsync('wrong data key is rejected', async () => {
  const wrongKey = new Uint8Array(nodeRandomBytes(32))
  await assertThrows(() => openPackage(created.pkg, { dataKey: wrongKey }), /wrong data key or tampered/i, 'wrong key')
})

/* 4. recipient wrapping -------------------------------------------------- */
const alice = await generateRecipientKeys()
const mallory = await generateRecipientKeys()
const recipientPackage = await createPackage({ listingId: listingIdHex, data: payload, salt, meta })
recipientPackage.pkg.wrap = await wrapKeyForRecipient(
  recipientPackage.dataKey,
  alice.publicKey,
  hexToBytes(recipientPackage.pkg.listingId, 'listingId'),
)

await checkAsync('wrap -> unwrap -> open round-trips for the recipient', async () => {
  const opened = await openPackage(recipientPackage.pkg, { recipient: alice })
  assert(hex(opened) === hex(payload), 'plaintext does not match after unwrap')
})

check('recipient keys are 32-byte raw X25519 keys', () => {
  assert(alice.publicKey.length === 32, `public key is ${alice.publicKey.length} bytes`)
  assert(alice.secretKey.length === 32, `secret key is ${alice.secretKey.length} bytes`)
  assert(hex(alice.publicKey) !== hex(mallory.publicKey), 'keypairs are not distinct')
})

await checkAsync('a different recipient cannot open the package', async () => {
  await assertThrows(
    () => openPackage(recipientPackage.pkg, { recipient: mallory }),
    /not addressed to this key/i,
    'wrong recipient',
  )
})

await checkAsync('a package without a wrapped key refuses recipient opening', async () => {
  await assertThrows(() => openPackage(created.pkg, { recipient: alice }), /no wrapped key/i, 'no wrap')
})

await checkAsync('the key wrap is bound to the listing id', async () => {
  const relisted: DataPackage = { ...recipientPackage.pkg, listingId: randomHex32() }
  await assertThrows(() => openPackage(relisted, { recipient: alice }), /not addressed to this key/i, 'relisted id')
})

/* 5. serialisation ------------------------------------------------------- */
await checkAsync('serialize -> parse round-trips the package', async () => {
  const parsed = parsePackage(serializePackage(recipientPackage.pkg))
  assert(JSON.stringify(parsed) === JSON.stringify(recipientPackage.pkg), 'round trip changed the package')
  const opened = await openPackage(parsed, { recipient: alice })
  assert(hex(opened) === hex(payload), 'parsed package does not open')
})

await checkAsync('parse rejects an unknown version', async () => {
  const bumped = { ...recipientPackage.pkg, version: PACKAGE_VERSION + 1 }
  await assertThrows(async () => parsePackage(JSON.stringify(bumped)), /unsupported package version/i, 'version')
})

await checkAsync('parse rejects malformed JSON and wrong-length fields', async () => {
  await assertThrows(async () => parsePackage('not json'), /not valid json/i, 'malformed')
  await assertThrows(async () => parsePackage('[]'), /must be a JSON object/i, 'array')
  const shortHash = { ...recipientPackage.pkg, dataHash: 'ab' }
  await assertThrows(async () => parsePackage(JSON.stringify(shortHash)), /dataHash must be 32 bytes/i, 'short hash')
  const shortMeta = { ...recipientPackage.pkg, meta: '00' }
  await assertThrows(async () => parsePackage(JSON.stringify(shortMeta)), /meta must be 512 bytes/i, 'short meta')
  const badAlg = {
    ...recipientPackage.pkg,
    cipher: { ...recipientPackage.pkg.cipher, alg: 'AES-ECB' as 'AES-256-GCM' },
  }
  await assertThrows(async () => parsePackage(JSON.stringify(badAlg)), /AES-256-GCM/i, 'bad cipher')
})

/* 6. verification -------------------------------------------------------- */
const opened = await openPackage(recipientPackage.pkg, { recipient: alice })
const expectedCommitment = computeDataCommitment(hexToBytes(recipientPackage.pkg.dataHash, 'dataHash'), salt)

await checkAsync('verifyPackage passes a good delivery', async () => {
  const report = await verifyPackage(opened, recipientPackage.pkg, { dataCommitment: expectedCommitment, meta })
  assert(report.ok, `expected ok, got ${JSON.stringify(report)}`)
  assert(report.hashOk && report.commitmentOk && report.metaOk, 'every flag should be set')
})

await checkAsync('verifyPackage flags a wrong salt', async () => {
  const badSalt: DataPackage = { ...recipientPackage.pkg, salt: randomHex32() }
  const report = await verifyPackage(opened, badSalt, { dataCommitment: expectedCommitment })
  assert(report.ok === false && report.commitmentOk === false, `expected commitment failure, got ${JSON.stringify(report)}`)
  assert(report.hashOk, 'hash should still pass')
})

await checkAsync('verifyPackage flags tampered plaintext', async () => {
  const tampered = Uint8Array.from(opened)
  tampered[0] ^= 0xff
  const report = await verifyPackage(tampered, recipientPackage.pkg, { dataCommitment: expectedCommitment })
  assert(report.ok === false && report.hashOk === false, `expected hash failure, got ${JSON.stringify(report)}`)
  assert(report.commitmentOk, 'commitment is computed from the package, not the plaintext')
})

await checkAsync('verifyPackage flags a metadata mismatch', async () => {
  const report = await verifyPackage(opened, recipientPackage.pkg, {
    dataCommitment: expectedCommitment,
    meta: encodeMeta({ title: 'Something else', description: '', category: '', size: '', records: '' }),
  })
  assert(report.metaOk === false && report.ok === false, `expected meta failure, got ${JSON.stringify(report)}`)
})

await checkAsync('verifyPackage flags a foreign on-chain commitment', async () => {
  const report = await verifyPackage(opened, recipientPackage.pkg, {
    dataCommitment: new Uint8Array(nodeRandomBytes(32)),
  })
  assert(report.commitmentOk === false && report.ok === false, `expected commitment failure, got ${JSON.stringify(report)}`)
})

/* summary --------------------------------------------------------------- */
console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exitCode = 1

function flipHexByte(value: string, index: number): string {
  const bytes = hexToBytes(value, 'flip')
  bytes[index] ^= 0xff
  return hex(bytes)
}
