import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

/**
 * vision_bundle.mjs ships with a sourceMappingURL comment pointing to a .map
 * file that was never included in the published npm package.
 *
 * Vite calls extractSourcemapFromFile() during the *load* phase — before any
 * transform hook runs — so a transform hook is too late to suppress it.
 * Using a load hook we return the file content ourselves without the broken
 * comment, so Vite never tries to open the missing .map file.
 */
function suppressMediapipeSourceMap() {
  return {
    name: 'suppress-mediapipe-sourcemap',
    enforce: 'pre',
    load(id) {
      const cleanId = id.split('?')[0];
      if (cleanId.includes('@mediapipe/tasks-vision') && cleanId.endsWith('.mjs')) {
        try {
          const code = readFileSync(cleanId, 'utf-8');
          return { code: code.replace(/\/\/# sourceMappingURL=\S+/g, ''), map: null };
        } catch {
          return null;
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), suppressMediapipeSourceMap()],
  optimizeDeps: {
    // @mediapipe/tasks-vision loads its own WASM dynamically — keep it out
    // of Vite's pre-bundler so the internal dynamic imports are preserved.
    exclude: ['@mediapipe/tasks-vision'],
  },
})
