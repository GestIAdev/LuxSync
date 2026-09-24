/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA — emissionPlan.ts (WAVE 8190 · Crux 1 Resolution)
 *
 * Blueprint ASTERIA_CRUX_RESOLUTION §2 — el Plan de Emisión.
 *
 * Antes (multiplicador ciego): UNA partición de cohortes + UN flag
 * `isolated` por cohorte se aplicaban a TODOS los targetParams por igual —
 * 150 nodos × {intensity, color} = 300 pistas aunque el color fuera
 * estático e idéntico en cada nodo.
 *
 * Ahora: cada parámetro se CLASIFICA por su firma espacio-temporal y cada
 * clase de valor se ENRUTA por separado:
 *
 *   tracks = Σ_p Σ_{C ∈ clases(p)} (route(C) = surgical ? |C| : 1)
 *
 * El coste quirúrgico solo lo paga el (param × clase) que derrama.
 *
 * FIRMAS (§2.3):
 *   - 'uniform-static'   → valor constante en todos los nodos (1 kf) —
 *                          regla de luminancia §2.4 para 'color'.
 *   - 'uniform-animated' → misma forma/gain, solo varía delay → Vía Λ.
 *   - 'graded-animated'  → gain varía → cohortes por percentiles.
 *   - 'cellular'         → distingue celdas → una clase por nodo.
 *
 * RUTAS (§2.3): 'zoned' (cobertura de zonas limpia o flood admitido),
 * 'lambda' (1 pista + bus phaseOverrides), 'surgical' (cell = nodeId).
 *
 * HIGIENE NUMÉRICA (§2.6): toda curva emitida pasa por sanitizeCurve —
 * timeMs entero, valores a 4 decimales, HSL a 1 decimal. El ruido de coma
 * flotante no viaja al .lfx.
 *
 * Función PURA y patch-time: sin estado, sin Electron, testeable en node.
 *
 * @module HephaestusView/asteria/compiler/emissionPlan
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  HephCurve,
  HephKeyframe,
  HephParamId,
  HephTrack,
  HSL,
  ZoneTarget,
} from '../../../../../core/hephaestus/types'
import type { PhaseConfigPro } from '../../../../../core/hephaestus/phase/PhaseConfigPro'
import type { PhaseOverrideMap } from '../../../../../core/hephaestus/phase/PhaseOverride'
import type { NodeAtlas } from '../store/useAsteriaStore'
import type { AsteriaProject, LayerPaint } from '../model/AsteriaProject'
import type {
  FieldPlanes,
  FieldSnapshot,
  PlaneField,
  ScalarPlane,
} from '../model/fieldEngine'
import { OWNER_NONE } from '../model/fieldEngine'
import { rotateCurveCyclic } from './curveRotate'
import { quantizeGainCohorts } from './cohortQuantizer'
import { hexToHsl } from './lutSynth'
import { specKey } from './synth/envelopes'
import {
  linearToRgb8,
  rgb8PackedToHsl,
  rgb8ToOklabInto,
  oklabToLinearInto,
} from '../model/colorMath'
import {
  ASTERIA_DEFAULT_SYNTH,
  ASTERIA_DEFAULT_TARGET_COLOR,
  effectivePaint,
} from '../model/AsteriaProject'

/** Prefijo de propiedad Asteria — el consumidor solo reemplaza ast_*. */
export const ASTERIA_TRACK_PREFIX = 'ast_'

/** ¿Pista propiedad de Asteria? (para la sustitución quirúrgica). */
export function isAsteriaTrack(trackId: string): boolean {
  return trackId.startsWith(ASTERIA_TRACK_PREFIX)
}

/**
 * Params que Asteria puede emitir: numéricos (λ-pulse) o 'color'
 * (LUT monocromática 🌈 WAVE 8110-M2).
 * WAVE 8080 (M1): 'strobe' admitido — el antiguo gate G6 era paternalismo;
 * el operador decide a qué canal aplica su campo, el compilador obedece.
 */
const LAMBDA_SAFE_PARAMS: ReadonlySet<HephParamId> = new Set([
  'intensity', 'white', 'amber', 'speed', 'zoom', 'focus', 'iris',
  'pan', 'tilt', 'strobe', 'scale_x', 'scale_y', 'rot_x', 'rot_y',
  'gobo_rotation', 'smoke_pump', 'width', 'direction', 'globalComp',
  'color',
])

/** phaseConfig mínimo que despierta el bus de overrides (hallazgo A1). */
export const ASTERIA_PHASE_CONFIG: PhaseConfigPro = {
  spreadDeg: 1, // ¡NUNCA 0! — con 0 los overrides mueren en silencio
  symmetry: 'linear',
  wings: 1,
  blocks: 1,
  shuffle: 0,
  shuffleSeed: 1,
  direction: 1,
}

/** `m` normalizado a [0, D) — acepta negativos (override Δ relativo). */
function modD(m: number, D: number): number {
  return ((m % D) + D) % D
}

/**
 * 🜨 WAVE 8193 (Crux 2): params a emitir = ∪ effectivePaint(g).params
 * sobre el stack — cada capa targetea SUS planos (§3.1). Un gesto sin
 * `paint` hereda `defaultPaint.params`. Los params sin canal
 * sintetizable se omiten; warnings emitidos UNA vez por param.
 * Orden determinista: primera aparición en orden de stack.
 */
export function emitPaintParams(
  project: AsteriaProject,
  warnings: string[],
): HephParamId[] {
  const seen = new Set<HephParamId>()
  const out: HephParamId[] = []
  const push = (param: HephParamId): void => {
    if (seen.has(param)) return
    seen.add(param)
    if (!LAMBDA_SAFE_PARAMS.has(param)) {
      warnings.push(`PARAM_SKIPPED '${param}' — sin canal sintetizable`)
      return
    }
    out.push(param)
  }
  for (const g of project.stack) {
    const ps = g.paint?.params ?? project.defaultPaint.params
    for (const p of ps) push(p)
  }
  return out
}

/**
 * Familia Aether a la que el adapter enruta cada paramId — espejo de
 * `_paramFamily` (HephaestusAetherAdapter:357). `cell` solo discrimina si
 * apunta a un nodeId de la familia que el param alcanza. null → param sin
 * familia (engine-internal) — jamás produce intent; se queda en la ruta
 * zonal (squelch innecesario, cero daño).
 */
export function paramNodeFamily(param: HephParamId): string | null {
  switch (param) {
    case 'intensity':
    case 'strobe':
      return 'IMPACT'
    case 'color':
    case 'white':
    case 'amber':
      return 'COLOR'
    case 'pan':
    case 'tilt':
    case 'speed':
      return 'KINETIC'
    case 'zoom':
    case 'focus':
    case 'iris':
    case 'gobo1':
    case 'gobo2':
    case 'prism':
    case 'scale_x':
    case 'scale_y':
    case 'rot_x':
    case 'rot_y':
    case 'gobo_rotation':
      return 'BEAM'
    case 'smoke_pump':
    case 'smoke_density':
    case 'fan_speed':
      return 'ATMOSPHERE'
    default:
      return null
  }
}

/**
 * Escala los valores de una curva por `gain`. WAVE 8090 (M1): el gain
 * se hornea en los keyframes — `track.dimmerScale` era un DEAD WRITE
 * (el runtime jamás lo leyó; auditoría 8080-M3). El motor recibe la
 * curva ya escalada — cero dependencia del campo muerto.
 *
 * - 'number': v × gain, clamp al `range` declarado.
 * - 'color' 🌈 WAVE 8110 (M3): gain → canal Lightness (HSL `l` × gain,
 *   clamp [0,100]). La caída espacial se convierte en fundido a negro
 *   manteniendo H y S intactos — pureza de tono preservada.
 */
function bakeGainIntoCurve(curve: HephCurve, gain: number): HephCurve {
  if (gain === 1) return curve
  if (curve.valueType === 'color') {
    return {
      ...curve,
      keyframes: curve.keyframes.map((kf) => {
        const v = kf.value
        if (typeof v !== 'object' || v === null || !('l' in v)) return kf
        return {
          ...kf,
          value: { ...v, l: Math.min(100, Math.max(0, (v as HSL).l * gain)) },
        }
      }),
    }
  }
  if (curve.valueType !== 'number') return curve
  const [lo, hi] = curve.range
  return {
    ...curve,
    keyframes: curve.keyframes.map((kf) => ({
      ...kf,
      value:
        typeof kf.value === 'number'
          ? Math.min(hi, Math.max(lo, kf.value * gain))
          : kf.value,
    })),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS DEL PLAN (blueprint §2.2)
// ═══════════════════════════════════════════════════════════════════════════

/** Firma espacio-temporal del plano de UN parámetro. */
export type PlaneSignature =
  | 'uniform-static'
  | 'palette-static'
  | 'uniform-animated'
  | 'graded-animated'
  | 'cellular'

/** Miembro de una clase de valor — delay/gain ya resueltos por nodo. */
export interface PlanMember {
  /** Índice canónico en el atlas. */
  readonly idx: number
  readonly nodeId: string
  readonly deviceId: string
  readonly delayMs: number
  readonly gain: number
}

/** Conjunto de nodos que comparten una curva/valor y se enrutan juntos. */
export interface ValueClass {
  readonly key: string
  readonly members: readonly PlanMember[]
  /**
   * 🜨 WAVE 8193 (§4.4): índice en project.stack de la capa cuya
   * effectivePaint gobierna la forma de onda de esta clase. Las clases
   * se particionan por specKey(owner) — dos nodos con owners de distinta
   * forma jamás comparten pista (G-SHAPE-ISOLATION). OWNER_NONE →
   * defaultPaint.
   */
  readonly owner: number
  /** Delay representativo — rotación de la curva en ruta 'zoned'. */
  readonly repDelayMs: number
  /** Gain representativo — horneado en ruta 'zoned'/'surgical' por cohorte. */
  readonly repGain: number
  /** Cobertura de zonas de la clase (rutas 'zoned'). */
  readonly zones: readonly ZoneTarget[]
  /** Bus de direcciones (rutas 'lambda'/'zoned'). */
  readonly overrides?: PhaseOverrideMap
  /** Curva materializada — solo firmas *-static (constante, 1 kf). */
  readonly staticCurve?: HephCurve
  /**
   * 🜨 WAVE 8194: color compuesto (sRGB8 empaquetado) de la clase —
   * solo param 'color'. Materializa la curva con ESTE tono (la mezcla
   * del plano), no con el paint.color de la capa.
   */
  readonly rgb8?: number
}

export type RouteKind = 'zoned' | 'lambda' | 'surgical'

export interface PlanClass {
  readonly cls: ValueClass
  readonly route: RouteKind
  /** Stem del id: 'lambda_0' · 'cohort_2' · 'mccd_2' · 'mcc' · 'static_0'. */
  readonly idStem: string
}

export interface ParamPlan {
  readonly param: HephParamId
  readonly signature: PlaneSignature
  readonly classes: readonly PlanClass[]
}

export interface PlanResult {
  readonly plans: readonly ParamPlan[]
  readonly isolatedCohorts: number
  readonly isolatedNodes: number
  readonly overrideCount: number
  readonly devicesTargeted: number
}

export interface PlanArgs {
  /**
   * 🜨 WAVE 8193: planos reales del engine — `scalar.get(param)` da el
   * ScalarPlane de cada param (delay/gain/mask/owner por nodo).
   */
  readonly field: FieldPlanes
  readonly atlas: NodeAtlas
  readonly project: AsteriaProject
  /** paint.params ya filtrados por emitPaintParams (warnings emitidos). */
  readonly params: readonly HephParamId[]
  readonly strategy: 'lambda' | 'cohort' | 'mcc' | 'mcc-device'
  readonly D: number
  /**
   * 🜨 WAVE 8190 §2.4 — Regla de Propiedad de Luminancia: true si
   * 'intensity' está activo Y no hay ride de color explícito. La
   * envolvente temporal pertenece a intensity; 'color' se clasifica
   * 'uniform-static' (1 kf hold).
   */
  readonly staticColor: boolean
  /**
   * §2.5 — política de inundación del color estático. WAVE 8192 la lee
   * del documento: migrados='allow' (paridad V1), nuevos='contain'.
   */
  readonly colorFlood: 'contain' | 'allow'
  readonly warnings: string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// PLANNER — clasificación por parámetro, ruta por clase
// ═══════════════════════════════════════════════════════════════════════════

/** Curva de color constante — 1 keyframe (G5: mínimo 1). La envolvente
 *  vive en intensity (§2.4); aquí solo el tono. */
function staticColorCurve(targetColorHex: string): HephCurve {
  const { h, s, l } = hexToHsl(targetColorHex)
  const value: HSL = { h, s, l }
  return {
    paramId: 'color',
    valueType: 'color',
    range: [0, 360],
    defaultValue: value,
    keyframes: [{ timeMs: 0, value: { ...value }, interpolation: 'linear' }],
    mode: 'absolute',
  }
}

/** 🜨 WAVE 8194: igual que staticColorCurve pero desde rgb8 empaquetado
 *  (el color COMPUESTO del plano, ya en sRGB — la aritmética HSL es la
 *  misma que hexToHsl vía rgb8PackedToHsl). */
function staticColorCurveRgb8(rgb8: number): HephCurve {
  const value = rgb8PackedToHsl(rgb8)
  return {
    paramId: 'color',
    valueType: 'color',
    range: [0, 360],
    defaultValue: value,
    keyframes: [{ timeMs: 0, value: { ...value }, interpolation: 'linear' }],
    mode: 'absolute',
  }
}

/**
 * 🜨 WAVE 8194 (§3.5) — Median-Cut en OKLab: reduce `colors` (rgb8
 * distintos) a ≤ budget representantes perceptualmente uniformes.
 * Corta la caja más poblada por el eje OKLab de mayor rango en su
 * mediana; el representante es el centroide del cluster re-proyectado
 * a sRGB8. Devuelve rgb8 → rgb8 representante.
 * Patch-time puro: aloca a propósito (jamás en el RAF).
 */
function medianCutOklab(
  colors: readonly number[],
  budget: number,
): Map<number, number> {
  const items = colors.map((rgb8) => {
    const lab: [number, number, number] = [0, 0, 0]
    rgb8ToOklabInto(rgb8, lab)
    return { rgb8, lab }
  })
  const boxes: (typeof items)[] = [items]
  while (boxes.length < budget) {
    let bi = -1
    let best = 1
    for (let k = 0; k < boxes.length; k++) {
      if (boxes[k].length > best) {
        best = boxes[k].length
        bi = k
      }
    }
    if (bi === -1) break // ninguna caja divisible
    const box = boxes[bi]
    let axis = 0
    let range = -1
    for (let a = 0; a < 3; a++) {
      let lo = Infinity
      let hi = -Infinity
      for (const it of box) {
        const v = it.lab[a]
        if (v < lo) lo = v
        if (v > hi) hi = v
      }
      if (hi - lo > range) {
        range = hi - lo
        axis = a
      }
    }
    box.sort((x, y) => x.lab[axis] - y.lab[axis])
    const mid = box.length >> 1
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid))
  }
  const out = new Map<number, number>()
  const tmp = [0, 0, 0]
  for (const box of boxes) {
    let l = 0
    let a = 0
    let b = 0
    for (const it of box) {
      l += it.lab[0]
      a += it.lab[1]
      b += it.lab[2]
    }
    const n = box.length
    oklabToLinearInto(l / n, a / n, b / n, tmp)
    const rep = linearToRgb8(tmp[0], tmp[1], tmp[2])
    for (const it of box) out.set(it.rgb8, rep)
  }
  return out
}

/**
 * 🜨 WAVE 8193: envuelve un FieldSnapshot plano (input legacy — fixtures,
 * documentos pre-8193) como UN ScalarPlane compartido por `params`.
 * owner = 0 para todos los nodos → la forma la dicta la capa base
 * (= defaultPaint en stacks v1) — paridad exacta con el modelo único.
 */
export function flatFieldToPlanes(
  field: FieldSnapshot,
  params: readonly HephParamId[],
): FieldPlanes {
  const shared: ScalarPlane = {
    delayMs: field.delayMs,
    gain: field.gain,
    mask: field.mask,
    owner: new Uint16Array(field.count),
  }
  const scalar = new Map<HephParamId, ScalarPlane>()
  for (const p of params) scalar.set(p, shared)
  // `color: null` — la forma plana no tiene álgebra de color: el planner
  // resuelve el param 'color' por `field.color ?? scalar.get('color')`
  // (este plano compartido) y particiona por paint.color — paridad V1.
  return { count: field.count, scalar, color: null }
}

/** Índices cubiertos (mask=1) del atlas filtrados por familia del param.
 *  fam=null → todos los cubiertos (params engine-internal). */
function coveredMembers(
  plane: PlaneField,
  atlas: NodeAtlas,
  fam: string | null,
): number[] {
  const entries = atlas.entries
  const n = Math.min(plane.mask.length, entries.length)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    if (plane.mask[i] === 0) continue
    if (fam !== null && entries[i].family !== fam) continue
    out.push(i)
  }
  return out
}

/** zoneIds únicos de los miembros (orden de atlas). */
function memberZones(members: readonly PlanMember[], atlas: NodeAtlas): string[] {
  const seen = new Set<string>()
  const zones: string[] = []
  for (const m of members) {
    const z = atlas.entries[m.idx].zoneId
    if (z && !seen.has(z)) {
      seen.add(z)
      zones.push(z)
    }
  }
  return zones
}

/** Devices que poseen un nodo de familia `fam` dentro de `zones`. */
function famDevicesInZones(
  atlas: NodeAtlas,
  zones: readonly string[],
  fam: string | null,
): Set<string> {
  const out = new Set<string>()
  const zset = new Set(zones)
  for (const e of atlas.entries) {
    if (!e.zoneId || !zset.has(e.zoneId)) continue
    if (fam !== null && e.family !== fam) continue
    out.add(e.deviceId)
  }
  return out
}

/**
 * Spill de una clase zonal, medido SOLO sobre nodos de la familia del
 * param (§2.3 — la decoupling real):
 *   a) nodos ajenos de la familia dentro de las zonas de la clase;
 *   b) nodos miembros cuyo device es alcanzado por zonas de OTRAS clases
 *      del MISMO param (dos pistas del mismo paramId compiten).
 */
function classSpill(
  atlas: NodeAtlas,
  fam: string | null,
  memberNodeIds: ReadonlySet<string>,
  zones: readonly string[],
  otherZones: readonly string[][],
): Set<string> {
  const spill = new Set<string>()
  const zset = new Set(zones)
  const memberDevs = new Set<string>()
  for (const e of atlas.entries) {
    if (memberNodeIds.has(e.nodeId)) memberDevs.add(e.deviceId)
  }
  // a) ajenos de la familia dentro de las zonas de la clase
  for (const e of atlas.entries) {
    if (fam !== null && e.family !== fam) continue
    if (e.zoneId && zset.has(e.zoneId) && !memberNodeIds.has(e.nodeId)) {
      spill.add(e.nodeId)
    }
  }
  // b) miembros alcanzados por zonas de otras clases del mismo param
  for (const zj of otherZones) {
    const devs = famDevicesInZones(atlas, zj, fam)
    for (const e of atlas.entries) {
      if (!memberNodeIds.has(e.nodeId)) continue
      if (devs.has(e.deviceId)) spill.add(e.nodeId)
    }
  }
  return spill
}

/** Bus de direcciones Λ: deviceId → offset absoluto = delay del PRIMER
 *  nodo miembro cubierto del device (orden canónico). Clamp+entero §8.1. */
function lambdaOverrides(
  members: readonly PlanMember[],
  D: number,
): PhaseOverrideMap {
  const out: PhaseOverrideMap = {}
  for (const m of members) {
    if (out[m.deviceId] !== undefined) continue
    out[m.deviceId] = {
      mode: 'absolute',
      offsetMs: Math.round(Math.max(0, Math.min(D, m.delayMs))),
    }
  }
  return out
}

/** Bus de cohorte: clava cada device a su delay exacto —
 *  offset = (media de sus nodos miembros) − d̄, mod D. */
function cohortOverrides(
  members: readonly PlanMember[],
  repDelayMs: number,
  D: number,
): PhaseOverrideMap {
  const acc = new Map<string, { s: number; n: number }>()
  for (const m of members) {
    const a = acc.get(m.deviceId) ?? { s: 0, n: 0 }
    a.s += m.delayMs
    a.n++
    acc.set(m.deviceId, a)
  }
  const out: PhaseOverrideMap = {}
  for (const [dev, a] of acc) {
    out[dev] = {
      mode: 'absolute',
      offsetMs: Math.round(modD(a.s / a.n - repDelayMs, D)),
    }
  }
  return out
}

function toMembers(
  idx: readonly number[],
  plane: PlaneField,
  atlas: NodeAtlas,
  gainOverride?: number,
): PlanMember[] {
  return idx.map((i) => ({
    idx: i,
    nodeId: atlas.entries[i].nodeId,
    deviceId: atlas.entries[i].deviceId,
    delayMs: plane.delayMs[i],
    gain: gainOverride ?? Math.min(1, Math.max(0, plane.gain[i])),
  }))
}

/**
 * 🜨 WAVE 8193 (§4.4) — partición por FORMA: los miembros cubiertos se
 * agrupan por la clave de forma de su owner (`specKey` del synth
 * efectivo, o `ride:<trackId>` si la capa monta un Λ-Ride; para 'color'
 * se concatena el color efectivo — paleta estática adelantada de 8194).
 * Dos capas con la MISMA forma colapsan en un grupo (paridad V1: un
 * solo grupo → emisión idéntica al campo escalar).
 * `owner` del grupo = primer owner visto de la clave (representante).
 */
function partitionByShape(
  project: AsteriaProject,
  plane: ScalarPlane,
  memberIdx: readonly number[],
  param: HephParamId,
  rgb8Of?: Int32Array | null,
): { owner: number; paint: LayerPaint; idx: number[]; rgb8?: number }[] {
  const paintCache = new Map<number, LayerPaint>()
  const paintOf = (owner: number): LayerPaint => {
    let p = paintCache.get(owner)
    if (p === undefined) {
      const g = owner === OWNER_NONE ? undefined : project.stack[owner]
      p = g === undefined ? project.defaultPaint : effectivePaint(project, g)
      paintCache.set(owner, p)
    }
    return p
  }
  const groups = new Map<
    string,
    { owner: number; paint: LayerPaint; idx: number[]; rgb8?: number }
  >()
  for (const i of memberIdx) {
    const owner = plane.owner[i]
    const paint = paintOf(owner)
    const shape =
      paint.lut?.kind === 'ride'
        ? `ride:${paint.lut.trackId}`
        : specKey(paint.synth ?? ASTERIA_DEFAULT_SYNTH)
    // 🜨 8194: para 'color' la clave usa el color COMPUESTO por nodo
    // (rgb8 del plano real); sin plano real (input legacy) cae al
    // paint.color del owner — paridad V1.
    const rgb8 = rgb8Of?.[i]
    const key =
      param === 'color'
        ? `${shape}|${rgb8 !== undefined ? rgb8.toString(16).padStart(6, '0') : (paint.color ?? '')}`
        : shape
    const grp = groups.get(key)
    if (grp) grp.idx.push(i)
    else groups.set(key, { owner, paint, idx: [i], rgb8 })
  }
  return [...groups.values()]
}

/**
 * PLAN DE EMISIÓN (§2.2) — sustituye al bucle ciego `params × cohortes`.
 * Cada parámetro clasifica su firma sobre SUS nodos enrutables (familia)
 * y cada clase se enruta por separado. La estrategia global sigue siendo
 * un sesgo del planificador (D-C4), no un multiplicador.
 */
export function planEmission(args: PlanArgs): PlanResult {
  const { field, atlas, project, params, strategy, D } = args
  const warnings = args.warnings as string[]
  const entries = atlas.entries
  const indexByNodeId = new Map(entries.map((e, i) => [e.nodeId, i]))
  const plans: ParamPlan[] = []
  const allDevices = new Set<string>()
  let overrideCount = 0
  let isolatedCohorts = 0
  let isolatedNodes = 0

  const needCohorts = strategy === 'cohort' || strategy === 'mcc-device'
  let cohortEmptyWarned = false

  for (const param of params) {
    const fam = paramNodeFamily(param)
    // 🜨 WAVE 8194: 'color' resuelve el ColorPlane real del engine; la
    // forma plana legacy lo tiene en scalar (wrap compartido).
    const plane: ScalarPlane | undefined =
      param === 'color'
        ? (field.color ?? field.scalar.get(param))
        : field.scalar.get(param)
    if (plane === undefined) {
      warnings.push(`PARAM_NO_PLANE '${param}' — ninguna capa lo pinta`)
      continue
    }
    const memberIdx = coveredMembers(plane, atlas, fam)
    if (memberIdx.length === 0) {
      warnings.push(
        `PARAM_NO_NODES '${param}' — sin nodos cubiertos de su familia`,
      )
      continue
    }

    // ── 🜨 WAVE 8194 (§3.5): color COMPUESTO por nodo ─────────────
    //    rgb8Of[i] = color final del nodo (lineal→sRGB8). Dedupe exacto;
    //    si los distintos superan colorBudget → median-cut en OKLab +
    //    COLOR_QUANTIZED. Un nodo con alpha=0 jamás está en memberIdx
    //    (mask=0 sellado por el engine) → G-COLOR-TRANSPARENT.
    let rgb8Of: Int32Array | null = null
    if (param === 'color' && field.color !== null) {
      const cp = field.color
      rgb8Of = new Int32Array(field.count)
      const distinct = new Set<number>()
      for (const i of memberIdx) {
        const j = i * 3
        const c = linearToRgb8(cp.rgb[j], cp.rgb[j + 1], cp.rgb[j + 2])
        rgb8Of[i] = c
        distinct.add(c)
      }
      const budget = Math.max(1, project.colorBudget ?? 16)
      if (distinct.size > budget) {
        const rep = medianCutOklab([...distinct], budget)
        for (const i of memberIdx) {
          rgb8Of[i] = rep.get(rgb8Of[i]) ?? rgb8Of[i]
        }
        warnings.push(
          `COLOR_QUANTIZED — ${distinct.size} colores distintos → ${budget} (median-cut OKLab)`,
        )
      }
    }

    // ── 🜨 WAVE 8193 (§4.4 · G-SHAPE-ISOLATION): partición por FORMA ──
    //    Las clases se forman primero por specKey del owner efectivo.
    //    Un solo grupo = una sola forma en el plano → emisión idéntica
    //    al modelo escalar (paridad V1). Con varias formas, cada grupo
    //    enruta por separado y el solape zonal fuerza aislamiento
    //    celular — dos formas jamás alcanzan el mismo (fixture, param)
    //    sin `cell`. 🜨 8194: para 'color' la clave incluye el rgb8
    //    compuesto por nodo (forma × color = clase).
    const groups = partitionByShape(project, plane, memberIdx, param, rgb8Of)
    const multiShape = groups.length > 1

    // ── Regla de Propiedad de Luminancia (§2.4) ────────────────────────
    // 'color' + intensity activo → la envolvente vive en intensity; el
    // color se emite como constante (1 kf hold) por CLASE DE COLOR.
    // 🜨 8194: las clases son el color COMPUESTO por nodo (rgb8 del
    // plano — la mezcla real de capas), no el paint.color declarado;
    // sin plano real (legacy) se particiona por paint.color del owner.
    if (param === 'color' && args.staticColor) {
      const colorGroups: { owner: number; idx: number[]; rgb8?: number; hex?: string }[] = []
      if (rgb8Of !== null) {
        const byColor = new Map<number, { owner: number; idx: number[] }>()
        for (const i of memberIdx) {
          const c = rgb8Of[i]
          const g = byColor.get(c)
          if (g) g.idx.push(i)
          else byColor.set(c, { owner: plane.owner[i], idx: [i] })
        }
        for (const [rgb8, g] of byColor) {
          colorGroups.push({ owner: g.owner, idx: g.idx, rgb8 })
        }
      } else {
        for (const g of groups) {
          colorGroups.push({ owner: g.owner, idx: g.idx, hex: g.paint.color })
        }
      }
      const multiColor = colorGroups.length > 1
      const membersPerGroup = colorGroups.map((g) => toMembers(g.idx, plane, atlas))
      const zonesList = membersPerGroup.map((ms) => memberZones(ms, atlas))
      const classes: PlanClass[] = []
      for (let gi = 0; gi < colorGroups.length; gi++) {
        const grp = colorGroups[gi]
        const members = membersPerGroup[gi]
        const zones = zonesList[gi]
        const memberSet = new Set(members.map((m) => m.nodeId))
        const otherZones = zonesList.filter((_, j) => j !== gi)
        const spill = classSpill(atlas, fam, memberSet, zones, otherZones)
        for (const m of members) allDevices.add(m.deviceId)

        let route: RouteKind = 'zoned'
        if (spill.size > 0) {
          if (args.colorFlood === 'contain' || multiColor) {
            route = 'surgical' // constantes quirúrgicas (~300 B c/u)
          } else {
            const foreign = famDevicesInZones(atlas, zones, fam)
            for (const d of memberSet) {
              foreign.delete(atlas.byNodeId.get(d)?.deviceId ?? '')
            }
            warnings.push(
              `COLOR_FLOOD — ${foreign.size} fixture(s) recibirán el color estático fuera de cobertura (policy 'allow')`,
            )
          }
        }
        classes.push({
          cls: {
            key: 'static',
            members,
            owner: grp.owner,
            rgb8: grp.rgb8,
            repDelayMs: 0,
            repGain: 1,
            zones: (zones.length > 0 ? zones : ['all']) as ZoneTarget[],
            staticCurve:
              grp.rgb8 !== undefined
                ? staticColorCurveRgb8(grp.rgb8)
                : staticColorCurve(
                    grp.hex ??
                      project.defaultPaint.color ??
                      ASTERIA_DEFAULT_TARGET_COLOR,
                  ),
          },
          route,
          idStem: multiColor ? `static_${gi}` : 'static_0',
        })
      }
      plans.push({ param, signature: 'uniform-static', classes })
      continue
    }

    // ── Vía Λ: una clase por grupo de forma, bus de direcciones ──────
    if (strategy === 'lambda') {
      const membersPerGroup = groups.map((g) => toMembers(g.idx, plane, atlas))
      const zonesList = membersPerGroup.map((ms) => memberZones(ms, atlas))
      const classes: PlanClass[] = []
      for (let gi = 0; gi < groups.length; gi++) {
        const grp = groups[gi]
        const members = membersPerGroup[gi]
        for (const m of members) allDevices.add(m.deviceId)
        const overrides = lambdaOverrides(members, D)
        overrideCount += Object.keys(overrides).length
        if (!multiShape) {
          classes.push({
            cls: {
              key: 'lambda',
              members,
              owner: grp.owner,
            rgb8: grp.rgb8,
              repDelayMs: 0,
              repGain: 1,
              zones: ['all'],
              overrides,
            },
            route: 'lambda',
            idStem: 'lambda_0', // emitRoute lo retaggea a 'ride_0' si aplica
          })
          continue
        }
        // Multi-forma: zones 'all' alcanzaría fixtures de otras formas —
        // la clase se recorta a las zonas de sus miembros; si el recorte
        // derrama sobre owners ajenos → quirúrgico (§4.4).
        const zones = zonesList[gi]
        const memberSet = new Set(members.map((m) => m.nodeId))
        const spill = classSpill(
          atlas, fam, memberSet, zones,
          zonesList.filter((_, j) => j !== gi),
        )
        if (spill.size > 0) {
          isolatedNodes += members.length
          warnings.push(
            `SHAPE_ISOLATED s${gi} [${param}] — ${members.length} nodo(s) → pistas cell-exactas (formas distintas no comparten pista)`,
          )
          classes.push({
            cls: {
              key: `s${gi}`,
              members,
              owner: grp.owner,
            rgb8: grp.rgb8,
              repDelayMs: 0,
              repGain: 1,
              zones: ['all'],
            },
            route: 'surgical',
            idStem: `lam_${gi}`,
          })
        } else {
          classes.push({
            cls: {
              key: `s${gi}`,
              members,
              owner: grp.owner,
            rgb8: grp.rgb8,
              repDelayMs: 0,
              repGain: 1,
              zones: (zones.length > 0 ? zones : ['all']) as ZoneTarget[],
              overrides,
            },
            route: 'zoned',
            idStem: `lambda_${gi}`,
          })
        }
      }
      plans.push({ param, signature: 'uniform-animated', classes })
      continue
    }

    // ── MCC-Cell: una clase por grupo de forma; el routing celular ya
    //    aísla por nodo — la forma llega vía `owner` de cada clase.
    if (strategy === 'mcc') {
      const classes: PlanClass[] = []
      for (const grp of groups) {
        const members = toMembers(grp.idx, plane, atlas)
        for (const m of members) allDevices.add(m.deviceId)
        classes.push({
          cls: {
            key: 'cells',
            members,
            owner: grp.owner,
            rgb8: grp.rgb8,
            repDelayMs: 0,
            repGain: 1,
            zones: ['all'],
          },
          route: 'surgical',
          idStem: 'mcc', // id = ast_<param>_mcc_<idx> (índice de atlas)
        })
      }
      plans.push({ param, signature: 'cellular', classes })
      continue
    }

    // ── Vía B: cohortes — ruta decidida por (cohorte × forma × param) ──
    const cohorts = quantizeGainCohorts(plane, entries, project.cohortBudget)
    if (needCohorts && cohorts.length === 0 && !cohortEmptyWarned) {
      cohortEmptyWarned = true
      warnings.push('COHORT_EMPTY — sin nodos cubiertos que cuantizar')
    }

    // Pass 1: miembros (familia ∩ grupo de forma) por cohorte + zonas.
    const perClass: {
      members: PlanMember[]
      zones: string[]
      repDelayMs: number
      repGain: number
      ci: number
      gi: number
      owner: number
      rgb8?: number
      key: string
    }[] = []
    for (let gi = 0; gi < groups.length; gi++) {
      const grp = groups[gi]
      const inGroup = new Set(grp.idx)
      for (let ci = 0; ci < cohorts.length; ci++) {
        const c = cohorts[ci]
        const idx: number[] = []
        for (const nid of c.nodeIds) {
          const i = indexByNodeId.get(nid)
          if (i === undefined || !inGroup.has(i)) continue
          if (fam !== null && entries[i].family !== fam) continue
          idx.push(i)
        }
        if (idx.length === 0) continue // DECOUPLING: cohorte sin miembros
        // de esta familia/forma → ningún track para esta combinación.
        const gain = Math.min(1, Math.max(0, c.gain))
        const members = toMembers(idx, plane, atlas, gain)
        perClass.push({
          members,
          zones: memberZones(members, atlas),
          repDelayMs: c.delayMs,
          repGain: gain,
          ci,
          gi,
          owner: grp.owner,
          rgb8: grp.rgb8,
          key: multiShape ? `s${gi}c${ci}` : `c${ci}`,
        })
      }
    }
    const zonesList = perClass.map((c) => c.zones)

    // Pass 2: spill por (clase × param) → ruta. Con formas distintas el
    // spill fuerza aislamiento celular bajo CUALQUIER estrategia — dos
    // formas no pueden compartir cobertura zonal (G-SHAPE-ISOLATION).
    const classes: PlanClass[] = []
    const spilledClasses: { key: string; spill: Set<string> }[] = []
    for (let k = 0; k < perClass.length; k++) {
      const pc = perClass[k]
      const memberSet = new Set(pc.members.map((m) => m.nodeId))
      const otherZones = zonesList.filter((_, j) => j !== k)
      const spill = classSpill(atlas, fam, memberSet, pc.zones, otherZones)
      const isolated =
        fam !== null &&
        spill.size > 0 &&
        (strategy === 'mcc-device' || multiShape)
      if (spill.size > 0) spilledClasses.push({ key: pc.key, spill })
      if (isolated) {
        isolatedCohorts++
        isolatedNodes += pc.members.length
      }
      for (const m of pc.members) allDevices.add(m.deviceId)

      if (isolated) {
        classes.push({
          cls: {
            key: pc.key,
            members: pc.members,
            owner: pc.owner,
            rgb8: pc.rgb8,
            repDelayMs: pc.repDelayMs,
            repGain: pc.repGain,
            zones: ['all'],
          },
          route: 'surgical',
          idStem: multiShape
            ? `mccd_${pc.ci}_s${pc.gi}`
            : `mccd_${pc.ci}`,
        })
      } else {
        const overrides = cohortOverrides(pc.members, pc.repDelayMs, D)
        overrideCount += Object.keys(overrides).length
        classes.push({
          cls: {
            key: pc.key,
            members: pc.members,
            owner: pc.owner,
            rgb8: pc.rgb8,
            repDelayMs: pc.repDelayMs,
            repGain: pc.repGain,
            zones: (pc.zones.length > 0 ? pc.zones : ['all']) as ZoneTarget[],
            overrides,
          },
          route: 'zoned',
          idStem: multiShape
            ? `cohort_${pc.ci}_s${pc.gi}`
            : `cohort_${pc.ci}`,
        })
      }
    }
    // Aviso agregado por clase (una línea por clase, params listados).
    for (const { key, spill } of spilledClasses) {
      const list = [...spill].slice(0, 8).join(', ')
      warnings.push(
        `COHORT_ZONE_SPILL ${key} [${param}] — ${spill.size} nodo(s) fuera del recorte de zonas: ${list}${spill.size > 8 ? ` +${spill.size - 8} más` : ''}`,
      )
    }
    for (const k of classes) {
      if (k.route !== 'surgical') continue
      const devs = new Set(k.cls.members.map((m) => m.deviceId))
      if (multiShape) {
        warnings.push(
          `SHAPE_ISOLATED ${k.cls.key} [${param}] — ${devs.size} fixture(s) → pistas cell-exactas (formas distintas no comparten pista)`,
        )
      } else if (strategy === 'mcc-device') {
        warnings.push(
          `COHORT_ISOLATED ${k.cls.key} [${param}] — ${devs.size} fixture(s) → pistas cell-exactas (MCC-Device)`,
        )
      }
    }
    plans.push({ param, signature: 'graded-animated', classes })
  }

  return {
    plans,
    isolatedCohorts,
    isolatedNodes,
    overrideCount,
    devicesTargeted: allDevices.size,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EMISIÓN — intérprete de rutas (única puerta que empuja HephTrack)
// ═══════════════════════════════════════════════════════════════════════════

const round4 = (v: number): number => Math.round(v * 1e4) / 1e4
const round1 = (v: number): number => Math.round(v * 10) / 10

/**
 * Higiene numérica (§2.6): se aplica DESPUÉS de rotar/escalar — el ruido
 * de coma flotante no viaja al .lfx. `timeMs` → entero clamp [0,D];
 * valores numéricos → 4 decimales dentro de range; HSL → 1 decimal.
 * El redondeo es monótono → el orden ASC se preserva sin re-sort.
 */
function sanitizeCurve(curve: HephCurve, D: number): HephCurve {
  const cleanValue = (v: number | HSL): number | HSL =>
    typeof v === 'number'
      ? round4(Math.min(curve.range[1], Math.max(curve.range[0], v)))
      : {
          h: round1(Math.min(360, Math.max(0, v.h))),
          s: round1(Math.min(100, Math.max(0, v.s))),
          l: round1(Math.min(100, Math.max(0, v.l))),
        }
  const keyframes: HephKeyframe[] = curve.keyframes.map((kf) => ({
    ...kf,
    timeMs: Math.round(Math.max(0, Math.min(D, kf.timeMs))),
    value: cleanValue(kf.value),
  }))
  return { ...curve, keyframes, defaultValue: cleanValue(curve.defaultValue) }
}

export interface EmitCtx {
  readonly D: number
  /**
   * Curva base por (parámetro, owner) — 🜨 WAVE 8193 §4.4: la forma de
   * onda la dicta la capa dominante de la clase (effectivePaint(owner)
   * .synth/.lut), no una global.
   * 🜨 WAVE 8194: para 'color', `rgb8` es el color COMPUESTO de la clase
   * (la mezcla del plano) — materializa la curva sobre ese tono.
   */
  readonly baseCurveFor: (
    param: HephParamId,
    owner: number,
    rgb8?: number,
  ) => HephCurve
  /** 'lambda' | 'ride' — etiqueta de id para la ruta Λ (§8.2). */
  readonly lambdaTag: 'lambda' | 'ride'
}

/**
 * emitRoute — las tres emisiones ya probadas del compilador:
 *   'lambda'   → 1 pista + phaseConfig + overrides (Vía Λ)
 *   'zoned'    → curva rotada por delay rep + gain horneado + zonas + bus
 *   'surgical' → pista por miembro, delay/gain horneados, cell = nodeId
 * Las clases estáticas usan `cls.staticCurve` (sin rotación ni gain —
 * la luminancia la posee intensity, §2.4).
 */
export function emitRoute(
  param: HephParamId,
  pc: PlanClass,
  ctx: EmitCtx,
  tracks: HephTrack[],
): void {
  const { cls, route, idStem } = pc
  const D = ctx.D

  if (route === 'surgical') {
    let di = 0
    for (const m of cls.members) {
      const base =
        cls.staticCurve ?? ctx.baseCurveFor(param, cls.owner, cls.rgb8)
      let curve = rotateCurveCyclic(base, m.delayMs, D)
      if (cls.staticCurve === undefined) {
        curve = bakeGainIntoCurve(curve, m.gain)
      }
      tracks.push({
        id:
          idStem === 'mcc'
            ? `${ASTERIA_TRACK_PREFIX}${param}_mcc_${m.idx}`
            : `${ASTERIA_TRACK_PREFIX}${param}_${idStem}_${di++}`,
        paramId: param,
        zones: ['all'], // el filtro real lo hace `cell` (Δ3)
        curve: sanitizeCurve(curve, D),
        blendMode: 'replace',
        cell: m.nodeId,
      })
    }
    return
  }

  const base =
    cls.staticCurve ?? ctx.baseCurveFor(param, cls.owner, cls.rgb8)
  let curve: HephCurve
  if (route === 'lambda' || cls.staticCurve !== undefined) {
    curve = base // Λ: delay vive en overrides; static: constante
  } else {
    curve = bakeGainIntoCurve(
      rotateCurveCyclic(base, cls.repDelayMs, D),
      cls.repGain,
    )
  }
  const stem = route === 'lambda' ? idStem.replace('lambda', ctx.lambdaTag) : idStem
  tracks.push({
    id: `${ASTERIA_TRACK_PREFIX}${param}_${stem}`,
    paramId: param,
    zones: cls.zones.length > 0 ? cls.zones : ['all'],
    curve: sanitizeCurve(curve, D),
    blendMode: 'replace',
    ...(cls.overrides !== undefined && {
      phaseConfig: { ...ASTERIA_PHASE_CONFIG }, // A1: spreadDeg=1 despierta el bus
      phaseOverrides: { ...cls.overrides },
    }),
  })
}

/** Intérprete del plan: empuja todos los HephTrack de todos los params. */
export function emitPlans(
  plans: readonly ParamPlan[],
  ctx: EmitCtx,
  tracks: HephTrack[],
): void {
  for (const plan of plans) {
    for (const pc of plan.classes) {
      emitRoute(plan.param, pc, ctx, tracks)
    }
  }
}
