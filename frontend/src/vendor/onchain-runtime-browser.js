// Browser replacement for @midnight-ntwrk/onchain-runtime-v3.
//
// The package's own browser entry is wasm-bindgen's "bundler" target:
//   import * as wasm from "./x_bg.wasm";   // bundler-instantiated ESM wasm module
//   import { __wbg_set_wasm } from "./x_bg.js";
//   __wbg_set_wasm(wasm);
//   wasm.__wbindgen_start();
//
// That only works when the bundler keeps exactly one copy of x_bg.js and hands
// back the wasm exports as a module namespace. Vite/rolldown inlines x_bg.js into
// the bundled dependency while the wasm glue imports it as a separate file URL,
// so __wbg_set_wasm() mutates copy A while the instantiated wasm calls into copy B
// (whose `wasm` is still undefined -> "__wbindgen_export_2 of undefined").
//
// This shim instantiates the module itself with a single bg.js instance, in the
// same order the package's Node entry uses: set exports, then run __wbindgen_start.
import * as bg from '../../node_modules/@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.js'
import wasmUrl from '../../node_modules/@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.wasm?url'

const response = await fetch(wasmUrl)
if (!response.ok) throw new Error(`Failed to load onchain-runtime wasm (${response.status})`)
const wasmModule = await WebAssembly.compile(await response.arrayBuffer())
const instance = await WebAssembly.instantiate(wasmModule, {
  './midnight_onchain_runtime_wasm_bg.js': bg,
})

bg.__wbg_set_wasm(instance.exports)
instance.exports.__wbindgen_start()

export * from '../../node_modules/@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.js'
