/**
 * Phase 4 UI check: boots Vite, walks every route in Chromium and asserts the
 * rendered pages come from SDK state rather than mock data.
 *
 *   npm run test:ui
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const PORT = 5175
const BASE = `http://localhost:${PORT}`
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let failed = 0
const pass = (name) => console.log(`  PASS  ${name}`)
const fail = (name, detail) => {
  failed++
  console.error(`  FAIL  ${name}`)
  if (detail) console.error(`        ${detail}`)
}
const check = (name, ok, detail) => (ok ? pass(name) : fail(name, detail))

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

const MOCK_MARKERS = [
  'Health Records: Cardiovascular',
  'Satellite Imagery: Agriculture',
  'MOCK_LISTINGS',
  'MOCK_WALLET',
  '0x4f2a8b1c7d2e9f3a6b8c4e7d2f9a1c3b',
]

console.log('\nPhase 4 UI check\n')

// The dep optimizer cache does not track edits to aliased source files, so start clean.
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
  const isIgnored = (text) =>
    text.includes('favicon') ||
    text.includes('Download the React DevTools') ||
    text.includes('Failed to load resource') ||
    text.includes('net::ERR') ||
    text.includes('WebSocket')

  page.on('console', msg => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (isIgnored(text)) return
    consoleErrors.push(text)
    console.log(`        [console] ${text.slice(0, 300)}`)
  })
  page.on('pageerror', err => {
    const text = String(err)
    if (isIgnored(text)) return
    consoleErrors.push(text)
    console.log(`        [pageerror] ${text.slice(0, 300)}`)
  })

  const visit = async (route, { text, absent = [], waitFor, timeout = 45000 }) => {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout })
    try {
      await page.waitForFunction(
        needle => document.body.innerText.includes(needle),
        { timeout: 30000 },
        waitFor ?? text,
      )
    } catch {
      // fall through to the assertions, which report what is actually on screen
    }
    await sleep(800)
    const body = await page.evaluate(() => document.body.innerText)
    check(`${route} renders "${text}"`, body.includes(text), body.slice(0, 300).replace(/\n/g, ' | '))
    const shown = absent.filter(marker => body.includes(marker))
    check(`${route} shows no mock data`, shown.length === 0, shown.join(', '))
    return body
  }

  await visit('/', { text: 'Live marketplace metrics', absent: MOCK_MARKERS, waitFor: 'Connect Wallet' })
  const home = await page.evaluate(() => document.body.innerText)
  check('/ shows the wallet connect affordance', home.includes('Connect Wallet'))

  await visit('/browse', { text: 'Browse Marketplace', absent: MOCK_MARKERS, waitFor: 'Browse Marketplace' })
  const browse = await page.evaluate(() => document.body.innerText)
  check(
    '/browse shows listings or an empty state',
    browse.includes('No listings found') || browse.includes('View Details') || browse.includes('Loading listings'),
    browse.slice(0, 300).replace(/\n/g, ' | '),
  )

  await visit('/list', { text: 'List Your Data', absent: MOCK_MARKERS, waitFor: 'List Your Data' })
  const listHasConnect = await page.evaluate(() => document.body.innerText.includes('Connect Wallet'))
  check('/list asks for a wallet when disconnected', listHasConnect)

  await visit('/dashboard', { text: 'Dashboard', absent: MOCK_MARKERS, waitFor: 'Dashboard' })
  const dashboard = await page.evaluate(() => document.body.innerText)
  check(
    '/dashboard degrades gracefully without a wallet',
    dashboard.includes('Connect a Midnight wallet') || dashboard.includes('NIGHT Balance'),
    dashboard.slice(0, 300).replace(/\n/g, ' | '),
  )

  const fakeId = 'ab'.repeat(32)
  await visit(`/listing/${fakeId}`, { text: 'Listing not found', absent: MOCK_MARKERS, waitFor: 'Listing not found' })

  check('no console or page errors across routes', consoleErrors.length === 0, consoleErrors.slice(0, 5).join('\n        '))
} catch (err) {
  fail('UI check threw', err instanceof Error ? err.message : String(err))
} finally {
  if (browser) await browser.close().catch(() => {})
  vite.kill('SIGTERM')
}

console.log(failed === 0 ? '\nAll UI checks passed\n' : `\n${failed} check(s) failed\n`)
process.exit(failed === 0 ? 0 : 1)
