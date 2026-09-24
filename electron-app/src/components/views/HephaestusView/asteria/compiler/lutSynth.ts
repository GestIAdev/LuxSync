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

import type { HephCurve, HephParamId, HSL } from '../../../../../core/hephaestus/types'
import { ASTERIA_DEFAULT_TARGET_COLOR } from '../model/AsteriaProject'
import type { PhaseOverrideMap } from '../../../../../core/hephaestus/phase/PhaseOverride'
import type { NodeAtlas } from '../store/useAsteriaStore'
import type { FieldSnapshot } from '../model/fieldEngine'
import { envelope } from './synth/envelopes'
import { materialize } from './synth/materialize'

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
  // 🜨 WAVE 8191: wrapper de compatibilidad — la receta 'pulse' por
  // defecto de envelopes.ts reproduce esta curva byte a byte
  // (gate G-SYN-COMPAT). La implementación vive en synth/materialize.
  return materialize(envelope({ shape: 'pulse' }), paramId, durationMs)
}

/**
 * HEX '#rrggbb' → HSL. Hex inválido → rojo puro (fallback honesto —
 * nunca NaN en un keyframe que el runtime vaya a fundir).
 */
export function hexToHsl(hex: string): HSL {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return { h: 0, s: 100, l: 50 }
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 0xff) / 255
  const g = ((n >> 8) & 0xff) / 255
  const b = (n & 0xff) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return {
    h: Math.round(h),
    s: Math.round(s * 1000) / 10,
    l: Math.round(l * 1000) / 10,
  }
}

/**
 * 🌈 WAVE 8120 (M2): LUT de COLOR — PULSO MONOCROMÁTICO.
 *
 * Muerte al arcoíris: H y S del `targetColorHex` elegido CONSTANTES en
 * todos los keyframes (lerpHue con delta=0 — cero deriva de tono).
 * Solo Lightness varía con la MISMA geometría trapezoidal del λ-pulse
 * numérico (attack 8% → hold 28% → release 42% → cierre C⁰ en D):
 *
 *   L: 0 → L_target → L_target → 0 → 0
 *
 * El pico es la L del color elegido — en el máximo del pulso el fixture
 * muestra EXACTAMENTE ese color; el resto del ciclo funde a negro
 * manteniendo tono/saturación. El desfase espacial (phaseOverrides)
 * convierte el pulso en una ola que enciende y apaga el color por el
 * rig. `bakeGainIntoCurve` sigue escalando L encima — la caída
 * espacial (barrido radial, cohortes) funde aún más a negro.
 *
 * Estructura idéntica a las curvas `valueType:'color'` de la Forja
 * (range [0,360], defaultValue HSL) — blendRgb las funde sin
 * discriminación.
 */
export function synthesizeColorLut(
  durationMs: number,
  targetColorHex: string = ASTERIA_DEFAULT_TARGET_COLOR,
): HephCurve {
  // 🜨 WAVE 8191: wrapper de compatibilidad — 'pulse' materializado
  // sobre el HSL del objetivo reproduce la V1 byte a byte
  // (gate G-SYN-COMPAT). La envolvente modula Lightness: pico = color
  // exacto, resto del ciclo funde a negro.
  return materialize(
    envelope({ shape: 'pulse' }),
    'color',
    durationMs,
    hexToHsl(targetColorHex),
  )
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
