// WAVE 3401: Vitest configuration for unit tests
// Separate from vite.config.ts (which is for Electron bundling).
// Tests run in Node.js environment -- required for SharedArrayBuffer + Atomics
// and dgram (used by OSCNexusProvider) without browser polyfills.

import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/audio/**'],
      reporter: ['text', 'lcov'],
    },
    // SharedArrayBuffer requires these COOP/COEP headers in browsers,
    // but in Node environment they are available natively -- no flags needed.
    // For the test runner itself (Vitest main thread), SAB is always available
    // in modern Node.js (v16+) without any flags.
    poolOptions: {
      forks: {
        // Each test file runs in its own forked process for isolation
        singleFork: false,
      }
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
