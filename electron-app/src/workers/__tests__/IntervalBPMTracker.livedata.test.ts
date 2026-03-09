/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 👻 WAVE 2172: DATA-DRIVEN MIR TEST — THE COLD LAB
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Industry-standard MIR (Music Information Retrieval) testing methodology:
 *
 *   1. Shadow Logger captures ~46 seconds of REAL audio telemetry from
 *      the GodEar while Boris Brejcha plays on YouTube.
 *   2. The dump is saved to electron-app/test-data/live_audio_dump.json.
 *   3. THIS TEST loads that JSON and replays it through the tracker in <50ms.
 *   4. PunkOpus tunes the gate/tracker math until the test is GREEN.
 *   5. Zero live-tests required. Pure cold-lab iteration.
 *
 * HOW TO USE:
 *   1. Run the app with music playing (46 seconds minimum).
 *   2. The Shadow Logger in senses.ts auto-dumps to test-data/.
 *   3. Run: npx vitest run IntervalBPMTracker.livedata.test.ts
 *   4. If RED → tune constants → run again. No app restart needed.
 *
 * THE TWO REPLAY MODES:
 *
 *   MODE A: "needle replay" — feeds the pre-gated needle directly.
 *           Tests the TRACKER in isolation. If this fails, the tracker
 *           math is wrong. If this passes, the gate is wrong.
 *
 *   MODE B: "raw replay" — recalculates needle from rawBassFlux +
 *           centroid using the SAME gate logic as senses.ts.
 *           Tests the FULL PIPELINE (gate + tracker). This is where
 *           you iterate on gate thresholds without touching the tracker.
 *
 * @author PunkOpus
 * @wave 2172
 */

import { describe, it, expect } from 'vitest'
import { IntervalBPMTracker } from '../IntervalBPMTracker'
import type { ShadowFrame } from './ShadowFrameSchema'
import * as fs from 'fs'
import * as path from 'path'

// ═══════════════════════════════════════════════════════════════════════════
// DUMP FILE LOCATION
// ═══════════════════════════════════════════════════════════════════════════
const DUMP_PATH = path.resolve(__dirname, '..', '..', '..', 'test-data', 'live_audio_dump.json')

// ═══════════════════════════════════════════════════════════════════════════
// GATE REPLICA — exact clone of the senses.ts gate logic
// ═══════════════════════════════════════════════════════════════════════════
// If you change the gate in senses.ts, mirror it here. The test ensures
// both converge to the same BPM.

/** Replicate the production gate from senses.ts (centroid-based)
 *
 * The gate decides what energy reaches the tracker as "needle".
 * This replica must match senses.ts exactly — any divergence means
 * the Cold Lab is testing a different pipeline than production.
 *
 * Gate pipeline:
 *   1. rawBassFlux > 0.030 (floor — eliminates decay tails)
 *   2. Centroid < 800Hz → pass (deep kick territory)
 *   3. Centroid 800-1500Hz → pass if bassFlux > 0.040 (strong kick with some mids)
 *   4. Sniper: bright centroid (>1500Hz) kills needle (hi-hat/clap bleed)
 */
function replayGate(frame: ShadowFrame): number {
  const { rawBassFlux, centroid } = frame
  let needle = 0

  // Step 1: Floor — eliminate inter-beat bass decay tails
  if (rawBassFlux > 0.030) {
    if (centroid < 800) {
      needle = rawBassFlux
    } else if (centroid < 1500) {
      if (rawBassFlux > 0.040) {
        needle = rawBassFlux
      }
    }
  }

  // Step 2: The Sniper — bright-transient guard
  if (needle > 0.015 && centroid > 1500) {
    needle = 0
  }

  return needle
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER — load and validate the dump
// ═══════════════════════════════════════════════════════════════════════════
function loadDump(): ShadowFrame[] {
  if (!fs.existsSync(DUMP_PATH)) {
    throw new Error(
      `[COLD LAB] No dump found at ${DUMP_PATH}\n` +
      `Run the app with music playing for ~46 seconds to generate it.\n` +
      `The Shadow Logger in senses.ts will auto-dump to this path.`
    )
  }

  const raw = fs.readFileSync(DUMP_PATH, 'utf-8')
  const frames: ShadowFrame[] = JSON.parse(raw)

  if (!Array.isArray(frames) || frames.length < 100) {
    throw new Error(
      `[COLD LAB] Dump has only ${frames.length} frames (need ≥100).\n` +
      `Let the music play longer before collecting.`
    )
  }

  return frames
}

// ═══════════════════════════════════════════════════════════════════════════
// DIAGNOSTIC — dump summary stats for debugging
// ═══════════════════════════════════════════════════════════════════════════
function printDumpStats(frames: ShadowFrame[]): void {
  const nonZeroNeedles = frames.filter(f => f.needle > 0)
  const centroidValues = frames.map(f => f.centroid).sort((a, b) => a - b)
  const needleValues = nonZeroNeedles.map(f => f.needle).sort((a, b) => a - b)
  const totalDurationMs = frames[frames.length - 1].timestampMs - frames[0].timestampMs

  console.log(`\n[COLD LAB] ═══════════════════════════════════════════════`)
  console.log(`  Frames:          ${frames.length}`)
  console.log(`  Duration:        ${(totalDurationMs / 1000).toFixed(1)}s`)
  console.log(`  Non-zero needles: ${nonZeroNeedles.length} / ${frames.length} (${(100 * nonZeroNeedles.length / frames.length).toFixed(1)}%)`)
  if (centroidValues.length > 0) {
    console.log(`  Centroid range:  ${Math.round(centroidValues[0])} - ${Math.round(centroidValues[centroidValues.length - 1])} Hz`)
    console.log(`  Centroid median: ${Math.round(centroidValues[Math.floor(centroidValues.length / 2)])} Hz`)
  }
  if (needleValues.length > 0) {
    console.log(`  Needle range:    ${needleValues[0].toFixed(4)} - ${needleValues[needleValues.length - 1].toFixed(4)}`)
    console.log(`  Needle median:   ${needleValues[Math.floor(needleValues.length / 2)].toFixed(4)}`)
  }
  console.log(`═══════════════════════════════════════════════════════════\n`)
}

// ═══════════════════════════════════════════════════════════════════════════
// THE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('👻 WAVE 2172: Data-Driven MIR Cold Lab', () => {

  // Skip the entire suite if no dump file exists yet
  const dumpExists = fs.existsSync(DUMP_PATH)

  describe.skipIf(!dumpExists)('🔬 MODE A: Needle Replay (tracker isolation)', () => {

    it('should detect ~126 BPM from real Boris Brejcha audio (needle replay)', () => {
      const frames = loadDump()
      printDumpStats(frames)

      const tracker = new IntervalBPMTracker()

      const startMs = performance.now()
      for (const frame of frames) {
        tracker.process(frame.needle, false, frame.timestampMs)
      }
      const elapsedMs = performance.now() - startMs

      const rawBpm = tracker.getBpm()
      const musicalBpm = tracker.getMusicalBpm()
      const result = tracker.process(0, false, frames[frames.length - 1].timestampMs + 1)
      const finalConf = result.confidence

      console.log(`\n[COLD LAB] MODE A RESULT:`)
      console.log(`  Raw BPM:    ${rawBpm}`)
      console.log(`  Musical BPM: ${musicalBpm} (Dance Pocket Folder)`)
      console.log(`  Confidence: ${finalConf.toFixed(3)}`)
      console.log(`  Kicks:      ${result.kickCount}`)
      console.log(`  Replay:     ${elapsedMs.toFixed(2)}ms (${frames.length} frames)`)

      // ── THE ASSERTIONS ──────────────────────────────────────────
      // Boris Brejcha standard: 124-128 BPM (MUSICAL, post-folder)
      // Raw may be 185 BPM (tresillo polyrhythm) — that's correct math.
      // The Dance Pocket Folder ÷1.5 = ~123 BPM → inside pocket.
      expect(musicalBpm).toBeGreaterThanOrEqual(120)
      expect(musicalBpm).toBeLessThanOrEqual(132)
      expect(finalConf).toBeGreaterThan(0.05)
      expect(elapsedMs).toBeLessThan(200) // must be fast — cold lab, not live
    })
  })

  describe.skipIf(!dumpExists)('🔬 MODE B: Raw Replay (full pipeline — gate + tracker)', () => {

    it('should detect ~126 BPM from recalculated gate (raw replay)', () => {
      const frames = loadDump()

      const tracker = new IntervalBPMTracker()

      const startMs = performance.now()
      for (const frame of frames) {
        const recalculatedNeedle = replayGate(frame)
        tracker.process(recalculatedNeedle, false, frame.timestampMs)
      }
      const elapsedMs = performance.now() - startMs

      const rawBpm = tracker.getBpm()
      const musicalBpm = tracker.getMusicalBpm()
      const result = tracker.process(0, false, frames[frames.length - 1].timestampMs + 1)
      const finalConf = result.confidence

      console.log(`\n[COLD LAB] MODE B RESULT:`)
      console.log(`  Raw BPM:    ${rawBpm}`)
      console.log(`  Musical BPM: ${musicalBpm} (Dance Pocket Folder)`)
      console.log(`  Confidence: ${finalConf.toFixed(3)}`)
      console.log(`  Kicks:      ${result.kickCount}`)
      console.log(`  Replay:     ${elapsedMs.toFixed(2)}ms (${frames.length} frames)`)

      expect(musicalBpm).toBeGreaterThanOrEqual(120)
      expect(musicalBpm).toBeLessThanOrEqual(132)
      expect(elapsedMs).toBeLessThan(200)
    })

    it('needle replay and raw replay should converge to same MUSICAL BPM (gate consistency)', () => {
      const frames = loadDump()

      // Mode A: needle directly
      const trackerA = new IntervalBPMTracker()
      for (const frame of frames) {
        trackerA.process(frame.needle, false, frame.timestampMs)
      }
      const musicalA = trackerA.getMusicalBpm()

      // Mode B: recalculated gate
      const trackerB = new IntervalBPMTracker()
      for (const frame of frames) {
        trackerB.process(replayGate(frame), false, frame.timestampMs)
      }
      const musicalB = trackerB.getMusicalBpm()

      console.log(`\n[COLD LAB] GATE CONSISTENCY (Musical BPM):`)
      console.log(`  Mode A (needle): ${musicalA} BPM`)
      console.log(`  Mode B (raw):    ${musicalB} BPM`)
      console.log(`  Delta:           ${Math.abs(musicalA - musicalB)} BPM`)

      // Both modes must produce the same musical BPM
      expect(Math.abs(musicalA - musicalB)).toBeLessThanOrEqual(5)
    })
  })

  describe.skipIf(!dumpExists)('📊 DIAGNOSTICS: Pipeline X-Ray', () => {

    it('should report kick timing distribution for manual inspection', () => {
      const frames = loadDump()
      const tracker = new IntervalBPMTracker()

      const kickTimestamps: number[] = []
      for (const frame of frames) {
        const result = tracker.process(frame.needle, false, frame.timestampMs)
        if (result.kickDetected) {
          kickTimestamps.push(frame.timestampMs)
        }
      }

      // Compute intervals between consecutive kicks
      const intervals: number[] = []
      for (let i = 1; i < kickTimestamps.length; i++) {
        intervals.push(kickTimestamps[i] - kickTimestamps[i - 1])
      }

      if (intervals.length > 0) {
        const sorted = [...intervals].sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)]
        const bpmFromMedian = 60000 / median
        const min = sorted[0]
        const max = sorted[sorted.length - 1]

        // BPM distribution
        const bpms = intervals.map(i => Math.round(60000 / i))
        const bpmCounts = new Map<number, number>()
        for (const b of bpms) {
          bpmCounts.set(b, (bpmCounts.get(b) || 0) + 1)
        }

        const bpmDistribution = [...bpmCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([bpm, count]) => `${bpm} BPM ×${count}`)
          .join(', ')

        console.log(`\n[COLD LAB] KICK TIMING X-RAY:`)
        console.log(`  Total kicks:     ${kickTimestamps.length}`)
        console.log(`  Intervals:       ${intervals.length}`)
        console.log(`  Median interval: ${median.toFixed(1)}ms (= ${bpmFromMedian.toFixed(0)} BPM)`)
        console.log(`  Range:           ${min.toFixed(1)} - ${max.toFixed(1)}ms`)
        console.log(`  Spread:          ${(max - min).toFixed(1)}ms`)
        console.log(`  BPM histogram:   ${bpmDistribution}`)
      } else {
        console.log(`\n[COLD LAB] ⚠️ NO KICKS DETECTED — the needle is completely silent.`)
        console.log(`  Non-zero frames: ${frames.filter(f => f.needle > 0).length}/${frames.length}`)
      }

      // This test always passes — it's a diagnostic tool
      expect(kickTimestamps.length).toBeGreaterThan(0)
    })
  })
})
