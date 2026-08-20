/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 WAVE 7563: VARIABLE-TEMPO BEAT TRACKING — Test Suite
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Covers the three subsystems that replaced the constant-tempo assumption:
 *   1. `buildTempoCurve`  — gap fill + sliding median over Oracle readings
 *   2. `trackBeatsDP`     — Ellis dynamic-programming beat tracker
 *   3. `detectDownbeats`  — spectral metre / downbeat phase estimation
 *
 * Closes the "TempoOracle integration untested" debt item recorded in
 * `CHRONOS_V3_WEBSITE_AUDIT_FINAL.md` §8.
 *
 * AXIOMA ANTI-SIMULACIÓN: every fixture is a deterministic synthetic signal
 * with analytically known ground truth. Zero Math.random(). Zero mocks — the
 * real DSP functions are exercised end to end.
 *
 * @module chronos/__tests__/VariableTempo
 */

import { describe, it, expect } from 'vitest'
import {
  buildTempoCurve,
  trackBeatsDP,
  detectDownbeats,
} from '../analysis/analysisPipeline'
import type { HeatmapData } from '../core/types'

/** Frame duration used throughout — matches DEFAULT_CONFIG.heatmapResolutionMs. */
const RES = 50

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Synthesises a unit-variance onset envelope containing impulses at a
 * (possibly time-varying) period.
 *
 * @param numPoints Frame count.
 * @param periodAt  Frames-per-beat as a function of the current frame.
 */
function clickEnvelope(numPoints: number, periodAt: (i: number) => number): Float64Array {
  const env = new Float64Array(numPoints)
  let next = 0
  while (next < numPoints) {
    const f = Math.round(next)
    if (f < numPoints) env[f] = 1
    next += periodAt(f)
  }
  let sum = 0
  for (let i = 0; i < numPoints; i++) sum += env[i]
  const mean = sum / numPoints
  let varSum = 0
  for (let i = 0; i < numPoints; i++) varSum += (env[i] - mean) ** 2
  const std = Math.sqrt(varSum / numPoints)
  if (std > 1e-12) for (let i = 0; i < numPoints; i++) env[i] /= std
  return env
}

/** Mean inter-onset interval over a slice of a beat array, expressed as BPM. */
function localBpm(beats: number[], from: number, to: number): number {
  let sum = 0
  let n = 0
  for (let i = Math.max(1, from); i < Math.min(beats.length, to); i++) {
    sum += beats[i] - beats[i - 1]
    n++
  }
  return n > 0 ? 60000 / (sum / n) : 0
}

/**
 * Minimal HeatmapData carrying only the bands `detectDownbeats` reads.
 * Everything else is zero-filled — the detector must not depend on it.
 */
function heatmapWith(nFrames: number, subBass: number[], mid: number[]): HeatmapData {
  const zeros = (): number[] => new Array(nFrames).fill(0)
  return {
    resolutionMs: RES,
    energy: zeros(),
    bass: zeros(),
    high: zeros(),
    flux: zeros(),
    subBass,
    bassReal: zeros(),
    lowMid: zeros(),
    mid,
    highMid: zeros(),
    treble: zeros(),
    ultraAir: zeros(),
  } as unknown as HeatmapData
}

/** Uniform beat array at a fixed BPM. */
function uniformBeats(count: number, bpm: number): number[] {
  const msPerBeat = 60000 / bpm
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(i * msPerBeat)
  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. TEMPO CURVE
// ═══════════════════════════════════════════════════════════════════════════

describe('🌊 buildTempoCurve — gap fill + sliding median', () => {
  it('holds the last confident value across a confidence gap', () => {
    const n = 100
    const raw = new Float64Array(n).fill(128)
    raw[10] = 0
    raw[11] = 0
    raw[12] = 0

    const curve = buildTempoCurve(raw, n, 120)

    expect(curve).toHaveLength(n)
    // A gap is "no opinion", not "tempo = 0" — the previous tempo is held.
    expect(curve[10]).toBeCloseTo(128, 6)
    expect(curve[11]).toBeCloseTo(128, 6)
    expect(curve[12]).toBeCloseTo(128, 6)
  })

  it('annihilates a single-frame octave flip (median, not mean)', () => {
    const n = 100
    const raw = new Float64Array(n).fill(128)
    // The Oracle's one failure mode: a momentary double-time reading.
    raw[50] = 256
    raw[51] = 256

    const curve = buildTempoCurve(raw, n, 120)

    expect(curve[50]).toBeCloseTo(128, 6)
    expect(curve[51]).toBeCloseTo(128, 6)
    // A 21-frame MEAN would have been dragged to ~140 by these two samples.
    expect(Math.max(...curve)).toBeLessThan(140)
  })

  it('back-fills the head from the first confident frame', () => {
    const n = 60
    const raw = new Float64Array(n)
    // Silent intro: nothing confident until frame 20.
    for (let i = 20; i < n; i++) raw[i] = 132

    const curve = buildTempoCurve(raw, n, 120)

    expect(curve[0]).toBeCloseTo(132, 6)
    expect(curve[19]).toBeCloseTo(132, 6)
  })

  it('returns a flat fallback when no frame was ever confident', () => {
    const raw = new Float64Array(50) // all zero — ambient / atonal material
    const curve = buildTempoCurve(raw, 50, 120)

    expect(curve).toHaveLength(50)
    expect(curve.every((v) => v === 120)).toBe(true)
  })

  it('never emits 0 or NaN', () => {
    const n = 80
    const raw = new Float64Array(n)
    for (let i = 0; i < n; i += 7) raw[i] = 110 + (i % 5)

    const curve = buildTempoCurve(raw, n, 120)

    for (const v of curve) {
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThan(0)
    }
  })

  it('tolerates a track shorter than the median window', () => {
    const raw = new Float64Array(4).fill(126)
    const curve = buildTempoCurve(raw, 4, 120)

    expect(curve).toHaveLength(4)
    expect(curve.every((v) => Math.abs(v - 126) < 1e-6)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. ELLIS DP BEAT TRACKER
// ═══════════════════════════════════════════════════════════════════════════

describe('🌊 trackBeatsDP — Ellis dynamic-programming tracker', () => {
  it('locks exactly onto a constant 120 BPM click train', () => {
    // 120 BPM ⇒ 500 ms ⇒ 10 frames @ 50 ms
    const n = 600 // 30 s
    const env = clickEnvelope(n, () => 10)
    const tempo = new Array(n).fill(120)

    const beats = trackBeatsDP(env, tempo, n, RES)

    expect(beats.length).toBeGreaterThan(50)
    expect(localBpm(beats, 0, beats.length)).toBeCloseTo(120, 1)

    // Every beat must sit on a click, not between them.
    let onClick = 0
    for (const b of beats) {
      const frame = b / RES
      if (Math.abs(frame - Math.round(frame / 10) * 10) < 0.6) onClick++
    }
    expect(onClick / beats.length).toBeGreaterThan(0.9)
  })

  it('emits a strictly increasing beat sequence', () => {
    const n = 400
    const env = clickEnvelope(n, () => 10)
    const beats = trackBeatsDP(env, new Array(n).fill(120), n, RES)

    for (let i = 1; i < beats.length; i++) {
      expect(beats[i]).toBeGreaterThan(beats[i - 1])
    }
  })

  it('FOLLOWS a tempo ramp of 120 → 140 BPM', () => {
    const n = 800
    const bpmAt = (i: number): number => 120 + (20 * i) / n
    const env = clickEnvelope(n, (i) => 60000 / bpmAt(i) / RES)
    const tempo: number[] = new Array(n)
    for (let i = 0; i < n; i++) tempo[i] = bpmAt(i)

    const beats = trackBeatsDP(env, tempo, n, RES)

    expect(beats.length).toBeGreaterThan(50)
    const early = localBpm(beats, 1, 11)
    const late = localBpm(beats, beats.length - 10, beats.length)

    // Tracks both ends of the ramp, not an average of the two.
    expect(early).toBeGreaterThan(116)
    expect(early).toBeLessThan(126)
    expect(late).toBeGreaterThan(133)
    expect(late).toBeLessThan(147)
    expect(late - early).toBeGreaterThan(10)
  })

  it('CONTROL: a flat tempo prior fails on the same ramp', () => {
    // This is the load-bearing test for the whole WAVE. It isolates the
    // contribution of the tempo CURVE: identical signal, identical DP, but
    // the target period is pinned at 120. If the curve were decorative, this
    // would track the ramp just as well as the test above. It does not.
    const n = 800
    const bpmAt = (i: number): number => 120 + (20 * i) / n
    const env = clickEnvelope(n, (i) => 60000 / bpmAt(i) / RES)

    const withCurve = trackBeatsDP(
      env,
      Array.from({ length: n }, (_, i) => bpmAt(i)),
      n,
      RES,
    )
    const withFlatPrior = trackBeatsDP(env, new Array(n).fill(120), n, RES)

    const lateCurve = localBpm(withCurve, withCurve.length - 10, withCurve.length)
    const lateFlat = localBpm(withFlatPrior, withFlatPrior.length - 10, withFlatPrior.length)

    // True local tempo at the end of the ramp is 140.
    expect(Math.abs(lateCurve - 140)).toBeLessThan(Math.abs(lateFlat - 140))
    expect(lateCurve).toBeGreaterThan(lateFlat + 8)
  })

  it('survives a silent gap mid-track and re-acquires', () => {
    const n = 700
    const env = clickEnvelope(n, () => 10)
    // Two seconds of dead air in the middle (a breakdown).
    for (let i = 300; i < 340; i++) env[i] = 0

    const beats = trackBeatsDP(env, new Array(n).fill(120), n, RES)

    expect(beats.length).toBeGreaterThan(40)
    // Tempo either side of the hole is still 120 — the DP coasted through.
    expect(localBpm(beats, beats.length - 10, beats.length)).toBeCloseTo(120, 0)
  })

  it('returns empty for input too short to track', () => {
    expect(trackBeatsDP(new Float64Array(3), [120, 120, 120], 3, RES)).toEqual([])
  })

  it('does not crash on an all-zero envelope', () => {
    const n = 200
    const beats = trackBeatsDP(new Float64Array(n), new Array(n).fill(120), n, RES)
    expect(Array.isArray(beats)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. SPECTRAL DOWNBEAT / METRE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

describe('🌊 detectDownbeats — spectral metre & phase', () => {
  /**
   * Builds a 4/4 kick/snare pattern whose bar starts sit at `phase`.
   * Kick on 1 and 3, snare on 2 and 4 — the canonical backbeat.
   */
  function backbeatFixture(nBeats: number, phase: number, fourOnFloor = false) {
    const beats = uniformBeats(nBeats, 120)
    const nFrames = Math.round(beats[nBeats - 1] / RES) + 10
    const subBass = new Array(nFrames).fill(0)
    const mid = new Array(nFrames).fill(0)

    for (let i = 0; i < nBeats; i++) {
      const f = Math.round(beats[i] / RES)
      const pos = ((i - phase) % 4 + 4) % 4
      if (fourOnFloor) {
        subBass[f] = 0.9
        mid[f] = pos === 1 || pos === 3 ? 0.9 : 0.05
      } else if (pos === 0) {
        subBass[f] = 1.0
        mid[f] = 0.1
      } else if (pos === 2) {
        subBass[f] = 0.7
        mid[f] = 0.1
      } else {
        subBass[f] = 0.1
        mid[f] = 0.9
      }
    }
    return { beats, heatmap: heatmapWith(nFrames, subBass, mid) }
  }

  it.each([0, 1, 2, 3])('recovers downbeat phase %i in 4/4', (phase) => {
    const { beats, heatmap } = backbeatFixture(64, phase)

    const result = detectDownbeats(beats, heatmap)

    expect(result.timeSignature).toBe(4)
    expect(result.phase).toBe(phase)
    expect(result.confidence).toBeGreaterThan(0.4)
    expect(result.downbeats[0]).toBe(beats[phase])
    expect(result.downbeats).toHaveLength(Math.ceil((64 - phase) / 4))
  })

  it('resolves four-on-the-floor via the snare backbeat alone', () => {
    // Kick is identical on every beat, so kick contrast is ~0. Only the
    // snare term can disambiguate — exactly the case that breaks naive
    // "loudest kick wins" phase detectors.
    const { beats, heatmap } = backbeatFixture(64, 1, true)

    const result = detectDownbeats(beats, heatmap)

    expect(result.timeSignature).toBe(4)
    expect(result.phase).toBe(1)
  })

  it('does not false-positive 3/4 on 4/4 material', () => {
    const { beats, heatmap } = backbeatFixture(64, 0)
    expect(detectDownbeats(beats, heatmap).timeSignature).toBe(4)
  })

  it('reports zero confidence when every phase is identical', () => {
    // Flat pattern: no metrical contrast anywhere. The honest answer is
    // "no evidence", not a confidently wrong phase.
    const beats = uniformBeats(64, 120)
    const nFrames = Math.round(beats[63] / RES) + 10
    const flat = new Array(nFrames).fill(0.5)

    const result = detectDownbeats(beats, heatmapWith(nFrames, flat, flat))

    expect(result.confidence).toBe(0)
  })

  it('degrades honestly on input shorter than two bars', () => {
    const result = detectDownbeats([0, 500, 1000], heatmapWith(30, new Array(30).fill(0), new Array(30).fill(0)))

    expect(result.confidence).toBe(0)
    expect(result.timeSignature).toBe(4)
    expect(result.phase).toBe(0)
  })

  it('handles an empty beat array', () => {
    const result = detectDownbeats([], heatmapWith(10, new Array(10).fill(0), new Array(10).fill(0)))

    expect(result.downbeats).toEqual([])
    expect(result.confidence).toBe(0)
  })

  it('falls back to legacy bands when tactical bands are absent', () => {
    // A V2 heatmap carries only energy/bass/high/flux — no subBass/mid.
    // NOTE the asymmetry between the beat-1 and beat-3 kick (1.0 vs 0.6):
    // see the half-bar ambiguity test below for why a symmetric pattern
    // would have no unique answer here.
    const beats = uniformBeats(32, 120)
    const nFrames = Math.round(beats[31] / RES) + 10
    const bass = new Array(nFrames).fill(0)
    const high = new Array(nFrames).fill(0)
    for (let i = 0; i < 32; i++) {
      const f = Math.round(beats[i] / RES)
      const pos = i % 4
      bass[f] = pos === 0 ? 1.0 : pos === 2 ? 0.6 : 0.1
      high[f] = pos === 1 || pos === 3 ? 0.9 : 0.1
    }
    const legacy = {
      resolutionMs: RES,
      energy: new Array(nFrames).fill(0),
      bass,
      high,
      flux: new Array(nFrames).fill(0),
    } as unknown as HeatmapData

    const result = detectDownbeats(beats, legacy)

    expect(result.timeSignature).toBe(4)
    expect(result.phase).toBe(0)
  })

  it('documents the genuine half-bar ambiguity of a symmetric pattern', () => {
    // kick|snare|kick|snare with IDENTICAL kick weights on 1 and 3 is
    // mathematically ambiguous: phase p and phase p+2 produce byte-identical
    // contrast scores. No estimator can resolve it from percussion alone —
    // real music breaks the tie with harmonic rhythm or a heavier bar-start
    // kick. This test pins the behaviour so a future change that silently
    // starts guessing is caught.
    const beats = uniformBeats(64, 120)
    const nFrames = Math.round(beats[63] / RES) + 10
    const subBass = new Array(nFrames).fill(0)
    const mid = new Array(nFrames).fill(0)
    for (let i = 0; i < 64; i++) {
      const f = Math.round(beats[i] / RES)
      const pos = i % 4
      subBass[f] = pos === 0 || pos === 2 ? 0.9 : 0.1
      mid[f] = pos === 1 || pos === 3 ? 0.9 : 0.1
    }

    const result = detectDownbeats(beats, heatmapWith(nFrames, subBass, mid))

    // The metre is still unambiguous, and the phase is one of the two
    // equally-valid bar starts — never an off-beat one.
    expect(result.timeSignature).toBe(4)
    expect([0, 2]).toContain(result.phase)
  })
})
