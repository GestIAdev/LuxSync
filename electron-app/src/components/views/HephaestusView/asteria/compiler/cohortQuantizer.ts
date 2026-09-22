/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 ASTERIA — cohortQuantizer.ts (WAVE 8040 · Vía B)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cuantizador de cohortes por GAIN — blueprint §8.3.
 *
 * La Vía Λ expresa retardo per-fixture vía phaseOverrides, pero el gain
 * per-nodo requiere Vía B: agrupar los nodos cubiertos en K ≤ cohortBudget
 * cohortes de gain similar; cada cohorte compila a UNA pista con la curva
 * maestra rotada por el retardo representativo y escalada por el gain
 * representativo (`dimmerScale` en intensity / valores horneados en el resto).
 *
 * CUANTIZACIÓN POR PERCENTILES (§8.3-1: "percentiles, no uniforme"):
 * los nodos cubiertos se ordenan por gain y se cortan en K cubos de
 * cardinal casi igual. Así, una distribución con un pico enorme en gain=1.0
 * no desperdicia niveles en regiones vacías (a diferencia de bins uniformes).
 *
 * REPRESENTANTES: media aritmética del cubo — el nivel que minimiza el
 * error cuadrático respecto a los miembros (óptimo de Lloyd para K fijo).
 *
 * DETERMINISMO: orden por (gain, índice de atlas). Misma entrada → misma
 * partición, byte a byte. Compiler-time puro — no se usa en runtime.
 */

import type { FieldSnapshot } from '../model/fieldEngine'
import type { NodeAtlasEntry } from '../../../../../core/aether/types'

/** Una cohorte de nodos con gain representativo compartido. */
export interface GainCohort {
  /**
   * Nivel de gain representativo del cubo (media de sus miembros).
   * Vía B lo aplica vía `dimmerScale` (intensity) o horneado en keyframes.
   */
  readonly gain: number

  /**
   * Retardo representativo del cubo (media de `delayMs`) — el delay que
   * `rotateCurveCyclic` hornea en la curva maestra de la cohorte (§8.3-2).
   */
  readonly delayMs: number

  /** nodeIds miembros, en orden canónico del atlas. */
  readonly nodeIds: string[]
}

/**
 * Agrupa los nodos cubiertos por `field.mask` en ≤ `maxCohorts` cohortes
 * por percentiles de `field.gain`.
 *
 * @param field       FieldSnapshot del fieldEngine (mask ≠ 0 → cubierto).
 * @param atlas       Node Atlas — aporta el nodeId canónico de cada índice.
 * @param maxCohorts  K máximo (`project.cohortBudget`, default 16).
 * @returns Cohortes ordenadas por gain ascendente. Vacío si no hay cubiertos.
 */
export function quantizeGainCohorts(
  field: FieldSnapshot,
  atlas: readonly NodeAtlasEntry[],
  maxCohorts: number,
): GainCohort[] {
  const n = Math.min(field.mask.length, atlas.length)
  if (n === 0 || maxCohorts <= 0) return []

  // ── 1. Recolectar cubiertos con sus índices canónicos ─────────────────
  const idx: number[] = []
  for (let i = 0; i < n; i++) {
    if (field.mask[i] !== 0) idx.push(i)
  }
  const covered = idx.length
  if (covered === 0) return []

  // ── 2. Orden determinista: (gain, índice de atlas) ────────────────────
  idx.sort((a, b) => (field.gain[a] - field.gain[b]) || (a - b))

  // ── 3. Corte por percentiles: K cubos de cardinal casi igual ──────────
  //    Frontera del cubo c: round(c · covered / K) — cubos difieren a lo
  //    sumo en 1 miembro; el remanente va a los primeros cubos.
  const K = Math.min(Math.floor(maxCohorts), covered)
  const cohorts: GainCohort[] = []
  let lo = 0
  for (let c = 0; c < K; c++) {
    const hi = Math.round(((c + 1) * covered) / K)
    const size = hi - lo
    if (size <= 0) break

    // Representantes = medias; nodeIds en orden de atlas (idx ya guarda
    // índices — se reordenan ascendentes dentro del cubo).
    let gainSum = 0
    let delaySum = 0
    const members: number[] = []
    for (let j = lo; j < hi; j++) {
      const i = idx[j]
      gainSum += field.gain[i]
      delaySum += field.delayMs[i]
      members.push(i)
    }
    members.sort((a, b) => a - b)

    cohorts.push({
      gain: gainSum / size,
      delayMs: delaySum / size,
      nodeIds: members.map(i => atlas[i].nodeId),
    })
    lo = hi
  }

  return cohorts
}
