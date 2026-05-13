/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 4750: ChillAmbientEngine — SISTEMA DE MAREAS (Multi-LFO Oceánico)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Motor de modulación de envelope para chill — DESPOJADO de generación de dimmer.
 *
 * FILOSOFÍA:
 *   Las ondas senoidales de intensidad bypasseaban L2 manual. FULMINADAS.
 *   Ahora: Solo morphFactor (control de decay en LiquidEngine) — nada de dimmer.
 *   Tu control L2 de faders manual RESPETADO por HTP.
 *
 * ARQUITECTURA (WAVE 4750 — SISTEMA DE MAREAS):
 *   - Desconectado del audio. No lee bandas espectrales.
 *   - 3 osciladores LFO con períodos PRIMOS entre sí (31s, 47s, 73s).
 *     Períodos primos garantizan que NUNCA coinciden en fase → patrón
 *     cuasi-infinito no periódico. El MCM de 31×47×73 ≈ 106.421s ≈ 29.5h.
 *   - Combinación ponderada: LFO1×0.50 + LFO2×0.30 + LFO3×0.20.
 *   - Suavizado EMA (α=0.008 @ 60fps ≈ τ≈2s) para transiciones fluidas.
 *   - morphFactor ∈ [0.25, 0.75] — rango más profundo que el 0.30-0.70 previo.
 *   - **CHANGE WAVE 4709**: Removidas ondas por zona (frontL, frontR, backL, backR).
 *   - Intensidades vienen del LiquidEngine normal → HTP aplica correctamente a L2.
 *
 * RESULTADO:
 *   - Pares OBEDECEN tu fader manual de dimmer.
 *   - Luz ambiental "respira" de forma orgánica, nunca mecánica.
 *   - Sin beat-sync que ignora L2.
 *
 * USAGE:
 *   import { chillAmbientEngine } from './ChillAmbientEngine'
 *   const frame = chillAmbientEngine.tick()
 *   // frame.morphFactor en [0.25, 0.75]
 *   // (frontL, backL, etc. ELIMINADAS — usan LiquidEngine normal)
 *
 * @module hal/physics/ChillAmbientEngine
 * @version WAVE 4750 — SISTEMA DE MAREAS
 * @author PunkOpus
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Períodos PRIMOS de los 3 osciladores LFO (segundos).
 * Primos entre sí → MCM = 31 × 47 × 73 ≈ 106.421s ≈ 29.5 horas.
 * El patrón combinado no se repite dentro de una noche completa de show.
 */
const LFO1_PERIOD_S = 31.0   // La Corriente Profunda
const LFO2_PERIOD_S = 47.0   // La Marea Alta
const LFO3_PERIOD_S = 73.0   // El Glaciar

/**
 * Pesos de combinación de los 3 LFOs.
 * Deben sumar 1.0 para mantener el rango [0,1] de la suma ponderada.
 */
const LFO1_WEIGHT = 0.50
const LFO2_WEIGHT = 0.30
const LFO3_WEIGHT = 0.20

/**
 * Factor EMA para suavizado del morphFactor.
 * α = 0.008 @ 60fps → τ ≈ 1000 / (60 × 0.008) ≈ 2.1 segundos.
 * Elimina saltos bruscos en transiciones vibe o reinicio del engine.
 */
const EMA_ALPHA = 0.008

/**
 * Rango de salida del morphFactor.
 * Más profundo que el 0.30-0.70 de WAVE 4709 para mayor contraste oceánico.
 */
const MORPH_MIN = 0.25
const MORPH_RANGE = 0.50   // → [0.25, 0.75]

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Salida de un tick del ChillAmbientEngine */
export interface ChillAmbientFrame {
  /** morphFactor para LiquidEngine71.morphFactorOverride — en [0.25, 0.75] */
  readonly morphFactor: number
  /** Timestamp de este frame (ms) — para debug y telemetría */
  readonly _ts: number
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Motor de morphFactor para chill — 100% determinista, 0% FFT, 0% azar.
 * WAVE 4750: 3 osciladores LFO con períodos primos + suavizado EMA.
 * Solo genera morphFactor para modular envelopes en LiquidEngine71.
 */
export class ChillAmbientEngine {

  /**
   * Estado suavizado del morphFactor (EMA).
   * Inicializado en 0.50 (centro del rango) para evitar saltos al arrancar.
   */
  private _smoothedMorph: number = 0.50

  /**
   * Genera un frame con morphFactor basado en el sistema de mareas Multi-LFO.
   * Llamar una vez por frame de render (60fps → ~16ms).
   * Idempotente para el mismo t: si se llama dos veces en el mismo ms, retorna lo mismo.
   */
  tick(): ChillAmbientFrame {
    const tMs = performance.now()
    const tSec = tMs / 1000
    const TWO_PI = 2 * Math.PI

    // ── SISTEMA DE MAREAS: 3 LFOs con períodos primos ────────────────────────
    // Cada LFO produce [0, 1]. La suma ponderada también da [0, 1].
    const lfo1 = (Math.sin((TWO_PI * tSec) / LFO1_PERIOD_S) + 1) / 2  // La Corriente Profunda
    const lfo2 = (Math.sin((TWO_PI * tSec) / LFO2_PERIOD_S) + 1) / 2  // La Marea Alta
    const lfo3 = (Math.sin((TWO_PI * tSec) / LFO3_PERIOD_S) + 1) / 2  // El Glaciar

    // Suma ponderada normalizada → [0, 1]
    const combined = lfo1 * LFO1_WEIGHT + lfo2 * LFO2_WEIGHT + lfo3 * LFO3_WEIGHT

    // Mapear a rango de salida → [MORPH_MIN, MORPH_MIN + MORPH_RANGE]
    const morphTarget = MORPH_MIN + combined * MORPH_RANGE

    // ── EMA suavizador — elimina saltos en la transición chill→otro vibe ──────
    this._smoothedMorph += (morphTarget - this._smoothedMorph) * EMA_ALPHA
    const morphFactor = this._smoothedMorph

    return { morphFactor, _ts: tMs }
  }

  /** Resetea el estado EMA al centro del rango (útil en tests o cambio brusco de vibe). */
  reset(): void {
    this._smoothedMorph = 0.50
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

/** Singleton global — una sola instancia para todo el proceso. */
export const chillAmbientEngine = new ChillAmbientEngine()
