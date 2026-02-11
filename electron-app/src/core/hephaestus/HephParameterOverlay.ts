/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS PARAMETER OVERLAY - THE INVISIBLE HAND
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2030.2: HEPHAESTUS CORE ENGINE
 * 
 * Capa que se coloca SOBRE el output de un efecto existente
 * y modula/reemplaza valores según curvas de automatización.
 * 
 * PRINCIPIO FUNDAMENTAL: TRANSPARENCIA TOTAL
 * El efecto base NO SABE que Hephaestus existe.
 * El EffectManager aplica el overlay DESPUÉS del getOutput().
 * Los 40+ efectos existentes siguen funcionando sin cambios.
 * 
 * FLUJO:
 *   Effect.getOutput() → rawOutput
 *   CurveEvaluator.getSnapshot(t) → hephValues
 *   HephParameterOverlay.apply(rawOutput, t) → finalOutput
 * 
 * MODOS DE APLICACIÓN (por curva):
 *   'absolute' → Reemplaza el valor del efecto
 *   'relative' → Multiplica el valor del efecto (envelope)
 *   'additive' → Suma al valor del efecto (wobble)
 * 
 * @module core/hephaestus/HephParameterOverlay
 * @version WAVE 2030.2
 */

import type { EffectFrameOutput } from '../effects/types'
import type { HephAutomationClip, HSL } from './types'
import { CurveEvaluator } from './CurveEvaluator'
import { isHSL } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Frecuencia máxima de strobe en Hz.
 * Corresponde al safe-max establecido en WAVE 1101.
 * strobe curva 0-1 se mapea a 0-MAX_STROBE_HZ
 */
const MAX_STROBE_HZ = 18

// ═══════════════════════════════════════════════════════════════════════════
// HEPHAESTUS PARAMETER OVERLAY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚒️ HEPHAESTUS PARAMETER OVERLAY
 * 
 * Toma el output raw de un efecto y aplica las curvas de automatización
 * de Hephaestus por encima, produciendo un output final modulado.
 * 
 * DISEÑO:
 * - Inmutable sobre rawOutput: clona antes de modificar
 * - Respeta el modo de cada curva (absolute/relative/additive)
 * - Clampea valores al rango válido
 * - Ignora parámetros sin curva (pass-through del efecto base)
 * 
 * USO:
 * ```typescript
 * const overlay = new HephParameterOverlay(automationClip)
 * 
 * // En cada frame del EffectManager:
 * const rawOutput = effect.getOutput()
 * const finalOutput = overlay.apply(rawOutput, currentTimeMs)
 * ```
 */
export class HephParameterOverlay {
  private readonly evaluator: CurveEvaluator
  private readonly durationMs: number

  constructor(clip: HephAutomationClip) {
    this.evaluator = new CurveEvaluator(clip.curves, clip.durationMs)
    this.durationMs = clip.durationMs
  }

  /**
   * Retorna la duración total del clip en milisegundos.
   * Útil para cleanup y timing en EffectManager.
   */
  getDurationMs(): number {
    return this.durationMs
  }

  /**
   * Aplica las curvas de Hephaestus sobre el output raw de un efecto.
   * 
   * NO MUTA el rawOutput original.
   * Produce un nuevo objeto con los valores modulados.
   * 
   * @param rawOutput Output original del efecto
   * @param timeMs Tiempo actual dentro del clip (ms desde inicio)
   * @returns Output final con curvas de automatización aplicadas
   */
  apply(rawOutput: EffectFrameOutput, timeMs: number): EffectFrameOutput {
    const snapshot = this.evaluator.getSnapshot(timeMs)

    // Shallow clone: no mutamos el original
    // Las propiedades anidadas (movement, zoneOverrides) se clonan
    // solo si se modifican — lazy clone.
    const output: EffectFrameOutput = { ...rawOutput }

    // ═════════════════════════════════════════════════════════════════
    // INTENSITY → dimmerOverride
    // ═════════════════════════════════════════════════════════════════
    if (snapshot.intensity !== undefined && typeof snapshot.intensity === 'number') {
      const curveVal = snapshot.intensity
      const mode = this.evaluator.getCurveMode('intensity')
      const baseIntensity = rawOutput.dimmerOverride ?? rawOutput.intensity ?? 1

      output.dimmerOverride = this.applyMode(baseIntensity, curveVal, mode, 0, 1)
      output.intensity = output.dimmerOverride
    }

    // ═════════════════════════════════════════════════════════════════
    // COLOR → colorOverride (HSL)
    // ═════════════════════════════════════════════════════════════════
    if (snapshot.color !== undefined && isHSL(snapshot.color)) {
      // Color siempre es absolute — no tiene sentido multiplicar HSL
      output.colorOverride = snapshot.color
    }

    // ═════════════════════════════════════════════════════════════════
    // WHITE → whiteOverride
    // ═════════════════════════════════════════════════════════════════
    if (snapshot.white !== undefined && typeof snapshot.white === 'number') {
      const mode = this.evaluator.getCurveMode('white')
      const baseWhite = rawOutput.whiteOverride ?? 0
      output.whiteOverride = this.applyMode(baseWhite, snapshot.white, mode, 0, 1)
    }

    // ═════════════════════════════════════════════════════════════════
    // AMBER → amberOverride
    // ═════════════════════════════════════════════════════════════════
    if (snapshot.amber !== undefined && typeof snapshot.amber === 'number') {
      const mode = this.evaluator.getCurveMode('amber')
      const baseAmber = rawOutput.amberOverride ?? 0
      output.amberOverride = this.applyMode(baseAmber, snapshot.amber, mode, 0, 1)
    }

    // ═════════════════════════════════════════════════════════════════
    // STROBE → strobeRate (0-1 → 0-18Hz)
    // ═════════════════════════════════════════════════════════════════
    if (snapshot.strobe !== undefined && typeof snapshot.strobe === 'number') {
      const mode = this.evaluator.getCurveMode('strobe')
      const baseStrobe = rawOutput.strobeRate ?? 0
      const baseNormalized = baseStrobe / MAX_STROBE_HZ
      const resultNormalized = this.applyMode(baseNormalized, snapshot.strobe, mode, 0, 1)
      output.strobeRate = resultNormalized * MAX_STROBE_HZ
    }

    // ═════════════════════════════════════════════════════════════════
    // PAN/TILT → movement override
    // ═════════════════════════════════════════════════════════════════
    if (snapshot.pan !== undefined || snapshot.tilt !== undefined) {
      // Clone movement si existe, crear si no
      output.movement = rawOutput.movement
        ? { ...rawOutput.movement }
        : { isAbsolute: true }

      if (snapshot.pan !== undefined && typeof snapshot.pan === 'number') {
        const mode = this.evaluator.getCurveMode('pan')
        // Curva 0-1 → movement -1..1
        const basePan = rawOutput.movement?.pan ?? 0
        const baseNorm = (basePan + 1) / 2 // -1..1 → 0..1
        const resultNorm = this.applyMode(baseNorm, snapshot.pan, mode, 0, 1)
        output.movement.pan = resultNorm * 2 - 1 // 0..1 → -1..1
      }

      if (snapshot.tilt !== undefined && typeof snapshot.tilt === 'number') {
        const mode = this.evaluator.getCurveMode('tilt')
        const baseTilt = rawOutput.movement?.tilt ?? 0
        const baseNorm = (baseTilt + 1) / 2
        const resultNorm = this.applyMode(baseNorm, snapshot.tilt, mode, 0, 1)
        output.movement.tilt = resultNorm * 2 - 1
      }

      output.movement.isAbsolute = true
    }

    // ═════════════════════════════════════════════════════════════════
    // GLOBAL COMPOSITION
    // ═════════════════════════════════════════════════════════════════
    if (snapshot.globalComp !== undefined && typeof snapshot.globalComp === 'number') {
      const mode = this.evaluator.getCurveMode('globalComp')
      const baseComp = rawOutput.globalComposition ?? 0
      output.globalComposition = this.applyMode(baseComp, snapshot.globalComp, mode, 0, 1)
    }

    return output
  }

  /**
   * Reset del evaluator interno.
   * Llamar cuando se hace seek/scrub en el timeline.
   */
  reset(): void {
    this.evaluator.reset()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNALS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Aplica el modo de curva (absolute/relative/additive) sobre un valor.
   * 
   * @param baseValue Valor original del efecto
   * @param curveValue Valor de la curva de Hephaestus
   * @param mode Modo de aplicación
   * @param min Valor mínimo (clamp)
   * @param max Valor máximo (clamp)
   * @returns Valor resultante, clamped al rango
   */
  private applyMode(
    baseValue: number,
    curveValue: number,
    mode: 'absolute' | 'relative' | 'additive',
    min: number,
    max: number
  ): number {
    let result: number

    switch (mode) {
      case 'absolute':
        // Reemplazar: la curva dicta el valor
        result = curveValue
        break

      case 'relative':
        // Multiplicar: la curva escala el valor del efecto (envelope)
        result = baseValue * curveValue
        break

      case 'additive':
        // Sumar: la curva añade un offset (wobble, LFO)
        result = baseValue + curveValue
        break

      default:
        result = curveValue
    }

    // Clamp al rango válido
    return Math.max(min, Math.min(max, result))
  }
}
