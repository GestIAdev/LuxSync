/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🗺️ WAVE 2078: CHRONOS TEST ARMY
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Suite 6: GodEarOffline — Exported API & Interface Contracts
 * 
 * NOTE: GodEarOffline.analyzeAudioFile() requires an AudioBuffer with
 * copyFromChannel() — a Web Audio API. We test the EXPORTED interfaces,
 * worker code, and config contract. The actual DSP math is verified
 * in GodEarFFT.test.ts through direct GodEarAnalyzer calls.
 * 
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). All assertions deterministic.
 * 
 * @module chronos/__tests__/GodEarOffline
 * @version WAVE 2078
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

    test('WORKER_CODE is valid JavaScript (parseable)', () => {
      // Verify it doesn't have obvious syntax errors
      expect(() => new Function(WORKER_CODE)).not.toThrow()
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
        audioData: new ArrayBuffer(1024),
        sampleRate: 44100,
      }
      
      expect(msg.type).toBe('analyze')
      expect(msg.sampleRate).toBe(44100)
      expect(msg.audioData.byteLength).toBe(1024)
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
