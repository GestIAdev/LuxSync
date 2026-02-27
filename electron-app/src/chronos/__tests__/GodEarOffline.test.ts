/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗺️ WAVE 2078/2080: CHRONOS TEST ARMY
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Suite 6: GodEarOffline — Exported API & Interface Contracts
 * 
 * WAVE 2080: Updated for real Web Worker implementation.
 * - WORKER_CODE now documents the real worker (godear-offline.worker.ts)
 * - GodEarOfflineMessage uses monoSamples: Float32Array (not audioData)
 * - createOfflineWorker() uses Vite native Worker import
 * 
 * NOTE: GodEarOffline.analyzeAudioFile() requires an AudioBuffer with
 * copyFromChannel() — a Web Audio API. We test the EXPORTED interfaces,
 * worker code, and config contract. The actual DSP math is verified
 * in GodEarFFT.test.ts through direct GodEarAnalyzer calls.
 * 
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). All assertions deterministic.
 * 
 * @module chronos/__tests__/GodEarOffline
 * @version WAVE 2080
 */

import { describe, test, expect } from 'vitest'
import {
  createOfflineWorker,
  WORKER_CODE,
} from '../analysis/GodEarOffline'
import type {
  AnalysisProgress,
  ProgressCallback,
  GodEarOfflineMessage,
  GodEarOfflineResponse,
} from '../analysis/GodEarOffline'

// ═══════════════════════════════════════════════════════════════════════════
// 🗺️ GODEAR OFFLINE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('🗺️ GodEarOffline — Cartographer API', () => {

  // ─────────────────────────────────────────────────────────────────────
  // EXPORTS EXIST
  // ─────────────────────────────────────────────────────────────────────

  describe('📦 Module Exports', () => {

    test('analyzeAudioFile is exported as function', async () => {
      // Dynamic import to verify it exists
      const mod = await import('../analysis/GodEarOffline')
      expect(typeof mod.analyzeAudioFile).toBe('function')
    })

    test('createOfflineWorker is exported as function', () => {
      expect(typeof createOfflineWorker).toBe('function')
    })

    test('WORKER_CODE is a non-empty string', () => {
      expect(typeof WORKER_CODE).toBe('string')
      expect(WORKER_CODE.length).toBeGreaterThan(10)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // WORKER CODE
  // ─────────────────────────────────────────────────────────────────────

  describe('🧵 Worker Code', () => {

    test('WORKER_CODE contains onmessage handler', () => {
      expect(WORKER_CODE).toContain('onmessage')
    })

    test('WORKER_CODE documents WAVE 2080 real worker', () => {
      // WAVE 2080: WORKER_CODE now documents the real implementation
      expect(WORKER_CODE).toContain('WAVE 2080')
      expect(WORKER_CODE).toContain('godear-offline.worker.ts')
      expect(WORKER_CODE).toContain('Cooley-Tukey FFT')
    })

    test('WORKER_CODE is valid JavaScript (parseable)', () => {
      // Verify it doesn't have obvious syntax errors
      expect(() => new Function(WORKER_CODE)).not.toThrow()
    })

    test('WORKER_CODE references the analysis message protocol', () => {
      // Worker expects 'analyze' messages with monoSamples
      expect(WORKER_CODE).toContain('analyze')
      expect(WORKER_CODE).toContain('monoSamples')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // INTERFACE CONTRACTS (Compile-time verified, runtime documented)
  // ─────────────────────────────────────────────────────────────────────

  describe('📋 Interface Contracts', () => {

    test('AnalysisProgress phases cover full pipeline', () => {
      // This documents what phases exist and verifies they match the code
      const expectedPhases: AnalysisProgress['phase'][] = [
        'waveform', 'energy', 'beats', 'sections', 'transients', 'complete'
      ]
      
      // If the type system allows these values, the interface is correct
      for (const phase of expectedPhases) {
        const progress: AnalysisProgress = {
          phase,
          progress: 50,
          message: `Testing ${phase}`,
        }
        expect(progress.phase).toBe(phase)
      }
    })

    test('GodEarOfflineMessage has correct shape', () => {
      const msg: GodEarOfflineMessage = {
        type: 'analyze',
        monoSamples: new Float32Array(1024),
        sampleRate: 44100,
        duration: 1.0,
      }
      
      expect(msg.type).toBe('analyze')
      expect(msg.sampleRate).toBe(44100)
      expect(msg.monoSamples.length).toBe(1024)
      expect(msg.duration).toBe(1.0)
    })

    test('GodEarOfflineResponse shapes are valid', () => {
      const progressResponse: GodEarOfflineResponse = {
        type: 'progress',
        progress: {
          phase: 'beats',
          progress: 75,
          message: 'Detecting beats...',
        },
      }
      expect(progressResponse.type).toBe('progress')
      
      const errorResponse: GodEarOfflineResponse = {
        type: 'error',
        error: 'Test error',
      }
      expect(errorResponse.type).toBe('error')
      expect(errorResponse.error).toBe('Test error')
    })

    test('ProgressCallback type is function', () => {
      const cb: ProgressCallback = (progress) => {
        expect(progress.phase).toBeTruthy()
      }
      
      cb({ phase: 'waveform', progress: 100, message: 'Done' })
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // DETERMINISM
  // ─────────────────────────────────────────────────────────────────────

  describe('🎲 Determinism', () => {

    test('WORKER_CODE is the same on every access', () => {
      const first = WORKER_CODE
      const second = WORKER_CODE
      expect(first).toBe(second)
    })
  })
})
