import fs from 'node:fs'
import path from 'node:path'

const frontend = process.argv[2] ?? process.cwd()
const entryPath = path.join(frontend, 'node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_fs.js')
const outPath = path.join(frontend, 'src/vendor/ledger-wasm-browser.js')

const entry = fs.readFileSync(entryPath, 'utf8')
const seen = []
const re = /import \* as (\S+) from '\.\/snippets\/([^']+)';/g
for (let m; (m = re.exec(entry)); ) {
  if (!seen.some(s => s.local === m[1])) seen.push({ local: m[1], rel: m[2] })
}

const PN = '../../node_modules/@midnight-ntwrk/ledger-v8'
const out = []

out.push('// Browser replacement for @midnight-ntwrk/ledger-v8.')
out.push('//')
out.push("// The package's browser entry is wasm-bindgen's bundler target: it does")
out.push('//   import * as wasm from "./midnight_ledger_wasm_bg.wasm"')
out.push('//   __wbg_set_wasm(wasm); wasm.__wbindgen_start()')
out.push('// which assumes the bundler keeps exactly one copy of the _bg.js glue and')
out.push('// instantiates the .wasm as an ESM module. Under Vite the glue is duplicated, so')
out.push('// __wbg_set_wasm() mutates one copy while the instantiated wasm calls into another')
out.push('// ("__wbindgen_start before initialization"), and the snippet modules the wasm')
out.push('// imports never reach the import object.')
out.push('//')
out.push("// This mirrors the package's own Node entry (midnight_ledger_wasm_fs.js) but")
out.push('// loads the 10 MB .wasm over fetch instead of readFileSync, and instantiates')
out.push('// asynchronously (Chrome rejects sync WebAssembly.Instance above 8 MB).')
out.push('//')
out.push('// GENERATED FROM node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_fs.js')
out.push('// Regenerate if the ledger-v8 dependency is upgraded.')
out.push('')
out.push(`import * as bg from '${PN}/midnight_ledger_wasm_bg.js'`)
out.push(`import wasmUrl from '${PN}/midnight_ledger_wasm_bg.wasm?url'`)
out.push('')
out.push('// Inline snippet modules imported by the wasm.')
for (const s of seen) out.push(`import * as ${s.local} from '${PN}/snippets/${s.rel}'`)
out.push('')
out.push("const imports = { './midnight_ledger_wasm_bg.js': bg }")
for (const s of seen) out.push(`imports['./snippets/${s.rel}'] = ${s.local}`)
out.push('')
out.push('const response = await fetch(wasmUrl)')
out.push('if (!response.ok) throw new Error(`Failed to load ledger wasm (${response.status})`)')
out.push('const wasmModule = await WebAssembly.compile(await response.arrayBuffer())')
out.push('const wasmInstance = await WebAssembly.instantiate(wasmModule, imports)')
out.push('')
out.push('bg.__wbg_set_wasm(wasmInstance.exports)')
out.push('wasmInstance.exports.__wbindgen_start()')
out.push('')
out.push(`export * from '${PN}/midnight_ledger_wasm_bg.js'`)

fs.writeFileSync(outPath, out.join('\n') + '\n')
console.log(`wrote ${path.relative(frontend, outPath)}: ${seen.length} snippets, ${out.length} lines`)
