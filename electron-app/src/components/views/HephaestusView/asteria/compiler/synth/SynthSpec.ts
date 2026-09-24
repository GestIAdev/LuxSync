/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA — SynthSpec.ts (WAVE 8191 · Crux 3 — Arsenal de Síntesis)
 *
 * Blueprint ASTERIA_CRUX_RESOLUTION §4.2: la forma de onda deja de ser una
 * constante global y se convierte en un PARÁMETRO declarativo. La spec es
 * el documento de intención; `envelope()` la convierte en puntos
 * normalizados y `materialize()` en la HephCurve final.
 *
 * WAVE 8191 la expone de forma provisional a nivel de PROYECTO
 * (`project.defaultSynth`); la WAVE 8195 la baja a `paint.synth` por capa.
 *
 * Puro: sin Electron, sin estado, serializable en JSON (viaja dentro del
 * `.lfx` en `clip.asteria` — D-4).
 *
 * @module HephaestusView/asteria/compiler/synth/SynthSpec
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Las 8 formas del vocabulario (tabla §4.3 del blueprint). */
export type SynthShape =
  | 'pulse'      // trapezoide V1 (default — compat byte a byte)
  | 'triangle'   // rampa simétrica sube/baja
  | 'ramp-up'    // diente de sierra ascendente, caída dura (ε = 1 ms)
  | 'ramp-down'  // diente de sierra descendente, subida dura (ε = 1 ms)
  | 'square'     // on/off duro — su discontinuidad en el wrap es intencional
  | 'sine'       // campana ease-in-out bezier
  | 'laser'      // pulso ultra-estrecho de flancos duros — la "línea de luz"
  | 'hold'       // constante (estático — alimenta 'uniform/palette-static')

/** Todas las formas, en orden de menú (UI provisional STRATEGY → SHAPE). */
export const SYNTH_SHAPES: readonly SynthShape[] = [
  'pulse',
  'triangle',
  'ramp-up',
  'ramp-down',
  'square',
  'sine',
  'laser',
  'hold',
]

/**
 * Spec declarativa de síntesis. Todos los campos opcionales — los defaults
 * viven por forma en `envelopes.ts` (SHAPE_DEFAULTS), de modo que
 * `{ shape: 'pulse' }` ≡ el pulso Λ de la V1.
 */
export interface SynthSpec {
  readonly shape: SynthShape
  /** Fracción de D ocupada por la parte activa ∈ (0,1]. Default por forma. */
  readonly duty?: number
  /**
   * Dureza de flancos ∈ [0,1]: 1 = duro (hold/ε=1 ms), 0 = suave.
   * Afecta solo a las formas con flanco duro (ramp-up/down, square,
   * laser) — pulse/triangle/sine ya son suaves por receta.
   */
  readonly edge?: number
  /** Suelo normalizado — la envolvente se remapea a [floor, ceil]. */
  readonly floor?: number // default 0
  /** Techo normalizado. */
  readonly ceil?: number // default 1
}
