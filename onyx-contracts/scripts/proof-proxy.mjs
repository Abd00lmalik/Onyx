#!/usr/bin/env node
/**
 * Local CORS / Local-Network-Access proxy for the Midnight proof server.
 *
 * Chrome 138+ gates requests from public origins (e.g. the deployed
 * https://onyx-market.vercel.app) to loopback targets behind a Local Network
 * Access permission, and older Private-Network-Access checks additionally
 * require `Access-Control-Allow-Private-Network: true` on CORS preflights.
 * The stock proof-server image (midnightntwrk/proof-server) emits neither,
 * so this proxy wraps 127.0.0.1:6300 and adds them.
 *
 *   usage: node scripts/proof-proxy.mjs [--port 6301] [--target http://127.0.0.1:6300]
 *
 * Then point the frontend at it with VITE_PROOF_SERVER_URL=http://localhost:6301
 */
import http from 'node:http'

const args = process.argv.slice(2)
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const PORT = Number(arg('port', '6301'))
const TARGET = new URL(arg('target', 'http://127.0.0.1:6300'))
const t0 = Date.now()
const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`
const log = (...a) => console.log(`[proof-proxy ${ts()}]`, ...a)

/** Mirror-origin CORS headers, including the LNA/PNA grants the stock image omits. */
function corsHeaders(req) {
  const origin = req.headers.origin
  const headers = {
    'access-control-allow-methods':
      'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, CONNECT, TRACE',
    'access-control-allow-headers': req.headers['access-control-request-headers'] || 'content-type',
    'access-control-max-age': '3600',
    'access-control-allow-credentials': 'true',
    // Private Network Access (Chrome 98+) opt-in:
    'access-control-allow-private-network': 'true',
  }
  if (origin) headers['access-control-allow-origin'] = origin
  headers['vary'] = 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers, Access-Control-Request-Private-Network'
  return headers
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)

  if (req.method === 'OPTIONS') {
    log(`OPTIONS ${url.pathname} origin=${req.headers.origin ?? '-'} pna=${req.headers['access-control-request-private-network'] ?? '-'}`)
    res.writeHead(204, corsHeaders(req))
    res.end()
    return
  }

  log(`${req.method} ${url.pathname}`)
  const proxied = http.request(
    {
      hostname: TARGET.hostname,
      port: TARGET.port,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: TARGET.host },
    },
    upstream => {
      const outHeaders = { ...upstream.headers, ...corsHeaders(req) }
      res.writeHead(upstream.statusCode ?? 502, outHeaders)
      upstream.pipe(res)
    },
  )
  proxied.on('error', err => {
    log(`upstream error: ${err.message}`)
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain', ...corsHeaders(req) })
    }
    res.end(`proof proxy upstream error: ${err.message}`)
  })
  // Stream request body through untouched (prove payloads can be large).
  req.pipe(proxied)
})

server.listen(PORT, '127.0.0.1', () => {
  log(`listening on http://127.0.0.1:${PORT} -> ${TARGET.origin}`)
})
