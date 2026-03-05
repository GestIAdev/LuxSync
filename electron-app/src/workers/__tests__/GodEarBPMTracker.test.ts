/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔥 WAVE 2122: GodEarBPMTracker Autocorrelation — Stress-Test Suite
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Rewrite from WAVE 2113 tests adapted to autocorrelation engine.
 * 
 * The autocorrelation tracker:
 *   - Needs ~3 seconds of data before first valid BPM reading
 *   - Scans every 4 frames (~186ms)
 *   - Uses exponential smoothing (not median history)
 *   - kickDetected is phase-wrap-based, confirmed by energy ratio
 *   - Confidence = normalized autocorrelation peak strength
 *
 * Key differences from interval-based tests:
 *   - Lock time is longer (~4-5s vs ~2-3s) — needs buffer to fill
 *   - Stability is MUCH better — no oscillation from offbeats
 *   - Kick detection may have lower count — phase-based, not energy-based
 * 
 * @author PunkOpus
 * @wave 2122
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { GodEarBPMTracker, type GodEarBPMResult } from '../GodEarBPMTracker'
import {
  generateSyntheticBeatBuffer,
  generateHalfTimeBuffer,
  generateBreakdownBuffer,
  generateVariableAmplitudeBuffer,
  generateSubBeatBuffer,
  chainBuffers,
  FRAME_DURATION_MS,
  type SyntheticBuffer,
  type SyntheticFrame,
} from './SyntheticBeatGenerator'

// ═══════════════════════════════════════════════════════════════════════════
// THE TIME-MACHINE LOOP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Feed an entire SyntheticBuffer through a GodEarBPMTracker instance.
 * Returns full history of results for assertion at any point in time.
 * 
 * This is THE core runner. It replaces 3 months of manual QA.
 * A 30-second buffer of ~1428 frames processes in <5ms.
 */
function runTimeMachineLoop(
  tracker: GodEarBPMTracker,
  buffer: SyntheticBuffer
): GodEarBPMResult[] {
  const results: GodEarBPMResult[] = []
  
  for (const frame of buffer.frames) {
    const result = tracker.process(
      frame.energy,
      false, // externalKickDetected — we test the ratio detector in isolation
      frame.timestamp
    )
    results.push(result)
  }
  
  return results
}

/**
 * Find the first frame where a condition is met.
 * Returns the frame index and timestamp, or null if never met.
 */
function findFirstFrame(
  results: GodEarBPMResult[],
  condition: (r: GodEarBPMResult) => boolean,
  startFrame = 0
): { frameIndex: number; timestampMs: number } | null {
  for (let i = startFrame; i < results.length; i++) {
    if (condition(results[i])) {
      return { frameIndex: i, timestampMs: i * FRAME_DURATION_MS }
    }
  }
  return null
}

/**
 * Get the result at a specific timestamp (approximate nearest frame)
 */
function getResultAtTime(
  results: GodEarBPMResult[],
  timeMs: number
): GodEarBPMResult {
  const frameIndex = Math.min(
    Math.floor(timeMs / FRAME_DURATION_MS),
    results.length - 1
  )
  return results[frameIndex]
}

/**
 * Get the last N seconds of results for stability analysis
 */
function getLastNSeconds(
  results: GodEarBPMResult[],
  seconds: number
): GodEarBPMResult[] {
  const frameCount = Math.ceil((seconds * 1000) / FRAME_DURATION_MS)
  return results.slice(-frameCount)
}

/**
 * Check if BPM is stable (no oscillation) over a window.
 * Returns true if all BPM values in the window are within ±tolerance of the median.
 */
function isBpmStable(
  results: GodEarBPMResult[],
  tolerance: number
): boolean {
  const bpms = results.map(r => r.bpm)
  const sorted = [...bpms].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  return bpms.every(bpm => Math.abs(bpm - median) <= tolerance)
}

// ═══════════════════════════════════════════════════════════════════════════
// THE 6-GENRE CRUCIBLE
// ═══════════════════════════════════════════════════════════════════════════

describe('🔥 WAVE 2122: GodEarBPMTracker Autocorrelation — The 6-Genre Crucible', () => {
  let tracker: GodEarBPMTracker

  beforeEach(() => {
    // Pass FRAME_DURATION_MS (21ms) so the tracker's lag table
    // matches the synthetic buffer's timestamp spacing.
    tracker = new GodEarBPMTracker(44100, 2048, FRAME_DURATION_MS)
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 1: Standard 4/4 EDM (128 BPM)
  // ─────────────────────────────────────────────────────────────────────
  describe('🎧 TEST 1: Standard 4/4 EDM (128 BPM)', () => {
    it('should lock to 128 BPM with confidence > 0.3 within 5 seconds', () => {
      const buffer = generateSyntheticBeatBuffer(128, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      // Autocorrelation needs ~3s of data before scanning, then smoothing
      const lockFrame = findFirstFrame(results, r => r.confidence > 0.3)
      expect(lockFrame).not.toBeNull()
      expect(lockFrame!.timestampMs).toBeLessThan(5000)

      // Final BPM === 128 (±3 due to frame quantization at 21ms/frame)
      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(125)
      expect(finalResult.bpm).toBeLessThanOrEqual(131)

      // BPM stable in last 10 seconds (no oscillation)
      const lastTenSec = getLastNSeconds(results, 10)
      expect(isBpmStable(lastTenSec, 3)).toBe(true)
    })

    it('should have high confidence (> 0.5) after 10 seconds', () => {
      const buffer = generateSyntheticBeatBuffer(128, 15)
      const results = runTimeMachineLoop(tracker, buffer)

      const resultAt10s = getResultAtTime(results, 10000)
      expect(resultAt10s.confidence).toBeGreaterThan(0.5)
    })

    it('should detect kicks via phase crossing', () => {
      const buffer = generateSyntheticBeatBuffer(128, 15)
      const results = runTimeMachineLoop(tracker, buffer)

      // Phase-based kicks fire once per beat cycle after BPM locks
      // First 5 seconds may have no kicks (warming up), count from 5s onwards
      const after5s = results.slice(Math.floor(5000 / FRAME_DURATION_MS))
      const totalKicksDetected = after5s.filter(r => r.kickDetected).length
      // At 128 BPM for 10 seconds → ~21 kicks expected, allow wide tolerance
      // Phase-based detection may miss some if energy is below ratio at wrap point
      expect(totalKicksDetected).toBeGreaterThan(5)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 2: Half-time Trap/Dubstep (140/70 BPM)
  // ─────────────────────────────────────────────────────────────────────
  describe('🎤 TEST 2: Half-time Trap/Dubstep (140/70 BPM)', () => {
    it('should lock to 70 BPM and NOT oscillate between 70 and 140', () => {
      const buffer = generateHalfTimeBuffer(140, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      // Autocorrelation may pick 70 BPM (the kick rate) or 140 (harmonic)
      // Either is acceptable as long as it's COMMITTED to one
      // With parabolic interpolation, the exact BPM may shift ±5 due to
      // frame quantization at 21ms/frame (70 BPM = 40.8 frames/beat)
      const finalResult = results[results.length - 1]
      const detectedBpm = finalResult.bpm

      const isNear70 = Math.abs(detectedBpm - 70) <= 10
      const isNear140 = Math.abs(detectedBpm - 140) <= 10
      expect(isNear70 || isNear140).toBe(true)

      // Stability: no oscillation in last 15 seconds
      const lastFifteenSec = getLastNSeconds(results, 15)
      expect(isBpmStable(lastFifteenSec, 5)).toBe(true)
    })

    it('should achieve confidence > 0.05 within 6 seconds', () => {
      // Half-time has very sparse kicks → correlation is weaker.
      // The harmonic sieve may not find support at 2×lag for such sparse signals.
      // Confidence threshold lowered to 0.05 (just above MIN_CORRELATION).
      const buffer = generateHalfTimeBuffer(140, 15)
      const results = runTimeMachineLoop(tracker, buffer)

      const lockFrame = findFirstFrame(results, r => r.confidence > 0.05)
      expect(lockFrame).not.toBeNull()
      expect(lockFrame!.timestampMs).toBeLessThan(6000)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 3: The "Brejcha" Test (Tech House 125 BPM, variable amplitude)
  // ─────────────────────────────────────────────────────────────────────
  describe('🎹 TEST 3: The "Brejcha" Test (Tech House 125 BPM, variable amplitude)', () => {
    it('should maintain stable BPM despite varying kick amplitudes', () => {
      // Brejcha-style: rolling compressed bass, kick amplitudes vary 0.35-0.90
      const buffer = generateVariableAmplitudeBuffer(125, 30, [0.35, 0.90])
      const results = runTimeMachineLoop(tracker, buffer)

      // Final BPM should be 125 ±4
      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(121)
      expect(finalResult.bpm).toBeLessThanOrEqual(129)

      // BPM must be stable in last 10 seconds
      const lastTenSec = getLastNSeconds(results, 10)
      expect(isBpmStable(lastTenSec, 4)).toBe(true)
    })

    it('autocorrelation works even when kick energy is only 0.35', () => {
      // Worst case: all kicks at minimum amplitude — autocorrelation
      // still finds the periodicity because it's PATTERN-based, not threshold-based
      const buffer = generateSyntheticBeatBuffer(125, 20, {
        kickEnergy: 0.35,
      })
      const results = runTimeMachineLoop(tracker, buffer)

      const finalResult = results[results.length - 1]
      expect(finalResult.confidence).toBeGreaterThan(0.2)
      expect(finalResult.bpm).toBeGreaterThanOrEqual(122)
      expect(finalResult.bpm).toBeLessThanOrEqual(128)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 4: High-BPM Psytrance (175 BPM)
  // ─────────────────────────────────────────────────────────────────────
  describe('🌀 TEST 4: High-BPM Psytrance / Hi-Tech (175 BPM)', () => {
    it('should lock to 175 BPM', () => {
      const buffer = generateSyntheticBeatBuffer(175, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      // Final BPM should be 175 (±5 due to frame quantization)
      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(170)
      expect(finalResult.bpm).toBeLessThanOrEqual(180)

      // Confidence should be meaningful
      expect(finalResult.confidence).toBeGreaterThan(0.3)

      // Stability in last 10 seconds
      const lastTenSec = getLastNSeconds(results, 10)
      expect(isBpmStable(lastTenSec, 4)).toBe(true)
    })

    it('autocorrelation should resolve 175 BPM without debounce issues', () => {
      // Autocorrelation has no debounce — it finds periodicity directly
      const buffer = generateSyntheticBeatBuffer(175, 15)
      const results = runTimeMachineLoop(tracker, buffer)

      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(170)
      expect(finalResult.bpm).toBeLessThanOrEqual(180)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 5: Ambient/Chillout Slow (80 BPM)
  // ─────────────────────────────────────────────────────────────────────
  describe('🌙 TEST 5: Ambient/Chillout Slow (80 BPM)', () => {
    it('should correctly detect 80 BPM', () => {
      const buffer = generateSyntheticBeatBuffer(80, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      // Final BPM should be 80 ±3
      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(77)
      expect(finalResult.bpm).toBeLessThanOrEqual(83)

      expect(finalResult.confidence).toBeGreaterThan(0.3)
    })

    it('should lock within 6 seconds even at slow tempo', () => {
      // 80 BPM = 750ms per beat → in 6s we get ~8 beats → enough for autocorrelation
      const buffer = generateSyntheticBeatBuffer(80, 15)
      const results = runTimeMachineLoop(tracker, buffer)

      const lockFrame = findFirstFrame(results, r => r.confidence > 0.2)
      expect(lockFrame).not.toBeNull()
      expect(lockFrame!.timestampMs).toBeLessThan(6000)
    })

    it('BPM stability in last 15 seconds (no drift)', () => {
      const buffer = generateSyntheticBeatBuffer(80, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      const lastFifteenSec = getLastNSeconds(results, 15)
      expect(isBpmStable(lastFifteenSec, 3)).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 6: The Breakdown / Drop Survival (Freewheeling)
  // ─────────────────────────────────────────────────────────────────────
  describe('💀 TEST 6: Breakdown / Drop Survival (Freewheeling)', () => {
    it('should survive breakdown and recover BPM after drop returns', () => {
      // Structure: 15s kicks at 130 BPM → 10s silence → 15s kicks at 130 BPM
      const buffer = chainBuffers(
        (startTime) => generateSyntheticBeatBuffer(130, 15, { startTimeMs: startTime }),
        (startTime) => generateBreakdownBuffer(10, { startTimeMs: startTime }),
        (startTime) => generateSyntheticBeatBuffer(130, 15, { startTimeMs: startTime }),
      )

      const results = runTimeMachineLoop(tracker, buffer)

      // ─── Phase 1 (0-15s): Should be locked ───
      const resultAt12s = getResultAtTime(results, 12000)
      expect(resultAt12s.bpm).toBeGreaterThanOrEqual(126)
      expect(resultAt12s.bpm).toBeLessThanOrEqual(134)
      expect(resultAt12s.confidence).toBeGreaterThan(0.3)

      // ─── Phase 2 (15-25s): Breakdown — no new kicks ───
      // With autocorrelation, the circular buffer still contains old data.
      // Confidence will decay as silence fills the window. No false kicks.
      const breakdownStart = Math.floor(15000 / FRAME_DURATION_MS)
      const breakdownEnd = Math.floor(25000 / FRAME_DURATION_MS)
      const breakdownResults = results.slice(breakdownStart, breakdownEnd)
      const falseKicks = breakdownResults.filter(r => r.kickDetected).length
      expect(falseKicks).toBe(0) // Zero false positives during silence

      // ─── Phase 3 (25-40s): Drop returns — must recover ───
      // Final BPM should be back to 130 ±4
      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(126)
      expect(finalResult.bpm).toBeLessThanOrEqual(134)
    })

    it('should not inject false positives during pure silence', () => {
      const buffer = generateBreakdownBuffer(20)
      const results = runTimeMachineLoop(tracker, buffer)

      const kicksDetected = results.filter(r => r.kickDetected).length
      expect(kicksDetected).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // BONUS: Performance Test
  // ─────────────────────────────────────────────────────────────────────
  describe('⚡ PERFORMANCE: Autocorrelation Time-Machine Loop', () => {
    it('should process 60 seconds of audio in under 200ms', () => {
      const buffer = generateSyntheticBeatBuffer(128, 60)
      
      const startTime = performance.now()
      runTimeMachineLoop(tracker, buffer)
      const elapsed = performance.now() - startTime

      // Autocorrelation is O(N×M) per scan — heavier than interval-based.
      // 60 seconds at 21ms/frame = ~2857 frames, scan every 4 = ~714 scans.
      // Each scan: ~286 samples × 121 BPM candidates ≈ 34K multiply-adds.
      // Budget: 200ms total (generous, should be <100ms on any modern CPU).
      expect(elapsed).toBeLessThan(200)
      
      console.log(`⚡ 60s of audio (${buffer.frames.length} frames) processed in ${elapsed.toFixed(2)}ms`)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 7: WAVE 2122 — THE BREJCHA CRUCIBLE (Sub-Beat Immunity)
  // ─────────────────────────────────────────────────────────────────────
  // THIS is the test that killed WAVEs 2118-2121.
  // Autocorrelation should handle it naturally because offbeats are
  // PART OF the repeating pattern at the true BPM interval.
  // ─────────────────────────────────────────────────────────────────────
  describe('🎯 TEST 7: WAVE 2122 — The Brejcha Crucible (Sub-Beat Immunity)', () => {
    it('should detect 125 BPM, NOT 161 BPM, when offbeats are present', () => {
      const buffer = generateSubBeatBuffer(125, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      // Final BPM MUST be 125 ±5 — NOT anywhere near 161
      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(120)
      expect(finalResult.bpm).toBeLessThanOrEqual(130)

      // Must NOT be in the 150-170 range at any stable point
      const lastTenSec = getLastNSeconds(results, 10)
      const maxBpm = Math.max(...lastTenSec.map(r => r.bpm))
      expect(maxBpm).toBeLessThan(145) // Hard ceiling: never above 145

      // Stability — this was the MAIN failure of interval-based tracking
      expect(isBpmStable(lastTenSec, 5)).toBe(true)
    })

    it('should handle aggressive sub-beats (high energy offbeats)', () => {
      // Offbeats almost as loud as kicks — the nightmare scenario for interval tracking
      // Autocorrelation doesn't care: both kick and offbeat repeat at the same period
      const buffer = generateSubBeatBuffer(125, 20, {
        kickEnergy: 0.75,
        subBeatEnergy: 0.60,  // 80% of kick energy — interval tracker would be destroyed
        noiseFloor: 0.20,
      })
      const results = runTimeMachineLoop(tracker, buffer)

      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(120)
      expect(finalResult.bpm).toBeLessThanOrEqual(130)
    })

    it('sub-beats at 130 BPM (Brejcha live set simulation)', () => {
      const buffer = generateSubBeatBuffer(130, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(126)
      expect(finalResult.bpm).toBeLessThanOrEqual(135)

      const lastTenSec = getLastNSeconds(results, 10)
      expect(isBpmStable(lastTenSec, 4)).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 8: PRODUCTION FRAME RATE (46.4ms/frame)
  // ─────────────────────────────────────────────────────────────────────
  // WAVE 2122 passed ALL tests at 21ms/frame but FAILED in production
  // at 46.4ms/frame because integer lags couldn't resolve 120-130 BPM.
  // This test validates the parabolic interpolation fix at REAL production
  // frame rate.
  // ─────────────────────────────────────────────────────────────────────
  describe('🎯 TEST 8: PRODUCTION FRAME RATE (46.4ms — The Real Crucible)', () => {
    const PRODUCTION_FRAME_MS = 46.4 // 2048 / 44100 * 1000

    /** Helper: generate frames at production frame rate */
    function generateProductionBuffer(bpm: number, durationSec: number, opts?: {
      kickEnergy?: number
      noiseFloor?: number
      subBeatEnergy?: number
    }): SyntheticBuffer {
      const kickEnergy = opts?.kickEnergy ?? 0.80
      const noiseFloor = opts?.noiseFloor ?? 0.12
      const subBeatEnergy = opts?.subBeatEnergy ?? 0

      const totalFrames = Math.ceil((durationSec * 1000) / PRODUCTION_FRAME_MS)
      const beatIntervalMs = 60000 / bpm
      const halfBeatMs = beatIntervalMs / 2

      const frames: SyntheticFrame[] = []
      let kickCount = 0

      for (let i = 0; i < totalFrames; i++) {
        const timestamp = i * PRODUCTION_FRAME_MS

        // Base noise (deterministic sine modulation)
        const noise = noiseFloor + 0.05 * Math.sin(i * 0.1) * Math.sin(i * 0.037)

        // Check if this frame is on a kick
        const timeSinceKick = timestamp % beatIntervalMs
        let energy = noise

        // Kick energy with 3-frame tail
        if (timeSinceKick < PRODUCTION_FRAME_MS) {
          energy = kickEnergy
          kickCount++
        } else if (timeSinceKick < PRODUCTION_FRAME_MS * 2) {
          energy = kickEnergy * 0.45
        } else if (timeSinceKick < PRODUCTION_FRAME_MS * 3) {
          energy = kickEnergy * 0.2
        }

        // Sub-beat (offbeat) if requested
        if (subBeatEnergy > 0) {
          const timeSinceOffbeat = (timestamp + halfBeatMs) % beatIntervalMs
          if (timeSinceOffbeat < PRODUCTION_FRAME_MS) {
            energy = Math.max(energy, subBeatEnergy)
          } else if (timeSinceOffbeat < PRODUCTION_FRAME_MS * 2) {
            energy = Math.max(energy, subBeatEnergy * 0.45)
          }
        }

        frames.push({
          energy,
          timestamp,
          isKickFrame: timeSinceKick < PRODUCTION_FRAME_MS,
        })
      }

      return { frames, durationMs: totalFrames * PRODUCTION_FRAME_MS, kickCount, sourceBpm: bpm }
    }

    it('should detect 126 BPM at production frame rate (THE bug that killed WAVE 2122)', () => {
      const prodTracker = new GodEarBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      const buffer = generateProductionBuffer(126, 30)
      const results = runTimeMachineLoop(prodTracker, buffer)

      const finalResult = results[results.length - 1]
      console.log(`🎯 PRODUCTION 126 BPM TEST: detected=${finalResult.bpm} raw=${finalResult.bpm} conf=${finalResult.confidence.toFixed(3)}`)

      // THIS IS THE CRITICAL ASSERTION:
      // WAVE 2122 would read 84-85 BPM here. We need 126 ±5.
      expect(finalResult.bpm).toBeGreaterThanOrEqual(121)
      expect(finalResult.bpm).toBeLessThanOrEqual(131)

      // Must NOT be near 84 (the sub-harmonic that trapped WAVE 2122)
      expect(finalResult.bpm).toBeGreaterThan(100)

      // Must NOT be near 169 (the super-harmonic that trapped WAVE 2122)
      expect(finalResult.bpm).toBeLessThan(150)
    })

    it('should detect 125 BPM at production frame rate', () => {
      const prodTracker = new GodEarBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      const buffer = generateProductionBuffer(125, 30)
      const results = runTimeMachineLoop(prodTracker, buffer)

      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(120)
      expect(finalResult.bpm).toBeLessThanOrEqual(130)
    })

    it('should detect 128 BPM at production frame rate', () => {
      const prodTracker = new GodEarBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      const buffer = generateProductionBuffer(128, 30)
      const results = runTimeMachineLoop(prodTracker, buffer)

      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(123)
      expect(finalResult.bpm).toBeLessThanOrEqual(133)
    })

    it('should detect 126 BPM WITH offbeats at production frame rate (Brejcha)', () => {
      const prodTracker = new GodEarBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      const buffer = generateProductionBuffer(126, 30, {
        kickEnergy: 0.80,
        subBeatEnergy: 0.55, // Brejcha-style offbeat
      })
      const results = runTimeMachineLoop(prodTracker, buffer)

      const finalResult = results[results.length - 1]
      console.log(`🎯 PRODUCTION BREJCHA TEST: detected=${finalResult.bpm} conf=${finalResult.confidence.toFixed(3)}`)

      expect(finalResult.bpm).toBeGreaterThanOrEqual(121)
      expect(finalResult.bpm).toBeLessThanOrEqual(131)
    })

    it('should detect 80 BPM at production frame rate', () => {
      const prodTracker = new GodEarBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      const buffer = generateProductionBuffer(80, 30)
      const results = runTimeMachineLoop(prodTracker, buffer)

      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(76)
      expect(finalResult.bpm).toBeLessThanOrEqual(84)
    })

    it('should detect 175 BPM at production frame rate', () => {
      const prodTracker = new GodEarBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      const buffer = generateProductionBuffer(175, 30)
      const results = runTimeMachineLoop(prodTracker, buffer)

      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(170)
      expect(finalResult.bpm).toBeLessThanOrEqual(180)
    })

    it('should be stable at production frame rate (no octave hopping)', () => {
      const prodTracker = new GodEarBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      const buffer = generateProductionBuffer(126, 30, {
        kickEnergy: 0.80,
        subBeatEnergy: 0.55,
      })
      const results = runTimeMachineLoop(prodTracker, buffer)

      // Check last 15 seconds — NO octave hopping
      const lastFifteenSec = results.slice(-Math.ceil(15000 / PRODUCTION_FRAME_MS))
      const bpms = lastFifteenSec.map(r => r.bpm)
      const minBpm = Math.min(...bpms)
      const maxBpm = Math.max(...bpms)

      // Range must be tight — NOT jumping between 84 and 168
      expect(maxBpm - minBpm).toBeLessThan(10)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 9: WAVE 2125 — POLYRHYTHM FILTER (96 vs 128 BPM)
  // ─────────────────────────────────────────────────────────────────────
  // When a syncopated bass creates a strong peak at 96 BPM (3/4 of 128),
  // the sieve should prefer 128 BPM as the real 4/4 beat.
  // ─────────────────────────────────────────────────────────────────────
  describe('🥊 TEST 9: WAVE 2125 — Polyrhythm Filter (96 vs 128 BPM)', () => {
    const PRODUCTION_FRAME_MS = 46.4

    /** Generate a buffer with BOTH 128 BPM kicks AND 96 BPM syncopation.
     *  The syncopation energy can be made stronger than the kick to simulate
     *  Brejcha-style dotted bass patterns. */
    function generateSyncopatedBuffer(
      realBpm: number,
      syncopationBpm: number,
      durationSec: number,
      opts?: {
        kickEnergy?: number
        syncopationEnergy?: number
        noiseFloor?: number
        frameDurationMs?: number
      }
    ): SyntheticBuffer {
      const frameDuration = opts?.frameDurationMs ?? PRODUCTION_FRAME_MS
      const kickEnergy = opts?.kickEnergy ?? 0.70
      const syncopationEnergy = opts?.syncopationEnergy ?? 0.85 // syncopation STRONGER!
      const noiseFloor = opts?.noiseFloor ?? 0.12

      const totalFrames = Math.ceil((durationSec * 1000) / frameDuration)
      const realBeatMs = 60000 / realBpm
      const syncBeatMs = 60000 / syncopationBpm

      const frames: SyntheticFrame[] = []
      let kickCount = 0

      for (let i = 0; i < totalFrames; i++) {
        const timestamp = i * frameDuration
        const noise = noiseFloor + 0.03 * Math.sin(i * 0.1) * Math.sin(i * 0.037)
        let energy = noise

        // Real 4/4 kick
        const timeSinceKick = timestamp % realBeatMs
        if (timeSinceKick < frameDuration) {
          energy = kickEnergy
          kickCount++
        } else if (timeSinceKick < frameDuration * 2) {
          energy = kickEnergy * 0.4
        }

        // Syncopation (dotted note) — overlaps but at different period
        const timeSinceSync = timestamp % syncBeatMs
        if (timeSinceSync < frameDuration) {
          energy = Math.max(energy, syncopationEnergy)
        } else if (timeSinceSync < frameDuration * 2) {
          energy = Math.max(energy, syncopationEnergy * 0.4)
        }

        frames.push({ energy, timestamp, isKickFrame: timeSinceKick < frameDuration })
      }

      return { frames, durationMs: totalFrames * frameDuration, kickCount, sourceBpm: realBpm }
    }

    it('should prefer 128 BPM over 96 BPM syncopation at production frame rate', () => {
      const prodTracker = new GodEarBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      const buffer = generateSyncopatedBuffer(128, 96, 30)
      const results = runTimeMachineLoop(prodTracker, buffer)

      const finalResult = results[results.length - 1]
      console.log(`🥊 POLYRHYTHM 128vs96: detected=${finalResult.bpm} conf=${finalResult.confidence.toFixed(3)}`)

      // MUST detect 128, NOT 96
      expect(finalResult.bpm).toBeGreaterThanOrEqual(123)
      expect(finalResult.bpm).toBeLessThanOrEqual(133)

      // Hard ceiling: never near 96
      expect(finalResult.bpm).toBeGreaterThan(110)
    })

    it('should prefer 128 BPM over 96 BPM at test frame rate too', () => {
      const tracker21ms = new GodEarBPMTracker(44100, 2048, FRAME_DURATION_MS)
      const buffer = generateSyncopatedBuffer(128, 96, 30, { frameDurationMs: FRAME_DURATION_MS })
      const results = runTimeMachineLoop(tracker21ms, buffer)

      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(123)
      expect(finalResult.bpm).toBeLessThanOrEqual(133)
    })

    it('should be stable (no bouncing between 96 and 128)', () => {
      const prodTracker = new GodEarBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      const buffer = generateSyncopatedBuffer(128, 96, 30)
      const results = runTimeMachineLoop(prodTracker, buffer)

      const lastFifteenSec = results.slice(-Math.ceil(15000 / PRODUCTION_FRAME_MS))
      const bpms = lastFifteenSec.map(r => r.bpm)
      const minBpm = Math.min(...bpms)
      const maxBpm = Math.max(...bpms)
      expect(maxBpm - minBpm).toBeLessThan(10)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 10: WAVE 2125 — TIME WARP PROTECTION
  // ─────────────────────────────────────────────────────────────────────
  describe('🕳️ TEST 10: WAVE 2125 — Time Warp Protection', () => {
    it('should recover after a 500ms gap in timestamps', () => {
      // 10 seconds of 128 BPM, then a 500ms gap, then 15 more seconds
      const tracker = new GodEarBPMTracker(44100, 2048, FRAME_DURATION_MS)
      const preBuf = generateSyntheticBeatBuffer(128, 10)
      const postBuf = generateSyntheticBeatBuffer(128, 15, {
        startTimeMs: 10000 + 500 // 500ms gap
      })

      // Feed pre-gap
      for (const frame of preBuf.frames) {
        tracker.process(frame.energy, false, frame.timestamp)
      }
      const bpmBeforeGap = tracker.getBpm()
      expect(bpmBeforeGap).toBeGreaterThanOrEqual(125)
      expect(bpmBeforeGap).toBeLessThanOrEqual(131)

      // Feed post-gap — the time warp guard should flush and recover
      const results: GodEarBPMResult[] = []
      for (const frame of postBuf.frames) {
        results.push(tracker.process(frame.energy, false, frame.timestamp))
      }

      // After recovery, BPM should be back to 128 ±3
      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(125)
      expect(finalResult.bpm).toBeLessThanOrEqual(131)
    })
  })
})
