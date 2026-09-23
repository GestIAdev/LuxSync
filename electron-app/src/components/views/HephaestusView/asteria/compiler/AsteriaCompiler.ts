/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA COMPILER — WAVE 8030-P6: FieldSnapshot → HephTrack[] (Vía Λ)
 *
 * Blueprint §8.1. El compilador convierte el campo espacial evaluado en
 * tracks `ast_*` inyectables en el clip activo — coexistiendo con Forge:
 * el consumidor reemplaza SOLO tracks con prefijo `ast_`, jamás los del
 * operador.
 *
 * REGLAS DURAS (cada una mapea a un gate verificado del loader/runtime):
 *   - zones NUNCA vacío → ['all']                          (G5)
 *   - curve.keyframes NUNCA vacío, orden ASC, en range     (G5 + invariante)
 *   - phaseConfig.spreadDeg = 1 cuando hay overrides       (A1 — con 0 el
 *     runtime ignora TODOS los overrides en silencio: HephaestusRuntime:1049)
 *   - overrides mode 'absolute' — determinismo puro         (PhaseOverride:83)
 *   - offsetMs clamp [0, D] + entero                       (clamp runtime + bytes)
 *   - reemplazo solo de tracks ast_*                       (coexistencia Forge)
 *
 * Estrategias (§4.3 — árbol de decisión):
 *   - 'lambda'/'ride' → Vía Λ: una pista-LUT + phaseOverrides per-fixture.
 *   - 'cohort'      → Vía B (§8.3): K cohortes por gain (percentiles),
 *                     curva maestra rotada por el delay representativo,
 *                     escalada por el gain representativo.
 *   - 'mcc'         → MCC-Cell (§4.2): una pista por (celda × parámetro),
 *                     curva rotada por el delay exacto de la celda y
 *                     `track.cell = nodeId` (discriminador Δ1-Δ3).
 *   - 'auto'        → el árbol: ¿distingue celdas del mismo fixture? → mcc;
 *                     ¿gain per-nodo? → cohort; si no → λ.
 * Λ-Ride (§8.2): lutSource.kind='ride' reutiliza la curva que el
 * operador esculpió en Forge como curva base de TODAS las estrategias.
 *
 * VALIDADOR ESTRUCTURAL: toda pista candidata pasa `validateAstTrack`
 * antes de salir — ids ast_*, zones no vacío, keyframes ASC en [0,D],
 * valores en range, overrides clampados/enteros. Una pista
 * que viola el contrato se rechaza con warning, jamás se inyecta.
 *
 * LIMITACIÓN Λ DECLARADA (§3.2): gain per-fixture no es expresable en
 * una sola pista — se reporta GAIN_REQUIRES_COHORTS si el campo lo usa.
 *
 * @module HephaestusView/asteria/compiler/AsteriaCompiler
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  HephAutomationClipV3,
  HephCurve,
  HephParamId,
  HephTrack,
  HSL,
  ZoneTarget,
} from '../../../../../core/hephaestus/types'
import type { PhaseConfigPro } from '../../../../../core/hephaestus/phase/PhaseConfigPro'
import type { PhaseOverrideMap } from '../../../../../core/hephaestus/phase/PhaseOverride'
import type { NodeAtlas } from '../store/useAsteriaStore'
import type { AsteriaProject, Gesture } from '../model/AsteriaProject'
import type { FieldSnapshot } from '../model/fieldEngine'
import { synthesizeColorLut, synthesizeLambda, synthesizeLambdaPulse } from './lutSynth'
import { ASTERIA_DEFAULT_TARGET_COLOR } from '../model/AsteriaProject'
import { measureGlyphLegibility } from '../model/glyphRaster'
import { rotateCurveCyclic } from './curveRotate'
import { quantizeGainCohorts } from './cohortQuantizer'

/** Estrategia REAL emitida por el compilador (la que produce los tracks). */
export type CompiledStrategy = 'lambda' | 'ride' | 'cohort' | 'mcc'

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT — blueprint §8.1 verbatim
// ═══════════════════════════════════════════════════════════════════════════

export interface CompileInput {
  readonly atlas: NodeAtlas
  readonly field: FieldSnapshot
  readonly clip: HephAutomationClipV3
  readonly project: AsteriaProject
}

export interface CompileReport {
  /** Estrategia realmente usada ('lambda' | 'ride' | 'cohort' | 'mcc'). */
  readonly strategy: CompiledStrategy
  readonly trackIds: readonly string[]
  readonly keyframeCount: number
  readonly overrideCount: number
  /** Nodos cubiertos por el campo (mask=1). */
  readonly nodesCovered: number
  /** Fixtures que recibieron dirección de fase. */
  readonly devicesTargeted: number
  /** Bytes reales del payload de tracks (JSON.stringify — §8.4). */
  readonly bytes: number
  readonly warnings: readonly string[]
}

export interface CompileOutput {
  readonly tracks: readonly HephTrack[]
  readonly report: CompileReport
}

/** Prefijo de propiedad Asteria — el consumidor solo reemplaza ast_*. */
export const ASTERIA_TRACK_PREFIX = 'ast_'

/** ¿Pista propiedad de Asteria? (para la sustitución quirúrgica). */
export function isAsteriaTrack(trackId: string): boolean {
  return trackId.startsWith(ASTERIA_TRACK_PREFIX)
}

/**
 * Sustitución quirúrgica (§8.1): devuelve un clip nuevo con los tracks
 * ast_* reemplazados por los compilados y `clip.asteria` actualizado al
 * proyecto vivo (D-4 — la receta viaja dentro del .lfx). Los tracks
 * manuales de Forge quedan INTACTOS — solo se filtran los ast_*.
 *
 * Función pura — el caller decide si va por `mutate` (historial) o
 * `replaceClipTransient` (live-compile sin ensuciar el undo).
 */
export function injectAstTracks(
  clip: HephAutomationClipV3,
  compiled: readonly HephTrack[],
  project: AsteriaProject,
): HephAutomationClipV3 {
  return {
    ...clip,
    asteria: project,
    tracks: [
      ...clip.tracks.filter((t) => !isAsteriaTrack(t.id)),
      ...compiled,
    ],
  }
}

/**
 * Params que la Vía Λ puede emitir: numéricos (λ-pulse) o 'color'
 * (LUT arcoíris 🌈 WAVE 8110-M2).
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
const ASTERIA_PHASE_CONFIG: PhaseConfigPro = {
  spreadDeg: 1, // ¡NUNCA 0! — con 0 los overrides mueren en silencio
  symmetry: 'linear',
  wings: 1,
  blocks: 1,
  shuffle: 0,
  shuffleSeed: 1,
  direction: 1,
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Deep-clone de una curva ajena (Λ-Ride) — nunca alias al clip vivo. */
function cloneCurve(src: HephCurve, paramId: HephParamId): HephCurve {
  return {
    ...src,
    paramId,
    keyframes: src.keyframes.map((kf) => ({
      ...kf,
      bezierHandles: kf.bezierHandles
        ? ([...kf.bezierHandles] as typeof kf.bezierHandles)
        : undefined,
      audioBinding: kf.audioBinding ? { ...kf.audioBinding } : undefined,
    })),
    range: [...src.range] as [number, number],
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
 *   manteniendo H y S intactos — pureza de tono preservada. La forma
 *   del keyframe ({h,s,l}) queda idéntica a las curvas de la Forja —
 *   blendRgb las funde sin excepciones de tipado.
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

/** `m` normalizado a [0, D) — acepta negativos (override Δ relativo). */
function modD(m: number, D: number): number {
  return ((m % D) + D) % D
}

/**
 * ¿El campo distingue celdas del MISMO fixture? (§4.3 — raíz del árbol).
 * Compara delay+gain de cada nodo cubierto contra el primer nodo
 * cubierto de su deviceId; cualquier diferencia ⇒ MCC-Cell.
 */
function fieldDistinguishesCells(field: FieldSnapshot, atlas: NodeAtlas): boolean {
  const first = new Map<string, { d: number; g: number }>()
  const entries = atlas.entries
  const n = Math.min(field.count, entries.length)
  for (let i = 0; i < n; i++) {
    if (field.mask[i] === 0) continue
    const dev = entries[i].deviceId
    const sig = first.get(dev)
    if (!sig) {
      first.set(dev, { d: field.delayMs[i], g: field.gain[i] })
    } else if (
      Math.abs(sig.d - field.delayMs[i]) > 1e-3 ||
      Math.abs(sig.g - field.gain[i]) > 1e-3
    ) {
      return true
    }
  }
  return false
}

/**
 * VALIDADOR ESTRUCTURAL — la puerta que toda pista `ast_*` cruza antes
 * de inyectarse. Devuelve la razón de rechazo o null si es válida.
 * Reglas: prefijo ast_, zones no vacío, keyframes no
 * vacío + ASC + dentro de [0,D], valores numéricos en range,
 * dimmerScale ∈ [0,1], overrides enteros y en [0,D].
 */
export function validateAstTrack(t: HephTrack, D: number): string | null {
  if (!t.id.startsWith(ASTERIA_TRACK_PREFIX)) return 'id sin prefijo ast_'
  if (t.zones.length === 0) return 'zones vacío (G5)'
  const kfs = t.curve.keyframes
  if (kfs.length === 0) return 'keyframes vacío (G5)'
  for (let i = 0; i < kfs.length; i++) {
    const kf = kfs[i]
    if (kf.timeMs < -1e-6 || kf.timeMs > D + 1e-6) {
      return `kf[${i}].timeMs=${kf.timeMs} fuera de [0, ${D}]`
    }
    if (i > 0 && kf.timeMs < kfs[i - 1].timeMs) {
      return `keyframes no ASC en kf[${i}]`
    }
    if (
      t.curve.valueType === 'number' &&
      typeof kf.value === 'number' &&
      (kf.value < t.curve.range[0] - 1e-6 || kf.value > t.curve.range[1] + 1e-6)
    ) {
      return `kf[${i}].value=${kf.value} fuera de range [${t.curve.range}]`
    }
  }
  if (
    t.dimmerScale !== undefined &&
    (t.dimmerScale < -1e-6 || t.dimmerScale > 1 + 1e-6)
  ) {
    return `dimmerScale=${t.dimmerScale} fuera de [0,1]`
  }
  if (t.phaseOverrides) {
    for (const dev of Object.keys(t.phaseOverrides)) {
      const o = t.phaseOverrides[dev].offsetMs
      if (!Number.isInteger(o) || o < 0 || o > D) {
        return `override '${dev}' offsetMs=${o} no entero/fuera de [0,${D}]`
      }
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPILE
// ═══════════════════════════════════════════════════════════════════════════

export function compile(input: CompileInput): CompileOutput {
  const { atlas, field, clip, project } = input
  const warnings: string[] = []
  const D = Math.max(1, clip.durationMs)

  // ── Cobertura del campo ──
  let nodesCovered = 0
  let gainVaries = false
  for (let i = 0; i < field.count; i++) {
    if (field.mask[i] === 0) continue
    nodesCovered++
    if (Math.abs(field.gain[i] - 1) > 1e-3) gainVaries = true
  }
  if (nodesCovered === 0) warnings.push('EMPTY_FIELD — sin nodos cubiertos')

  // ── Estrategia — §4.3: 'auto' recorre el árbol de decisión ──
  let strategy: 'lambda' | 'cohort' | 'mcc'
  switch (project.strategy) {
    case 'cohort':
      strategy = 'cohort'
      break
    case 'mcc':
      strategy = 'mcc'
      break
    case 'lambda':
      strategy = 'lambda'
      break
    case 'auto':
      strategy = fieldDistinguishesCells(field, atlas)
        ? 'mcc'
        : gainVaries
          ? 'cohort'
          : 'lambda'
      break
  }
  if (strategy === 'lambda' && gainVaries) {
    warnings.push(
      'GAIN_REQUIRES_COHORTS — Λ no puede gain per-fixture (§3.2); gain ignorado',
    )
  }

  // ── 🜨 WAVE 8160 (M1): GLYPH = GEOMETRÍA 2D PURA ────────────────────
  //    Un gesto de texto jamás cruza el targeting por zonas de la Vía B:
  //    la máscara del operador (lazo/polígono/libre) es arbitraria y el
  //    spill de zonas es estructuralmente inevitable. Enrutamiento
  //    celular puro: MCC-Cell emite una pista por (nodo cubierto × param)
  //    con `track.cell = nodeId` — mapeo absoluto 1:1, cero derrame.
  //    Válido bajo CUALQUIER strategy declarada: estampar texto nunca
  //    emite COHORT_ZONE_SPILL.
  const glyphGestures = project.stack.filter(
    (g): g is Extract<Gesture, { kind: 'glyph' }> => g.kind === 'glyph',
  )
  if (glyphGestures.length > 0) {
    if (strategy !== 'mcc') {
      if (project.strategy !== 'auto' && project.strategy !== 'mcc') {
        warnings.push(
          `GLYPH_ROUTED_MCC — el texto es máscara libre 1:1; strategy '${project.strategy}' relevada por enrutamiento celular`,
        )
      }
      strategy = 'mcc'
    }
    // ── 🜨 WAVE 8160 (M2): legibilidad = aviso, nunca bloqueo ──
    //    El operador tiene la última palabra: el texto compila aunque la
    //    matriz no resuelva la fuente 5×7. Reporte honesto, sin gate.
    for (const g of glyphGestures) {
      const m = measureGlyphLegibility(atlas, g)
      if (!m.legible) {
        warnings.push(
          `GLYPH_SUBOPTIMAL_RES '${g.text ?? ''}' — ${m.rowsResolved}/7 filas · ${m.colsResolved} cols resueltas — compila igualmente (aviso, no bloqueo)`,
        )
      }
    }
    // (La rama LAMBDA_FROZEN_DRIFT murió aquí: con glyph → mcc forzado,
    //  strategy==='lambda' + glyph es inalcanzable — el drift de imagen
    //  estática era un artefacto del truco Λ; MCC lo hornea por celda.)
  }

  // ── Λ-Ride (§8.2): la curva esculpida en Forge es la base de TODAS las
  //    estrategias — el compilador no sintetiza, solo inyecta geometría ──
  let rideCurve: HephCurve | null = null
  if (project.lutSource.kind === 'ride') {
    const srcId = project.lutSource.trackId
    const src = clip.tracks.find((t) => t.id === srcId)
    if (src) {
      rideCurve = src.curve
    } else {
      warnings.push(`RIDE_SOURCE_MISSING '${srcId}' — sintetizando pulso Λ`)
    }
  }

  /** Curva base por parámetro: clone del ride o síntesis por tipo
   *  (λ-pulse numérica / LUT color 🌈 WAVE 8110-M2). El ride es
   *  agnóstico — cloneCurve preserva el valueType del origen. Guardia
   *  honesta: 'color' con fuente no-color no clonaría basura silente —
   *  advertimos y caemos al LUT sintético. */
  const baseCurveFor = (param: HephParamId): HephCurve => {
    if (rideCurve !== null) {
      if (param === 'color' && rideCurve.valueType !== 'color') {
        warnings.push(
          `RIDE_TYPE_MISMATCH — fuente '${rideCurve.paramId}' no es color; 'color' usa LUT sintética`,
        )
      } else {
        return cloneCurve(rideCurve, param)
      }
    }
    return param === 'color'
      ? synthesizeColorLut(D, project.targetColor ?? ASTERIA_DEFAULT_TARGET_COLOR)
      : synthesizeLambdaPulse(param, D)
  }

  // ── Emisión por estrategia ──
  let tracks: HephTrack[] = []
  let reportStrategy: CompiledStrategy
  let overrideCount = 0
  let devicesTargeted = 0

  if (strategy === 'cohort') {
    const r = emitCohortTracks(atlas, field, project, D, baseCurveFor, warnings)
    tracks = r.tracks
    overrideCount = r.overrideCount
    devicesTargeted = r.devicesTargeted
    reportStrategy = 'cohort'
  } else if (strategy === 'mcc') {
    const r = emitMccTracks(atlas, field, project, D, baseCurveFor, warnings)
    tracks = r.tracks
    devicesTargeted = r.devicesTargeted
    reportStrategy = 'mcc'
  } else {
    // ── Vía Λ: bus de direcciones + una pista por targetParam ──
    const lambda = synthesizeLambda(field, D, atlas)
    reportStrategy = rideCurve !== null ? 'ride' : 'lambda'
    overrideCount = Object.keys(lambda.overrides).length
    devicesTargeted = lambda.devicesTargeted
    let n = 0
    for (const param of emitTargetParams(project, warnings)) {
      const curve = baseCurveFor(param)
      tracks.push({
        id: `${ASTERIA_TRACK_PREFIX}${param}_${reportStrategy}_${n++}`,
        paramId: param,
        zones: ['all'], // G5 — nunca vacío
        curve,
        blendMode: 'replace',
        phaseConfig: { ...ASTERIA_PHASE_CONFIG }, // A1: spreadDeg=1 despierta el bus
        phaseOverrides: { ...lambda.overrides },
      })
    }
  }

  // ── VALIDADOR ESTRUCTURAL — toda pista candidata cruza la puerta ──
  const validated: HephTrack[] = []
  for (const t of tracks) {
    const reason = validateAstTrack(t, D)
    if (reason !== null) {
      warnings.push(`TRACK_REJECTED '${t.id}' — ${reason}`)
    } else {
      validated.push(t)
    }
  }
  tracks = validated

  // ── AST_SHADOWS_FORGE (WAVE 8070-M4): los ast_* se inyectan AL FINAL
  //    de clip.tracks con blendMode 'replace' — en runtime funden sobre
  //    cualquier track manual que comparta (paramId, zona). El operador
  //    debe saber que su curva de Forge queda enmascarada, no borrada.
  const shadowed = new Map<string, string[]>() // forgeTrackId → astTrackIds
  for (const ast of tracks) {
    for (const forge of clip.tracks) {
      if (isAsteriaTrack(forge.id) || forge.paramId !== ast.paramId) continue
      if (!zonesOverlap(forge.zones, ast.zones)) continue
      const list = shadowed.get(forge.id)
      if (list) list.push(ast.id)
      else shadowed.set(forge.id, [ast.id])
    }
  }
  for (const [forgeId, astIds] of shadowed) {
    warnings.push(
      `AST_SHADOWS_FORGE '${forgeId}' — curva manual enmascarada por ${astIds.join(', ')} (replace)`,
    )
  }

  let keyframeCount = 0
  for (const t of tracks) keyframeCount += t.curve.keyframes.length
  if (tracks.length === 0) {
    warnings.push('NO_TRACKS — ningún targetParam emitible')
  }

  // ── Reporte (bytes reales del payload — §8.4) ──
  const report: CompileReport = {
    strategy: reportStrategy,
    trackIds: tracks.map((t) => t.id),
    keyframeCount,
    overrideCount,
    nodesCovered,
    devicesTargeted,
    bytes: JSON.stringify(tracks).length,
    warnings,
  }

  return { tracks, report }
}

/** ¿Las zonas de dos tracks se solapan? 'all' cubre todo; ausencia = 'all'. */
function zonesOverlap(
  a: readonly ZoneTarget[] | undefined,
  b: readonly ZoneTarget[] | undefined,
): boolean {
  const A: readonly ZoneTarget[] = a && a.length > 0 ? a : (['all'] as ZoneTarget[])
  const B: readonly ZoneTarget[] = b && b.length > 0 ? b : (['all'] as ZoneTarget[])
  if (A.includes('all') || B.includes('all')) return true
  return A.some((z) => B.includes(z))
}

// ═══════════════════════════════════════════════════════════════════════════
// EMISSION — params target + estrategias Cohort/MCC
// ═══════════════════════════════════════════════════════════════════════════

/**
 * targetParams filtrados por las reglas duras: los params sin canal
 * sintetizable se omiten — warnings emitidos UNA vez. WAVE 8080 (M1):
 * strobe compila como cualquier otro param numérico; WAVE 8110 (M1):
 * 'color' compila con LUT HSL — el operador tiene la última palabra.
 */
function emitTargetParams(
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
 * VÍA B — cohortes (§8.3): K ≤ cohortBudget cubos por percentiles de gain.
 * Por cohorte × parámetro: curva maestra rotada por el delay representativo,
 * escalada por el gain representativo horneado en los keyframes
 * (WAVE 8090-M1: intensity también — `dimmerScale` era dead write).
 * Targeting = zones ∪ overrides `absolute` que
 * CLAVAN cada fixture miembro a su delay exacto (offset = delay_dev − d̄
 * mod D — la curva ya lleva d̄ horneado).
 * COHORT_ZONE_SPILL: si una zona de la cohorte alcanza fixtures ajenos, o
 * un fixture miembro cae en zonas de otra cohorte, se reporta la lista
 * exacta de nodos afectados — nunca se esconde.
 */
function emitCohortTracks(
  atlas: NodeAtlas,
  field: FieldSnapshot,
  project: AsteriaProject,
  D: number,
  baseCurveFor: (param: HephParamId) => HephCurve,
  warnings: string[],
): { tracks: HephTrack[]; overrideCount: number; devicesTargeted: number } {
  const entries = atlas.entries
  const cohorts = quantizeGainCohorts(field, entries, project.cohortBudget)
  if (cohorts.length === 0) {
    warnings.push('COHORT_EMPTY — sin nodos cubiertos que cuantizar')
    return { tracks: [], overrideCount: 0, devicesTargeted: 0 }
  }

  const params = emitTargetParams(project, warnings)
  const indexByNodeId = new Map(entries.map((e, i) => [e.nodeId, i]))

  // Índice zona → devices que poseen un nodo en ella (para el spill)
  const devicesByZone = new Map<string, Set<string>>()
  for (const e of entries) {
    if (!e.zoneId) continue
    let set = devicesByZone.get(e.zoneId)
    if (!set) devicesByZone.set(e.zoneId, (set = new Set()))
    set.add(e.deviceId)
  }

  // Targeting de cada cohorte: zones ∪ devices alcanzados
  const memberDevices: Set<string>[] = []
  const targetedDevices: Set<string>[] = []
  const cohortZones: string[][] = []
  for (const c of cohorts) {
    const members = new Set<string>()
    const zones: string[] = []
    const zoneSet = new Set<string>()
    for (const nid of c.nodeIds) {
      const e = atlas.byNodeId.get(nid)
      if (!e) continue
      members.add(e.deviceId)
      if (e.zoneId && !zoneSet.has(e.zoneId)) {
        zoneSet.add(e.zoneId)
        zones.push(e.zoneId)
      }
    }
    const targeted = new Set<string>()
    for (const z of zones) {
      for (const dev of devicesByZone.get(z) ?? []) targeted.add(dev)
    }
    memberDevices.push(members)
    targetedDevices.push(targeted)
    cohortZones.push(zones)
  }

  const tracks: HephTrack[] = []
  let overrideCount = 0
  const allMemberDevices = new Set<string>()
  for (const m of memberDevices) for (const d of m) allMemberDevices.add(d)

  for (let ci = 0; ci < cohorts.length; ci++) {
    const c = cohorts[ci]
    const members = memberDevices[ci]
    const zones = cohortZones[ci]

    // ── COHORT_ZONE_SPILL ──────────────────────────────────────────────
    // a) todo nodo NO miembro situado en una zona usada por la cohorte
    //    recibe su pista — incluidos nodos ajenos de fixtures miembro
    const memberSet = new Set(c.nodeIds)
    const spill = new Set<string>()
    for (const e of entries) {
      if (e.zoneId && zones.includes(e.zoneId) && !memberSet.has(e.nodeId)) {
        spill.add(e.nodeId)
      }
    }
    // b) fixtures miembros alcanzados TAMBIÉN por zonas de otras cohortes
    //    → reciben dos pistas; el blend decide, sus nodos son afectados
    for (let cj = 0; cj < cohorts.length; cj++) {
      if (cj === ci) continue
      for (const dev of members) {
        if (!targetedDevices[cj].has(dev)) continue
        for (const nid of c.nodeIds) {
          const e = atlas.byNodeId.get(nid)
          if (e && e.deviceId === dev) spill.add(nid)
        }
      }
    }
    if (spill.size > 0) {
      const list = [...spill].slice(0, 8).join(', ')
      warnings.push(
        `COHORT_ZONE_SPILL c${ci} — ${spill.size} nodo(s) fuera del recorte de zonas: ${list}${spill.size > 8 ? ` +${spill.size - 8} más` : ''}`,
      )
    }

    // ── Overrides: clavan cada fixture miembro a su delay exacto ──
    //    Curva rotada por d̄ (media de la cohorte) + override absoluto
    //    (delay_dev − d̄) mod D ⇒ C(t + delay_dev) exacto por fixture.
    const devDelaySum = new Map<string, { s: number; n: number }>()
    for (const nid of c.nodeIds) {
      const e = atlas.byNodeId.get(nid)
      const i = indexByNodeId.get(nid)
      if (!e || i === undefined) continue
      const acc = devDelaySum.get(e.deviceId) ?? { s: 0, n: 0 }
      acc.s += field.delayMs[i]
      acc.n++
      devDelaySum.set(e.deviceId, acc)
    }
    const overrides: PhaseOverrideMap = {}
    for (const [dev, acc] of devDelaySum) {
      const devDelay = acc.s / acc.n
      overrides[dev] = {
        mode: 'absolute',
        offsetMs: Math.round(modD(devDelay - c.delayMs, D)),
      }
    }
    overrideCount += Object.keys(overrides).length

    const gain = Math.min(1, Math.max(0, c.gain))
    for (const param of params) {
      let curve = rotateCurveCyclic(baseCurveFor(param), c.delayMs, D)
      curve = bakeGainIntoCurve(curve, gain)
      tracks.push({
        id: `${ASTERIA_TRACK_PREFIX}${param}_cohort_${ci}`,
        paramId: param,
        zones: (zones.length > 0 ? zones : ['all']) as readonly ZoneTarget[],
        curve,
        blendMode: 'replace',
        phaseConfig: { ...ASTERIA_PHASE_CONFIG },
        phaseOverrides: overrides,
      })
    }
  }

  return { tracks, overrideCount, devicesTargeted: allMemberDevices.size }
}

/**
 * VÍA MCC — Máscaras de Curva Celular (§4.2): una pista por
 * (celda cubierta × parámetro). El retardo NO viaja en phaseOverrides
 * (fixture-granular — A3) sino HORNEADO en la curva via
 * `rotateCurveCyclic(curva, delay_celda, D)`.
 *
 * `track.cell = nodeId` COMPLETO ('dev:cell') — el discriminador Δ3
 * (`_nodeCellMatches`) acepta match exacto de id completo, así cada
 * pista es quirúrgica: solo el nodo cuyo nodeId coincide recibe la
 * curva; las celdas homónimas de OTROS fixtures no colisionan. Δ1
 * garantiza que estas pistas no se fundan entre sí en el blend map.
 */
function emitMccTracks(
  atlas: NodeAtlas,
  field: FieldSnapshot,
  project: AsteriaProject,
  D: number,
  baseCurveFor: (param: HephParamId) => HephCurve,
  warnings: string[],
): { tracks: HephTrack[]; devicesTargeted: number } {
  const entries = atlas.entries
  const params = emitTargetParams(project, warnings)
  const n = Math.min(field.count, entries.length)

  const tracks: HephTrack[] = []
  const devices = new Set<string>()
  for (let i = 0; i < n; i++) {
    if (field.mask[i] === 0) continue
    const e = entries[i]
    devices.add(e.deviceId)
    const gain = Math.min(1, Math.max(0, field.gain[i]))
    for (const param of params) {
      let curve = rotateCurveCyclic(baseCurveFor(param), field.delayMs[i], D)
      curve = bakeGainIntoCurve(curve, gain)
      tracks.push({
        id: `${ASTERIA_TRACK_PREFIX}${param}_mcc_${i}`,
        paramId: param,
        zones: ['all'], // G5 — el filtro real lo hace `cell` (Δ3)
        curve,
        blendMode: 'replace',
        cell: e.nodeId, // Δ1+Δ3: match exacto por id completo
      })
    }
  }

  return { tracks, devicesTargeted: devices.size }
}
