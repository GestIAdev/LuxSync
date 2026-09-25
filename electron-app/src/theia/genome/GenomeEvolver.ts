/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 WAVE 8235 — INFINITE GENOME · Fase G3: Genome Evolver (mutación §4.6)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Observador pasivo del tick — mismo patrón que `SeleneTheiaBridge`:
 * el host (TickEngine, que ya conoce `u_barCount` y los ingredientes de
 * `u_approach`) llama `notify()` por frame; el evolver dispara la mutación
 * SOLO en frontera de frase y solo cuando es seguro.
 *
 * Reglas del blueprint (§4.6):
 *   - Cada `phraseBars` compases (16 ó 32) hay frontera de frase.
 *   - Solo muta si `approach < 0.2` y NO hay drop activo (nunca en el
 *     clímax ni en mitad de un buildup).
 *   - La semilla hija es `PCG(seed_actual ⊕ contador_de_frases)`.
 *   - Si solo cambian genes `expr`, el cambio se fija por `u_gene` sin
 *     recompilar ni crossfade (lo decide `ThetaOrchestrator.evolveGenome`
 *     vía `structGenesDiffer` y el fast-path del worker por programKey).
 *
 * Zero-alloc: notify() trabaja sobre escalares; `evolveGenome` corre a lo
 * sumo una vez por frase — jamás por frame.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { ThetaOrchestrator } from '../ThetaOrchestrator'

/** Compases por frase (§4.6: 16 u 32). */
export const GENOME_PHRASE_BARS = 16
/** Compuerta de seguridad: `u_approach` debe ser < 0.2 para mutar. */
export const GENOME_APPROACH_GATE = 0.2
/** Crossfade de una mutación `struct`: 2 compases (§4.6). */
export const GENOME_MUTATE_BARS = 2

export class GenomeEvolver {
  private _theta: ThetaOrchestrator | null = null
  /** Índice de la última frase observada (`floor(barCount / phraseBars)`). */
  private _phraseIdx = -1
  /** Contador de frases cruzadas — la segunda entrada del PCG de semilla hija. */
  private _phraseCount = 0

  /** Longitud de frase en compases (16 ó 32, §4.6). */
  phraseBars: number = GENOME_PHRASE_BARS
  /** Umbral de `u_approach` por encima del cual la mutación se pospone. */
  approachGate: number = GENOME_APPROACH_GATE
  /** Kill-switch del operador. */
  enabled = true

  attach(theta: ThetaOrchestrator): void {
    this._theta = theta
    this._phraseIdx = -1
  }

  detach(): void {
    this._theta = null
    this._phraseIdx = -1
    this._phraseCount = 0
  }

  isAttached(): boolean {
    return this._theta !== null
  }

  /** Frases atravesadas desde el attach (diagnóstico). */
  get phraseCount(): number {
    return this._phraseCount
  }

  /**
   * §4.6 — llamada por tick con el `u_barCount` absoluto y el gate
   * instantáneo del host. Detecta el CRUCE de frontera de frase y, si el
   * momento es seguro, pide al orquestador la mutación.
   *
   * @param barCount   u_barCount — compases absolutos (slot 59 del ring).
   * @param approach   u_approach instantáneo (rampa oráculo sin suavizar —
   *                   conservador: adelanta el veto respecto al EMA).
   * @param dropActive zona `peak` / apocalypse — jamás mutar en el clímax.
   * @param barMs      duración real de un compás (ms) — base del crossfade.
   */
  notify(
    barCount: number,
    approach: number,
    dropActive: boolean,
    barMs: number,
  ): void {
    const theta = this._theta
    if (!theta || !this.enabled) return
    const idx = Math.floor(barCount / this.phraseBars)
    if (this._phraseIdx < 0) {
      // Primera observación: siembra el índice — mutar exige un CRUCE real.
      this._phraseIdx = idx
      return
    }
    if (idx === this._phraseIdx) return
    this._phraseIdx = idx
    this._phraseCount++
    if (approach >= this.approachGate || dropActive) return
    theta.evolveGenome(this._phraseCount, barMs)
  }
}

// ─────────────────────────── Singleton ───────────────────────────

let _instance: GenomeEvolver | null = null

export function getGenomeEvolver(): GenomeEvolver {
  if (!_instance) _instance = new GenomeEvolver()
  return _instance
}
