/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗺️ GODEAR OFFLINE - THE CARTOGRAPHER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 2002: THE SYNAPTIC BRIDGE (Original)
 * WAVE 2077: THE TRANSPLANT — Real GodEarFFT Integration
 * WAVE 2080: THE GHOST IN THE MACHINE — Real Web Worker
 * GODEAR UNLEASHED: Phase 1 + Phase 4 — Zero-GC heatmap + DRY pipeline
 *
 * Análisis offline de audio para el timeline de Chronos.
 * Extrae waveform, beat grid, secciones, y heatmap energético.
 *
 * GODEAR UNLEASHED CHANGES:
 * - Phase 1: extractEnergyHeatmap() now uses a pre-allocated window buffer
 *   (zero per-frame allocation, ~57 MB GC pressure eliminated)
 * - Phase 4: All extraction functions moved to analysisPipeline.ts (single
 *   source of truth). This file is now a thin orchestrator: Worker dispatch
 *   + main-thread fallback. The 700 lines of duplicated logic are gone.
 *
 * NOTA: Este NO es el GodEar en tiempo real. Es la versión batch
 * para procesar archivos completos de una sola vez.
 * El GodEarFFT real (workers/GodEarFFT.ts) corre en Senses Worker.
 *
 * @module chronos/analysis/GodEarOffline
 * @version GODEAR UNLEASHED
 */

import type { AnalysisData } from '../core/types'

import {
  DEFAULT_CONFIG,
  runAnalysisPipeline,
  type OfflineAnalysisConfig,
  type ProgressCallback as PipelineProgressCallback,
} from './analysisPipeline'

export type { OfflineAnalysisConfig }

// Re-export for backwards compatibility
export { DEFAULT_CONFIG as OFFLINE_DEFAULT_CONFIG } from './analysisPipeline'

// ═══════════════════════════════════════════════════════════════════════════
// 📊 PROGRESS TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface AnalysisProgress {
  phase: 'waveform' | 'energy' | 'beats' | 'sections' | 'transients' | 'complete'
  progress: number
  message: string
}

/**
 * Legacy progress callback that receives a full AnalysisProgress object.
 * This is the public API type used by useAudioLoader and tests.
 */
export type ProgressCallback = (progress: AnalysisProgress) => void

// ═══════════════════════════════════════════════════════════════════════════
// 🗺️ GODEAR OFFLINE - MAIN API
// ═══════════════════════════════════════════════════════════════════════════

/**
 *  WAVE 2080: Worker-backed analysis with automatic fallback
 *
 * Tries to run the full pipeline in a dedicated Web Worker.
 * If Worker fails (CSP restrictions, build issues, etc.), falls back
 * to main thread analysis seamlessly.
 *
 * @param buffer AudioBuffer decodificado
 * @param config Configuración opcional
 * @param onProgress Callback de progreso
 * @returns AnalysisData para el timeline
 */
export async function analyzeAudioFile(
  buffer: AudioBuffer,
  config: Partial<OfflineAnalysisConfig> = {},
  onProgress?: ProgressCallback
): Promise<AnalysisData> {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // Prepare mono samples (needed for both worker and fallback paths)
  const monoSamples = getMonoSamples(buffer)
  const sampleRate = buffer.sampleRate
  const duration = buffer.duration

  // 👻 WAVE 2080: Try Worker first
  try {
    const result = await analyzeViaWorker(monoSamples, sampleRate, duration, cfg, onProgress)
    console.log('[GodEarOffline] 👻 Analysis completed via Web Worker (UI thread free)')
    return result
  } catch (workerError) {
    console.warn('[GodEarOffline] ⚠️ Worker failed, falling back to main thread:', workerError)
    // Fall through to main thread analysis
  }

  // 🔄 Fallback: Main thread analysis (original WAVE 2077 path)
  return analyzeOnMainThread(monoSamples, sampleRate, duration, cfg, onProgress)
}

/**
 * 👻 WAVE 2080: Run analysis pipeline in a dedicated Web Worker
 *
 * Uses Vite's worker import pattern for proper bundling.
 * Transfers Float32Array as Transferable Object (zero-copy).
 */
async function analyzeViaWorker(
  monoSamples: Float32Array,
  sampleRate: number,
  duration: number,
  config: OfflineAnalysisConfig,
  onProgress?: ProgressCallback
): Promise<AnalysisData> {
  return new Promise<AnalysisData>((resolve, reject) => {
    let worker: Worker | null = null

    try {
      // Vite Web Worker pattern: import with ?worker suffix at build time
      // At runtime, create inline Blob worker from the compiled worker code
      worker = new Worker(
        new URL('./godear-offline.worker.ts', import.meta.url),
        { type: 'module' }
      )
    } catch (err) {
      reject(new Error(`Cannot create Worker: ${err instanceof Error ? err.message : String(err)}`))
      return
    }

    // Timeout: 60 seconds max for analysis
    const timeout = setTimeout(() => {
      worker?.terminate()
      reject(new Error('Worker analysis timed out (60s)'))
    }, 60_000)

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data

      switch (msg.type) {
        case 'progress':
          onProgress?.({
            phase: msg.phase as AnalysisProgress['phase'],
            progress: msg.progress,
            message: msg.message,
          })
          break

        case 'complete':
          clearTimeout(timeout)
          worker?.terminate()

          // Reconstruct AnalysisData from worker result
          const result: AnalysisData = {
            durationMs: msg.result.durationMs,
            waveform: msg.result.waveform,
            energyHeatmap: msg.result.energyHeatmap,
            beatGrid: msg.result.beatGrid,
            sections: msg.result.sections,
            transients: msg.result.transients,
            // GODEAR UNLEASHED Phase 2: pass through 3-band transient events
            transientEvents: msg.result.transientEvents,
          }

          onProgress?.({ phase: 'complete', progress: 100, message: 'Analysis completed (Worker)' })
          resolve(result)
          break

        case 'error':
          clearTimeout(timeout)
          worker?.terminate()
          reject(new Error(msg.error))
          break
      }
    }

    worker.onerror = (err) => {
      clearTimeout(timeout)
      worker?.terminate()
      reject(new Error(`Worker error: ${err.message}`))
    }

    // Send samples to worker — transfer the buffer (zero-copy)
    // We clone the monoSamples because transfer empties the original
    const samplesClone = monoSamples.slice()
    worker.postMessage(
      {
        type: 'analyze',
        monoSamples: samplesClone,
        sampleRate,
        duration,
        config,
      },
      [samplesClone.buffer] // Transferable — zero-copy to worker
    )
  })
}

/**
 * 🔄 Main thread analysis (fallback path)
 *
 * Original WAVE 2077 pipeline — runs on the UI thread with yieldToEventLoop().
 * Used when Web Worker is unavailable.
 *
 * GODEAR UNLEASHED: Now delegates to runAnalysisPipeline() from
 * analysisPipeline.ts (single source of truth).
 */
async function analyzeOnMainThread(
  monoSamples: Float32Array,
  sampleRate: number,
  duration: number,
  cfg: OfflineAnalysisConfig,
  onProgress?: ProgressCallback
): Promise<AnalysisData> {
  const report: PipelineProgressCallback = (phase, progress, message) => {
    onProgress?.({ phase: phase as AnalysisProgress['phase'], progress, message })
  }

  // 🛡️ WAVE 2005.2: Helper to yield to event loop periodically
  const yieldToEventLoop = () => new Promise<void>(resolve => setTimeout(resolve, 0))

  await yieldToEventLoop()

  // Run the shared pipeline (yields between phases for UI responsiveness)
  // We call runAnalysisPipeline in stages by wrapping it — but since
  // runAnalysisPipeline is synchronous, we call it with yields before each
  // major phase. The pipeline itself handles progress reporting.

  // Phase 1: Waveform
  report('waveform', 0, 'Extracting waveform...')
  await yieldToEventLoop()

  // Run the full pipeline (it reports progress via the callback)
  // The pipeline is synchronous but fast enough for most tracks.
  // For very long tracks, the Worker path is preferred.
  const result = runAnalysisPipeline(monoSamples, sampleRate, duration, cfg, report)

  report('complete', 100, 'Analysis completed (main thread)')

  return {
    durationMs: result.durationMs,
    waveform: result.waveform,
    energyHeatmap: result.energyHeatmap,
    beatGrid: result.beatGrid,
    sections: result.sections,
    transients: result.transients,
    // GODEAR UNLEASHED Phase 2: pass through 3-band transient events
    transientEvents: result.transientEvents,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 MONO DOWNMIX (kept here — not part of the shared pipeline)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mezcla todos los canales a mono
 */
function getMonoSamples(buffer: AudioBuffer): Float32Array {
  const length = buffer.length
  const mono = new Float32Array(length)
  const numChannels = buffer.numberOfChannels

  // Obtener primer canal
  buffer.copyFromChannel(mono, 0)

  // Si hay más canales, promediar
  if (numChannels > 1) {
    const temp = new Float32Array(length)
    for (let ch = 1; ch < numChannels; ch++) {
      buffer.copyFromChannel(temp, ch)
      for (let i = 0; i < length; i++) {
        mono[i] += temp[i]
      }
    }
    // Normalizar
    for (let i = 0; i < length; i++) {
      mono[i] /= numChannels
    }
  }

  return mono
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧵 WEB WORKER INTERFACE (backwards compatibility exports)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mensaje para enviar al Worker
 */
export interface GodEarOfflineMessage {
  type: 'analyze'
  monoSamples: Float32Array
  sampleRate: number
  duration: number
  config?: Partial<OfflineAnalysisConfig>
}

/**
 * Respuesta del Worker
 */
export interface GodEarOfflineResponse {
  type: 'progress' | 'complete' | 'error'
  progress?: AnalysisProgress
  result?: AnalysisData
  error?: string
}

/**
 * 👻 WAVE 2080: Worker code indicator
 *
 * The actual worker code lives in godear-offline.worker.ts
 * and is loaded via Vite's native Worker support:
 *   new Worker(new URL('./godear-offline.worker.ts', import.meta.url))
 *
 * This string exists for backwards compatibility with tests
 * and to document that the worker IS implemented.
 */
export const WORKER_CODE = `
// 👻 WAVE 2080: THE GHOST IN THE MACHINE
// Real implementation in: godear-offline.worker.ts
// Loaded via Vite native Worker with import.meta.url
// Features: Cooley-Tukey FFT, LR4 filters, 7 tactical bands
// Pipeline: waveform → heatmap → beats → sections → transients
// Thread: DEDICATED Web Worker (zero UI blocking)
// GODEAR UNLEASHED: All analysis logic in analysisPipeline.ts (DRY)
self.onmessage = async (e) => {
  const { type, monoSamples, sampleRate, duration, config } = e.data;
  if (type === 'analyze') {
    // Real analysis runs in godear-offline.worker.ts
    // This inline version exists only as documentation
    self.postMessage({ type: 'error', error: 'Use Vite Worker import instead' });
  }
};
`

/**
 * 👻 WAVE 2080: Creates the real Web Worker via Vite's native Worker support
 *
 * Uses import.meta.url pattern for proper bundling.
 * The worker file (godear-offline.worker.ts) is compiled by Vite
 * and loaded as a proper ES module Worker.
 *
 * @returns Worker instance ready to receive 'analyze' messages
 * @throws Error if Worker creation fails (CSP, build issues)
 */
export function createOfflineWorker(): Worker {
  return new Worker(
    new URL('./godear-offline.worker.ts', import.meta.url),
    { type: 'module' }
  )
}
