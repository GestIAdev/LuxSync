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
import type { AsteriaProject } from '../model/AsteriaProject'
import type { FieldSnapshot } from '../model/fieldEngine'
import { rotateCurveCyclic } from './curveRotate'
import { quantizeGainCohorts } from './cohortQuantizer'
import { hexToHsl } from './lutSynth'
import { ASTERIA_DEFAULT_TARGET_COLOR } from '../model/AsteriaProject'

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
 * targetParams filtrados por las reglas duras: los params sin canal
 * sintetizable se omiten — warnings emitidos UNA vez.
 */
export function emitTargetParams(
  project: AsteriaProject,
  warnings: string[],
): HephParamId[] {
  const out: HephParamId[] = []
  for (const param of project.targetParams) {
    if (!LAMBDA_SAFE_PARAMS.has(param)) {
      warnings.push(`PARAM_SKIPPED '${param}' — sin canal sintetizable`)
      continue
    }
    out.push(param)
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
  readonly field: FieldSnapshot
  readonly atlas: NodeAtlas
  readonly project: AsteriaProject
  /** targetParams ya filtrados por emitTargetParams (warnings emitidos). */
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
   * §2.5 — política de inundación del color estático. WAVE 8190 fuerza
   * 'allow' (paridad V1); 'contain' llega con el modelo v2 (WAVE 8192).
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

/** Índices cubiertos (mask=1) del atlas filtrados por familia del param.
 *  fam=null → todos los cubiertos (params engine-internal). */
function coveredMembers(
  field: FieldSnapshot,
  atlas: NodeAtlas,
  fam: string | null,
): number[] {
  const entries = atlas.entries
  const n = Math.min(field.count, entries.length)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    if (field.mask[i] === 0) continue
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
  field: FieldSnapshot,
  atlas: NodeAtlas,
  gainOverride?: number,
): PlanMember[] {
  return idx.map((i) => ({
    idx: i,
    nodeId: atlas.entries[i].nodeId,
    deviceId: atlas.entries[i].deviceId,
    delayMs: field.delayMs[i],
    gain: gainOverride ?? Math.min(1, Math.max(0, field.gain[i])),
  }))
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

  // Cohortes del campo compartido — una partición, consumida por param.
  const needCohorts = strategy === 'cohort' || strategy === 'mcc-device'
  const cohorts = needCohorts
    ? quantizeGainCohorts(field, entries, project.cohortBudget)
    : []
  if (needCohorts && cohorts.length === 0) {
    warnings.push('COHORT_EMPTY — sin nodos cubiertos que cuantizar')
  }

  for (const param of params) {
    const fam = paramNodeFamily(param)
    const memberIdx = coveredMembers(field, atlas, fam)

    // ── Regla de Propiedad de Luminancia (§2.4) ────────────────────────
    // 'color' + intensity activo → la envolvente vive en intensity; el
    // color se emite como constante (1 kf hold) en UNA clase.
    if (param === 'color' && args.staticColor) {
      if (memberIdx.length === 0) {
        warnings.push(
          `PARAM_NO_NODES 'color' — sin nodos COLOR cubiertos por el campo`,
        )
        continue
      }
      const members = toMembers(memberIdx, field, atlas)
      const zones = memberZones(members, atlas)
      const memberSet = new Set(members.map((m) => m.nodeId))
      const spill = classSpill(atlas, fam, memberSet, zones, [])
      for (const m of members) allDevices.add(m.deviceId)

      let route: RouteKind = 'zoned'
      if (spill.size > 0) {
        if (args.colorFlood === 'contain') {
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
      plans.push({
        param,
        signature: 'uniform-static',
        classes: [{
          cls: {
            key: 'static',
            members,
            repDelayMs: 0,
            repGain: 1,
            zones: (zones.length > 0 ? zones : ['all']) as ZoneTarget[],
            staticCurve: staticColorCurve(
              project.targetColor ?? ASTERIA_DEFAULT_TARGET_COLOR,
            ),
          },
          route,
          idStem: 'static_0',
        }],
      })
      continue
    }

    if (memberIdx.length === 0) {
      warnings.push(
        `PARAM_NO_NODES '${param}' — sin nodos cubiertos de su familia`,
      )
      continue
    }

    // ── Vía Λ: una clase, un track, bus de direcciones ─────────────────
    if (strategy === 'lambda') {
      const members = toMembers(memberIdx, field, atlas)
      for (const m of members) allDevices.add(m.deviceId)
      const overrides = lambdaOverrides(members, D)
      overrideCount += Object.keys(overrides).length
      plans.push({
        param,
        signature: 'uniform-animated',
        classes: [{
          cls: {
            key: 'lambda',
            members,
            repDelayMs: 0,
            repGain: 1,
            zones: ['all'],
            overrides,
          },
          route: 'lambda',
          idStem: 'lambda_0', // emitRoute lo retaggea a 'ride_0' si aplica
        }],
      })
      continue
    }

    // ── MCC-Cell: una clase por nodo cubierto de la familia ────────────
    if (strategy === 'mcc') {
      const members = toMembers(memberIdx, field, atlas)
      for (const m of members) allDevices.add(m.deviceId)
      plans.push({
        param,
        signature: 'cellular',
        classes: [{
          cls: {
            key: 'cells',
            members,
            repDelayMs: 0,
            repGain: 1,
            zones: ['all'],
          },
          route: 'surgical',
          idStem: 'mcc', // id = ast_<param>_mcc_<idx> (índice de atlas)
        }],
      })
      continue
    }

    // ── Vía B: cohortes — ruta decidida por (cohorte × param) ──────────
    // Pass 1: miembros de la familia por cohorte + sus zonas.
    const perCohort: {
      members: PlanMember[]
      zones: string[]
      repDelayMs: number
      repGain: number
      ci: number
    }[] = []
    for (let ci = 0; ci < cohorts.length; ci++) {
      const c = cohorts[ci]
      const idx: number[] = []
      for (const nid of c.nodeIds) {
        const i = indexByNodeId.get(nid)
        if (i === undefined) continue
        if (fam !== null && entries[i].family !== fam) continue
        idx.push(i)
      }
      if (idx.length === 0) continue // DECOUPLING: cohorte sin miembros
      // de esta familia → ningún track para este param.
      const gain = Math.min(1, Math.max(0, c.gain))
      const members = toMembers(idx, field, atlas, gain)
      perCohort.push({
        members,
        zones: memberZones(members, atlas),
        repDelayMs: c.delayMs,
        repGain: gain,
        ci,
      })
    }
    const zonesList = perCohort.map((c) => c.zones)

    // Pass 2: spill por (cohorte × param) → ruta.
    const classes: PlanClass[] = []
    const spilledByCohort = new Map<number, Set<string>>()
    for (let k = 0; k < perCohort.length; k++) {
      const pc = perCohort[k]
      const memberSet = new Set(pc.members.map((m) => m.nodeId))
      const otherZones = zonesList.filter((_, j) => j !== k)
      const spill = classSpill(atlas, fam, memberSet, pc.zones, otherZones)
      const isolated =
        strategy === 'mcc-device' && fam !== null && spill.size > 0
      if (spill.size > 0) spilledByCohort.set(pc.ci, spill)
      if (isolated) {
        isolatedCohorts++
        isolatedNodes += pc.members.length
      }
      for (const m of pc.members) allDevices.add(m.deviceId)

      if (isolated) {
        classes.push({
          cls: {
            key: `c${pc.ci}`,
            members: pc.members,
            repDelayMs: pc.repDelayMs,
            repGain: pc.repGain,
            zones: ['all'],
          },
          route: 'surgical',
          idStem: `mccd_${pc.ci}`,
        })
      } else {
        const overrides = cohortOverrides(pc.members, pc.repDelayMs, D)
        overrideCount += Object.keys(overrides).length
        classes.push({
          cls: {
            key: `c${pc.ci}`,
            members: pc.members,
            repDelayMs: pc.repDelayMs,
            repGain: pc.repGain,
            zones: (pc.zones.length > 0 ? pc.zones : ['all']) as ZoneTarget[],
            overrides,
          },
          route: 'zoned',
          idStem: `cohort_${pc.ci}`,
        })
      }
    }
    // Aviso agregado por cohorte (una línea por cohorte, params listados).
    for (const [ci, spill] of spilledByCohort) {
      const list = [...spill].slice(0, 8).join(', ')
      warnings.push(
        `COHORT_ZONE_SPILL c${ci} [${param}] — ${spill.size} nodo(s) fuera del recorte de zonas: ${list}${spill.size > 8 ? ` +${spill.size - 8} más` : ''}`,
      )
    }
    if (strategy === 'mcc-device') {
      for (const k of classes) {
        if (k.route === 'surgical') {
          const devs = new Set(k.cls.members.map((m) => m.deviceId))
          warnings.push(
            `COHORT_ISOLATED ${k.cls.key} [${param}] — ${devs.size} fixture(s) → pistas cell-exactas (MCC-Device)`,
          )
        }
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
  readonly baseCurveFor: (param: HephParamId) => HephCurve
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
      const base = cls.staticCurve ?? ctx.baseCurveFor(param)
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

  const base = cls.staticCurve ?? ctx.baseCurveFor(param)
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
