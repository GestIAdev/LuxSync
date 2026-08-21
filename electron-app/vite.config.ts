import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import path from 'path'
import { builtinModules } from 'module'

// 🔥 WAVE 2495: Node.js builtins must be external for ALL electron entries.
// Without this, Rollup tries to resolve 'events', 'fs', 'path', etc. as browser
// modules and fails with "__vite-browser-external" errors.
// Includes both 'events' and 'node:events' variants.
const nodeBuiltins = [
  ...builtinModules,
  ...builtinModules.map(m => `node:${m}`),
  'electron',
]

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              // 🧠 WAVE 10 + WAVE 2495: Excluir módulos nativos + builtins de Node.js
              external: [...nodeBuiltins, 'better-sqlite3', 'serialport', 'bytenode'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
      // 🧠 WAVE 10/254: Trinity Workers - BETA (Senses) and GAMMA (Mind)
      {
        entry: 'src/workers/senses.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            lib: {
              entry: 'src/workers/senses.ts',
              formats: ['cjs'],
              fileName: () => 'senses.js',
            },
            rollupOptions: {
              external: [...nodeBuiltins, 'better-sqlite3'],
            },
          },
        },
      },
      {
        entry: 'src/workers/mind.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            lib: {
              entry: 'src/workers/mind.ts',
              formats: ['cjs'],
              fileName: () => 'mind.js',
            },
            rollupOptions: {
              external: [...nodeBuiltins, 'better-sqlite3'],
            },
          },
        },
      },
      // WAVE 6019: DMX SAB Worker — worker_thread con SharedArrayBuffer
      {
        entry: 'src/hal/workers/openDmxWorker.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            lib: {
              entry: 'src/hal/workers/openDmxWorker.ts',
              formats: ['cjs'],
              fileName: () => 'openDmxWorker.js',
            },
            rollupOptions: {
              external: [...nodeBuiltins, 'serialport'],
            },
          },
        },
      },
      // 👻 WAVE 2541.3: GodEarFFT standalone CJS — requerido por phantomWorker.html
      // El phantom tiene nodeIntegration:true y usa require(), pero Vite bundlea
      // GodEarFFT dentro del renderer. Este entry lo saca como módulo CJS independiente.
      {
        entry: 'src/workers/GodEarFFT.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            lib: {
              entry: 'src/workers/GodEarFFT.ts',
              formats: ['cjs'],
              fileName: () => 'GodEarFFT.js',
            },
            rollupOptions: {
              external: [...nodeBuiltins],
              output: {
                exports: 'named',
              },
            },
          },
        },
      },
      // 👻 WAVE 7564.9: PHANTOM PIPELINE — standalone CJS bundle for the phantom worker.
      // Bundles analysisPipeline.ts + TempoOracle + GodEarFFT + Ellis DP tracker into
      // one self-contained module. The phantom worker BrowserWindow require()s this
      // after decoding audio with AudioContext, replacing 500 lines of duplicated
      // inline JS with the single source of truth.
      {
        entry: 'src/chronos/analysis/phantomPipeline.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            lib: {
              entry: 'src/chronos/analysis/phantomPipeline.ts',
              formats: ['cjs'],
              fileName: () => 'phantomPipeline.js',
            },
            rollupOptions: {
              external: [...nodeBuiltins],
              output: {
                exports: 'named',
              },
            },
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@styles': path.resolve(__dirname, './src/styles'),
    },
  },
  server: {
    port: 5173,
  },
})
