/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 LUT SYNTH — WAVE 8030-P6: VÍA Λ (Curva-LUT + Bus de Direcciones)
 *
 * Blueprint §3: el `.lfx` solo tiene UN handle per-fixture — `offsetMs`
 * (`phaseOverrides`). La Vía Λ invierte el problema: la curva deja de ser
 * una envolvente temporal y se convierte en una LOOK-UP TABLE indexada
 * por espacio; `offsetᵢ` es la dirección de memoria del fixture i:
 *
 *   valor(fixture) = C((t + offsetᵢ) mod D)
 *
 * MODO ANIMADO (§3.3): el operador pinta un RETARDO, la LUT es una forma
 * de onda (pulso), y:
 *
 *   offsetMs[i] = delayMs[i]    // verbatim blueprint — clamp [0, D], int
 *
 * Granularidad honesta (§2): `phaseOverrides` es por FIXTURE, no por
 * celda — cada deviceId recibe el retardo de su primer nodo cubierto en
 * orden canónico del atlas. La independencia por celda es MCC (WAVE 8040).
 *
 * Función PURA y patch-time: sin estado, sin Electron, testeable en node.
 *
 * @module HephaestusView/asteria/compiler/lutSynth
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { HephCurve, HephKeyframe, HephParamId } from '../../../../../core/hephaestus/types'
import type { PhaseOverrideMap } from '../../../../../core/hephaestus/phase/PhaseOverride'
import type { NodeAtlas } from '../store/useAsteriaStore'
import type { FieldSnapshot } from '../model/fieldEngine'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface LambdaResult {
  /** La Curva-LUT maestra (forma de onda — el "grano" del efecto). */
  readonly curve: HephCurve
  /** Bus de direcciones: deviceId → offset absoluto en la LUT. */
  readonly overrides: PhaseOverrideMap
  /** Fixtures que recibieron dirección (para el reporte). */
  readonly devicesTargeted: number
}

// ═══════════════════════════════════════════════════════════════════════════
// LUT — el pulso Λ por defecto
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sintetiza la forma de onda Λ básica: pulso trapezoidal que ocupa todo
 * el durationMs — ataque rápido, meseta, release, y keyframe de cierre
 * en τ=D con el valor inicial (wrap C⁰ — sin "tirón" por ciclo, §3.3-6).
 *
 * INVARIANTES cumplidas (gate G5 + serializador):
 *   - keyframes no vacío, orden ASC por timeMs, valores en range [0,1]
 */
export function synthesizeLambdaPulse(
  paramId: HephParamId,
  durationMs: number,
): HephCurve {
  const D = Math.max(1, durationMs)
  const keyframes: HephKeyframe[] = [
    { timeMs: 0,                    value: 0, interpolation: 'linear' },
    { timeMs: Math.round(D * 0.08), value: 1, interpolation: 'linear' }, // attack
    { timeMs: Math.round(D * 0.28), value: 1, interpolation: 'linear' }, // hold
    { timeMs: Math.round(D * 0.42), value: 0, interpolation: 'linear' }, // release
    { timeMs: D,                    value: 0, interpolation: 'linear' }, // cierre C⁰
  ]
  return {
    paramId,
    valueType: 'number',
    range: [0, 1],
    defaultValue: 0,
    keyframes,
    mode: 'absolute',
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BUS DE DIRECCIONES — delayMs[] → PhaseOverrideMap por deviceId
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construye la pareja (LUT, direcciones) de un FieldSnapshot:
 *   - curve:     pulso Λ sintetizado para `paramId`
 *   - overrides: deviceId → { mode:'absolute', offsetMs } con el retardo
 *                del PRIMER nodo cubierto (mask=1) del fixture en orden
 *                canónico del atlas. Nodos sin cobertura no emiten
 *                dirección. offsetMs clampado a [0, durationMs] y
 *                redondeado a entero (regla dura §8.1 — clamp del runtime
 *                + ahorro de bytes).
 */
export function synthesizeLambda(
  field: FieldSnapshot,
  durationMs: number,
  atlas: NodeAtlas,
  paramId: HephParamId = 'intensity',
): LambdaResult {
  const curve = synthesizeLambdaPulse(paramId, durationMs)
  const overrides: PhaseOverrideMap = {}
  let devicesTargeted = 0

  const { delayMs, mask, count } = field
  const entries = atlas.entries
  for (let i = 0; i < count; i++) {
    if (mask[i] === 0) continue
    const deviceId = entries[i].deviceId
    if (overrides[deviceId] !== undefined) continue // primer nodo cubierto
    const d = Math.round(Math.max(0, Math.min(durationMs, delayMs[i])))
    overrides[deviceId] = { mode: 'absolute', offsetMs: d }
    devicesTargeted++
  }

  return { curve, overrides, devicesTargeted }
}
