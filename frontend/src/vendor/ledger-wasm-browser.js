// Browser replacement for @midnight-ntwrk/ledger-v8.
//
// The package's browser entry is wasm-bindgen's bundler target: it does
//   import * as wasm from "./midnight_ledger_wasm_bg.wasm"
//   __wbg_set_wasm(wasm); wasm.__wbindgen_start()
// which assumes the bundler keeps exactly one copy of the _bg.js glue and
// instantiates the .wasm as an ESM module. Under Vite the glue is duplicated, so
// __wbg_set_wasm() mutates one copy while the instantiated wasm calls into another
// ("__wbindgen_start before initialization"), and the snippet modules the wasm
// imports never reach the import object.
//
// This mirrors the package's own Node entry (midnight_ledger_wasm_fs.js) but
// loads the 10 MB .wasm over fetch instead of readFileSync, and instantiates
// asynchronously (Chrome rejects sync WebAssembly.Instance above 8 MB).
//
// GENERATED FROM node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_fs.js
// Regenerate if the ledger-v8 dependency is upgraded.

import * as bg from '../../node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_bg.js'
import wasmUrl from '../../node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_bg.wasm?url'

// Inline snippet modules imported by the wasm.
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline0_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline0.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline1_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline1.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline10_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline10.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline11_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline11.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline12_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline12.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline13_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline13.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline14_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline14.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline15_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline15.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline16_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline16.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline17_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline17.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline18_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline18.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline19_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline19.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline2_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline2.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline20_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline20.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline21_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline21.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline22_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline22.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline23_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline23.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline3_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline3.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline4_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline4.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline5_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline5.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline6_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline6.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline7_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline7.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline8_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline8.js'
import * as snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline9_js from '../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline9.js'

const imports = { './midnight_ledger_wasm_bg.js': bg }
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline0.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline0_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline1.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline1_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline10.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline10_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline11.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline11_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline12.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline12_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline13.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline13_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline14.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline14_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline15.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline15_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline16.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline16_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline17.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline17_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline18.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline18_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline19.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline19_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline2.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline2_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline20.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline20_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline21.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline21_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline22.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline22_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline23.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline23_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline3.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline3_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline4.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline4_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline5.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline5_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline6.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline6_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline7.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline7_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline8.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline8_js
imports['./snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline9.js'] = snippets_midnight_ledger_wasm_9f71df61dc0427fb_inline9_js

const response = await fetch(wasmUrl)
if (!response.ok) throw new Error(`Failed to load ledger wasm (${response.status})`)
const wasmModule = await WebAssembly.compile(await response.arrayBuffer())
const wasmInstance = await WebAssembly.instantiate(wasmModule, imports)

bg.__wbg_set_wasm(wasmInstance.exports)
wasmInstance.exports.__wbindgen_start()

export * from '../../node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_bg.js'
