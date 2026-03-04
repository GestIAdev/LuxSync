/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔥 WAVE 2113: THE AUTOMATON — GodEarBPMTracker Stress-Test Suite
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 6-Genre Crucible: Deterministic offline tests that run in <50ms CPU.
 * No Web Audio API. No mp3 files. No real-time. Pure math.
 * 
 * The Time-Machine Loop: Instantiates GodEarBPMTracker, feeds synthetic
 * frames in a synchronous for-loop, advances timestamps by FRAME_DURATION_MS.
 * A "minute" of audio processes in milliseconds.
 * 
 * @author PunkOpus
 * @wave 2113
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { GodEarBPMTracker, type GodEarBPMResult } from '../GodEarBPMTracker'
import {
  generateSyntheticBeatBuffer,
  generateHalfTimeBuffer,
  generateBreakdownBuffer,
  generateVariableAmplitudeBuffer,
  chainBuffers,
  FRAME_DURATION_MS,
  type SyntheticBuffer,
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

describe('🔥 WAVE 2113: GodEarBPMTracker — The 6-Genre Crucible', () => {
  let tracker: GodEarBPMTracker

  beforeEach(() => {
    tracker = new GodEarBPMTracker()
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 1: Standard 4/4 EDM (128 BPM)
  // ─────────────────────────────────────────────────────────────────────
  describe('🎧 TEST 1: Standard 4/4 EDM (128 BPM)', () => {
    it('should lock to 128 BPM with confidence > 0.5 within 3 seconds', () => {
      const buffer = generateSyntheticBeatBuffer(128, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      // Assert: confidence > 0.5 within 3 seconds (3000ms / 21ms ≈ 143 frames)
      const lockFrame = findFirstFrame(results, r => r.confidence > 0.5)
      expect(lockFrame).not.toBeNull()
      expect(lockFrame!.timestampMs).toBeLessThan(3000)

      // Assert: final BPM === 128 (±3 due to frame quantization)
      // At 21ms/frame, intervals quantize to 462-483ms → median → 129-130 BPM
      // This is a systematic offset from discrete time, not a tracker bug
      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(126)
      expect(finalResult.bpm).toBeLessThanOrEqual(131)

      // Assert: BPM stable in last 10 seconds (no oscillation)
      const lastTenSec = getLastNSeconds(results, 10)
      expect(isBpmStable(lastTenSec, 2)).toBe(true)
    })

    it('should have high confidence (> 0.7) after 10 seconds', () => {
      const buffer = generateSyntheticBeatBuffer(128, 15)
      const results = runTimeMachineLoop(tracker, buffer)

      const resultAt10s = getResultAtTime(results, 10000)
      expect(resultAt10s.confidence).toBeGreaterThan(0.7)
    })

    it('should detect kicks at the correct rate', () => {
      const buffer = generateSyntheticBeatBuffer(128, 10)
      const results = runTimeMachineLoop(tracker, buffer)

      // At 128 BPM for 10 seconds → ~21 kicks expected
      const totalKicksDetected = results.filter(r => r.kickDetected).length
      const expectedKicks = Math.floor(10 * 128 / 60)
      // Allow 30% tolerance (some kicks may be debounced or missed at start)
      expect(totalKicksDetected).toBeGreaterThan(expectedKicks * 0.7)
      expect(totalKicksDetected).toBeLessThan(expectedKicks * 1.3)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 2: Half-time Trap/Dubstep (140/70 BPM)
  // ─────────────────────────────────────────────────────────────────────
  describe('🎤 TEST 2: Half-time Trap/Dubstep (140/70 BPM)', () => {
    it('should lock to 70 BPM and NOT oscillate between 70 and 140', () => {
      const buffer = generateHalfTimeBuffer(140, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      // The tracker should lock to 70 BPM (the actual kick rate)
      // If Octave Protection doubles it to 140, that's also acceptable
      // What's NOT acceptable: oscillating between 70 and 140
      const finalResult = results[results.length - 1]
      const detectedBpm = finalResult.bpm

      // Must be near 70 OR near 140 — but COMMITTED to one
      const isNear70 = Math.abs(detectedBpm - 70) <= 3
      const isNear140 = Math.abs(detectedBpm - 140) <= 3
      expect(isNear70 || isNear140).toBe(true)

      // Assert stability: no oscillation in last 15 seconds
      const lastFifteenSec = getLastNSeconds(results, 15)
      expect(isBpmStable(lastFifteenSec, 4)).toBe(true)
    })

    it('should achieve confidence > 0.3 within 5 seconds', () => {
      const buffer = generateHalfTimeBuffer(140, 15)
      const results = runTimeMachineLoop(tracker, buffer)

      // Half-time has longer intervals → needs more time to build confidence
      const lockFrame = findFirstFrame(results, r => r.confidence > 0.3)
      expect(lockFrame).not.toBeNull()
      expect(lockFrame!.timestampMs).toBeLessThan(5000)
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

      // Final BPM should be 125 ±2
      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(123)
      expect(finalResult.bpm).toBeLessThanOrEqual(127)

      // BPM must be stable in last 10 seconds — the RATIO detection
      // should be immune to amplitude changes
      const lastTenSec = getLastNSeconds(results, 10)
      expect(isBpmStable(lastTenSec, 3)).toBe(true)
    })

    it('ratio detection must work even when kick energy is only 0.35 (2.9× floor)', () => {
      // Worst case: all kicks at minimum amplitude
      const buffer = generateSyntheticBeatBuffer(125, 20, {
        kickEnergy: 0.35, // Only 2.9× above 0.12 floor — close to threshold
      })
      const results = runTimeMachineLoop(tracker, buffer)

      // Should still lock — 0.35 / 0.12 ≈ 2.9 is above KICK_RATIO_THRESHOLD (1.6)
      const finalResult = results[results.length - 1]
      expect(finalResult.confidence).toBeGreaterThan(0.3)
      expect(finalResult.bpm).toBeGreaterThanOrEqual(123)
      expect(finalResult.bpm).toBeLessThanOrEqual(127)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 4: High-BPM Psytrance (175 BPM)
  // ─────────────────────────────────────────────────────────────────────
  describe('🌀 TEST 4: High-BPM Psytrance / Hi-Tech (175 BPM)', () => {
    it('should lock to 175 BPM without debounce collision', () => {
      // 175 BPM → 342ms interval
      // Adaptive debounce: max(200, 342 * 0.40) = max(200, 137) = 200ms
      // 200ms < 342ms → debounce should NOT eat the kicks
      const buffer = generateSyntheticBeatBuffer(175, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      // Final BPM should be 175 (±4 due to frame quantization)
      // At 21ms/frame, 175 BPM interval=342.8ms quantizes to 336-357ms → 168-179 BPM
      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(172)
      expect(finalResult.bpm).toBeLessThanOrEqual(180)

      // Confidence should be high — regular fast kicks
      expect(finalResult.confidence).toBeGreaterThan(0.5)

      // Stability in last 10 seconds
      const lastTenSec = getLastNSeconds(results, 10)
      expect(isBpmStable(lastTenSec, 3)).toBe(true)
    })

    it('MIN_INTERVAL_MS (200ms) must not clip kicks at 175 BPM', () => {
      // 175 BPM = 342ms between kicks
      // Each kick should pass the 200ms debounce comfortably
      const buffer = generateSyntheticBeatBuffer(175, 10)
      const results = runTimeMachineLoop(tracker, buffer)

      const totalKicksDetected = results.filter(r => r.kickDetected).length
      const expectedKicks = Math.floor(10 * 175 / 60) // ~29 kicks
      // Must detect at least 80% — debounce shouldn't eat any
      expect(totalKicksDetected).toBeGreaterThan(expectedKicks * 0.8)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 5: Ambient/Chillout Slow (80 BPM)
  // ─────────────────────────────────────────────────────────────────────
  describe('🌙 TEST 5: Ambient/Chillout Slow (80 BPM)', () => {
    it('should correctly detect 80 BPM without treating long intervals as errors', () => {
      // 80 BPM → 750ms interval
      // MAX_INTERVAL_MS is 1500ms → 750ms fits comfortably
      const buffer = generateSyntheticBeatBuffer(80, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      // Final BPM should be 80 ±2
      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(78)
      expect(finalResult.bpm).toBeLessThanOrEqual(82)

      // Confidence may be slightly lower due to longer intervals
      // but should still be meaningful
      expect(finalResult.confidence).toBeGreaterThan(0.4)
    })

    it('should lock within 5 seconds even at slow tempo', () => {
      // 80 BPM = 750ms per beat → in 5s we get ~6 kicks → enough for detection
      const buffer = generateSyntheticBeatBuffer(80, 15)
      const results = runTimeMachineLoop(tracker, buffer)

      const lockFrame = findFirstFrame(results, r => r.confidence > 0.3)
      expect(lockFrame).not.toBeNull()
      expect(lockFrame!.timestampMs).toBeLessThan(5000)
    })

    it('BPM stability in last 15 seconds (no drift)', () => {
      const buffer = generateSyntheticBeatBuffer(80, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      const lastFifteenSec = getLastNSeconds(results, 15)
      expect(isBpmStable(lastFifteenSec, 2)).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 6: The Breakdown / Drop Survival (Freewheeling)
  // ─────────────────────────────────────────────────────────────────────
  describe('💀 TEST 6: Breakdown / Drop Survival (Freewheeling)', () => {
    it('should survive breakdown and recover BPM after drop returns', () => {
      // Structure: 15s kicks at 130 BPM → 10s silence → 15s kicks at 130 BPM
      const buffer = chainBuffers(
        // Segment 1: 15 seconds of kicks at 130 BPM
        (startTime) => generateSyntheticBeatBuffer(130, 15, { startTimeMs: startTime }),
        // Segment 2: 10 seconds of breakdown (silence)
        (startTime) => generateBreakdownBuffer(10, { startTimeMs: startTime }),
        // Segment 3: 15 seconds of kicks at 130 BPM (the DROP)
        (startTime) => generateSyntheticBeatBuffer(130, 15, { startTimeMs: startTime }),
      )

      const results = runTimeMachineLoop(tracker, buffer)

      // ─── Phase 1 (0-15s): Should be locked ───
      const resultAt12s = getResultAtTime(results, 12000)
      expect(resultAt12s.bpm).toBeGreaterThanOrEqual(128)
      expect(resultAt12s.bpm).toBeLessThanOrEqual(132)
      expect(resultAt12s.confidence).toBeGreaterThan(0.5)

      // ─── Phase 2 (15-25s): Breakdown — no new kicks ───
      // The tracker retains its history during silence.
      // Confidence stays high because the EXISTING intervals still have low variance.
      // This is CORRECT behavior: the tracker "remembers" the tempo.
      // What matters is: NO FALSE KICKS during silence.
      const breakdownStart = Math.floor(15000 / FRAME_DURATION_MS)
      const breakdownEnd = Math.floor(25000 / FRAME_DURATION_MS)
      const breakdownResults = results.slice(breakdownStart, breakdownEnd)
      const falseKicks = breakdownResults.filter(r => r.kickDetected).length
      expect(falseKicks).toBe(0) // Zero false positives during silence

      // Kick count should not increase during breakdown (allow ±1 for frame boundary)
      const kicksBeforeBreakdown = getResultAtTime(results, 14500).kickCount
      const kicksAfterBreakdown = getResultAtTime(results, 24500).kickCount
      expect(Math.abs(kicksAfterBreakdown - kicksBeforeBreakdown)).toBeLessThanOrEqual(1)

      // ─── Phase 3 (25-40s): Drop returns — must recover ───
      // Should recover confidence > 0.30 within 2 seconds after drop (by 27s)
      const dropStartFrame = Math.floor(25000 / FRAME_DURATION_MS)
      const recoveryFrame = findFirstFrame(
        results,
        r => r.confidence > 0.30,
        dropStartFrame
      )
      expect(recoveryFrame).not.toBeNull()
      // Recovery within 2 seconds of the drop returning
      const recoveryTimeAfterDrop = recoveryFrame!.timestampMs - 25000
      expect(recoveryTimeAfterDrop).toBeLessThan(2000)

      // Final BPM should be back to 130 ±2
      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(128)
      expect(finalResult.bpm).toBeLessThanOrEqual(132)
    })

    it('should not inject false positives during pure silence', () => {
      // 20 seconds of pure breakdown
      const buffer = generateBreakdownBuffer(20)
      const results = runTimeMachineLoop(tracker, buffer)

      // Zero kicks should be detected
      const kicksDetected = results.filter(r => r.kickDetected).length
      expect(kicksDetected).toBe(0)

      // Confidence should stay at 0 or near 0
      const finalResult = results[results.length - 1]
      expect(finalResult.confidence).toBeLessThanOrEqual(0.1)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // BONUS: Performance Test
  // ─────────────────────────────────────────────────────────────────────
  describe('⚡ PERFORMANCE: The Time-Machine Loop', () => {
    it('should process 60 seconds of audio in under 50ms', () => {
      const buffer = generateSyntheticBeatBuffer(128, 60)
      
      const startTime = performance.now()
      runTimeMachineLoop(tracker, buffer)
      const elapsed = performance.now() - startTime

      // 60 seconds → ~2857 frames → must complete in <50ms
      expect(elapsed).toBeLessThan(50)
      
      // Log actual performance for human reference
      console.log(`⚡ 60s of audio (${buffer.frames.length} frames) processed in ${elapsed.toFixed(2)}ms`)
    })
  })
})
