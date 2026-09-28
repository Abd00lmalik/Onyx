import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const onchainRuntimeShim = fileURLToPath(new URL('./src/vendor/onchain-runtime-browser.js', import.meta.url))
const ledgerWasmShim = fileURLToPath(new URL('./src/vendor/ledger-wasm-browser.js', import.meta.url))

/**
 * Both Midnight wasm packages ship wasm-bindgen's "bundler" browser entry, which
 * only works when the bundler keeps exactly one copy of the `_bg.js` glue and
 * instantiates the `.wasm` as an ESM module. Vite bundles the glue twice, so
 * `__wbg_set_wasm()` mutates one copy while the instantiated wasm calls into the
 * other ("__wbindgen_start before initialization").
 *
 * Resolve every route into those entries - the bare package specifier and the
 * entry file itself - to the shims in src/vendor.
 */
function midnightWasmShims(): Plugin {
  const replacements: Array<[RegExp, string]> = [
    [/^(?:@midnight-ntwrk\/onchain-runtime-v3$|.*\/@midnight-ntwrk\/onchain-runtime-v3\/midnight_onchain_runtime_wasm\.js$)/, onchainRuntimeShim],
    [/^(?:@midnight-ntwrk\/ledger-v8$|.*\/@midnight-ntwrk\/ledger-v8\/midnight_ledger_wasm\.js$)/, ledgerWasmShim],
  ]
  return {
    name: 'midnight-wasm-shims',
    enforce: 'pre',
    resolveId(id) {
      const clean = id.split('?')[0].replace(/\\/g, '/')
      for (const [pattern, replacement] of replacements) {
        if (pattern.test(clean)) return replacement
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [
    midnightWasmShims(),
    // abstract-level (used by the level private state provider) and the level
    // chain require Node builtins that Vite externalizes with an empty stub in
    // the browser ("Class extends value undefined"). Polyfill them here.
    nodePolyfills({
      include: ['assert', 'buffer', 'crypto', 'events', 'os', 'path', 'process', 'stream', 'string_decoder', 'util'],
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    // Keep the wasm packages out of the dep bundler: the shims and the _bg.js
    // glue must stay single-instance and be served through the module graph.
    exclude: ['@midnight-ntwrk/onchain-runtime-v3', '@midnight-ntwrk/ledger-v8'],
  },
  resolve: {
    alias: [{ find: '@', replacement: '/src' }],
    // One copy of the wasm layer everywhere: wasm-bindgen ties class identity
    // to the instance that created an object, so two copies break instanceof.
    dedupe: ['@midnight-ntwrk/compact-runtime', '@midnight-ntwrk/onchain-runtime-v3'],
  },
  server: {
    port: 5173,
    host: true,
  },
})
