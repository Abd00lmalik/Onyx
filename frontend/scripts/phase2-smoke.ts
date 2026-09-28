/**
 * Phase 2 smoke test - run with: npm run test:smoke
 *
 * Pure checks only (no chain access): password policy, bech32m address decoding,
 * metadata encoding, hex helpers, generated contract module loading, and that every
 * circuit in contract-info.json has its ZK artifacts synced into public/.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { validatePassword } from '@midnight-ntwrk/midnight-js-utils'
import {
  META_MAX_BYTES,
  addressBytesToBech32m,
  bech32mToAddressBytes,
  bytesToHex,
  decodeMeta,
  encodeMeta,
  hexToBytes,
  toAddressBytes,
} from '../src/lib/hex.ts'
import { generatePassword } from '../src/lib/secure-password.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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

const DEPLOYER_BECH32M =
  'mn_addr_preprod1xra3cc9jxvnjk7l9q8wauxh3mztqvm9yze7u9a2mq6f94ztkxmvqaupl0x'

console.log('\nPhase 2 smoke test\n')

/* 1. private state password policy --------------------------------------- */
check('generated password satisfies validatePassword', () => {
  for (let i = 0; i < 5; i++) {
    const pw = generatePassword()
    assert(pw.length >= 16, `password too short: ${pw.length}`)
    validatePassword(pw)
  }
})

/* 2. bech32m address decoding -------------------------------------------- */
check('bech32m test vector decodes to 32 bytes', () => {
  const bytes = bech32mToAddressBytes(DEPLOYER_BECH32M, 'addr')
  assert(bytes.length === 32, `expected 32 bytes, got ${bytes.length}`)
  assert(bytesToHex(bytes).length === 64, 'hex encoding must be 64 chars')
})

check('bech32m encode/decode round-trips exactly', () => {
  const bytes = bech32mToAddressBytes(DEPLOYER_BECH32M, 'addr')
  const reencoded = addressBytesToBech32m(bytes, 'preprod')
  assert(reencoded === DEPLOYER_BECH32M, `${reencoded} !== ${DEPLOYER_BECH32M}`)
})

check('bech32m rejects a corrupted checksum', () => {
  const corrupted = `${DEPLOYER_BECH32M.slice(0, -1)}q`
  let threw = false
  try {
    bech32mToAddressBytes(corrupted, 'addr')
  } catch {
    threw = true
  }
  assert(threw, 'corrupted address should throw')
})

/* 3. metadata encoding ---------------------------------------------------- */
check('metadata round-trips through Bytes<512>', () => {
  const meta = {
    title: 'Health Records: Cardiovascular',
    description: 'Anonymized cardiovascular patient records'.repeat(4),
    category: 'Healthcare',
    size: '2.4 GB',
    records: '48,200',
  }
  const encoded = encodeMeta(meta)
  assert(encoded.length === META_MAX_BYTES, `expected ${META_MAX_BYTES} bytes`)
  const decoded = decodeMeta(encoded)
  assert(decoded.title === meta.title, `title mismatch: ${decoded.title}`)
  assert(decoded.description === meta.description, 'description mismatch')
  assert(decoded.category === meta.category, 'category mismatch')
  assert(decoded.size === meta.size, 'size mismatch')
  assert(decoded.records === meta.records, 'records mismatch')
})

check('oversized metadata is rejected', () => {
  let threw = false
  try {
    encodeMeta({ title: 'x'.repeat(600), description: '', category: '', size: '', records: '' })
  } catch {
    threw = true
  }
  assert(threw, 'metadata over 512 bytes should throw')
})

check('zero-padded and empty metadata decode safely', () => {
  const empty = decodeMeta(new Uint8Array(META_MAX_BYTES))
  assert(empty.title === '' && empty.description === '', 'empty meta should decode to empty fields')
})

/* 4. hex helpers ---------------------------------------------------------- */
check('hex helpers validate shape', () => {
  const vectorBytes = bech32mToAddressBytes(DEPLOYER_BECH32M, 'addr')
  const bytes = toAddressBytes(bytesToHex(vectorBytes), 'deployer address')
  assert(bytes.length === 32, 'expected 32 bytes')
  assert(bytesToHex(hexToBytes(bytesToHex(bytes))) === bytesToHex(bytes), 'hex round-trip failed')

  let threw = false
  try {
    toAddressBytes('abcd', 'listing id')
  } catch {
    threw = true
  }
  assert(threw, 'short address must be rejected')

  threw = false
  try {
    hexToBytes('abc', 'odd')
  } catch {
    threw = true
  }
  assert(threw, 'odd-length hex must be rejected')
})

/* 5. generated contract module ------------------------------------------- */
await checkAsync('generated contract module loads and exposes ledger()', async () => {
  const mod = await import('../src/generated/contract/index.js')
  assert(typeof mod.ledger === 'function', 'ledger export missing')
  assert(typeof mod.Contract === 'function', 'Contract export missing')
  assert(mod.ListingState.active === 0, 'ListingState.active should be 0')
  assert(mod.ListingState.completed === 3, 'ListingState.completed should be 3')
})

check('public/ copy of the contract matches src/generated/', () => {
  const a = readFileSync(path.join(root, 'public/zk-artifacts/contract/index.js'))
  const b = readFileSync(path.join(root, 'src/generated/contract/index.js'))
  const hash = (buf: Buffer) => createHash('sha256').update(buf).digest('hex')
  assert(hash(a) === hash(b), 'contract copies drifted - re-run the artifact sync')
})

/* 6. contract-info agrees with the frontend wrappers ---------------------- */
check('contract-info.json matches the frontend wrappers', () => {
  const infoPath = path.join(root, 'public/zk-artifacts/contract-info.json')
  assert(existsSync(infoPath), 'contract-info.json missing')
  const info = JSON.parse(readFileSync(infoPath, 'utf8')) as {
    'runtime-version': string
    circuits: { name: string; arguments: { name: string; type: { 'type-name': string; length?: number } }[] }[]
  }

  assert(
    info['runtime-version'] === '0.16.0',
    `artifacts expect runtime ${info['runtime-version']}, frontend pins 0.16.0`,
  )

  const byName = new Map(info.circuits.map(circuit => [circuit.name, circuit]))
  const typeOf = (arg: { type: { 'type-name': string; length?: number } }) =>
    arg.type['type-name'] === 'Bytes' ? `Bytes<${arg.type.length}>` : arg.type['type-name']

  const expected: Record<string, string[]> = {
    listData: ['Bytes<32>', 'Uint', 'Bytes<512>', 'Bytes<32>'],
    buyListing: ['Bytes<32>', 'Bytes<32>'],
    confirmDelivery: ['Bytes<32>'],
    disputeListing: ['Bytes<32>'],
    resolveDispute: ['Bytes<32>', 'Boolean'],
  }
  for (const [name, args] of Object.entries(expected)) {
    const circuit = byName.get(name)
    assert(circuit, `circuit ${name} missing from contract-info.json`)
    const actual = circuit.arguments.map(typeOf)
    assert(
      JSON.stringify(actual) === JSON.stringify(args),
      `${name}(${actual.join(', ')}) !== expected (${args.join(', ')})`,
    )
  }
})

/* 7. ZK artifacts present for every circuit ------------------------------ */
check('every circuit has prover/verifier/zkir artifacts', () => {
  const infoPath = path.join(root, 'public/zk-artifacts/contract-info.json')
  assert(existsSync(infoPath), 'contract-info.json missing')
  const info = JSON.parse(readFileSync(infoPath, 'utf8')) as {
    circuits: { name: string }[]
  }
  const circuits = info.circuits.map(circuit => circuit.name)
  assert(circuits.length >= 15, `expected >=15 circuits, found ${circuits.length}`)

  const missing: string[] = []
  for (const circuit of circuits) {
    for (const rel of [
      `keys/${circuit}.prover`,
      `keys/${circuit}.verifier`,
      `zkir/${circuit}.bzkir`,
      `zkir/${circuit}.zkir`,
    ]) {
      if (!existsSync(path.join(root, 'public/zk-artifacts', rel))) missing.push(rel)
    }
  }
  assert(missing.length === 0, `missing artifacts: ${missing.join(', ')}`)
  console.log(`        checked ${circuits.length} circuits`)
})

/* summary ---------------------------------------------------------------- */
console.log(`\n${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
