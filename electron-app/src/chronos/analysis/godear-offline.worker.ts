/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 👻 WAVE 2080: GODEAR OFFLINE WEB WORKER — THE GHOST IN THE MACHINE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Real Web Worker for offline audio analysis.
 * Runs GodEarAnalyzer (Cooley-Tukey FFT + LR4 filters) in a DEDICATED THREAD.
 *
 * The main thread sends raw Float32Array audio samples via postMessage
 * with Transferable Objects (zero-copy). This worker processes the entire
 * pipeline (waveform → heatmap → beats → sections → transients) without
 * blocking the UI.
 *
 * ARCHITECTURE:
 * ┌─────────────────────┐     postMessage      ┌─────────────────────────┐
 * │   Main Thread       │  ──────────────────►  │  Web Worker (this file) │
 * │   (React/Renderer)  │  ◄──────────────────  │  GodEarAnalyzer + FFT   │
 * │   useAudioLoader    │   progress/result     │  LR4 filters + bands    │
 * └─────────────────────┘                       └─────────────────────────┘
 *
 * GODEAR UNLEASHED Phase 4: All analysis functions now imported from
 * analysisPipeline.ts (single source of truth). This file is now a thin
 * worker shell: message protocol + progress reporting + pipeline dispatch.
 * The 700 lines of duplicated analysis logic have been eliminated.
 *
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). Real FFT. Real DSP.
 *
 * @module chronos/analysis/godear-offline.worker
 * @version GODEAR UNLEASHED
 */

import {
  DEFAULT_CONFIG,
  runAnalysisPipeline,
  type OfflineAnalysisConfig,
  type AnalysisPipelineResult,
} from './analysisPipeline'

// ═══════════════════════════════════════════════════════════════════════════
// 📡 WORKER MESSAGE PROTOCOL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Messages FROM main thread TO worker
 */
interface WorkerInMessage {
  type: 'analyze'
  /** Raw mono Float32Array samples (transferred, not copied) */
  monoSamples: Float32Array
  sampleRate: number
  duration: number
  config: OfflineAnalysisConfig
}

/**
 * Messages FROM worker TO main thread
 */
type WorkerOutMessage =
  | { type: 'progress'; phase: string; progress: number; message: string }
  | { type: 'complete'; result: AnalysisPipelineResult }
  | { type: 'error'; error: string }

// ═══════════════════════════════════════════════════════════════════════════
// 📡 POST HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function reportProgress(phase: string, progress: number, message: string) {
  const msg: WorkerOutMessage = { type: 'progress', phase, progress, message }
  self.postMessage(msg)
}

function reportComplete(result: AnalysisPipelineResult) {
  const msg: WorkerOutMessage = { type: 'complete', result }
  self.postMessage(msg)
}

function reportError(error: string) {
  const msg: WorkerOutMessage = { type: 'error', error }
  self.postMessage(msg)
}

// ═══════════════════════════════════════════════════════════════════════════
// 👻 WORKER ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const { type, monoSamples, sampleRate, duration, config } = e.data

  if (type !== 'analyze') {
    reportError(`Unknown message type: ${type}`)
    return
  }

  try {
    // Run the shared analysis pipeline with progress reporting
    const result = runAnalysisPipeline(
      monoSamples,
      sampleRate,
      duration,
      { ...DEFAULT_CONFIG, ...config },
      reportProgress,
    )

    reportProgress('complete', 100, 'Analysis completed (Worker)')
    reportComplete(result)
  } catch (err) {
    reportError(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}
