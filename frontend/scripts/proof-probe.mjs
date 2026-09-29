/**
 * Diagnostic: reproduce the "'check' returned an error: TypeError: Failed to fetch"
 * failure seen on the deployed Vercel site. Loads the live origin in headless
 * Chrome and attempts the same cross-origin proof-server calls the app makes,
 * capturing CDP Network evidence (LNA/PNA preflight, CORS, mixed content).
 *
 * Usage: node scripts/proof-probe.mjs [origin] [proofUrl]
 *   origin    default https://onyx-market.vercel.app
 *   proofUrl  default http://localhost:6300  (what the deployed bundle bakes in)
 */
import puppeteer from 'puppeteer'

const ORIGIN = process.argv[2] || 'https://onyx-market.vercel.app'
const PROOF = process.argv[3] || 'http://localhost:6300'

const t0 = Date.now()
const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`
const log = (...a) => console.log(`[probe ${ts()}]`, ...a)

const events = []

async function main() {
  log('launching headless chrome')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)

  const cdp = await page.createCDPSession()
  await cdp.send('Network.enable')
  cdp.on('Network.requestWillBeSent', e => {
    if (/6300|check|prove/.test(e.request.url)) {
      events.push({ type: 'request', method: e.request.method, url: e.request.url, headers: e.request.headers })
      log(`REQ  ${e.request.method} ${e.request.url}`)
    }
  })
  cdp.on('Network.responseReceived', e => {
    if (/6300|check|prove/.test(e.response.url)) {
      events.push({
        type: 'response',
        url: e.response.url,
        status: e.response.status,
        headers: e.response.headers,
        fromDiskCache: e.response.fromDiskCache,
      })
      log(`RESP ${e.response.status} ${e.response.url}`)
      log(`     headers: ${JSON.stringify(e.response.headers)}`)
    }
  })
  cdp.on('Network.loadingFailed', e => {
    // loadingFailed doesn't carry the URL; correlate by request id in events if needed
    events.push({ type: 'failed', errorText: e.errorText, blockedReason: e.blockedReason, canceled: e.canceled })
    log(`FAIL errorText=${e.errorText} blockedReason=${e.blockedReason ?? '-'} canceled=${e.canceled ?? '-'}`)
  })

  page.on('console', m => {
    const text = m.text()
    if (/mixed|LNA|local network|private network|CORS|Failed to fetch|content security/i.test(text)) {
      log(`console.${m.type()}: ${text.slice(0, 300)}`)
    }
  })
  page.on('pageerror', e => log(`pageerror: ${e.message}`))

  log(`goto ${ORIGIN}/list`)
  await page.goto(`${ORIGIN}/list`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  log('page loaded:', await page.title())

  // 1) The real failing call: POST /check with a non-simple header (forces CORS preflight,
  //    which is also where LNA injects Access-Control-Request-Private-Network).
  const checkResult = await page.evaluate(async url => {
    try {
      const res = await fetch(`${url}/check`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'probe',
      })
      const text = await res.text().catch(() => '')
      return { ok: true, status: res.status, body: text.slice(0, 200) }
    } catch (err) {
      return { ok: false, error: String(err), message: err?.message ?? '' }
    }
  }, PROOF)
  log('POST /check ->', JSON.stringify(checkResult))

  // 2) Simple GET to /health for comparison (no custom headers, still LNA-gated).
  const healthResult = await page.evaluate(async url => {
    try {
      const res = await fetch(`${url}/health`, { cache: 'no-store' })
      return { ok: true, status: res.status }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }, PROOF)
  log('GET /health ->', JSON.stringify(healthResult))

  // 3) What is the loopback address space result in the security panel?
  const lna = await page.evaluate(async () => {
    // navigator.permissions for local-network-access (Chrome 138+); may be undefined.
    try {
      if (navigator.permissions?.query) {
        const st = await navigator.permissions.query({ name: 'local-network-access' }).catch(() => null)
        if (st) return { state: st.state }
      }
    } catch {}
    return { state: 'unsupported' }
  }, PROOF)
  log('local-network-access permission:', JSON.stringify(lna))

  log('--- event summary ---')
  for (const e of events) log(JSON.stringify(e))

  await browser.close()

  const verdict = checkResult.ok
    ? `REACHED SERVER (HTTP ${checkResult.status}) — NOT blocked client-side`
    : `CLIENT BLOCKED: ${checkResult.error}`
  log('VERDICT:', verdict)
}

main().catch(err => {
  console.error('[probe] fatal:', err)
  process.exit(1)
})
