/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA — envelopes.ts (WAVE 8191 · Crux 3 — Arsenal de Síntesis)
 *
 * Blueprint ASTERIA_CRUX_RESOLUTION §4.2/§4.3 — la tabla de envolventes.
 *
 * `envelope(spec)` devuelve puntos NORMALIZADOS: `t ∈ [0,1]` es fracción de
 * ciclo, `v ∈ [0,1]` es la amplitud. No conoce `HephParamId`, ni `D`, ni
 * color — `materialize()` es el único punto que materializa eso (§4.2).
 *
 * ε = 1 ms ABSOLUTO (recetas ramp-up/down y laser): como la envolvente no
 * conoce D, el punto del flanco duro se marca con `shiftMs: 1` y
 * `materialize` lo aplica tras escalar `t·D` — el ε del blueprint se
 * preserva milisegundo a milisegundo.
 *
 * CIERRE C⁰ (§3.3-6): toda receta termina en `t=1` con el valor de `t=0`
 * EXCEPTO `square`, cuyo salto en el wrap ES su flanco de subida
 * (intencional — G-SYN-SHAPE la exime explícitamente).
 *
 * `edge < 1` ablanda los flancos marcados `hold`/ε sustituyéndolos por
 * rampas `linear` de ancho `a = (1−edge)·w·0.25` (tabla §4.3, nota).
 *
 * Función PURA + memoizada por `specKey` — la tabla es estática.
 *
 * @module HephaestusView/asteria/compiler/synth/envelopes
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { HephInterpolation } from '../../../../../../core/hephaestus/types'
import type { SynthShape, SynthSpec } from './SynthSpec'

/** Punto de envolvente normalizado — `t` fase ∈[0,1], `v` amplitud ∈[0,1]. */
export interface EnvPoint {
  readonly t: number
  readonly v: number
  /** Interpolación HACIA el siguiente punto (la del último se ignora). */
  readonly interp: HephInterpolation
  /** Handles cubic-bezier relativos al segmento (interp 'bezier'). */
  readonly bz?: readonly [number, number, number, number]
  /**
   * Desplazamiento absoluto en ms aplicado tras `t·D` — materializa el
   * ε = 1 ms del blueprint sin que la envolvente conozca D.
   */
  readonly shiftMs?: number
}

/** Defaults por forma (tabla §4.3). `pulse` reproduce la V1 byte a byte. */
export const SHAPE_DEFAULTS: Readonly<
  Record<SynthShape, { duty: number; edge: number }>
> = {
  pulse: { duty: 0.42, edge: 0 },
  triangle: { duty: 0.5, edge: 0 },
  'ramp-up': { duty: 0.5, edge: 1 },
  'ramp-down': { duty: 0.5, edge: 1 },
  square: { duty: 0.5, edge: 1 },
  sine: { duty: 1.0, edge: 0 },
  laser: { duty: 0.04, edge: 1 },
  hold: { duty: 1.0, edge: 1 },
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))
const clampDuty = (x: number): number => Math.min(1, Math.max(0.01, x))

/** Spec con todos los defaults resueltos y clampeados — fuente única de
 *  verdad para `envelope` y `specKey` (misma spec → misma clave). */
export function resolveSpec(spec: SynthSpec): Required<SynthSpec> {
  const d = SHAPE_DEFAULTS[spec.shape]
  const floor = clamp01(spec.floor ?? 0)
  const ceil = clamp01(spec.ceil ?? 1)
  return {
    shape: spec.shape,
    duty: clampDuty(spec.duty ?? d.duty),
    edge: clamp01(spec.edge ?? d.edge),
    floor: Math.min(floor, ceil),
    ceil: Math.max(floor, ceil),
  }
}

/**
 * Clave de partición (§4.4): dos clases con el mismo specKey comparten
 * curva base; con distinto → rutas separadas (evita el spill de shapes
 * sobre el mismo paramId — WAVE 8185).
 */
export function specKey(spec: SynthSpec): string {
  const r = resolveSpec(spec)
  return `${r.shape}|${r.duty}|${r.edge}|${r.floor}|${r.ceil}`
}

const EASE_IN_OUT: readonly [number, number, number, number] = [
  0.42, 0, 0.58, 1,
]

const pt = (
  t: number,
  v: number,
  interp: HephInterpolation = 'linear',
  bz?: readonly [number, number, number, number],
  shiftMs?: number,
): EnvPoint => ({ t, v, interp, bz, shiftMs })

/** Recetas §4.3 — `w` = duty resuelto, `a` = ancho de flanco blando. */
function recipe(r: Required<SynthSpec>): EnvPoint[] {
  const w = r.duty
  const e = r.edge
  const soft = e < 1 - 1e-6
  const a = (1 - e) * w * 0.25
  switch (r.shape) {
    case 'pulse':
      // ≡ V1 con w=0.42: 4w/21=0.08 · 2w/3=0.28 · w=0.42 (paridad §4.2).
      return [
        pt(0, 0),
        pt((w * 4) / 21, 1),
        pt((w * 2) / 3, 1),
        pt(w, 0),
        pt(1, 0),
      ]
    case 'triangle':
      return [pt(0, 0), pt(w / 2, 1), pt(w, 0), pt(1, 0)]
    case 'ramp-up':
      // Diente de sierra ascendente — caída dura de ε=1 ms (edge=1) o
      // rampa de ancho `a` (edge<1).
      return soft
        ? [pt(0, 0), pt(w, 1), pt(w + a, 0), pt(1, 0)]
        : [pt(0, 0), pt(w, 1, 'hold'), pt(w, 0, 'linear', undefined, 1), pt(1, 0)]
    case 'ramp-down':
      // Subida dura de ε=1 ms (edge=1) o rampa de ancho `a` — caída linear.
      return soft
        ? [pt(0, 0), pt(a, 1), pt(w, 0), pt(1, 0)]
        : [pt(0, 0), pt(0, 1, 'linear', undefined, 1), pt(w, 0), pt(1, 0)]
    case 'square':
      // On/off duro — wrap discontinuo intencional (sin cierre C⁰).
      return soft
        ? [pt(0, 1), pt(w - a, 1), pt(w, 0), pt(1, 0)]
        : [pt(0, 1, 'hold'), pt(w, 0, 'hold'), pt(1, 0)]
    case 'sine':
      // Campana ease-in-out — dos segmentos bezier sube/baja.
      return [
        pt(0, 0, 'bezier', EASE_IN_OUT),
        pt(w / 2, 1, 'bezier', EASE_IN_OUT),
        pt(w, 0),
        pt(1, 0),
      ]
    case 'laser':
      // Línea de luz: OFF → subida ε=1 ms → meseta [ε, w) → OFF.
      // edge<1: los hold → lin y ε → a (nota de la tabla §4.3).
      return soft
        ? [pt(0, 0), pt(a, 1), pt(w, 0), pt(1, 0)]
        : [pt(0, 0, 'hold'), pt(0, 1, 'hold', undefined, 1), pt(w, 0, 'hold'), pt(1, 0)]
    case 'hold':
      // Constante — alimenta las firmas *-static del planner (§2.3).
      return [pt(0, 1, 'hold')]
  }
}

/** Cache de envolventes — la tabla es estática, specKey → puntos. */
const envCache = new Map<string, readonly EnvPoint[]>()

/**
 * Envolvente normalizada de la spec. Orden ASC por `t`, `v ∈ [0,1]`,
 * remapeada a [floor, ceil] y sin puntos consecutivos idénticos en (t,v)
 * (dedupe — p.ej. `sine` con duty=1 colapsa su `w:0` con el `1:0`).
 */
export function envelope(spec: SynthSpec): readonly EnvPoint[] {
  const key = specKey(spec)
  const hit = envCache.get(key)
  if (hit !== undefined) return hit

  const r = resolveSpec(spec)
  let pts = recipe(r)
  if (r.floor !== 0 || r.ceil !== 1) {
    const span = r.ceil - r.floor
    pts = pts.map((p) => ({ ...p, v: r.floor + p.v * span }))
  }
  const out: EnvPoint[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last !== undefined && last.t === p.t && last.v === p.v) continue
    out.push(p)
  }
  envCache.set(key, out)
  return out
}
