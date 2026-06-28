/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPH SHARED MATH — Single source of truth for blend + evaluator construction
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * P2#7: Consolidates the math that was duplicated between useHephPreview (UI)
 * and HephaestusRuntime (engine). Both now import from this module.
 *
 * Shared:
 *   - defaultBlendMode: intensity→max, everything else→replace
 *   - blendNumeric: max/replace/add/multiply for scalar values
 *   - blendRgb: max/replace/add/multiply for RGB triplets
 *   - buildTrackEvaluators: per-track CurveEvaluator construction
 *
 * @module core/hephaestus/HephSharedMath
 */

import { CurveEvaluator } from './CurveEvaluator'
import type { HephTrack, HephParamId, HephCurve, BlendMode } from './types'

/**
 * Default BlendMode per parameter — when the track doesn't declare
 * a fusion strategy. Aligns with historical semantics:
 *   - intensity → 'max' (HTP — highest takes precedence)
 *   - color / pan / tilt / etc → 'replace' (LTP — last write wins)
 */
export function defaultBlendMode(paramId: HephParamId): BlendMode {
  return paramId === 'intensity' ? 'max' : 'replace'
}

/**
 * Blend two numeric values using the given mode.
 * Values are in normalized [0,1] space.
 */
export function blendNumeric(existing: number, incoming: number, mode: BlendMode): number {
  switch (mode) {
    case 'max': return Math.max(existing, incoming)
    case 'replace': return incoming
    case 'add': return Math.min(1, existing + incoming)
    case 'multiply': return existing * incoming
  }
}

/**
 * Blend two RGB triplets using the given mode.
 * Values are in 0-255 space.
 */
export function blendRgb(
  er: number, eg: number, eb: number,
  ir: number, ig: number, ib: number,
  mode: BlendMode,
): [number, number, number] {
  switch (mode) {
    case 'max': return [Math.max(er, ir), Math.max(eg, ig), Math.max(eb, ib)]
    case 'replace': return [ir, ig, ib]
    case 'add': return [Math.min(255, er + ir), Math.min(255, eg + ig), Math.min(255, eb + ib)]
    case 'multiply': return [(er * ir) / 255, (eg * ig) / 255, (eb * ib) / 255]
  }
}

/**
 * Build per-track CurveEvaluators — one evaluator per track, each with a
 * single curve entry. Preserves the multicelular architecture: two tracks
 * with the same paramId get isolated evaluators with independent cursor
 * caches, exactly like the runtime's ResolvedTrack.
 */
export function buildTrackEvaluators(
  tracks: readonly HephTrack[],
  durationMs: number,
): Map<string, CurveEvaluator> {
  const map = new Map<string, CurveEvaluator>()
  for (const t of tracks) {
    const curveMap = new Map<HephParamId, HephCurve>()
    curveMap.set(t.paramId, t.curve)
    map.set(t.id, new CurveEvaluator(curveMap, durationMs))
  }
  return map
}
