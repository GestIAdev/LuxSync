/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧠 SeleneDirector — WAVE 8307 (Blueprint Ola D2 · §6.4)
 *
 * El "oráculo VJ": dado el estado musical actual, elige cuál de los ítems
 * candidatos (la playlist, o el catálogo como fallback) debe sonar.
 *
 *   1. `AcoTracker`   — proxy renderer-side del `TargetDNA` de Selene. El
 *                       DNAAnalyzer real vive en el main process y NO se
 *                       publica en el ring, así que se re-deriva del propio
 *                       ring (energía, dureza, planitud, flujo, densidad de
 *                       transitorios) con un EMA (τ ≈ 2 s) anti-jitter.
 *   2. `energyToZone` — umbrales canónicos de `MusicalContext.EnergyZone`.
 *   3. `seleneChoose` — ranking euclídeo (aggression, chaos, organicity) +
 *                       bonus de vibe, delegado a
 *                       `SeleneTheiaAdapter.rankCandidates` (geometría única).
 *
 * Puro y determinista (sin rAF, sin stores): el Auto-Pilot inyecta las
 * lecturas y consume el índice ganador.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { EnergyZone, ITheiaAtom, ITheiaGenome } from '../types/theiaTypes'
import { getSeleneTheiaAdapter } from '../core/theia/SeleneTheiaAdapter'

/** Constante de tiempo del EMA del target ACO (ms). */
const ACO_TAU_MS = 2000

/** Features de telemetría que alimentan el proxy ACO (todas 0..1). */
export interface AcoFeatures {
  readonly energy: number
  readonly harshness: number
  readonly flatness: number
  readonly transientDensity: number
  readonly spectralFlux: number
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Proxy del `DNAAnalyzer.calculateRawTarget`: misma intención semántica
 * (agresión = golpe, caos = ruido/transitorios, organicidad = calidez
 * tonal — inversa a la energía mecánica), calculada solo con el ring.
 */
export function deriveAco(f: AcoFeatures): ITheiaGenome {
  const aggression = clamp01(0.55 * f.energy + 0.25 * f.harshness + 0.2 * f.spectralFlux)
  const chaos = clamp01(0.45 * f.transientDensity + 0.3 * f.flatness + 0.25 * f.spectralFlux)
  const organicity = clamp01(0.9 - 0.6 * f.energy - 0.2 * f.harshness - 0.1 * f.transientDensity)
  return { aggression, chaos, organicity }
}

/** Umbrales canónicos de `MusicalContext.EnergyZone` (energía 0..1). */
export function energyToZone(e: number): EnergyZone {
  if (e < 0.1) return 'silence'
  if (e < 0.2) return 'valley'
  if (e < 0.35) return 'ambient'
  if (e < 0.5) return 'gentle'
  if (e < 0.7) return 'active'
  if (e < 0.85) return 'intense'
  return 'peak'
}

/** EMA del target ACO + energía (ruta caliente: cero allocs por update). */
export class AcoTracker {
  aggression = 0.5
  chaos = 0.5
  organicity = 0.5
  energy = 0
  private primed = false

  update(f: AcoFeatures, dtMs: number): void {
    const raw = deriveAco(f)
    if (!this.primed) {
      this.aggression = raw.aggression
      this.chaos = raw.chaos
      this.organicity = raw.organicity
      this.energy = f.energy
      this.primed = true
      return
    }
    const a = 1 - Math.exp(-Math.max(0, dtMs) / ACO_TAU_MS)
    this.aggression += a * (raw.aggression - this.aggression)
    this.chaos += a * (raw.chaos - this.chaos)
    this.organicity += a * (raw.organicity - this.organicity)
    this.energy += a * (f.energy - this.energy)
  }

  target(): ITheiaGenome {
    return { aggression: this.aggression, chaos: this.chaos, organicity: this.organicity }
  }

  reset(): void {
    this.primed = false
  }
}

/** Candidato: un átomo resuelto y su origen (índice de playlist o catálogo). */
export interface SeleneCandidate {
  /** Índice en la playlist, o -1 si viene del catálogo (fallback). */
  readonly index: number
  readonly atom: ITheiaAtom
}

export interface SelenePick {
  readonly index: number
  readonly atomId: string
  readonly score: number
  readonly distance: number
  readonly vibeMatch: boolean
}

/**
 * Cruza ACO + vibe + zona energética contra los candidatos y devuelve el
 * ganador. `avoidAtomId` = el átomo en LIVE (no se repite salvo único).
 */
export function seleneChoose(
  candidates: readonly SeleneCandidate[],
  ctx: {
    readonly target: ITheiaGenome
    readonly energy: number
    readonly vibe: string
    readonly avoidAtomId?: string
  },
): SelenePick | null {
  if (candidates.length === 0) return null
  const atoms = candidates.map((c) => c.atom)
  const win = getSeleneTheiaAdapter().rankCandidates(
    atoms,
    ctx.target,
    energyToZone(ctx.energy),
    ctx.vibe,
    ctx.avoidAtomId,
  )
  if (!win) return null
  const hit = candidates.find((c) => c.atom.id === win.atomId)
  if (!hit) return null
  return {
    index: hit.index,
    atomId: win.atomId,
    score: win.score,
    distance: win.distance,
    vibeMatch: win.vibeMatch,
  }
}
