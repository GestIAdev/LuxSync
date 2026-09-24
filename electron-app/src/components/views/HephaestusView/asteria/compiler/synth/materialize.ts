/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA — materialize.ts (WAVE 8191 · Crux 3 — Arsenal de Síntesis)
 *
 * Blueprint ASTERIA_CRUX_RESOLUTION §4.2 — el ÚNICO punto del sintetizador
 * que conoce `HephParamId`, la duración `D` y el color objetivo.
 *
 *   EnvPoint (t∈[0,1], v∈[0,1])  ──▶  HephKeyframe (timeMs, value)
 *
 *   - number: value = v (range [0,1] — el remap [floor,ceil] ya lo hizo
 *     `envelope`; `sanitizeCurve` del planner redondea a 4 decimales).
 *   - color:  value = { h, s, l: v·L_target } — la envolvente modula
 *     Lightness sobre el tono/saturación del objetivo (pulso
 *     monocromático 🌈 8120 — H/S constantes, cero deriva de hue).
 *   - `shiftMs` del punto se suma tras `t·D` (ε = 1 ms absoluto) y el
 *     resultado se clampa a [0, D].
 *
 * Función PURA, patch-time. Sin estado, sin Electron.
 *
 * @module HephaestusView/asteria/compiler/synth/materialize
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  HephCurve,
  HephKeyframe,
  HephParamId,
  HSL,
} from '../../../../../../core/hephaestus/types'
import type { EnvPoint } from './envelopes'

/** Fallback honesto si se materializa 'color' sin objetivo — rojo puro,
 *  idéntico al fallback de `hexToHsl` (nunca NaN en un keyframe). */
const FALLBACK_COLOR: HSL = { h: 0, s: 100, l: 50 }

/**
 * Envolvente normalizada → HephCurve concreta.
 * @param env   puntos de `envelope(spec)` — ASC, cerrados C⁰ (salvo square)
 * @param param parámetro Heph destino — 'color' activa el modo HSL
 * @param durationMs  duración del clip (D) — escala t→timeMs
 * @param color tono objetivo para 'color' (su `l` es el pico de la envolvente)
 */
export function materialize(
  env: readonly EnvPoint[],
  param: HephParamId,
  durationMs: number,
  color?: HSL,
): HephCurve {
  const D = Math.max(1, durationMs)
  const isColor = param === 'color'
  const c = color ?? FALLBACK_COLOR

  const keyframes: HephKeyframe[] = env.map((p) => ({
    timeMs: Math.min(D, Math.max(0, Math.round(p.t * D) + (p.shiftMs ?? 0))),
    value: isColor ? { h: c.h, s: c.s, l: p.v * c.l } : p.v,
    interpolation: p.interp,
    ...(p.bz !== undefined
      ? { bezierHandles: [...p.bz] as [number, number, number, number] }
      : {}),
  }))

  const rest = env[0]?.v ?? 0
  return {
    paramId: param,
    valueType: isColor ? 'color' : 'number',
    range: isColor ? [0, 360] : [0, 1],
    defaultValue: isColor ? { h: c.h, s: c.s, l: rest * c.l } : rest,
    keyframes,
    mode: 'absolute',
  }
}
