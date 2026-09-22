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
 *   - sin track 'strobe' salvo petición explícita          (G6)
 *   - reemplazo solo de tracks ast_*                       (coexistencia Forge)
 *
 * Estrategias: 'auto'/'lambda' → Vía Λ hoy. 'cohort'/'mcc' llegan con
 * sus waves — se reportan en warnings y caen a Λ (fallback honesto).
 * Λ-Ride (§8.2): lutSource.kind='ride' reutiliza la curva que el
 * operador esculpió en Forge — el compilador no sintetiza, solo inyecta
 * el bus de direcciones.
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
} from '../../../../../core/hephaestus/types'
import type { PhaseConfigPro } from '../../../../../core/hephaestus/phase/PhaseConfigPro'
import type { NodeAtlas } from '../store/useAsteriaStore'
import type { AsteriaProject } from '../model/AsteriaProject'
import type { FieldSnapshot } from '../model/fieldEngine'
import { synthesizeLambda, synthesizeLambdaPulse } from './lutSynth'

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
  /** Estrategia realmente usada ('lambda' | 'ride'). */
  readonly strategy: 'lambda' | 'ride'
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

/** Params que la Vía Λ puede emitir hoy: numéricos, curva sintetizable. */
const LAMBDA_SAFE_PARAMS: ReadonlySet<HephParamId> = new Set([
  'intensity', 'white', 'amber', 'speed', 'zoom', 'focus', 'iris',
  'pan', 'tilt', 'scale_x', 'scale_y', 'rot_x', 'rot_y',
  'gobo_rotation', 'smoke_pump', 'width', 'direction', 'globalComp',
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

// ═══════════════════════════════════════════════════════════════════════════
// COMPILE
// ═══════════════════════════════════════════════════════════════════════════

export function compile(input: CompileInput): CompileOutput {
  const { atlas, field, clip, project } = input
  const warnings: string[] = []
  const D = Math.max(1, clip.durationMs)

  // ── Estrategia ──
  const strategy: 'lambda' | 'ride' =
    project.lutSource.kind === 'ride' ? 'ride' : 'lambda'
  if (project.strategy === 'cohort' || project.strategy === 'mcc') {
    warnings.push(
      `STRATEGY_${project.strategy.toUpperCase()}_PENDING — emitiendo Vía Λ`,
    )
  }

  // ── Cobertura del campo ──
  let nodesCovered = 0
  let gainVaries = false
  for (let i = 0; i < field.count; i++) {
    if (field.mask[i] === 0) continue
    nodesCovered++
    if (Math.abs(field.gain[i] - 1) > 1e-3) gainVaries = true
  }
  if (nodesCovered === 0) warnings.push('EMPTY_FIELD — sin nodos cubiertos')
  if (gainVaries) {
    warnings.push(
      'GAIN_REQUIRES_COHORTS — Λ no puede gain per-fixture (§3.2); gain ignorado',
    )
  }

  // ── Bus de direcciones (compartido por todas las pistas emitidas) ──
  const lambda = synthesizeLambda(field, D, atlas)

  // ── Λ-Ride: localizar la curva fuente en el clip ──
  let rideCurve: HephCurve | null = null
  if (strategy === 'ride') {
    const srcId =
      project.lutSource.kind === 'ride' ? project.lutSource.trackId : ''
    const src = clip.tracks.find((t) => t.id === srcId)
    if (src) {
      rideCurve = src.curve
    } else {
      warnings.push(`RIDE_SOURCE_MISSING '${srcId}' — sintetizando pulso Λ`)
    }
  }

  // ── Emisión: una pista Λ por targetParam ──
  const tracks: HephTrack[] = []
  let keyframeCount = 0
  let n = 0
  for (const param of project.targetParams) {
    if (param === 'strobe') {
      warnings.push('STROBE_SKIPPED — G6: nunca sin petición explícita')
      continue
    }
    if (!LAMBDA_SAFE_PARAMS.has(param)) {
      warnings.push(`PARAM_SKIPPED '${param}' — Λ requiere curva numérica`)
      continue
    }
    const curve =
      rideCurve !== null ? cloneCurve(rideCurve, param) : synthesizeLambdaPulse(param, D)
    if (curve.keyframes.length === 0) {
      warnings.push(`EMPTY_CURVE '${param}' — pista omitida (gate G5)`)
      continue
    }
    keyframeCount += curve.keyframes.length
    tracks.push({
      id: `${ASTERIA_TRACK_PREFIX}${param}_${strategy}_${n++}`,
      paramId: param,
      zones: ['all'], // G5 — nunca vacío
      curve,
      dimmerScale: param === 'intensity' ? 1 : undefined,
      blendMode: 'replace',
      phaseConfig: { ...ASTERIA_PHASE_CONFIG }, // A1: spreadDeg=1 despierta el bus
      phaseOverrides: { ...lambda.overrides },
    })
  }
  if (tracks.length === 0) {
    warnings.push('NO_TRACKS — ningún targetParam emitible')
  }

  // ── Reporte (bytes reales del payload — §8.4) ──
  const report: CompileReport = {
    strategy,
    trackIds: tracks.map((t) => t.id),
    keyframeCount,
    overrideCount: Object.keys(lambda.overrides).length,
    nodesCovered,
    devicesTargeted: lambda.devicesTargeted,
    bytes: JSON.stringify(tracks).length,
    warnings,
  }

  return { tracks, report }
}
