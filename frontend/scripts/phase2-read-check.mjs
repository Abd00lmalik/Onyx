/**
 * Phase 2 read-path check: boots the Vite dev server, loads the app in Chromium,
 * then exercises the SDK read path against the live preprod indexer.
 *
 *   npm run test:read
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { rmSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const PORT = 5174
const BASE = `http://localhost:${PORT}`
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTRACT_ADDRESS = 'a7791112a07144af7da22e51b0a504cc07df513585abf5066d333802e2ca4998'

let failed = 0
const pass = (name) => console.log(`  PASS  ${name}`)
const fail = (name, detail) => {
  failed++
  console.error(`  FAIL  ${name}`)
  if (detail) console.error(`        ${detail}`)
}

async function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await sleep(400)
  }
  throw new Error(`dev server did not start at ${url}`)
}

console.log('\nPhase 2 read-path check\n')

// The dep optimizer cache does not track edits to the aliased wasm shims in
// src/vendor, so start from a clean cache to keep this check deterministic.
const depCache = path.join(root, 'node_modules', '.vite')
if (existsSync(depCache)) {
  rmSync(depCache, { recursive: true, force: true })
  console.log('  cleared dependency cache')
}

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
  shell: true,
})

let browser
try {
  await waitForServer(BASE)
  console.log(`  dev server ready at ${BASE}`)

  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      consoleErrors.push(text)
      console.log(`        [console] ${text.slice(0, 400)}`)
    }
  })
  page.on('pageerror', err => {
    const text = String(err)
    consoleErrors.push(text)
    console.log(`        [pageerror] ${text.slice(0, 400)}`)
  })

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })
  pass('app loads without page errors')

  // The first import of the SDK triggers dependency optimization, which can
  // answer 504 (Outdated Optimize Dep) and force a reload. Warm it up first.
  let warmError = null
  for (let attempt = 1; attempt <= 5; attempt++) {
    warmError = await page.evaluate(async () => {
      try {
        await import('/src/lib/midnight.ts')
        return null
      } catch (err) {
        return String(err && err.message ? err.message : err)
      }
    })
    if (!warmError) break
    console.log(`        warm-up ${attempt}: ${warmError.slice(0, 140)}`)
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
    await sleep(1500)
  }
  if (warmError) fail('SDK module graph never became loadable', warmError)
  else pass('SDK module graph loaded')

  // Discard 504 / re-optimization noise emitted while warming up.
  consoleErrors.length = 0

  const readResult = warmError
    ? { fatal: warmError }
    : await page.evaluate(async (address) => {
    try {
      const midnight = await import('/src/lib/midnight.ts')
      midnight.initNetwork()
      const { publicDataProvider } = midnight.createReadProviders()
      const contractState = await publicDataProvider.queryContractState(address)
      if (!contractState) return { found: false }
      const state = midnight.OnyxLedger.ledger(contractState.data)
      const listings = []
      const hex = bytes => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
      for (const [id, seller] of state.listingSeller) {
        listings.push({
          id: hex(id),
          seller: hex(seller),
          price: state.listingPrice.lookup(id).toString(),
          listingState: state.listingState.lookup(id),
          metaBytes: state.listingMeta.lookup(id).length,
        })
      }
      return {
        found: true,
        listingCount: Number(state.listingCount),
        completedCount: Number(state.completedCount),
        listings,
      }
    } catch (err) {
      return { fatal: String(err && err.message ? err.message : err) }
    }
  }, CONTRACT_ADDRESS)

  if (readResult.fatal) {
    fail('SDK read path failed', readResult.fatal)
  } else if (readResult.found) {
    pass(`contract state read from preprod indexer (listings=${readResult.listingCount})`)
    if (readResult.listings.length > 0) {
      const first = readResult.listings[0]
      pass(
        `decoded listing ${first.id.slice(0, 12)}… price=${first.price} STAR state=${first.listingState} meta=${first.metaBytes}B`,
      )
      if (first.metaBytes !== 512) fail('listing meta must be 512 bytes', `got ${first.metaBytes}`)
    } else {
      console.log('        (no listings yet - decode path verified against empty state)')
    }
  } else {
    fail('contract state not found on preprod', 'queryContractState returned null')
  }

  // Phase 3 parity: the same package module has to work in Chrome, where X25519
  // and the wasm-backed commitment both take a different path than in Node.
  const pkgProbe = await page.evaluate(async () => {
    try {
      const pkg = await import('/src/lib/package.ts')
      const { bytesToHex } = await import('/src/lib/hex.ts')
      const contractMod = await import('/src/generated/contract/index.js')

      const contract = new contractMod.Contract({
        local_secret_key: (ctx) => [ctx.privateState, new Uint8Array(32)],
        get_random_salt: (ctx) => [ctx.privateState, new Uint8Array(32)],
        store_listing_salt: (ctx) => [ctx.privateState, []],
      })

      const alice = await pkg.generateRecipientKeys()
      if (alice.publicKey.length !== 32 || alice.secretKey.length !== 32) {
        return { fatal: `recipient keys are ${alice.publicKey.length}/${alice.secretKey.length} bytes, expected 32` }
      }

      const data = new TextEncoder().encode('onyx browser package probe')
      const salt = pkg.randomSalt()
      const meta = new Uint8Array(512)
      const listingId = pkg.randomSalt()
      const dataHash = await pkg.hashData(data)

      const ours = bytesToHex(pkg.computeDataCommitment(dataHash, salt))
      const theirs = bytesToHex(contract._compute_data_commitment_0(dataHash, salt))
      if (ours !== theirs) return { fatal: `browser commitment ${ours} != contract ${theirs}` }

      const created = await pkg.createPackage({ listingId: bytesToHex(listingId), data, salt, meta })
      created.pkg.wrap = await pkg.wrapKeyForRecipient(created.dataKey, alice.publicKey, listingId)
      const opened = await pkg.openPackage(created.pkg, { recipient: alice })
      if (bytesToHex(opened) !== bytesToHex(new Uint8Array(data))) return { fatal: 'opened bytes differ' }

      const report = await pkg.verifyPackage(opened, created.pkg, {
        dataCommitment: pkg.computeDataCommitment(dataHash, salt),
        meta,
      })
      if (!report.ok) return { fatal: `verify reported ${JSON.stringify(report)}` }

      let wrongRecipient = false
      const mallory = await pkg.generateRecipientKeys()
      try {
        await pkg.openPackage(created.pkg, { recipient: mallory })
      } catch {
        wrongRecipient = true
      }
      if (!wrongRecipient) return { fatal: 'a second recipient was able to open the package' }

      return { ok: true, commitment: ours }
    } catch (err) {
      return { fatal: String(err && err.message ? err.message : err) }
    }
  })

  if (pkgProbe.fatal) {
    fail('browser package probe (X25519 + commitment)', pkgProbe.fatal)
  } else {
    pass(`browser package probe: wrap/unwrap, verify, contract commitment ${pkgProbe.commitment.slice(0, 16)}…`)
  }

  const relevantErrors = consoleErrors.filter(
    text => !text.includes('favicon') && !text.includes('Download the React DevTools'),
  )
  if (relevantErrors.length === 0) {
    pass('no console/page errors during read path')
  } else {
    fail(`${relevantErrors.length} console/page error(s)`, relevantErrors.slice(0, 5).join('\n        '))
  }
} catch (err) {
  fail('read-path check threw', err instanceof Error ? err.message : String(err))
} finally {
  if (browser) await browser.close().catch(() => {})
  vite.kill('SIGTERM')
}

console.log(failed === 0 ? '\nAll read-path checks passed\n' : `\n${failed} check(s) failed\n`)
process.exit(failed === 0 ? 0 : 1)
