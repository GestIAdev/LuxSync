// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA II: Genetic Operators
// ═══════════════════════════════════════════════════════════════════════════
//  Pure deterministic functions that produce genetic variance (delta_json)
//  from a parent HephAutomationClipV3.
//
//  Delta representation: JSON Patch (RFC 6902) operations array.
//  applyDelta() resolves deltas with array-index awareness for tracks/keyframes.
//
//  All operators are pure: (clip) → { clip: clone, delta: Operation[] }
//  The clone is the mutated clip; the delta is the minimal diff to reproduce it.
// ═══════════════════════════════════════════════════════════════════════════

import type { HephAutomationClipV3, HephTrack, HephKeyframe, HephCurve, HephInterpolation } from '../../hephaestus/types'
import { BEZIER_PRESETS } from '../../hephaestus/types'
import { ENERGY_ZONES } from '../../arsenal/LfxClipInstance'
import type { PhaseConfigPro } from '../../hephaestus/phase/PhaseConfigPro'
import { DEFAULT_PHASE_CONFIG_PRO } from '../../hephaestus/phase/PhaseConfigPro'
import type { MutationOperator } from '../types'
import type { CognitiveDNA, FrozenGenome, EnergyZoneRange, TextureAffinity, SpatialBehavior } from '../../arsenal/lfxTypes'

// ─── JSON PATCH (RFC 6902 subset) ───────────────────────────────────────────

export interface JsonPatchOp {
  op: 'add' | 'replace' | 'remove'
  path: string
  value?: unknown
}

export interface OperatorResult {
  clip: HephAutomationClipV3
  delta: JsonPatchOp[]
  operator: MutationOperator
  l2Distance: number
}

// ─── DEEP CLONE ─────────────────────────────────────────────────────────────

function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj)
  }
  return JSON.parse(JSON.stringify(obj)) as T
}

// ─── DELTA APPLICATION ──────────────────────────────────────────────────────

/**
 * Applies a JSON Patch (RFC 6902 subset) to a clip.
 * Supports: add, replace, remove on object properties and array indices.
 * Path format: "/tracks/0/curve/keyframes/1/value"
 *
 * Robust with nested arrays (tracks[], keyframes[]).
 */
export function applyDelta(
  clip: HephAutomationClipV3,
  delta: JsonPatchOp[],
): HephAutomationClipV3 {
  const target = deepClone(clip) as unknown as Record<string, unknown>

  for (const op of delta) {
    const parts = op.path.split('/').filter(Boolean)
    let cursor: any = target

    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i]
      cursor = cursor[key]
    }

    const lastKey = parts[parts.length - 1]

    switch (op.op) {
      case 'replace':
        cursor[lastKey] = op.value
        break
      case 'add':
        if (lastKey === '-' && Array.isArray(cursor)) {
          cursor.push(op.value)
        } else if (Array.isArray(cursor) && /^\d+$/.test(lastKey)) {
          cursor.splice(Number(lastKey), 0, op.value)
        } else if (Array.isArray(cursor[lastKey])) {
          ;(cursor[lastKey] as unknown[]).push(op.value)
        } else {
          cursor[lastKey] = op.value
        }
        break
      case 'remove':
        if (Array.isArray(cursor) && /^\d+$/.test(lastKey)) {
          cursor.splice(Number(lastKey), 1)
        } else {
          delete cursor[lastKey]
        }
        break
    }
  }

  return target as unknown as HephAutomationClipV3
}

// ─── L2 DISTANCE V2 — COMPOSITE MULTI-SPACE (WAVE 6000) ─────────────────────

/**
 * D_curve: RMSE over normalized keyframe values and bezier handles.
 * Differences are divided by the track's span (range[1] - range[0])
 * so that pan/tilt channels don't dominate the score.
 */
function computeDCurve(
  parent: HephAutomationClipV3,
  child: HephAutomationClipV3,
): number {
  let sumSq = 0
  let count = 0

  const maxTracks = Math.max(parent.tracks.length, child.tracks.length)
  for (let t = 0; t < maxTracks; t++) {
    const pt = parent.tracks[t]
    const ct = child.tracks[t]
    if (!pt || !ct) {
      sumSq += 1.0
      count++
      continue
    }

    const span = pt.curve.range[1] - pt.curve.range[0]
    const safeSpan = span !== 0 ? span : 1

    const pk = pt.curve.keyframes
    const ck = ct.curve.keyframes
    const maxKf = Math.max(pk.length, ck.length)
    for (let k = 0; k < maxKf; k++) {
      const pkf = pk[k]
      const ckf = ck[k]
      if (!pkf || !ckf) {
        sumSq += 0.5
        count++
        continue
      }
      if (typeof pkf.value === 'number' && typeof ckf.value === 'number') {
        const diffNorm = (ckf.value - pkf.value) / safeSpan
        sumSq += diffNorm * diffNorm
        count++
      }
      if (pkf.bezierHandles && ckf.bezierHandles) {
        for (let b = 0; b < 4; b++) {
          const diff = ckf.bezierHandles[b] - pkf.bezierHandles[b]
          sumSq += diff * diff * 0.25
          count++
        }
      }
    }
  }

  return count > 0 ? Math.sqrt(sumSq / count) : 0
}

/**
 * D_phase: RMSE over normalized PhaseConfigPro field differences.
 * Each field is normalized to [0,1] by its canonical range.
 * Weights reflect visual impact: spreadDeg > wings > shuffle ≈ blocks > direction > symmetry.
 */
function computeDPhase(
  parent: HephAutomationClipV3,
  child: HephAutomationClipV3,
): number {
  const maxTracks = Math.max(parent.tracks.length, child.tracks.length)
  let sumSq = 0
  let count = 0

  const weights = [0.30, 0.25, 0.15, 0.15, 0.10, 0.05]

  for (let t = 0; t < maxTracks; t++) {
    const pt = parent.tracks[t]
    const ct = child.tracks[t]
    if (!pt || !ct) {
      sumSq += 0.5
      count++
      continue
    }

    const pp = pt.phaseConfig ?? DEFAULT_PHASE_CONFIG_PRO
    const cp = ct.phaseConfig ?? DEFAULT_PHASE_CONFIG_PRO

    const dSpread    = Math.abs(cp.spreadDeg - pp.spreadDeg) / 1440
    const dWings     = Math.abs(cp.wings - pp.wings) / 8
    const dShuffle   = Math.abs(cp.shuffle - pp.shuffle)
    const dBlocks    = Math.abs(cp.blocks - pp.blocks) / 16
    const dDirection = cp.direction !== pp.direction ? 1 : 0
    const dSymmetry  = cp.symmetry !== pp.symmetry ? 1 : 0

    const diffs = [dSpread, dWings, dShuffle, dBlocks, dDirection, dSymmetry]

    let weightedSumSq = 0
    for (let i = 0; i < diffs.length; i++) {
      weightedSumSq += weights[i] * diffs[i] * diffs[i]
    }
    sumSq += weightedSumSq
    count++
  }

  return count > 0 ? Math.sqrt(sumSq / count) : 0
}

/**
 * D_structural: topological distance [0,1] based on track count diff,
 * average keyframe count diff, and interpolation change ratio.
 */
function computeDStructural(
  parent: HephAutomationClipV3,
  child: HephAutomationClipV3,
): number {
  const trackCountDiff =
    Math.abs(child.tracks.length - parent.tracks.length) /
    Math.max(parent.tracks.length, 1)

  let keyframeDiffSum = 0
  let interpolationChanges = 0
  let comparedTracks = 0

  const maxT = Math.max(parent.tracks.length, child.tracks.length)
  for (let t = 0; t < maxT; t++) {
    const pt = parent.tracks[t]
    const ct = child.tracks[t]
    if (!pt || !ct) continue
    comparedTracks++

    const kfDiff = Math.abs(ct.curve.keyframes.length - pt.curve.keyframes.length)
    keyframeDiffSum += kfDiff / Math.max(pt.curve.keyframes.length, 1)

    const minKf = Math.min(pt.curve.keyframes.length, ct.curve.keyframes.length)
    for (let k = 0; k < minKf; k++) {
      if (pt.curve.keyframes[k].interpolation !== ct.curve.keyframes[k].interpolation) {
        interpolationChanges++
      }
    }
  }

  const avgKfDiff = comparedTracks > 0 ? keyframeDiffSum / comparedTracks : 0
  const interpRatio = comparedTracks > 0
    ? interpolationChanges / comparedTracks
    : 0

  return Math.max(0, Math.min(1,
    0.5 * trackCountDiff + 0.35 * avgKfDiff + 0.15 * interpRatio,
  ))
}

/**
 * Composite L2 distance V2 — multi-space weighted average.
 * L2_total = 0.45 * D_curve + 0.35 * D_phase + 0.20 * D_structural
 *
 * Unlike V1, this is NOT blind to phaseConfig changes (D_phase)
 * and captures structural topology shifts (D_structural).
 */
export function computeL2DistanceV2(
  parent: HephAutomationClipV3,
  child: HephAutomationClipV3,
): number {
  const dCurve = computeDCurve(parent, child)
  const dPhase = computeDPhase(parent, child)
  const dStructural = computeDStructural(parent, child)

  return 0.45 * dCurve + 0.35 * dPhase + 0.20 * dStructural
}

// ─── RANDOM HELPERS (deterministic via seed) ────────────────────────────────

export function makeRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return ((s >>> 0) % 1000000) / 1000000
  }
}

export function stringToSeed(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return h
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// ─── FAT-TAILED RNG (WAVE 6000) ─────────────────────────────────────────────

export interface FatTailedRng {
  /** Truncated Cauchy distribution: heavy tails, most values near 0. */
  sampleCauchy(scale: number, maxAbs: number): number
  /** Pareto distribution: strictly positive, heavy upper tail. */
  samplePareto(xm: number, alpha: number): number
}

/**
 * Wraps a base RNG to provide fat-tailed sampling distributions.
 * Uses Cauchy (for signed magnitudes) and Pareto (for positive magnitudes).
 */
export function makeFatTailedRng(baseRng: () => number): FatTailedRng {
  const sampleCauchy = (scale: number, maxAbs: number): number => {
    const p = baseRng()
    const pClamped = Math.max(1e-6, Math.min(1 - 1e-6, p))
    const raw = scale * Math.tan(Math.PI * (pClamped - 0.5))
    return Math.max(-maxAbs, Math.min(maxAbs, raw))
  }

  const samplePareto = (xm: number, alpha: number): number => {
    const p = Math.max(0, Math.min(1 - 1e-9, baseRng()))
    return xm / Math.pow(1 - p, 1 / alpha)
  }

  return { sampleCauchy, samplePareto }
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 1: POINT MUTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Modifies a single numeric `value` (and optionally a bezier handle) in a random track.
 * WAVE 6000.V2: Magnitude now drawn from truncated Cauchy distribution —
 * most mutations are small (MICRO/STANDARD), but rare CATACLYSMIC events occur.
 */
export function pointMutation(
  parent: HephAutomationClipV3,
  seed?: number,
): OperatorResult {
  const rng = makeRng(seed ?? Date.now())
  const fatRng = makeFatTailedRng(rng)
  const child = deepClone(parent)
  const delta: JsonPatchOp[] = []

  const numericTracks = child.tracks
    .map((t, i) => ({ track: t, index: i }))
    .filter((t) => t.track.curve.valueType === 'number' && t.track.curve.keyframes.length > 0)

  if (numericTracks.length === 0) {
    return { clip: child, delta, operator: 'point_mutation', l2Distance: 0 }
  }

  const pick = numericTracks[Math.floor(rng() * numericTracks.length)]
  const track = pick.track
  const trackIdx = pick.index
  const kfIdx = Math.floor(rng() * track.curve.keyframes.length)
  const kf = track.curve.keyframes[kfIdx]

  // Fat-tailed magnitude: Cauchy(scale=0.02, maxAbs=0.60)
  const magnitude = fatRng.sampleCauchy(0.02, 0.60)

  const range = track.curve.range
  const span = range[1] - range[0]

  if (typeof kf.value === 'number') {
    const oldVal = kf.value
    const newVal = clamp(oldVal + magnitude * span, range[0], range[1])
    kf.value = newVal
    delta.push({
      op: 'replace',
      path: `/tracks/${trackIdx}/curve/keyframes/${kfIdx}/value`,
      value: newVal,
    })
  }

  // 50% chance to also mutate a bezier handle
  if (kf.bezierHandles && rng() < 0.5) {
    const handleIdx = Math.floor(rng() * 4)
    const oldHandle = kf.bezierHandles[handleIdx]
    const handleDelta = fatRng.sampleCauchy(0.03, 0.80)
    const newHandle = clamp(oldHandle + handleDelta, -2, 2)
    kf.bezierHandles[handleIdx] = newHandle
    delta.push({
      op: 'replace',
      path: `/tracks/${trackIdx}/curve/keyframes/${kfIdx}/bezierHandles/${handleIdx}`,
      value: newHandle,
    })
  }

  return {
    clip: child,
    delta,
    operator: 'point_mutation',
    l2Distance: computeL2DistanceV2(parent, child),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 2: GENE DUPLICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clones an existing track, mutates its phaseConfig (spreadDeg, wings, shuffle),
 * and appends it to the tracks array.
 */
export function geneDuplication(
  parent: HephAutomationClipV3,
  seed?: number,
): OperatorResult {
  const rng = makeRng(seed ?? Date.now())
  const child = deepClone(parent)
  const delta: JsonPatchOp[] = []

  if (child.tracks.length === 0) {
    return {
      clip: child,
      delta,
      operator: 'gene_duplication',
      l2Distance: 0,
    }
  }

  // Pick a random track to duplicate
  const srcIdx = Math.floor(rng() * child.tracks.length)
  const srcTrack = child.tracks[srcIdx]
  const cloned: HephTrack = deepClone(srcTrack)

  // New ID for the duplicated track
  cloned.id = `${srcTrack.id}_dup_${Math.floor(rng() * 100000)}`

  // Mutate phaseConfig — create or modify existing
  const existingPhase = cloned.phaseConfig ?? { ...DEFAULT_PHASE_CONFIG_PRO }
  const newPhase: PhaseConfigPro = {
    ...existingPhase,
    spreadDeg: clamp(existingPhase.spreadDeg + (rng() - 0.5) * 180, 0, 1440),
    wings: clamp(Math.round(existingPhase.wings + (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 2))), 1, 8),
    shuffle: clamp(existingPhase.shuffle + (rng() - 0.5) * 0.4, 0, 1),
    shuffleSeed: Math.floor(rng() * 100000) + 1,
  }
  cloned.phaseConfig = newPhase

  // Optionally shift zones to create spatial divergence
  if (rng() < 0.3 && cloned.zones.length > 0) {
    // Keep zones as-is — duplication already creates spatial overlap diversity
  }

  child.tracks.push(cloned)

  delta.push({
    op: 'add',
    path: '/tracks/-',
    value: cloned,
  })

  return {
    clip: child,
    delta,
    operator: 'gene_duplication',
    l2Distance: computeL2DistanceV2(parent, child),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 3: PHASE EPIGENETICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mutates PhaseConfigPro parameters across ALL tracks using fat-tailed distributions.
 * WAVE 6000.V2: spreadDeg and shuffle use sampleCauchy for signed variance,
 * wings and blocks use samplePareto for positive scalar jumps.
 */
export function phaseEpigenetics(
  parent: HephAutomationClipV3,
  seed?: number,
): OperatorResult {
  const rng = makeRng(seed ?? Date.now())
  const fatRng = makeFatTailedRng(rng)
  const child = deepClone(parent)
  const delta: JsonPatchOp[] = []

  for (let t = 0; t < child.tracks.length; t++) {
    const track = child.tracks[t]
    const existing = track.phaseConfig ?? { ...DEFAULT_PHASE_CONFIG_PRO }

    const numMutations = 1 + Math.floor(rng() * 2)
    const newPhase: PhaseConfigPro = { ...existing }

    for (let m = 0; m < numMutations; m++) {
      const param = Math.floor(rng() * 5)
      switch (param) {
        case 0: // spreadDeg — Cauchy signed variance
          newPhase.spreadDeg = clamp(
            existing.spreadDeg + fatRng.sampleCauchy(30, 360), 0, 1440,
          )
          break
        case 1: // wings — Pareto positive jump ± direction
          newPhase.wings = clamp(
            Math.round(existing.wings + (rng() < 0.5 ? -1 : 1) * fatRng.samplePareto(0.5, 2)),
            1, 8,
          )
          break
        case 2: // shuffle — Cauchy signed variance
          newPhase.shuffle = clamp(
            existing.shuffle + fatRng.sampleCauchy(0.05, 0.50), 0, 1,
          )
          break
        case 3: // blocks — Pareto positive jump ± direction
          newPhase.blocks = clamp(
            Math.round(existing.blocks + (rng() < 0.5 ? -1 : 1) * fatRng.samplePareto(0.5, 2)),
            1, 16,
          )
          break
        case 4: // direction — coin flip
          newPhase.direction = (rng() < 0.5 ? 1 : -1) as 1 | -1
          break
      }
    }

    newPhase.shuffleSeed = Math.floor(rng() * 100000) + 1
    track.phaseConfig = newPhase

    delta.push({
      op: 'replace',
      path: `/tracks/${t}/phaseConfig`,
      value: newPhase,
    })
  }

  return {
    clip: child,
    delta,
    operator: 'phase_epigenetics',
    l2Distance: computeL2DistanceV2(parent, child),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 4: TEMPORAL STRETCH
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compresses or expands the timeMs of all keyframes by a factor derived
 * from a fat-tailed Cauchy distribution. factor < 1 = speed up, > 1 = slow down.
 * 70% chance targets a single track, 30% targets the entire clip.
 */
export function temporalStretch(
  parent: HephAutomationClipV3,
  seed?: number,
): OperatorResult {
  const rng = makeRng(seed ?? Date.now())
  const fatRng = makeFatTailedRng(rng)
  const child = deepClone(parent)
  const delta: JsonPatchOp[] = []

  if (child.tracks.length === 0) {
    return { clip: child, delta, operator: 'temporal_stretch', l2Distance: 0 }
  }

  const factor = fatRng.sampleCauchy(0.15, 0.90) + 1.0
  const targetClip = rng() < 0.3
  const durationMs = child.durationMs

  if (targetClip) {
    child.durationMs = Math.round(durationMs * factor)
    delta.push({
      op: 'replace',
      path: '/durationMs',
      value: child.durationMs,
    })
  }

  const trackIndices = targetClip
    ? child.tracks.map((_, i) => i)
    : [Math.floor(rng() * child.tracks.length)]

  for (const t of trackIndices) {
    const track = child.tracks[t]
    for (let k = 0; k < track.curve.keyframes.length; k++) {
      const kf = track.curve.keyframes[k]
      const newTime = clamp(Math.round(kf.timeMs * factor), 0, child.durationMs)
      kf.timeMs = newTime
      delta.push({
        op: 'replace',
        path: `/tracks/${t}/curve/keyframes/${k}/timeMs`,
        value: newTime,
      })
    }
    track.curve.keyframes.sort((a, b) => a.timeMs - b.timeMs)
  }

  return {
    clip: child,
    delta,
    operator: 'temporal_stretch',
    l2Distance: computeL2DistanceV2(parent, child),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 5: GENE SPLICE
// ═══════════════════════════════════════════════════════════════════════════

const BEZIER_PRESET_KEYS = Object.keys(BEZIER_PRESETS)

/**
 * Inserts 1-3 new keyframes between two existing ones in a numeric track.
 * Values are linearly interpolated + Cauchy noise. Emits 'add' ops.
 */
export function geneSplice(
  parent: HephAutomationClipV3,
  seed?: number,
): OperatorResult {
  const rng = makeRng(seed ?? Date.now())
  const fatRng = makeFatTailedRng(rng)
  const child = deepClone(parent)
  const delta: JsonPatchOp[] = []

  const numericTracks = child.tracks
    .map((t, i) => ({ track: t, index: i }))
    .filter((t) => t.track.curve.valueType === 'number' && t.track.curve.keyframes.length >= 2)

  if (numericTracks.length === 0) {
    return { clip: child, delta, operator: 'gene_splice', l2Distance: 0 }
  }

  const pick = numericTracks[Math.floor(rng() * numericTracks.length)]
  const track = pick.track
  const trackIdx = pick.index
  const kfs = track.curve.keyframes

  const gapIdx = Math.floor(rng() * (kfs.length - 1))
  const numInserts = 1 + Math.floor(rng() * 3)
  const range = track.curve.range
  const span = range[1] - range[0]

  for (let j = 1; j <= numInserts; j++) {
    const tFraction = j / (numInserts + 1)
    const kfA = kfs[gapIdx]
    const kfB = kfs[gapIdx + 1]

    const baseTime = kfA.timeMs + (kfB.timeMs - kfA.timeMs) * tFraction
    const valA = kfA.value
    const valB = kfB.value
    if (typeof valA !== 'number' || typeof valB !== 'number') break

    const baseValue = valA + (valB - valA) * tFraction
    const noise = fatRng.sampleCauchy(0.04, 0.50)
    const newValue = clamp(baseValue + noise * span, range[0], range[1])

    const interpRoll = rng()
    const newInterp: HephInterpolation =
      interpRoll < 0.6 ? 'bezier' : interpRoll < 0.9 ? 'linear' : 'hold'

    const newKf: HephKeyframe = {
      timeMs: Math.round(baseTime),
      value: newValue,
      interpolation: newInterp,
    }

    if (newInterp === 'bezier') {
      const presetKey = BEZIER_PRESET_KEYS[Math.floor(rng() * BEZIER_PRESET_KEYS.length)]
      newKf.bezierHandles = [...BEZIER_PRESETS[presetKey]] as [number, number, number, number]
    }

    // Find insertion index to maintain ascending timeMs
    let insertIdx = gapIdx + 1
    while (insertIdx < kfs.length && kfs[insertIdx].timeMs < newKf.timeMs) {
      insertIdx++
    }
    kfs.splice(insertIdx, 0, newKf)

    delta.push({
      op: 'add',
      path: `/tracks/${trackIdx}/curve/keyframes/${insertIdx}`,
      value: newKf,
    })
  }

  return {
    clip: child,
    delta,
    operator: 'gene_splice',
    l2Distance: computeL2DistanceV2(parent, child),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 6: GENE DELETION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Removes a keyframe (preserving first/last anchors) or an entire track
 * (protecting the intensity channel). Emits 'remove' ops.
 */
export function geneDeletion(
  parent: HephAutomationClipV3,
  seed?: number,
): OperatorResult {
  const rng = makeRng(seed ?? Date.now())
  const child = deepClone(parent)
  const delta: JsonPatchOp[] = []

  if (child.tracks.length === 0) {
    return { clip: child, delta, operator: 'gene_deletion', l2Distance: 0 }
  }

  const mode: 'keyframe' | 'track' = rng() < 0.7 ? 'keyframe' : 'track'

  if (mode === 'keyframe') {
    const eligibleTracks = child.tracks
      .map((t, i) => ({ track: t, index: i }))
      .filter((t) => t.track.curve.keyframes.length >= 3)

    if (eligibleTracks.length === 0) {
      return { clip: child, delta, operator: 'gene_deletion', l2Distance: 0 }
    }

    const pick = eligibleTracks[Math.floor(rng() * eligibleTracks.length)]
    const track = pick.track
    const trackIdx = pick.index
    const kfs = track.curve.keyframes

    // Exclude first and last keyframe (anchors)
    const kfIdx = 1 + Math.floor(rng() * (kfs.length - 2))
    kfs.splice(kfIdx, 1)

    delta.push({
      op: 'remove',
      path: `/tracks/${trackIdx}/curve/keyframes/${kfIdx}`,
    })
  } else {
    if (child.tracks.length < 2) {
      return { clip: child, delta, operator: 'gene_deletion', l2Distance: 0 }
    }

    // Protect intensity: don't delete the only intensity track
    const intensityTracks = child.tracks.filter((t) => t.paramId === 'intensity')
    const eligibleTracks = child.tracks
      .map((t, i) => ({ track: t, index: i }))
      .filter((t) =>
        intensityTracks.length > 1 || t.track.paramId !== 'intensity',
      )

    if (eligibleTracks.length === 0) {
      return { clip: child, delta, operator: 'gene_deletion', l2Distance: 0 }
    }

    const pick = eligibleTracks[Math.floor(rng() * eligibleTracks.length)]
    const trackIdx = pick.index
    child.tracks.splice(trackIdx, 1)

    delta.push({
      op: 'remove',
      path: `/tracks/${trackIdx}`,
    })
  }

  return {
    clip: child,
    delta,
    operator: 'gene_deletion',
    l2Distance: computeL2DistanceV2(parent, child),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 7: INTERPOLATION DRIFT
// ═══════════════════════════════════════════════════════════════════════════

const INTERP_TRANSITIONS: Record<HephInterpolation, [HephInterpolation, number][]> = {
  bezier: [['linear', 0.30], ['hold', 0.15], ['bezier', 0.55]],
  linear: [['bezier', 0.50], ['hold', 0.20], ['linear', 0.30]],
  hold: [['bezier', 0.40], ['linear', 0.40], ['hold', 0.20]],
}

function pickTransition(rng: () => number, current: HephInterpolation): HephInterpolation {
  const transitions = INTERP_TRANSITIONS[current]
  const roll = rng()
  let acc = 0
  for (const [target, prob] of transitions) {
    acc += prob
    if (roll < acc) return target
  }
  return transitions[transitions.length - 1][0]
}

/**
 * Changes the interpolation type of a random keyframe using a Markov-style
 * transition matrix. Updates bezierHandles when entering/leaving bezier mode.
 */
export function interpolationDrift(
  parent: HephAutomationClipV3,
  seed?: number,
): OperatorResult {
  const rng = makeRng(seed ?? Date.now())
  const fatRng = makeFatTailedRng(rng)
  const child = deepClone(parent)
  const delta: JsonPatchOp[] = []

  const eligibleTracks = child.tracks
    .map((t, i) => ({ track: t, index: i }))
    .filter((t) => t.track.curve.keyframes.length >= 2)

  if (eligibleTracks.length === 0) {
    return { clip: child, delta, operator: 'interpolation_drift', l2Distance: 0 }
  }

  const pick = eligibleTracks[Math.floor(rng() * eligibleTracks.length)]
  const track = pick.track
  const trackIdx = pick.index
  const kfs = track.curve.keyframes

  // Exclude last keyframe (interpolation defines transition TO next)
  const kfIdx = Math.floor(rng() * (kfs.length - 1))
  const kf = kfs[kfIdx]
  const currentInterp = kf.interpolation

  // Pick new interpolation, re-roll once if same (avoid no-op)
  let newInterp = pickTransition(rng, currentInterp)
  if (newInterp === currentInterp) {
    newInterp = pickTransition(rng, currentInterp)
  }
  if (newInterp === currentInterp) {
    return { clip: child, delta, operator: 'interpolation_drift', l2Distance: 0 }
  }

  kf.interpolation = newInterp
  delta.push({
    op: 'replace',
    path: `/tracks/${trackIdx}/curve/keyframes/${kfIdx}/interpolation`,
    value: newInterp,
  })

  if (newInterp === 'bezier') {
    if (kf.bezierHandles) {
      // Perturb existing handles with Cauchy noise
      const perturbed = kf.bezierHandles.map((h) =>
        clamp(h + fatRng.sampleCauchy(0.03, 0.50), -2, 2),
      ) as [number, number, number, number]
      kf.bezierHandles = perturbed
      delta.push({
        op: 'replace',
        path: `/tracks/${trackIdx}/curve/keyframes/${kfIdx}/bezierHandles`,
        value: perturbed,
      })
    } else {
      // Generate random preset
      const presetKey = BEZIER_PRESET_KEYS[Math.floor(rng() * BEZIER_PRESET_KEYS.length)]
      const handles = [...BEZIER_PRESETS[presetKey]] as [number, number, number, number]
      kf.bezierHandles = handles
      delta.push({
        op: 'replace',
        path: `/tracks/${trackIdx}/curve/keyframes/${kfIdx}/bezierHandles`,
        value: handles,
      })
    }
  } else {
    // Leaving bezier — remove handles if present
    if (kf.bezierHandles) {
      delete kf.bezierHandles
      delta.push({
        op: 'remove',
        path: `/tracks/${trackIdx}/curve/keyframes/${kfIdx}/bezierHandles`,
      })
    }
  }

  return {
    clip: child,
    delta,
    operator: 'interpolation_drift',
    l2Distance: computeL2DistanceV2(parent, child),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 8: CROSSOVER — SEXUAL REPRODUCTION (WAVE 6000.V3)
// ═══════════════════════════════════════════════════════════════════════════

export interface CrossoverResult {
  clip: HephAutomationClipV3
  delta: JsonPatchOp[]
  operator: 'crossover'
  l2Distance: number
  dominantParent: 'A' | 'B'
}

const DOMAIN_TEMPORAL = new Set(['intensity', 'color', 'strobe', 'strobeRate', 'zoom', 'focus'])
const DOMAIN_SPATIAL = new Set(['pan', 'tilt'])

/**
 * Blends cognitiveDNA from two parents, weighting numeric genome 60/40
 * toward the dominant parent. Unions lists (compatibleVibes, validSections).
 * G4 PRE-SCREENING: if unioned energyZone span > 2, collapses to dominant's range.
 */
export function blendCognitiveDNA(
  dnaA: CognitiveDNA,
  dnaB: CognitiveDNA,
  dominant: 'A' | 'B',
): CognitiveDNA {
  const dom = dominant === 'A' ? dnaA : dnaB
  const sub = dominant === 'A' ? dnaB : dnaA

  const genome: FrozenGenome = {
    aggression: 0.6 * dom.genome.aggression + 0.4 * sub.genome.aggression,
    chaos: 0.6 * dom.genome.chaos + 0.4 * sub.genome.chaos,
    organicity: 0.6 * dom.genome.organicity + 0.4 * sub.genome.organicity,
  }

  const textureAffinity: TextureAffinity = dom.textureAffinity
  const spatialBehavior: SpatialBehavior = dom.spatialBehavior

  const compatibleVibes = [...new Set([...dnaA.compatibleVibes, ...dnaB.compatibleVibes])]
  const validSections = [...new Set([...dnaA.validSections, ...dnaB.validSections])]

  // G4 PRE-SCREENING: check zoneSpan of unioned range
  const unionMinIdx = Math.min(
    ENERGY_ZONES.indexOf(dnaA.energyZone.min as typeof ENERGY_ZONES[number]),
    ENERGY_ZONES.indexOf(dnaB.energyZone.min as typeof ENERGY_ZONES[number]),
  )
  const unionMaxIdx = Math.max(
    ENERGY_ZONES.indexOf(dnaA.energyZone.max as typeof ENERGY_ZONES[number]),
    ENERGY_ZONES.indexOf(dnaB.energyZone.max as typeof ENERGY_ZONES[number]),
  )
  const unionSpan = unionMaxIdx - unionMinIdx + 1

  const energyZone: EnergyZoneRange =
    unionSpan > 2 ? dom.energyZone : {
      min: ENERGY_ZONES[Math.max(0, unionMinIdx)] as EnergyZoneRange['min'],
      max: ENERGY_ZONES[Math.min(ENERGY_ZONES.length - 1, unionMaxIdx)] as EnergyZoneRange['max'],
    }

  const aggressionRange = {
    min: Math.min(dnaA.aggressionRange.min, dnaB.aggressionRange.min),
    max: Math.max(dnaA.aggressionRange.max, dnaB.aggressionRange.max),
  }

  const pressureRange = {
    min: Math.min(dnaA.pressureRange.min, dnaB.pressureRange.min),
    max: Math.max(dnaA.pressureRange.max, dnaB.pressureRange.max),
  }

  return {
    genome,
    textureAffinity,
    compatibleVibes,
    validSections,
    energyZone,
    aggressionRange,
    pressureRange,
    spatialBehavior,
    ikCompatibility: dom.ikCompatibility,
    executionDomain: dom.executionDomain,
  }
}

/**
 * Sexual reproduction operator — combines temporal tracks from one parent
 * with spatial tracks from another, blending cognitiveDNA.
 *
 * Delta is a bulk replace of /tracks and /cognitiveDNA on the dominant parent.
 * L2 = min(distance to A, distance to B) — conservative rule.
 */
export function crossover(
  parentA: HephAutomationClipV3,
  parentB: HephAutomationClipV3,
  fitnessA: number,
  fitnessB: number,
  seed?: number,
): CrossoverResult {
  const rng = makeRng(seed ?? Date.now())
  const dominant: 'A' | 'B' = fitnessA >= fitnessB ? 'A' : 'B'
  const dominantClip = dominant === 'A' ? parentA : parentB

  // Domain inheritance with forced hybridization
  let inheritTemporalFrom: 'A' | 'B' = rng() < 0.5 ? 'A' : 'B'
  let inheritSpatialFrom: 'A' | 'B' = rng() < 0.5 ? 'A' : 'B'

  // Force re-roll if both from same parent (guarantee hybrid)
  if (inheritTemporalFrom === inheritSpatialFrom) {
    inheritSpatialFrom = inheritSpatialFrom === 'A' ? 'B' : 'A'
  }

  const temporalDonor = inheritTemporalFrom === 'A' ? parentA : parentB
  const spatialDonor = inheritSpatialFrom === 'A' ? parentA : parentB

  // Build child tracks: temporal from one, spatial from other
  const childTracks: HephTrack[] = []

  for (const track of temporalDonor.tracks) {
    if (DOMAIN_TEMPORAL.has(track.paramId)) {
      childTracks.push(deepClone(track))
    }
  }
  for (const track of spatialDonor.tracks) {
    if (DOMAIN_SPATIAL.has(track.paramId)) {
      childTracks.push(deepClone(track))
    }
  }

  // If no tracks matched (edge case), fall back to dominant parent's tracks
  if (childTracks.length === 0) {
    for (const track of dominantClip.tracks) {
      childTracks.push(deepClone(track))
    }
  }

  // Build child clip from dominant parent as base
  const child: HephAutomationClipV3 = deepClone(dominantClip)
  child.tracks = childTracks
  child.durationMs = Math.round((parentA.durationMs + parentB.durationMs) / 2)

  // Union spatialZones
  const zoneSet = new Set<string>([
    ...parentA.spatialZones.map(String),
    ...parentB.spatialZones.map(String),
  ])
  child.spatialZones = [...zoneSet] as HephAutomationClipV3['spatialZones']

  // Blend cognitiveDNA
  if (parentA.cognitiveDNA && parentB.cognitiveDNA) {
    child.cognitiveDNA = blendCognitiveDNA(
      parentA.cognitiveDNA,
      parentB.cognitiveDNA,
      dominant,
    )
  }

  // Delta: bulk replace of tracks + cognitiveDNA on dominant parent
  const delta: JsonPatchOp[] = [
    { op: 'replace', path: '/tracks', value: childTracks },
    { op: 'replace', path: '/durationMs', value: child.durationMs },
  ]
  if (child.cognitiveDNA) {
    delta.push({ op: 'replace', path: '/cognitiveDNA', value: child.cognitiveDNA })
  }

  // L2 = min distance to either parent (conservative)
  const l2A = computeL2DistanceV2(parentA, child)
  const l2B = computeL2DistanceV2(parentB, child)
  const l2Distance = Math.min(l2A, l2B)

  return {
    clip: child,
    delta,
    operator: 'crossover',
    l2Distance,
    dominantParent: dominant,
  }
}

// ─── DISPATCHER ─────────────────────────────────────────────────────────────

/**
 * Dispatches to the appropriate operator by name.
 * Note: 'crossover' requires two parents — use crossover() directly
 * or ColiseumService.spawnHybrid() for sexual reproduction.
 */
export function applyOperator(
  parent: HephAutomationClipV3,
  operatorType: MutationOperator,
  seed?: number,
): OperatorResult {
  switch (operatorType) {
    case 'point_mutation':
      return pointMutation(parent, seed)
    case 'gene_duplication':
      return geneDuplication(parent, seed)
    case 'phase_epigenetics':
      return phaseEpigenetics(parent, seed)
    case 'temporal_stretch':
      return temporalStretch(parent, seed)
    case 'gene_splice':
      return geneSplice(parent, seed)
    case 'gene_deletion':
      return geneDeletion(parent, seed)
    case 'interpolation_drift':
      return interpolationDrift(parent, seed)
    case 'crossover':
      console.warn('[GeneticOperators] crossover requires two parents — use crossover() directly or ColiseumService.spawnHybrid()')
      return {
        clip: deepClone(parent),
        delta: [],
        operator: 'crossover',
        l2Distance: 0,
      }
    default:
      // Unknown operator — return clone with no delta
      return {
        clip: deepClone(parent),
        delta: [],
        operator: operatorType,
        l2Distance: 0,
      }
  }
}
