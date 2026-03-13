/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ PHASE DISTRIBUTOR - WAVE 2400: THE PHASER REVOLUTION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Clase STATELESS que calcula el phase offset por fixture basándose
 * en PhaseConfig + la lista de fixture IDs resuelta por resolveFixtureSelector().
 *
 * DESIGN AXIOMS:
 * 1. Pure function: mismos inputs → mismos outputs. SIEMPRE.
 * 2. Pre-calculable: resolve() se llama UNA VEZ cuando el clip
 *    se activa (play/playFromClip). NO en cada tick.
 * 3. Sorted output: FixturePhase[] ordenado por phaseOffsetMs ASC.
 *    Esto permite que el CurveEvaluator cursor cache funcione
 *    en O(1) amortizado incluso con phase offsets.
 *
 * FÓRMULAS CENTRALES:
 *
 *   spreadMs = durationMs × config.spread
 *
 *   Linear:
 *     stepMs = spreadMs / max(1, N - 1)
 *     offset[i] = i × stepMs
 *
 *   Mirror:
 *     halfN = ceil(N / 2)
 *     mirrorIdx = min(i, N - 1 - i)
 *     offset[i] = mirrorIdx × (spreadMs / max(1, halfN - 1))
 *
 *   Center-Out:
 *     center = (N - 1) / 2
 *     dist[i] = abs(i - center)
 *     offset[i] = (dist / maxDist) × spreadMs
 *
 *   Wings:
 *     wingSize = ceil(N / wings)
 *     localIndex = i % wingSize
 *     → Aplica la fórmula de symmetry con localIndex y wingSize
 *
 * @module core/hephaestus/runtime/PhaseDistributor
 * @version WAVE 2400
 */

import type {
  PhaseConfig,
  PhaseSymmetryMode,
  PhaseDirection,
  FixturePhase,
} from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// PHASE DISTRIBUTOR
// ═══════════════════════════════════════════════════════════════════════════

export class PhaseDistributor {
  /**
   * Resuelve la distribución de fase para una lista de fixtures.
   *
   * @param fixtureIds — IDs resueltos por resolveFixtureSelector()
   * @param config — Configuración de fase (spread, symmetry, wings, direction)
   * @param durationMs — Duración del clip (para calcular spreadMs)
   * @returns FixturePhase[] ordenado por phaseOffsetMs ASC
   *
   * CRITICAL: El array de salida se ordena ascendentemente por phaseOffsetMs.
   * Esto garantiza que tickWithPhase() evalúa tiempos en orden creciente,
   * permitiendo que el cursor cache del CurveEvaluator funcione en O(1).
   */
  static resolve(
    fixtureIds: string[],
    config: PhaseConfig,
    durationMs: number
  ): FixturePhase[] {
    const N = fixtureIds.length

    // ── Edge cases ────────────────────────────────────────────────────
    if (N === 0) return []

    if (N === 1 || config.spread === 0) {
      return fixtureIds.map(id => ({
        fixtureId: id,
        phaseOffsetMs: 0,
        normalizedIndex: 0,
      }))
    }

    // ── Calculate spread in ms ────────────────────────────────────────
    const spreadMs = durationMs * Math.max(0, Math.min(1, config.spread))
    const wings = Math.max(1, Math.min(config.wings, N))
    const wingSize = Math.ceil(N / wings)

    // ── Build results ─────────────────────────────────────────────────
    const results: FixturePhase[] = new Array(N)

    for (let i = 0; i < N; i++) {
      const wingIndex = Math.floor(i / wingSize)
      const localIndex = i - wingIndex * wingSize
      const localN = Math.min(wingSize, N - wingIndex * wingSize)

      const offset = PhaseDistributor.computeOffset(
        localIndex,
        localN,
        spreadMs,
        config.symmetry,
        config.direction
      )

      results[i] = {
        fixtureId: fixtureIds[i],
        phaseOffsetMs: offset,
        normalizedIndex: localN > 1 ? localIndex / (localN - 1) : 0,
      }
    }

    // ── Sort by phaseOffsetMs ASC ─────────────────────────────────────
    // CRITICAL for CurveEvaluator cursor cache optimization.
    // tickWithPhase() iterates this array → queries go in monotonically
    // increasing time order → cursor cache stays O(1) amortized.
    results.sort((a, b) => a.phaseOffsetMs - b.phaseOffsetMs)

    return results
  }

  /**
   * Calcula el offset de UNA fixture dentro de su wing.
   * Pure math — sin side effects.
   *
   * @param localIndex — Índice de la fixture dentro de su wing (0-based)
   * @param localN — Cantidad de fixtures en este wing
   * @param spreadMs — Spread total en ms
   * @param symmetry — Modo de simetría
   * @param direction — Dirección de propagación (1=forward, -1=reverse)
   * @returns Offset en ms
   */
  private static computeOffset(
    localIndex: number,
    localN: number,
    spreadMs: number,
    symmetry: PhaseSymmetryMode,
    direction: PhaseDirection
  ): number {
    if (localN <= 1) return 0

    let offset: number

    switch (symmetry) {
      case 'linear': {
        // Linear: evenly spaced offsets
        // [0, step, 2*step, ..., spreadMs]
        const stepMs = spreadMs / (localN - 1)
        offset = localIndex * stepMs
        break
      }

      case 'mirror': {
        // Mirror: fold from edges to center
        // [0, step, 2step, ..., 2step, step, 0]
        const halfN = Math.ceil(localN / 2)
        const mirrorIdx = localIndex < halfN
          ? localIndex
          : localN - 1 - localIndex
        const mirrorStep = spreadMs / Math.max(1, halfN - 1)
        offset = mirrorIdx * mirrorStep
        break
      }

      case 'center-out': {
        // Center-out: expand from center, largest offset at edges
        // [max, ..., 0, ..., max]
        const center = (localN - 1) / 2
        const dist = Math.abs(localIndex - center)
        const maxDist = center || 1
        offset = (dist / maxDist) * spreadMs
        break
      }

      default:
        // Fallback to linear
        offset = localIndex * (spreadMs / (localN - 1))
    }

    // Apply direction: reverse flips the offset
    if (direction === -1) {
      offset = spreadMs - offset
    }

    return offset
  }
}
