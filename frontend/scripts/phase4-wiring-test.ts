/**
 * Phase 4 wiring test: static assertions that the view layer talks to the real
 * SDK instead of mock data.
 *
 *   npm run test:wiring
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = path.join(root, 'src')

let failed = 0
const pass = (name: string) => console.log(`  PASS  ${name}`)
const fail = (name: string, detail?: string) => {
  failed++
  console.error(`  FAIL  ${name}`)
  if (detail) console.error(`        ${detail}`)
}
const check = (name: string, ok: boolean, detail?: string) => (ok ? pass(name) : fail(name, detail))

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

const files = walk(srcRoot)
const sources = new Map<string, string>()
for (const file of files) sources.set(path.relative(srcRoot, file).replace(/\\/g, '/'), readFileSync(file, 'utf8'))

const rel = (name: string) => name.replace(/\\/g, '/')
const read = (name: string) => {
  const content = sources.get(rel(name))
  if (content === undefined) throw new Error(`missing file src/${rel(name)}`)
  return content
}
const anySource = (pattern: RegExp) => [...sources.entries()].filter(([, text]) => pattern.test(text))

console.log('\nPhase 4 wiring test\n')

check('src/lib/mockData.ts is deleted', !existsSync(path.join(srcRoot, 'lib', 'mockData.ts')))

const mockImporters = anySource(/mockData/)
check('no file references mockData', mockImporters.length === 0, mockImporters.map(([f]) => f).join(', '))

const mockConsts = anySource(/MOCK_/)
check('no MOCK_ constants remain', mockConsts.length === 0, mockConsts.map(([f]) => f).join(', '))

check(
  'no formatDust left, formatNight is the price formatter',
  anySource(/formatDust/).length === 0 && /export function formatNight/.test(read('lib/format.ts')),
)

const fakeDelays = [...sources.entries()].filter(
  ([name, text]) => (name.startsWith('components/') || name.startsWith('pages/')) && /new Promise\(resolve => setTimeout\(resolve,/.test(text),
)
check('no fake setTimeout delays in components/pages', fakeDelays.length === 0, fakeDelays.map(([f]) => f).join(', '))

const randomHex = anySource(/0123456789abcdef'\[Math\.floor/)
check('no randomly generated transaction hashes', randomHex.length === 0, randomHex.map(([f]) => f).join(', '))

const listingDefs = anySource(/export (interface Listing|type ListingState) /)
check(
  'Listing/ListingState are defined once, in src/types/index.ts',
  listingDefs.length === 1 && listingDefs[0][0] === 'types/index.ts',
  listingDefs.map(([f]) => f).join(', '),
)

check('AppProvider wraps the app', /<AppProvider>/.test(read('App.tsx')))

const wallet = read('components/wallet/WalletConnect.tsx')
check('WalletConnect consumes the shared context', /useApp\(\)/.test(wallet))
check('WalletConnect calls the real connect/disconnect', /wallet\.connect\(/.test(wallet) && /wallet\.disconnect/.test(wallet))
check('WalletConnect shows real balances', /formatNight\(wallet\.balance\)/.test(wallet))

for (const page of ['pages/HomePage.tsx', 'pages/BrowsePage.tsx', 'pages/DashboardPage.tsx', 'pages/ListingDetailPage.tsx']) {
  check(`${page} reads SDK state`, /useApp\(\)/.test(read(page)))
}

const buyDialog = read('components/marketplace/BuyDialog.tsx')
check('BuyDialog takes a real onConfirm', /onConfirm: \(\) => Promise<void>/.test(buyDialog))
check('BuyDialog has no fake purchase timer', !/setTimeout\(resolve, 2000\)/.test(buyDialog))

const form = read('components/marketplace/ListDataForm.tsx')
check('ListDataForm converts NIGHT to STAR', /nightToStar\(price\)/.test(form))
check('ListDataForm encrypts the file before submitting', /hashData\(/.test(form) && /createPackage\(/.test(form))
check('ListDataForm downloads the seller vault', /serializeVault\(/.test(form) && /onyx-vault\.json/.test(form))
check('ListDataForm price label says NIGHT', /Price \(NIGHT\)/.test(form) && !/Price \(DUST\)/.test(form))

const priceLabels = ['components/marketplace/ListingCard.tsx', 'components/marketplace/BuyDialog.tsx', 'pages/ListingDetailPage.tsx']
for (const file of priceLabels) {
  const text = read(file)
  check(`${rel(file)} prices in NIGHT`, /formatNight\(listing\.price\)/.test(text) && !/DUST/.test(text))
}

const detail = read('pages/ListingDetailPage.tsx')
for (const circuit of ['buyListing', 'confirmDelivery', 'disputeListing']) {
  check(`ListingDetailPage calls ${circuit}`, new RegExp(`contract\\.${circuit}\\(`).test(detail))
}
check('ListingDetailPage polls until the state changes', /waitForState\(/.test(detail))

const delivery = read('components/marketplace/DeliveryPanel.tsx')
for (const fn of ['generateRecipientKeys', 'unwrapKeyForRecipient', 'verifyPackage', 'recipientBuild']) {
  check(`DeliveryPanel uses ${fn}`, new RegExp(`\\b${fn}\\(`).test(delivery))
}

const format = read('lib/format.ts')
check(
  'format.ts exposes the helpers the UI needs',
  ['formatNight', 'formatRaw', 'nightToStar', 'addressDisplay', 'formatFileSize'].every(name => new RegExp(`export function ${name}`).test(format)),
)

check('useContract keeps a ref so connect-then-call works', /contractRef\.current/.test(read('hooks/useContract.ts')))
check('useMarketplace returns listings from fetchListings', /Promise<Listing\[\]>/.test(read('hooks/useMarketplace.ts')))
check('App context mounts the three hooks once', ['useWallet', 'useContract', 'useMarketplace'].every(name => new RegExp(name).test(read('context/AppContext.tsx'))))

console.log(failed === 0 ? '\nAll wiring checks passed\n' : `\n${failed} check(s) failed\n`)
process.exit(failed === 0 ? 0 : 1)
