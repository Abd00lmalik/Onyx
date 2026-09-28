/**
 * Copies compiled contract artifacts into the frontend:
 *   onyx-contracts/contracts/managed/onyx-marketplace/* -> frontend/public/zk-artifacts/*
 *   .../contract/{index.js,index.d.ts}                  -> frontend/src/generated/contract/*
 *
 * Run after every `compact compile`: npm run sync:artifacts
 */
import { cp, mkdir, rm, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(here, '..')
const repoRoot = path.resolve(frontendRoot, '..')
const source = path.join(repoRoot, 'onyx-contracts', 'contracts', 'managed', 'onyx-marketplace')
const publicOut = path.join(frontendRoot, 'public', 'zk-artifacts')
const generatedOut = path.join(frontendRoot, 'src', 'generated', 'contract')

const entries = await readdir(source, { withFileTypes: true })
if (!entries.some(entry => entry.isDirectory() && entry.name === 'contract')) {
  console.error(`No compiled contract found at ${source}. Run "npm run compile" in onyx-contracts first.`)
  process.exit(1)
}

await rm(publicOut, { recursive: true, force: true })
await mkdir(publicOut, { recursive: true })
for (const entry of entries) {
  await cp(path.join(source, entry.name), path.join(publicOut, entry.name), { recursive: true })
}

await rm(generatedOut, { recursive: true, force: true })
await mkdir(generatedOut, { recursive: true })
for (const file of ['index.js', 'index.d.ts', 'index.js.map']) {
  await cp(path.join(source, 'contract', file), path.join(generatedOut, file)).catch(() => {})
}

const keys = (await readdir(path.join(publicOut, 'keys'))).length
const zkir = (await readdir(path.join(publicOut, 'zkir'))).length
console.log(`Synced artifacts: keys=${keys}, zkir=${zkir}`)
console.log(`  public  -> ${publicOut}`)
console.log(`  bundled -> ${generatedOut}`)
