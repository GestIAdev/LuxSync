/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 👻 WAVE 7564.9: PHANTOM PIPELINE — Standalone CJS Entry for the Phantom Worker
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Thin re-export wrapper that Vite bundles into a single self-contained CJS
 * module (`dist-electron/phantomPipeline.js`). The phantom worker BrowserWindow
 * loads this via `require()` — same pattern as `GodEarFFT.js`.
 *
 * This file exists because `analysisPipeline.ts` lives in `src/chronos/`,
 * which is NOT in `tsconfig.node.json`'s include list, so `tsc` does not
 * compile it. Vite bundles it instead, inlining all dependencies (GodEarFFT,
 * TempoOracle, NSDF autocorrelation, Ellis DP tracker) into one file.
 *
 * The phantom worker calls `runAnalysisPipeline(monoSamples, sampleRate,
 * duration, config, onProgress)` after decoding audio with `AudioContext`.
 * This is the SAME function `godear-offline.worker.ts` calls — single source
 * of truth.
 *
 * @module chronos/analysis/phantomPipeline
 * @version WAVE 7564.9
 */

export { runAnalysisPipeline, DEFAULT_CONFIG } from './analysisPipeline'
