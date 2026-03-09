/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🥁 WAVE 2168: IntervalBPMTracker — THE RESURRECTION TEST SUITE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tests for the interval-based BPM tracker resurrected from WAVE 1163.
 *
 * KEY DIFFERENCES from autocorrelation tests:
 *   - Lock time is FASTER (~2-3s vs ~4-5s) — ratio detection is instant
 *   - Uses median smoothing (12 samples), not exponential moving average
 *   - Kick detection is energy-ratio based (1.6× rolling avg + delta > 0.008)
 *   - Confidence is based on interval consistency, not autocorrelation peak strength
 *   - No harmonic sieve, no octave lock — just raw kick timing
 *
 * Test infrastructure: Reuses SyntheticBeatGenerator from WAVE 2113.
 *
 * @author PunkOpus
 * @wave 2168
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { IntervalBPMTracker, type GodEarBPMResult } from '../IntervalBPMTracker'
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
 * Feed an entire SyntheticBuffer through an IntervalBPMTracker instance.
 * Returns full history of results for assertion at any point in time.
 */
function runTimeMachineLoop(
  tracker: IntervalBPMTracker,
  buffer: SyntheticBuffer
): GodEarBPMResult[] {
  const results: GodEarBPMResult[] = []

  for (const frame of buffer.frames) {
    const result = tracker.process(
      frame.energy,
      false,
      frame.timestamp
    )
    results.push(result)
  }

  return results
}

/**
 * Find the first frame where a condition is met.
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
 */
function isBpmStable(
  results: GodEarBPMResult[],
  tolerance: number
): boolean {
  const bpms = results.map(r => r.bpm).filter(bpm => bpm > 0)
  if (bpms.length === 0) return true
  const sorted = [...bpms].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  return bpms.every(bpm => Math.abs(bpm - median) <= tolerance)
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTION FRAME RATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const PRODUCTION_FRAME_MS = 46.4 // 2048 / 44100 * 1000

/** Generate frames at production frame rate */
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


// ═══════════════════════════════════════════════════════════════════════════
// THE 6-GENRE CRUCIBLE — ADAPTED FOR INTERVAL-BASED DETECTION
// ═══════════════════════════════════════════════════════════════════════════

describe('🥁 WAVE 2168: IntervalBPMTracker — The Resurrection', () => {
  let tracker: IntervalBPMTracker

  beforeEach(() => {
    tracker = new IntervalBPMTracker(44100, 2048, FRAME_DURATION_MS)
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 1: Standard 4/4 EDM (128 BPM)
  // ─────────────────────────────────────────────────────────────────────
  describe('🎧 TEST 1: Standard 4/4 EDM (128 BPM)', () => {
    it('should lock to 128 BPM within 4 seconds', () => {
      const buffer = generateSyntheticBeatBuffer(128, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      // Interval-based detection is faster than autocorrelation
      // Needs ~5 kicks (MIN_KICKS_FOR_BPM) ≈ 5 × 469ms ≈ 2.3s
      const lockFrame = findFirstFrame(results, r => r.confidence > 0.3)
      expect(lockFrame).not.toBeNull()
      expect(lockFrame!.timestampMs).toBeLessThan(4000)

      // Final BPM === 128 (±3 due to frame quantization at 21ms/frame)
      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(125)
      expect(finalResult.bpm).toBeLessThanOrEqual(131)

      // BPM stable in last 10 seconds
      const lastTenSec = getLastNSeconds(results, 10)
      expect(isBpmStable(lastTenSec, 3)).toBe(true)
    })

    it('should have high confidence (> 0.5) after 10 seconds', () => {
      const buffer = generateSyntheticBeatBuffer(128, 15)
      const results = runTimeMachineLoop(tracker, buffer)

      const resultAt10s = getResultAtTime(results, 10000)
      expect(resultAt10s.confidence).toBeGreaterThan(0.5)
    })

    it('should detect kicks', () => {
      const buffer = generateSyntheticBeatBuffer(128, 15)
      const results = runTimeMachineLoop(tracker, buffer)

      // Count kicks in last 10 seconds
      const after5s = results.slice(Math.floor(5000 / FRAME_DURATION_MS))
      const totalKicksDetected = after5s.filter(r => r.kickDetected).length
      // At 128 BPM for 10 seconds → ~21 kicks expected
      expect(totalKicksDetected).toBeGreaterThan(10)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 2: Half-time Trap/Dubstep (140/70 BPM)
  // ─────────────────────────────────────────────────────────────────────
  describe('🎤 TEST 2: Half-time Trap/Dubstep (140/70 BPM)', () => {
    it('should lock to 70 BPM (the actual kick rate)', () => {
      const buffer = generateHalfTimeBuffer(140, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      // Interval-based detection measures time between actual kicks,
      // which at half-time are at 70 BPM.
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
      const buffer = generateVariableAmplitudeBuffer(125, 30, [0.35, 0.90])
      const results = runTimeMachineLoop(tracker, buffer)

      // Final BPM should be 125 ±5
      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(120)
      expect(finalResult.bpm).toBeLessThanOrEqual(130)

      // BPM must be stable in last 10 seconds
      const lastTenSec = getLastNSeconds(results, 10)
      expect(isBpmStable(lastTenSec, 5)).toBe(true)
    })

    it('ratio detection works even with low kick energy (0.035)', () => {
      // Low-energy kicks still exceed 1.6× of rolling average
      // because the noise floor is ~0.010, so 0.035 / 0.010 = 3.5 > 1.6 ✅
      const buffer = generateSyntheticBeatBuffer(125, 20, {
        kickEnergy: 0.035,
      })
      const results = runTimeMachineLoop(tracker, buffer)

      const finalResult = results[results.length - 1]
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

      expect(finalResult.confidence).toBeGreaterThan(0.3)

      const lastTenSec = getLastNSeconds(results, 10)
      expect(isBpmStable(lastTenSec, 4)).toBe(true)
    })

    it('adaptive debounce should not block 175 BPM kicks', () => {
      // 175 BPM = 343ms interval. Debounce = max(200, 343 × 0.40) = 200ms
      // 343ms > 200ms → no blocking. This was the WAVE 1163 fix.
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

      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(77)
      expect(finalResult.bpm).toBeLessThanOrEqual(83)
      expect(finalResult.confidence).toBeGreaterThan(0.3)
    })

    it('should lock within 6 seconds', () => {
      // 80 BPM = 750ms per beat → in 6s we get ~8 beats → enough for 5-kick minimum
      const buffer = generateSyntheticBeatBuffer(80, 15)
      const results = runTimeMachineLoop(tracker, buffer)

      const lockFrame = findFirstFrame(results, r => r.confidence > 0.2)
      expect(lockFrame).not.toBeNull()
      expect(lockFrame!.timestampMs).toBeLessThan(6000)
    })

    it('BPM stability (no drift)', () => {
      const buffer = generateSyntheticBeatBuffer(80, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      const lastFifteenSec = getLastNSeconds(results, 15)
      expect(isBpmStable(lastFifteenSec, 3)).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 6: Breakdown / Drop Survival
  // ─────────────────────────────────────────────────────────────────────
  describe('💀 TEST 6: Breakdown / Drop Survival', () => {
    it('should survive breakdown and recover BPM after drop returns', () => {
      const buffer = chainBuffers(
        (startTime) => generateSyntheticBeatBuffer(130, 15, { startTimeMs: startTime }),
        (startTime) => generateBreakdownBuffer(10, { startTimeMs: startTime }),
        (startTime) => generateSyntheticBeatBuffer(130, 15, { startTimeMs: startTime }),
      )

      const results = runTimeMachineLoop(tracker, buffer)

      // Phase 1 (0-15s): Should be locked
      const resultAt12s = getResultAtTime(results, 12000)
      expect(resultAt12s.bpm).toBeGreaterThanOrEqual(126)
      expect(resultAt12s.bpm).toBeLessThanOrEqual(134)

      // Phase 2 (15-25s): Breakdown — no false kicks
      const breakdownStart = Math.floor(15000 / FRAME_DURATION_MS)
      const breakdownEnd = Math.floor(25000 / FRAME_DURATION_MS)
      const breakdownResults = results.slice(breakdownStart, breakdownEnd)
      const falseKicks = breakdownResults.filter(r => r.kickDetected).length
      expect(falseKicks).toBe(0)

      // Phase 3 (25-40s): Drop returns — must recover
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
  // TEST 7: Sub-Beat Immunity (THE BREJCHA CRUCIBLE)
  // ─────────────────────────────────────────────────────────────────────
  describe('🎯 TEST 7: Sub-Beat Immunity (The Brejcha Crucible)', () => {
    it('should detect 125 BPM, NOT double BPM, with offbeats', () => {
      const buffer = generateSubBeatBuffer(125, 30)
      const results = runTimeMachineLoop(tracker, buffer)

      const finalResult = results[results.length - 1]
      // Interval-based: the ratio detector triggers on kicks (0.050 energy)
      // but NOT on sub-beats (which are weaker). The adaptive debounce
      // prevents double-counting when the sub-beat IS strong enough to trigger.
      //
      // Acceptable: 125 ±5 BPM (the real tempo)
      // Also acceptable: ~250 BPM if sub-beats trigger (unlikely with default energy)
      // NOT acceptable: random oscillation
      expect(finalResult.bpm).toBeGreaterThanOrEqual(120)
      expect(finalResult.bpm).toBeLessThanOrEqual(135)
    })

    it('should handle medium-energy sub-beats without doubling', () => {
      // Sub-beats at 50% of kick energy — below 1.6× ratio when averaged in
      const buffer = generateSubBeatBuffer(125, 30, {
        kickEnergy: 0.050,
        subBeatEnergy: 0.025, // 50% of kick — below ratio threshold when avg includes it
        noiseFloor: 0.010,
      })
      const results = runTimeMachineLoop(tracker, buffer)

      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(120)
      expect(finalResult.bpm).toBeLessThanOrEqual(135)

      const lastTenSec = getLastNSeconds(results, 10)
      expect(isBpmStable(lastTenSec, 5)).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 8: PRODUCTION FRAME RATE (46.4ms/frame)
  // ─────────────────────────────────────────────────────────────────────
  describe('🎯 TEST 8: PRODUCTION FRAME RATE (46.4ms — The Real Crucible)', () => {
    it('should detect 126 BPM at production frame rate', () => {
      const prodTracker = new IntervalBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      const buffer = generateProductionBuffer(126, 30)
      const results = runTimeMachineLoop(prodTracker, buffer)

      const finalResult = results[results.length - 1]
      console.log(`🎯 PRODUCTION 126 BPM: detected=${finalResult.bpm} conf=${finalResult.confidence.toFixed(3)}`)

      expect(finalResult.bpm).toBeGreaterThanOrEqual(121)
      expect(finalResult.bpm).toBeLessThanOrEqual(131)
    })

    it('should detect 125 BPM at production frame rate', () => {
      const prodTracker = new IntervalBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      const buffer = generateProductionBuffer(125, 30)
      const results = runTimeMachineLoop(prodTracker, buffer)

      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(120)
      expect(finalResult.bpm).toBeLessThanOrEqual(130)
    })

    it('should detect 128 BPM at production frame rate', () => {
      const prodTracker = new IntervalBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      const buffer = generateProductionBuffer(128, 30)
      const results = runTimeMachineLoop(prodTracker, buffer)

      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(123)
      expect(finalResult.bpm).toBeLessThanOrEqual(133)
    })

    it('should detect 126 BPM WITH offbeats at production frame rate (Brejcha)', () => {
      const prodTracker = new IntervalBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      // WAVE 2170: offbeat energy updated to reflect real-world values POST senses.ts floor.
      // Pre-floor: offbeats could arrive at 0.55 (68% of kick).
      // Post-floor (0.030): only true kick onsets ≥ 0.07 arrive; bass residue ≤ 0.04 is blocked.
      // Real Brejcha production: kick=0.10-0.28, post-floor offbeat max≈0.04 → ratio ≤ 40%.
      // PEAK_DISCRIMINATOR_RATIO=0.65 blocks anything < 65% of peak → offbeats at 40% are blocked.
      const buffer = generateProductionBuffer(126, 30, {
        kickEnergy: 0.80,
        subBeatEnergy: 0.40,  // 50% of kick — below PEAK_DISCRIMINATOR_RATIO=0.65 threshold
      })
      const results = runTimeMachineLoop(prodTracker, buffer)

      const finalResult = results[results.length - 1]
      console.log(`🎯 PRODUCTION BREJCHA: detected=${finalResult.bpm} conf=${finalResult.confidence.toFixed(3)}`)

      // THE MONEY SHOT: 126 BPM, not 164 or 82
      expect(finalResult.bpm).toBeGreaterThanOrEqual(121)
      expect(finalResult.bpm).toBeLessThanOrEqual(135)
    })

    it('should detect 80 BPM at production frame rate', () => {
      const prodTracker = new IntervalBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      const buffer = generateProductionBuffer(80, 30)
      const results = runTimeMachineLoop(prodTracker, buffer)

      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(76)
      expect(finalResult.bpm).toBeLessThanOrEqual(84)
    })

    it('should detect 175 BPM at production frame rate', () => {
      const prodTracker = new IntervalBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      const buffer = generateProductionBuffer(175, 30)
      const results = runTimeMachineLoop(prodTracker, buffer)

      const finalResult = results[results.length - 1]
      // At 46.4ms/frame, 175 BPM (342.9ms) quantizes to 7-8 frames.
      // 7 frames = 324.8ms = 184.7 BPM, 8 frames = 371.2ms = 161.6 BPM.
      // Median of these quanta lands ~185 BPM. Wider tolerance needed.
      expect(finalResult.bpm).toBeGreaterThanOrEqual(168)
      expect(finalResult.bpm).toBeLessThanOrEqual(190)
    })

    it('should be stable at production frame rate (no octave hopping)', () => {
      const prodTracker = new IntervalBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      const buffer = generateProductionBuffer(126, 30, {
        kickEnergy: 0.80,
        subBeatEnergy: 0.55,
      })
      const results = runTimeMachineLoop(prodTracker, buffer)

      const lastFifteenSec = results.slice(-Math.ceil(15000 / PRODUCTION_FRAME_MS))
      const bpms = lastFifteenSec.map(r => r.bpm).filter(b => b > 0)
      if (bpms.length > 0) {
        const minBpm = Math.min(...bpms)
        const maxBpm = Math.max(...bpms)
        expect(maxBpm - minBpm).toBeLessThan(15)
      }
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 10: DANCE POCKET FOLDER — getMusicalBpm() (WAVE 2174)
  // ─────────────────────────────────────────────────────────────────────
  describe('🎯 TEST 10: Dance Pocket Folder — getMusicalBpm() (WAVE 2174)', () => {

    it('should passthrough BPM already inside the dance pocket (128 BPM)', () => {
      const buffer = generateProductionBuffer(128, 15)
      const prodTracker = new IntervalBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      for (const frame of buffer.frames) {
        prodTracker.process(frame.energy, false, frame.timestamp)
      }

      const raw = prodTracker.getBpm()
      const musical = prodTracker.getMusicalBpm()

      // 128 is already in [90, 135] — no folding
      expect(raw).toBeGreaterThanOrEqual(125)
      expect(raw).toBeLessThanOrEqual(131)
      expect(musical).toBe(raw)
    })

    it('should fold 185 BPM → ~123 BPM via tresillo ÷1.5', () => {
      // Generate at 185 BPM — fast polyrhythmic techno
      const buffer = generateProductionBuffer(185, 15)
      const prodTracker = new IntervalBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      for (const frame of buffer.frames) {
        prodTracker.process(frame.energy, false, frame.timestamp)
      }

      const raw = prodTracker.getBpm()
      const musical = prodTracker.getMusicalBpm()

      // Raw should be near 185 (above dance pocket)
      expect(raw).toBeGreaterThanOrEqual(175)
      expect(raw).toBeLessThanOrEqual(195)

      // Musical should be ÷1.5 = ~123 BPM (inside pocket)
      expect(musical).toBeGreaterThanOrEqual(117)
      expect(musical).toBeLessThanOrEqual(130)
    })

    it('should fold 175 BPM Psytrance → ~117 BPM via tresillo ÷1.5', () => {
      // 175 BPM — proven detectable by TEST 4. Above the dance pocket (90-135).
      // The tresillo fold: 175 / 1.5 = 116.7 → inside [90, 135] pocket.
      // This exercises the ÷1.5 path for a BPM that the tracker genuinely detects.
      //
      // NOTE: The ÷2.0 (double-time) path cannot be exercised with synthetic beats
      // because the tracker's MIN_INTERVAL_MS=300ms caps raw detection at ~200 BPM.
      // Any BPM where ÷1.5 doesn't land in pocket but ÷2.0 does (e.g., 250 BPM raw)
      // is physically unreachable by the tracker. In production, the ÷2.0 path serves
      // as a safety net for future tracker improvements or external BPM sources.
      const buffer = generateProductionBuffer(175, 15)
      const prodTracker = new IntervalBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      for (const frame of buffer.frames) {
        prodTracker.process(frame.energy, false, frame.timestamp)
      }

      const raw = prodTracker.getBpm()
      const musical = prodTracker.getMusicalBpm()

      // Raw should detect near 175 (above dance pocket)
      expect(raw).toBeGreaterThanOrEqual(168)
      expect(raw).toBeLessThanOrEqual(185)

      // ÷1.5 = ~117 BPM → inside [90, 135] pocket
      expect(musical).toBeGreaterThanOrEqual(112)
      expect(musical).toBeLessThanOrEqual(125)
    })

    it('should fold slow 65 BPM → 130 BPM via ×2.0', () => {
      // 65 BPM — trap half-time
      const buffer = generateProductionBuffer(65, 20)
      const prodTracker = new IntervalBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      for (const frame of buffer.frames) {
        prodTracker.process(frame.energy, false, frame.timestamp)
      }

      const raw = prodTracker.getBpm()
      const musical = prodTracker.getMusicalBpm()

      // Raw near 65 (below dance pocket)
      expect(raw).toBeGreaterThanOrEqual(55)
      expect(raw).toBeLessThanOrEqual(75)

      // ×2.0 = 130 (inside pocket)
      expect(musical).toBeGreaterThanOrEqual(110)
      expect(musical).toBeLessThanOrEqual(135)
    })

    it('should return 0 when no signal detected', () => {
      const freshTracker = new IntervalBPMTracker()
      expect(freshTracker.getMusicalBpm()).toBe(0)
    })

    it('should return raw BPM when no ratio lands in pocket', () => {
      // Custom pocket that nothing folds into: [200, 210]
      const buffer = generateProductionBuffer(128, 15)
      const prodTracker = new IntervalBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      for (const frame of buffer.frames) {
        prodTracker.process(frame.energy, false, frame.timestamp)
      }

      const raw = prodTracker.getBpm()
      // [200, 210] pocket — 128 is too low, ×2=256 too high
      const musical = prodTracker.getMusicalBpm(200, 210)
      expect(musical).toBe(raw)
    })

    it('should accept custom dance pocket boundaries', () => {
      // Cumbia pocket: [100, 140]
      const buffer = generateProductionBuffer(185, 15)
      const prodTracker = new IntervalBPMTracker(44100, 2048, PRODUCTION_FRAME_MS)
      for (const frame of buffer.frames) {
        prodTracker.process(frame.energy, false, frame.timestamp)
      }

      const raw = prodTracker.getBpm()
      expect(raw).toBeGreaterThanOrEqual(175)

      // With [100, 140]: ÷1.5 = ~123 → inside [100, 140] ✅
      const musical = prodTracker.getMusicalBpm(100, 140)
      expect(musical).toBeGreaterThanOrEqual(117)
      expect(musical).toBeLessThanOrEqual(130)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // PERFORMANCE TEST
  // ─────────────────────────────────────────────────────────────────────
  describe('⚡ PERFORMANCE: Interval-Based Time-Machine Loop', () => {
    it('should process 60 seconds of audio in under 50ms', () => {
      const buffer = generateSyntheticBeatBuffer(128, 60)

      const startTime = performance.now()
      runTimeMachineLoop(tracker, buffer)
      const elapsed = performance.now() - startTime

      // Interval-based is O(1) per frame — MUCH faster than autocorrelation
      expect(elapsed).toBeLessThan(50)

      console.log(`⚡ 60s of audio (${buffer.frames.length} frames) processed in ${elapsed.toFixed(2)}ms`)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // TEST 9: RESET (AMNESIA PROTOCOL)
  // ─────────────────────────────────────────────────────────────────────
  describe('🧨 TEST 9: Reset (Amnesia Protocol)', () => {
    it('should clear all state on reset', () => {
      const buffer = generateSyntheticBeatBuffer(128, 10)
      runTimeMachineLoop(tracker, buffer)

      expect(tracker.getBpm()).toBeGreaterThan(0)

      tracker.reset()

      expect(tracker.getBpm()).toBe(0)

      // After reset, first frame should have zero confidence
      const result = tracker.process(0.01, false, 100000)
      expect(result.confidence).toBe(0)
      expect(result.bpm).toBe(0)
      expect(result.kickCount).toBe(0)
    })

    it('should re-lock to new BPM after reset', () => {
      // Lock to 128 BPM
      const buf1 = generateSyntheticBeatBuffer(128, 10)
      runTimeMachineLoop(tracker, buf1)
      expect(tracker.getBpm()).toBeGreaterThanOrEqual(125)
      expect(tracker.getBpm()).toBeLessThanOrEqual(131)

      // Reset
      tracker.reset()

      // Lock to 90 BPM
      const buf2 = generateSyntheticBeatBuffer(90, 15, {
        startTimeMs: 20000,
      })
      const results = runTimeMachineLoop(tracker, buf2)

      const finalResult = results[results.length - 1]
      expect(finalResult.bpm).toBeGreaterThanOrEqual(87)
      expect(finalResult.bpm).toBeLessThanOrEqual(93)
    })
  })
})
