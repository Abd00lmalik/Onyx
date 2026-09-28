/**
 * Phase 6 UI E2E — strictly headless Chrome against the real frontend.
 *
 * Drives the built app (vite preview) through the full marketplace flow:
 *
 *   seller session  connect -> /list -> fill form -> upload CSV -> List Dataset
 *                   -> wait for "Listed on-chain" (prove + index + vault)
 *   buyer session   connect -> /browse -> open the new listing -> Buy This Dataset
 *                   -> Buy Now -> wait for sold state ("Confirm Delivery")
 *
 * The wallet comes from the local bridge (`onyx-contracts/scripts/e2e-bridge.ts`)
 * injected via `window.__ONYX_E2E__` — no Lace extension, all proving through
 * the local HTTP proof server, all state changes on-chain.
 *
 * Prereqs: npm run build (dist/), proof server on :6300, sample CSV at
 * ONYX_SAMPLE_CSV or OneDrive\Desktop\onyx-sample-dataset.csv.
 *
 * Usage: node scripts/phase6-ui-e2e.mjs
 */
import puppeteer from 'puppeteer'
import { spawn } from 'node:child_process'
import { openSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND = path.resolve(SCRIPT_DIR, '..')
const ROOT = path.resolve(FRONTEND, '..')
const ONYX = path.join(ROOT, 'onyx-contracts')
const ARTIFACTS = path.join(FRONTEND, '.e2e-artifacts')
const BRIDGE = 'http://127.0.0.1:8787'
const APP = 'http://localhost:4173'
const PROOF = 'http://127.0.0.1:6300'
const DATASET =
  process.env.ONYX_SAMPLE_CSV ??
  path.join(process.env.USERPROFILE ?? '', 'OneDrive', 'Desktop', 'onyx-sample-dataset.csv')
const TITLE = `Onyx Headless E2E ${new Date().toISOString().slice(0, 19)}`
const BRIDGE_READY_TIMEOUT = 20 * 60 * 1000

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const procs = []
let browser = null

function log(msg) {
  console.log(`[e2e ${new Date().toISOString().slice(11, 19)}] ${msg}`)
}

function fail(msg) {
  throw new Error(msg)
}

function spawnNode(cli, args, cwd, logFile) {
  const out = openSync(logFile, 'a')
  const child = spawn(process.execPath, [cli, ...args], { cwd, stdio: ['ignore', out, out] })
  procs.push(child)
  child.on('exit', code => log(`process exited (${path.basename(logFile)}): code=${code}`))
  return child
}

async function httpOk(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    return res.ok
  } catch {
    return false
  }
}

async function waitForBridgeReady() {
  const deadline = Date.now() + BRIDGE_READY_TIMEOUT
  let lastPhase = ''
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BRIDGE}/health`, { signal: AbortSignal.timeout(4000) })
      if (res.ok) {
        const health = await res.json()
        if (health.ready) return health
        if (health.phase !== lastPhase) {
          lastPhase = health.phase
          log(`bridge phase: ${health.phase}`)
        }
      }
    } catch {
      /* bridge not up yet */
    }
    await sleep(5000)
  }
  fail(`bridge not ready after ${BRIDGE_READY_TIMEOUT / 60000} min - see e2e-bridge.log`)
}

async function visibleErrors(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[class*="danger"]')]
      .filter(el => el.tagName !== 'BUTTON' && !el.closest('button'))
      .map(el => el.innerText?.trim())
      .filter(Boolean)
      .join(' | '),
  )
}

async function shot(page, name) {
  const file = path.join(ARTIFACTS, `${name}.png`)
  await page.screenshot({ path: file }).catch(() => {})
  log(`screenshot: ${name}.png`)
}

async function clickButton(page, text) {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    const clicked = await page.evaluate(t => {
      const el = [...document.querySelectorAll('button')].find(
        b => b.textContent.trim().includes(t) && !b.disabled,
      )
      if (!el) return false
      el.click()
      return true
    }, text)
    if (clicked) return
    await sleep(500)
  }
  await shot(page, 'fail-click')
  fail(`no clickable button containing "${text}"`)
}

async function newSession(wallet) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  page.setDefaultTimeout(60000)
  page.on('console', m => {
    if (m.type() === 'error') log(`[${wallet}] console.error: ${m.text()}`)
  })
  page.on('pageerror', e => log(`[${wallet}] pageerror: ${e.message}`))
  page.on('crash', () => log(`[${wallet}] PAGE CRASHED`))
  page.on('requestfailed', r => {
    const err = r.failure()?.errorText ?? 'failed'
    if (!r.url().includes('favicon')) log(`[${wallet}] requestfailed: ${err} ${r.url()}`)
  })
  await page.evaluateOnNewDocument(opts => {
    window.__ONYX_E2E__ = opts
  }, { bridge: BRIDGE, wallet: wallet === 'seller' ? 'deployer' : wallet })
  const cdp = await page.createCDPSession().catch(() => null)
  if (cdp) {
    await cdp
      .send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: ARTIFACTS })
      .catch(() => {})
  }
  return page
}

async function connect(page, wallet) {
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await clickButton(page, 'Connect Wallet')
  await page.waitForSelector('button[title="Disconnect"]', { timeout: 180000 })
  const summary = await page.evaluate(() => {
    const el = document.querySelector('button[title="Disconnect"]')
    const box = el?.closest('div')
    return box?.innerText ?? ''
  })
  if (!summary.includes('NIGHT')) fail(`[${wallet}] connected but no NIGHT balance shown: "${summary}"`)
  log(`[${wallet}] connected: ${summary.replace(/\s+/g, ' ')}`)
  await shot(page, `01-${wallet}-connected`)
}

/** Full page loads reset the React wallet context - reconnect when needed. */
async function ensureConnected(page) {
  if (await page.$('button[title="Disconnect"]')) return
  await clickButton(page, 'Connect Wallet')
  await page.waitForSelector('button[title="Disconnect"]', { timeout: 180000 })
}

async function listAsSeller(page) {
  await page.goto(`${APP}/list`, { waitUntil: 'domcontentloaded' })
  await ensureConnected(page)
  await page.waitForSelector('input[placeholder="e.g. Financial Market Data Q4"]')
  await page.type('input[placeholder="e.g. Financial Market Data Q4"]', TITLE)
  await page.type('textarea[placeholder="Describe your dataset..."]', 'Headless Chrome end-to-end dataset.')
  await page.type('input[step="0.000001"]', '0.01')
  await page.select('select', 'Finance')
  const fileInput = await page.$('input[type="file"]')
  if (!fileInput) fail('no file input on /list')
  await fileInput.uploadFile(DATASET)
  await shot(page, '02-list-form')
  await page.evaluate(() => document.querySelector('form button[type="submit"]')?.click())

  try {
    await page.waitForFunction(() => document.body.innerText.includes('Listed on-chain'), {
      timeout: 360000,
      polling: 3000,
    })
  } catch (e) {
    const errs = await visibleErrors(page)
    fail(`list did not reach "Listed on-chain" (${e?.message || e}) - page errors: ${errs || '(none visible)'}`)
  }
  log(`seller listed: "${TITLE}"`)
  await shot(page, '03-listed')
}

async function buyAsBuyer(page) {
  // DUST pays the buy fee; wait for a refill if the previous run drained it.
  const dustDeadline = Date.now() + 12 * 60 * 1000
  for (;;) {
    const dust = Number((await (await fetch(`${BRIDGE}/buyer/balances`)).json()).dust)
    if (dust >= 5e14) break
    if (Date.now() > dustDeadline) fail(`buyer dust never refilled (${dust})`)
    log(`buyer dust low (${dust}) - waiting for regeneration…`)
    await sleep(20000)
  }

  await page.goto(`${APP}/browse`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(t => document.body.innerText.includes(t), { timeout: 120000, polling: 2000 }, TITLE)

  const opened = await page.evaluate(t => {
    const span = [...document.querySelectorAll('span')].find(s => s.textContent.trim() === t)
    const card = span?.closest('div[class*="cursor-pointer"]') ?? span
    if (!card) return false
    card.click()
    return true
  }, TITLE)
  if (!opened) fail(`could not find listing card for "${TITLE}"`)
  await page.waitForFunction(() => location.pathname.startsWith('/listing/'), { timeout: 30000 })
  await ensureConnected(page)
  await page.waitForFunction(t => document.body.innerText.includes(t), { timeout: 60000, polling: 2000 }, 'Buy This Dataset')
  await shot(page, '04-detail')
  await clickButton(page, 'Buy This Dataset')
  await page.waitForFunction(() => document.body.innerText.includes('Purchase Dataset'), { timeout: 30000 })
  await shot(page, '05-buy-dialog')
  await clickButton(page, 'Buy Now')

  // Buy Now proves, submits, then polls the indexer for `sold`; the dialog
  // closes only on success and keeps showing the error box on failure.
  const deadline = Date.now() + 300000
  let dialogClosedAt = 0
  let bought = false
  let errStrikes = 0
  while (Date.now() < deadline) {
    const snap = await page.evaluate(() => ({
      dialog: document.body.innerText.includes('Purchase Dataset'),
      confirm: document.body.innerText.includes('Confirm Delivery'),
      // Real error boxes only - destructive buttons share the danger class.
      errors: [...document.querySelectorAll('[class*="danger"]')]
        .filter(el => el.tagName !== 'BUTTON' && !el.closest('button'))
        .map(el => el.innerText?.trim())
        .filter(Boolean)
        .join(' | '),
    }))
    if (!snap.dialog && snap.confirm) {
      bought = true
      break
    }
    if (snap.dialog && snap.errors) {
      errStrikes++
      if (errStrikes >= 2) {
        await shot(page, '06-buy-error')
        fail(`buy dialog reported an error: ${snap.errors}`)
      }
    } else {
      errStrikes = 0
    }
    if (!snap.dialog) {
      if (!dialogClosedAt) {
        dialogClosedAt = Date.now()
        log('buy dialog closed - waiting for the sold state to render')
      } else if (Date.now() - dialogClosedAt > 20000) {
        await page.reload({ waitUntil: 'domcontentloaded' })
        dialogClosedAt = 0
        log('reloading detail page for the sold state')
      }
    }
    await sleep(3000)
  }
  if (!bought) {
    const errs = await visibleErrors(page)
    fail(`buy did not reach the sold state - page errors: ${errs || '(none visible)'}`)
  }

  log('buyer purchase confirmed: sold state with "Confirm Delivery" visible')
  await shot(page, '06-bought')
}

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true })

  const { existsSync } = await import('node:fs')
  if (!existsSync(path.join(FRONTEND, 'dist', 'index.html'))) {
    fail('frontend/dist missing - run `npm run build` first')
  }
  if (!existsSync(DATASET)) fail(`sample CSV not found at ${DATASET}`)

  if (await httpOk(`${BRIDGE}/health`)) {
    log('bridge already running - reusing')
  } else {
    log('starting bridge…')
    spawnNode(path.join(ONYX, 'node_modules', 'tsx', 'dist', 'cli.mjs'), ['scripts/e2e-bridge.ts'], ONYX, path.join(ARTIFACTS, 'bridge.log'))
  }
  if (!(await httpOk(PROOF))) fail(`proof server not responding at ${PROOF}`)
  if (await httpOk(APP)) {
    log('vite preview already running - reusing')
  } else {
    log('starting vite preview…')
    spawnNode(path.join(FRONTEND, 'node_modules', 'vite', 'bin', 'vite.js'), ['preview', '--port', '4173', '--strictPort'], FRONTEND, path.join(ARTIFACTS, 'preview.log'))
    await waitForHttp(APP, 60000, 'vite preview')
  }

  const health = await waitForBridgeReady()
  log(`bridge ready - seller=${health.deployer.address.slice(0, 20)}… buyer=${health.buyer.address.slice(0, 20)}…`)

  // Windows resolves localhost to ::1 first; the proof server binds IPv4 only.
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--host-resolver-rules=MAP localhost 127.0.0.1'],
  })

  const seller = await newSession('seller')
  await connect(seller, 'seller')
  await listAsSeller(seller)

  const buyer = await newSession('buyer')
  await connect(buyer, 'buyer')
  await buyAsBuyer(buyer)

  log('PASS: list + buy completed through the real frontend in headless Chrome')
}

async function waitForHttp(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await httpOk(url)) return
    await sleep(1000)
  }
  fail(`timed out waiting for ${label} (${url})`)
}

async function cleanup() {
  if (browser) await browser.close().catch(() => {})
  for (const p of procs) {
    try {
      p.kill()
    } catch {
      /* already gone */
    }
  }
}

main()
  .then(async () => {
    await cleanup()
    process.exit(0)
  })
  .catch(async err => {
    console.error(`[e2e] FAIL: ${err.message ?? err}`)
    await cleanup()
    process.exit(1)
  })
