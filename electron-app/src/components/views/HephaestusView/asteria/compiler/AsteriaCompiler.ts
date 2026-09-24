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
 *   - 'mcc-device'  → WAVE 8186 (VÍA A del COHORT_FORENSIC_AUDIT):
 *                     cohortes limpias normales + cohortes con
 *                     COHORT_ZONE_SPILL reemitidas como pistas
 *                     quirúrgicas `cell = nodeId` por nodo miembro.
 *   - 'auto'        → el árbol: ¿distingue celdas del mismo fixture? → mcc;
 *                     ¿gain per-nodo? → cohort (con auto-escalado a
 *                     mcc-device si una cohorte derrama); si no → λ.
 * Λ-Ride (§8.2): lutSource.kind='ride' reutiliza la curva que el
 * operador esculpió en Forge como curva base de TODAS las estrategias.
 *
 * 🜨 WAVE 8190 — PLAN DE EMISIÓN (CRUX_RESOLUTION §2): el bucle
 * `params × cohortes` ciego murió. `planEmission` (emissionPlan.ts)
 * clasifica cada parámetro por firma espacio-temporal y enruta cada
 * clase de valor por separado — `emitRoute` (zoned/lambda/surgical) es
 * la única puerta que empuja HephTracks. Regla de luminancia §2.4:
 * 'color' + intensity activo → estático (1 kf), una sola pista.
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
  ZoneTarget,
} from '../../../../../core/hephaestus/types'
import type { NodeAtlas } from '../store/useAsteriaStore'
import type {
  AsteriaProject,
  AsteriaProjectV1,
  Gesture,
  LayerPaint,
} from '../model/AsteriaProject'
import type {
  FieldPlanes,
  FieldSnapshot,
  ScalarPlane,
} from '../model/fieldEngine'
import { OWNER_NONE } from '../model/fieldEngine'
import { hexToHsl } from './lutSynth'
import { rgb8PackedToHsl } from '../model/colorMath'
import { envelope, specKey } from './synth/envelopes'
import { materialize } from './synth/materialize'
import {
  ASTERIA_DEFAULT_SYNTH,
  ASTERIA_DEFAULT_TARGET_COLOR,
  effectivePaint,
  migrateV1toV2,
} from '../model/AsteriaProject'
import { measureGlyphLegibility } from '../model/glyphRaster'
import {
  ASTERIA_TRACK_PREFIX,
  emitPaintParams,
  emitPlans,
  flatFieldToPlanes,
  isAsteriaTrack,
  planEmission,
} from './emissionPlan'

// 🜨 WAVE 8190 — los símbolos de propiedad ast_* viven en emissionPlan;
// re-exportados aquí para no romper los imports de la UI (ParameterLane,
// ForgeTab, LabTab, GestureInspector).
export { ASTERIA_TRACK_PREFIX, isAsteriaTrack } from './emissionPlan'

/** Estrategia REAL emitida por el compilador (la que produce los tracks). */
export type CompiledStrategy = 'lambda' | 'ride' | 'cohort' | 'mcc' | 'mcc-device'

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT — blueprint §8.1 verbatim
// ═══════════════════════════════════════════════════════════════════════════

export interface CompileInput {
  readonly atlas: NodeAtlas
  /**
   * 🜨 WAVE 8193: planos reales del fieldEngine (`FieldPlanes`), o un
   * FieldSnapshot plano legacy — se envuelve como UN ScalarPlane
   * compartido por todos los params (paridad con el modelo único).
   */
  readonly field: FieldPlanes | FieldSnapshot
  readonly clip: HephAutomationClipV3
  /**
   * 🜨 WAVE 8192: acepta documentos v1 — se normalizan a v2 por
   * `migrateV1toV2` antes de planear (un documento viejo nunca tumba
   * el compilador; la salida es idéntica a la de v1 — gate G-MIG).
   */
  readonly project: AsteriaProject | AsteriaProjectV1
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
 * ¿Algún plano distingue celdas del MISMO fixture? (§4.3 — raíz del
 * árbol). 🜨 WAVE 8193: multi-plano — si CUALQUIER plano escalar
 * distingue celdas, 'auto' escala a MCC. Compara delay+gain de cada
 * nodo cubierto contra el primer nodo cubierto de su deviceId.
 */
function fieldDistinguishesCells(field: FieldPlanes, atlas: NodeAtlas): boolean {
  const entries = atlas.entries
  const planes: Iterable<ScalarPlane> =
    field.color !== null
      ? [...field.scalar.values(), field.color]
      : field.scalar.values()
  for (const plane of planes) {
    const first = new Map<string, { d: number; g: number }>()
    const n = Math.min(field.count, plane.mask.length)
    for (let i = 0; i < n; i++) {
      if (plane.mask[i] === 0) continue
      const dev = entries[i].deviceId
      const sig = first.get(dev)
      if (!sig) {
        first.set(dev, { d: plane.delayMs[i], g: plane.gain[i] })
      } else if (
        Math.abs(sig.d - plane.delayMs[i]) > 1e-3 ||
        Math.abs(sig.g - plane.gain[i]) > 1e-3
      ) {
        return true
      }
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
  const { atlas, clip } = input
  // 🜨 WAVE 8192 — frontera de versión: todo lo interno opera sobre v2.
  const project = migrateV1toV2(input.project)
  const warnings: string[] = []
  const D = Math.max(1, clip.durationMs)

  // ── 🜨 WAVE 8193: params activos = ∪ effectivePaint(g).params ──
  const params = emitPaintParams(project, warnings)

  // Normalización del input: planos reales del engine, o la forma plana
  // legacy envuelta como ScalarPlane compartido (paridad modelo único).
  const field: FieldPlanes =
    'scalar' in input.field
      ? input.field
      : flatFieldToPlanes(input.field, params)

  // ── Cobertura del campo — UNIÓN de todos los planos (+ color 8194) ──
  let nodesCovered = 0
  let gainVaries = false
  {
    const seen = new Uint8Array(field.count)
    const planes: Iterable<ScalarPlane> =
      field.color !== null
        ? [...field.scalar.values(), field.color]
        : field.scalar.values()
    for (const plane of planes) {
      const n = Math.min(field.count, plane.mask.length)
      for (let i = 0; i < n; i++) {
        if (plane.mask[i] === 0) continue
        if (seen[i] === 0) {
          seen[i] = 1
          nodesCovered++
        }
        if (Math.abs(plane.gain[i] - 1) > 1e-3) gainVaries = true
      }
    }
  }
  if (nodesCovered === 0) warnings.push('EMPTY_FIELD — sin nodos cubiertos')

  // ── Estrategia — §4.3: 'auto' recorre el árbol de decisión ──
  let strategy: 'lambda' | 'cohort' | 'mcc' | 'mcc-device'
  switch (project.strategy) {
    case 'cohort':
      strategy = 'cohort'
      break
    case 'mcc':
      strategy = 'mcc'
      break
    case 'mcc-device':
      strategy = 'mcc-device'
      break
    case 'lambda':
      strategy = 'lambda'
      break
    case 'auto':
      strategy = fieldDistinguishesCells(field, atlas)
        ? 'mcc'
        : gainVaries
          ? 'mcc-device' // 🜨 WAVE 8186: cohort + auto-escalado por spill
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
      if (
        project.strategy !== 'auto' &&
        project.strategy !== 'mcc' &&
        project.strategy !== 'mcc-device'
      ) {
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
  //    🜨 WAVE 8192: la fuente vive en defaultPaint.lut (undefined = synth).
  //    🜨 WAVE 8193: `rideWarned` deduplica con los rides por-capa de
  //    baseCurveFor — el aviso de una fuente ausente sale UNA vez.
  const rideWarned = new Set<string>()
  const lut = project.defaultPaint.lut
  let rideCurve: HephCurve | null = null
  if (lut?.kind === 'ride') {
    const srcId = lut.trackId
    const src = clip.tracks.find((t) => t.id === srcId)
    if (src) {
      rideCurve = src.curve
    } else {
      rideWarned.add(srcId)
      warnings.push(`RIDE_SOURCE_MISSING '${srcId}' — sintetizando pulso Λ`)
    }
  }

  // 🜨 WAVE 8193 (§4.4) — la forma de onda la dicta la CAPA DOMINANTE
  // (plane.owner) de cada clase, no una global: effectivePaint(owner)
  // .synth/.lut. Las curvas se memoizan por (param, specKey, rideId,
  // color) — clases con la misma forma comparten la base materializada.
  const paintCache = new Map<number, LayerPaint>()
  const paintForOwner = (owner: number): LayerPaint => {
    let p = paintCache.get(owner)
    if (p === undefined) {
      const g = owner === OWNER_NONE ? undefined : project.stack[owner]
      p =
        g === undefined ? project.defaultPaint : effectivePaint(project, g)
      paintCache.set(owner, p)
    }
    return p
  }
  const curveCache = new Map<string, HephCurve>()

  /** Curva base por (parámetro, owner[, rgb8]): clone del ride de SU
   *  capa o síntesis por SU spec (envelope→materialize 🜨 WAVE 8191).
   *  El ride es agnóstico — cloneCurve preserva el valueType del origen.
   *  🜨 WAVE 8194: para 'color', `rgb8` es el color COMPUESTO de la clase
   *  (la mezcla real del plano de color) — tiene precedencia sobre el
   *  paint.color declarado. Un ride de color explícito manda sobre ambos.
   *  Guardia honesta: 'color' con fuente no-color no clonaría basura
   *  silente — advertimos (una vez por fuente) y caemos a síntesis. */
  const baseCurveFor = (
    param: HephParamId,
    owner: number,
    rgb8?: number,
  ): HephCurve => {
    const paint = paintForOwner(owner)
    const lut = paint.lut
    if (lut?.kind === 'ride') {
      const srcId = lut.trackId
      const src = clip.tracks.find((t) => t.id === srcId)
      if (src) {
        if (param === 'color' && src.curve.valueType !== 'color') {
          if (!rideWarned.has(`type:${srcId}:${param}`)) {
            rideWarned.add(`type:${srcId}:${param}`)
            warnings.push(
              `RIDE_TYPE_MISMATCH — fuente '${src.curve.paramId}' no es color; 'color' usa LUT sintética`,
            )
          }
        } else {
          const key = `ride:${srcId}|${param}`
          let c = curveCache.get(key)
          if (c === undefined) {
            c = cloneCurve(src.curve, param)
            curveCache.set(key, c)
          }
          return c
        }
      } else if (!rideWarned.has(srcId)) {
        rideWarned.add(srcId)
        warnings.push(`RIDE_SOURCE_MISSING '${srcId}' — sintetizando pulso Λ`)
      }
    }
    const spec = paint.synth ?? ASTERIA_DEFAULT_SYNTH
    const colorHex =
      param === 'color'
        ? rgb8 !== undefined
          ? `#${rgb8.toString(16).padStart(6, '0')}`
          : (paint.color ??
            project.defaultPaint.color ??
            ASTERIA_DEFAULT_TARGET_COLOR)
        : ''
    const key = `syn:${param}|${specKey(spec)}|${colorHex}`
    let c = curveCache.get(key)
    if (c === undefined) {
      c =
        param === 'color'
          ? materialize(
              envelope(spec),
              'color',
              D,
              rgb8 !== undefined ? rgb8PackedToHsl(rgb8) : hexToHsl(colorHex),
            )
          : materialize(envelope(spec), param, D)
      curveCache.set(key, c)
    }
    return c
  }

  // ── Emisión por estrategia — 🜨 WAVE 8190: PLAN DE EMISIÓN ──
  //    El multiplicador `params × cohortes` ciego murió: cada param
  //    clasifica su firma y cada clase enruta por separado
  //    (CRUX_RESOLUTION §2). La estrategia queda como sesgo global.
  let tracks: HephTrack[] = []

  // §2.4 — Regla de Propiedad de Luminancia: intensity posee la
  // envolvente; 'color' se emite estático (1 kf). Un ride de color
  // explícito tiene precedencia sobre la regla (el operador esculpió
  // esa curva a propósito).
  const staticColor =
    params.includes('intensity') &&
    params.includes('color') &&
    !(rideCurve !== null && rideCurve.valueType === 'color')

  const planned = planEmission({
    field,
    atlas,
    project,
    params,
    strategy,
    D,
    staticColor,
    // §2.5 — del documento: migrados 'allow' (paridad V1), nuevos
    // 'contain' por defecto. `?? 'allow'` cubre JSON corrupto a mano.
    colorFlood: project.colorFlood ?? 'allow',
    warnings,
  })

  const reportStrategy: CompiledStrategy =
    strategy === 'mcc'
      ? 'mcc'
      : strategy === 'lambda'
        ? rideCurve !== null
          ? 'ride'
          : 'lambda'
        : planned.isolatedCohorts > 0 || strategy === 'mcc-device'
          ? 'mcc-device'
          : 'cohort'
  if (strategy === 'mcc-device' && planned.isolatedCohorts === 0) {
    warnings.push(
      'MCC_DEVICE_NO_SPILL — ninguna cohorte derramó; emisión cohorte pura',
    )
  }
  const overrideCount = planned.overrideCount
  const devicesTargeted = planned.devicesTargeted
  emitPlans(
    planned.plans,
    { D, baseCurveFor, lambdaTag: reportStrategy === 'ride' ? 'ride' : 'lambda' },
    tracks,
  )

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
// EMISSION — movida a emissionPlan.ts (WAVE 8190 · Plan de Emisión §2)
// ═══════════════════════════════════════════════════════════════════════════
