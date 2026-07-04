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

import type { HephAutomationClipV3, HephTrack, HephKeyframe, HephCurve } from '../../hephaestus/types'
import type { PhaseConfigPro } from '../../hephaestus/phase/PhaseConfigPro'
import { DEFAULT_PHASE_CONFIG_PRO } from '../../hephaestus/phase/PhaseConfigPro'
import type { MutationOperator } from '../types'

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
        if (Array.isArray(cursor[lastKey])) {
          ;(cursor[lastKey] as unknown[]).push(op.value)
        } else if (lastKey === '-' && Array.isArray(cursor)) {
          cursor.push(op.value)
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

// ─── L2 DISTANCE HELPER ─────────────────────────────────────────────────────

/**
 * Computes a normalized L2 distance between parent and child clip
 * based on numeric keyframe values and bezier handles.
 * Returns a value in [0, ∞) — higher = more divergent.
 */
function computeL2Distance(
  parent: HephAutomationClipV3,
  child: HephAutomationClipV3,
): number {
  let sumSq = 0
  let count = 0

  const parentTracks = parent.tracks
  const childTracks = child.tracks

  const maxTracks = Math.max(parentTracks.length, childTracks.length)
  for (let t = 0; t < maxTracks; t++) {
    const pt = parentTracks[t]
    const ct = childTracks[t]
    if (!pt || !ct) {
      sumSq += 1.0 // track added/removed = full divergence
      count++
      continue
    }

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
        const diff = ckf.value - pkf.value
        sumSq += diff * diff
        count++
      }
      if (pkf.bezierHandles && ckf.bezierHandles) {
        for (let b = 0; b < 4; b++) {
          const diff = ckf.bezierHandles[b] - pkf.bezierHandles[b]
          sumSq += diff * diff * 0.25 // bezier weighted lower
          count++
        }
      }
    }
  }

  return count > 0 ? Math.sqrt(sumSq / count) : 0
}

// ─── RANDOM HELPERS (deterministic via seed) ────────────────────────────────

function makeRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return ((s >>> 0) % 1000000) / 1000000
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 1: POINT MUTATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Modifies 2-8% a single Bézier handle or numeric `value` in a random track.
 * Does not touch color values (HSL) — only numeric keyframes.
 */
export function pointMutation(
  parent: HephAutomationClipV3,
  seed?: number,
): OperatorResult {
  const rng = makeRng(seed ?? Date.now())
  const child = deepClone(parent)
  const delta: JsonPatchOp[] = []

  // Find tracks with numeric keyframes
  const numericTracks = child.tracks
    .map((t, i) => ({ track: t, index: i }))
    .filter((t) => t.track.curve.valueType === 'number' && t.track.curve.keyframes.length > 0)

  if (numericTracks.length === 0) {
    return {
      clip: child,
      delta,
      operator: 'point_mutation',
      l2Distance: 0,
    }
  }

  // Pick a random track
  const pick = numericTracks[Math.floor(rng() * numericTracks.length)]
  const track = pick.track
  const trackIdx = pick.index

  // Pick a random keyframe
  const kfIdx = Math.floor(rng() * track.curve.keyframes.length)
  const kf = track.curve.keyframes[kfIdx]

  // Mutation magnitude: 2-8%
  const magnitude = 0.02 + rng() * 0.06
  const sign = rng() < 0.5 ? -1 : 1

  const range = track.curve.range
  const span = range[1] - range[0]

  if (typeof kf.value === 'number') {
    const oldVal = kf.value
    const newVal = clamp(oldVal + sign * magnitude * span, range[0], range[1])
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
    const newHandle = clamp(oldHandle + sign * magnitude, -2, 2)
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
    l2Distance: computeL2Distance(parent, child),
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
    l2Distance: computeL2Distance(parent, child),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATOR 3: PHASE EPIGENETICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mutates PhaseConfigPro parameters (spreadDeg, wings, shuffle, blocks, direction)
 * across ALL tracks without touching the curves (keyframes/values).
 * This is purely epigenetic — it changes HOW tracks execute, not WHAT they produce.
 */
export function phaseEpigenetics(
  parent: HephAutomationClipV3,
  seed?: number,
): OperatorResult {
  const rng = makeRng(seed ?? Date.now())
  const child = deepClone(parent)
  const delta: JsonPatchOp[] = []

  for (let t = 0; t < child.tracks.length; t++) {
    const track = child.tracks[t]
    const existing = track.phaseConfig ?? { ...DEFAULT_PHASE_CONFIG_PRO }

    // Mutate 1-2 phase parameters per track
    const numMutations = 1 + Math.floor(rng() * 2)
    const newPhase: PhaseConfigPro = { ...existing }

    for (let m = 0; m < numMutations; m++) {
      const param = Math.floor(rng() * 5)
      switch (param) {
        case 0: // spreadDeg
          newPhase.spreadDeg = clamp(existing.spreadDeg + (rng() - 0.5) * 120, 0, 1440)
          break
        case 1: // wings
          newPhase.wings = clamp(Math.round(existing.wings + (rng() < 0.5 ? -1 : 1)), 1, 8)
          break
        case 2: // shuffle
          newPhase.shuffle = clamp(existing.shuffle + (rng() - 0.5) * 0.3, 0, 1)
          break
        case 3: // blocks
          newPhase.blocks = clamp(Math.round(existing.blocks + (rng() < 0.5 ? -1 : 1)), 1, 16)
          break
        case 4: // direction
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
    l2Distance: computeL2Distance(parent, child),
  }
}

// ─── DISPATCHER ─────────────────────────────────────────────────────────────

/**
 * Dispatches to the appropriate operator by name.
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
