/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 VibeFusionResolver.ts — THE FUSION CORE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Función pura que toma un `CustomVibeOverride` (documento `.luxvibe`) y
 * produce un `FusedVibeBundle`: las 7 configs canónicas de motor ya
 * fusionadas con las mutaciones del documento, listas para injertar.
 *
 * ── PIPELINE ───────────────────────────────────────────────────────────────
 * 1. Valida `baseDNA` y `schemaVersion`.
 * 2. Deep-clone las 7 configs canónicas del ADN base.
 * 3. Walk del override con `forEachLeaf` → por cada hoja:
 *    a. Bloquea rutas selladas (SEALED_PARAMS) → diagnostic `error`.
 *    b. Clampea valores numéricos contra GENE_RANGES → diagnostic `warn`.
 *    c. Mapea la ruta del override a la ruta canónica y aplica el valor.
 * 4. Aplica invariantes cross-gen (morphFloor < morphCeiling, etc.).
 * 5. Construye y devuelve el `FusedVibeBundle`.
 *
 * ── PUREZA ─────────────────────────────────────────────────────────────────
 * Esta función es PURA: cero side-effects, cero deps de React, cero writes
 * a los registries canónicos. Los tests verifican que los registries
 * originales no se mutan.
 *
 * @module engine/vibe/custom/VibeFusionResolver
 * @version FASE 1B — The Fusion Core
 */

import type {
  CustomVibeOverride,
  FusedVibeBundle,
  ResolveDiagnostic,
  ResolveResult,
  BaseDNA,
  CustomVibeKey,
  GoldenPatternId,
  GraftablePatternConfig,
  SpatialOverride,
  GrandMasterOverride,
} from '../../../types/CustomVibe'
import { isBaseDNA, isCustomVibeOverride, LUXVIBE_SCHEMA_VERSION } from '../../../types/CustomVibe'

import { VIBE_REGISTRY } from '../../vibe/profiles/index'
import { PROFILE_REGISTRY } from '../../../hal/physics/profiles/index'
import { COLOR_CONSTITUTIONS } from '../../color/colorConstitutions'
import { VIBE_CONFIG, STEREO_CONFIG, PATTERN_CONFIG } from '../../movement/VibeMovementManager'
import { MOVEMENT_PRESETS } from '../../movement/VibeMovementPresets'
import { TILT_OFFSET_BY_VIBE } from '../../movement/VibeMovementManager'

import { isSealed } from './SEALED_PARAMS'
import { clampGene, getGeneRange } from './GENE_RANGES'
import { forEachLeaf, setByPath, getByPath } from './pathUtils'

// ═══════════════════════════════════════════════════════════════════════════
// DEEP CLONE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deep clone que preserva tipos primitivos, arrays y objetos planos.
 * Usa `structuredClone` si está disponible (Node 17+, browsers modernos);
 * si no, fallback a JSON roundtrip (suficiente para el genoma, que es
 * 100% dato serializable).
 */
function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj)
  }
  return JSON.parse(JSON.stringify(obj)) as T
}

// ═══════════════════════════════════════════════════════════════════════════
// PATH MAPPING — override path → canonical config + canonical path
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Destinos posibles dentro del FusedVibeBundle.
 * El resolver escribe en uno de estos según el prefijo de la ruta.
 */
type BundleTarget =
  | 'liquidProfile'
  | 'colorConstitution'
  | 'vibeConfig'
  | 'stereoConfig'
  | 'movementPreset'
  | 'tiltOffset'
  | 'patternConfigs'
  | 'spatial'
  | 'grandMaster'

interface PathMapping {
  target: BundleTarget
  /** Ruta canónica dentro del target. Para tiltOffset es '' (scalar). */
  canonicalPath: string
}

/**
 * Mapea una ruta del override (p.ej. `physics.transient.percBoost`) a su
 * destino en el FusedVibeBundle y su ruta canónica.
 *
 * Devuelve `null` si la ruta no es reconocida (gen desconocido).
 */
function mapOverridePath(fullPath: string): PathMapping | null {
  // ── PHYSICS ──────────────────────────────────────────────────────────
  if (fullPath.startsWith('physics.envelopes.')) {
    // physics.envelopes.<slot>.<gene> → liquidProfile.<slot>.<gene>
    return { target: 'liquidProfile', canonicalPath: fullPath.slice('physics.envelopes.'.length) }
  }
  if (fullPath.startsWith('physics.overrides41.envelopes.')) {
    // physics.overrides41.envelopes.<slot>.<gene> → liquidProfile.overrides41.<slot>.<gene>
    return {
      target: 'liquidProfile',
      canonicalPath: 'overrides41.' + fullPath.slice('physics.overrides41.envelopes.'.length),
    }
  }
  if (fullPath.startsWith('physics.overrides41.transient.')) {
    return {
      target: 'liquidProfile',
      canonicalPath: 'overrides41.' + fullPath.slice('physics.overrides41.transient.'.length),
    }
  }
  if (fullPath.startsWith('physics.overrides41.separation.')) {
    return {
      target: 'liquidProfile',
      canonicalPath: 'overrides41.' + fullPath.slice('physics.overrides41.separation.'.length),
    }
  }
  if (fullPath.startsWith('physics.overrides41.sidechain.')) {
    return {
      target: 'liquidProfile',
      canonicalPath: 'overrides41.' + fullPath.slice('physics.overrides41.sidechain.'.length),
    }
  }
  if (fullPath.startsWith('physics.overrides41.routing.')) {
    return {
      target: 'liquidProfile',
      canonicalPath: 'overrides41.' + fullPath.slice('physics.overrides41.routing.'.length),
    }
  }
  // Physics flat groups → liquidProfile flat fields
  for (const group of ['transient', 'separation', 'sidechain', 'strobe', 'modes', 'morph', 'kick', 'ambient']) {
    if (fullPath.startsWith(`physics.${group}.`)) {
      return { target: 'liquidProfile', canonicalPath: fullPath.slice(`physics.${group}.`.length) }
    }
  }
  // Routing: layout41Strategy va a overrides41, isPureAmbient es top-level
  if (fullPath === 'physics.routing.layout41Strategy') {
    return { target: 'liquidProfile', canonicalPath: 'overrides41.layout41Strategy' }
  }
  if (fullPath === 'physics.routing.isPureAmbient') {
    return { target: 'liquidProfile', canonicalPath: 'isPureAmbient' }
  }

  // ── COLOR ────────────────────────────────────────────────────────────
  // Color groups that map to flat GenerationOptions fields
  for (const group of ['hue', 'thermal', 'luminance', 'harmony', 'accent']) {
    if (fullPath.startsWith(`color.${group}.`)) {
      return { target: 'colorConstitution', canonicalPath: fullPath.slice(`color.${group}.`.length) }
    }
  }
  // Color groups that map to nested GenerationOptions fields
  if (fullPath.startsWith('color.mudGuard.')) {
    return { target: 'colorConstitution', canonicalPath: 'mudGuard.' + fullPath.slice('color.mudGuard.'.length) }
  }
  if (fullPath.startsWith('color.neonProtocol.')) {
    return { target: 'colorConstitution', canonicalPath: 'neonProtocol.' + fullPath.slice('color.neonProtocol.'.length) }
  }
  if (fullPath.startsWith('color.transitions.')) {
    return { target: 'colorConstitution', canonicalPath: 'transitionConfig.' + fullPath.slice('color.transitions.'.length) }
  }
  if (fullPath.startsWith('color.dimming.')) {
    return { target: 'colorConstitution', canonicalPath: 'dimmingConfig.' + fullPath.slice('color.dimming.'.length) }
  }
  if (fullPath.startsWith('color.siderealClock.')) {
    return { target: 'colorConstitution', canonicalPath: 'siderealClock.' + fullPath.slice('color.siderealClock.'.length) }
  }
  if (fullPath.startsWith('color.oceanicModulation.')) {
    return { target: 'colorConstitution', canonicalPath: 'oceanicModulation.' + fullPath.slice('color.oceanicModulation.'.length) }
  }

  // ── MOVEMENT ─────────────────────────────────────────────────────────
  if (fullPath.startsWith('movement.kinematics.')) {
    return { target: 'vibeConfig', canonicalPath: fullPath.slice('movement.kinematics.'.length) }
  }
  if (fullPath.startsWith('movement.scheduler.')) {
    // movement.scheduler.<pattern>.<gene> → patternConfigs.<pattern>.<gene>
    return { target: 'patternConfigs', canonicalPath: fullPath.slice('movement.scheduler.'.length) }
  }
  if (fullPath.startsWith('movement.stereo.')) {
    return { target: 'stereoConfig', canonicalPath: fullPath.slice('movement.stereo.'.length) }
  }
  if (fullPath === 'movement.tiltOffset') {
    return { target: 'tiltOffset', canonicalPath: '' }
  }
  if (fullPath.startsWith('movement.physics.')) {
    return { target: 'movementPreset', canonicalPath: 'physics.' + fullPath.slice('movement.physics.'.length) }
  }
  if (fullPath.startsWith('movement.optics.')) {
    return { target: 'movementPreset', canonicalPath: 'optics.' + fullPath.slice('movement.optics.'.length) }
  }
  if (fullPath.startsWith('movement.behavior.')) {
    return { target: 'movementPreset', canonicalPath: 'behavior.' + fullPath.slice('movement.behavior.'.length) }
  }
  if (fullPath.startsWith('movement.spatial.')) {
    return { target: 'spatial', canonicalPath: fullPath.slice('movement.spatial.'.length) }
  }
  if (fullPath.startsWith('movement.grandMaster.')) {
    return { target: 'grandMaster', canonicalPath: fullPath.slice('movement.grandMaster.'.length) }
  }

  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// INVARIANT ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aplica invariantes cross-gen después del merge.
 * Modifica el bundle in-place (ya es un clone) y emite diagnostics.
 *
 * @param mutatedPaths Set de rutas que el usuario mutó explícitamente.
 *                     Las invariantes que sólo aplican a mutaciones del
 *                     usuario (p.ej. anti-epilepsia) se skipped si la ruta
 *                     no está en este set.
 */
function enforceInvariants(
  bundle: FusedVibeBundle,
  diagnostics: ResolveDiagnostic[],
  mutatedPaths: Set<string>,
): void {
  // ── morphFloor < morphCeiling ────────────────────────────────────────
  const { morphFloor, morphCeiling } = bundle.liquidProfile
  if (morphFloor >= morphCeiling) {
    const corrected = morphCeiling - 0.01
    diagnostics.push({
      severity: 'warn',
      path: 'physics.morph.morphFloor',
      message: `morphFloor (${morphFloor}) >= morphCeiling (${morphCeiling}). Auto-corrigiendo morphFloor a ${corrected}.`,
      requested: morphFloor,
      applied: corrected,
    })
    ;(bundle.liquidProfile as unknown as Record<string, unknown>).morphFloor = corrected
  }

  // ── phraseDuration = N × cycleBeats (por patrón) ─────────────────────
  if (bundle.patternConfigs) {
    for (const [pattern, config] of Object.entries(bundle.patternConfigs)) {
      if (!config) continue
      const { cycleBeats, phraseDuration } = config
      if (cycleBeats > 0 && phraseDuration % cycleBeats !== 0) {
        const snapped = Math.round(phraseDuration / cycleBeats) * cycleBeats
        diagnostics.push({
          severity: 'warn',
          path: `movement.scheduler.${pattern}.phraseDuration`,
          message: `phraseDuration (${phraseDuration}) no es múltiplo de cycleBeats (${cycleBeats}). Snap a ${snapped}.`,
          requested: phraseDuration,
          applied: snapped,
        })
        ;(config as unknown as Record<string, unknown>).phraseDuration = snapped
      }
    }
  }

  // ── zoomRange.min <= zoomRange.max ───────────────────────────────────
  const zoomRange = bundle.movementPreset.optics.zoomRange
  if (zoomRange.min > zoomRange.max) {
    diagnostics.push({
      severity: 'warn',
      path: 'movement.optics.zoomRange',
      message: `zoomRange.min (${zoomRange.min}) > zoomRange.max (${zoomRange.max}). Intercambiando.`,
      requested: `[${zoomRange.min}, ${zoomRange.max}]`,
      applied: `[${zoomRange.max}, ${zoomRange.min}]`,
    })
    ;(bundle.movementPreset.optics as unknown as Record<string, unknown>).zoomRange = { min: zoomRange.max, max: zoomRange.min }
  }

  // ── focusRange.min <= focusRange.max ─────────────────────────────────
  const focusRange = bundle.movementPreset.optics.focusRange
  if (focusRange.min > focusRange.max) {
    diagnostics.push({
      severity: 'warn',
      path: 'movement.optics.focusRange',
      message: `focusRange.min (${focusRange.min}) > focusRange.max (${focusRange.max}). Intercambiando.`,
      requested: `[${focusRange.min}, ${focusRange.max}]`,
      applied: `[${focusRange.max}, ${focusRange.min}]`,
    })
    ;(bundle.movementPreset.optics as unknown as Record<string, unknown>).focusRange = { min: focusRange.max, max: focusRange.min }
  }

  // ── Anti-epilepsia: strobeDuration × strobeThreshold ≤ 12 Hz ────────
  // Frecuencia efectiva ≈ 1000ms / strobeDuration. Si strobeDuration < 83ms
  // (≈12 Hz), se clampea. strobeThreshold no afecta la frecuencia directamente
  // pero un threshold muy bajo dispara continuamente.
  // SÓLO se aplica si el usuario mutó strobeDuration — no clampamos el ADN base.
  if (!mutatedPaths.has('physics.strobe.strobeDuration')) return
  const strobeDuration = bundle.liquidProfile.strobeDuration
  const MIN_STROBE_MS = 84 // ≈11.9 Hz, deja margen del techo de 12 Hz
  if (strobeDuration < MIN_STROBE_MS && strobeDuration > 0) {
    diagnostics.push({
      severity: 'warn',
      path: 'physics.strobe.strobeDuration',
      message: `strobeDuration (${strobeDuration}ms) produce >12 Hz (riesgo fotoconvulsivo). Clampeado a ${MIN_STROBE_MS}ms.`,
      requested: strobeDuration,
      applied: MIN_STROBE_MS,
    })
    ;(bundle.liquidProfile as unknown as Record<string, unknown>).strobeDuration = MIN_STROBE_MS
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN RESOLVER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resuelve un `CustomVibeOverride` en un `FusedVibeBundle` listo para injertar.
 *
 * @param doc Documento `.luxvibe` parseado.
 * @returns `ResolveResult` con el bundle, diagnostics y flag `ok`.
 */
export function resolveCustomVibe(doc: CustomVibeOverride): ResolveResult {
  const diagnostics: ResolveDiagnostic[] = []

  // ── 1. Validar esquema ───────────────────────────────────────────────
  if (!isCustomVibeOverride(doc)) {
    diagnostics.push({
      severity: 'error',
      path: 'root',
      message: 'Documento inválido: no es un CustomVibeOverride válido.',
    })
    return { bundle: null, diagnostics, ok: false }
  }
  if (doc.schemaVersion !== LUXVIBE_SCHEMA_VERSION) {
    diagnostics.push({
      severity: 'error',
      path: 'schemaVersion',
      message: `schemaVersion ${doc.schemaVersion} no soportado. Actual: ${LUXVIBE_SCHEMA_VERSION}.`,
      requested: doc.schemaVersion,
      applied: LUXVIBE_SCHEMA_VERSION,
    })
    return { bundle: null, diagnostics, ok: false }
  }

  const baseDNA = doc.baseDNA as BaseDNA
  if (!isBaseDNA(baseDNA)) {
    diagnostics.push({
      severity: 'error',
      path: 'baseDNA',
      message: `baseDNA "${baseDNA}" no es un ADN canónico válido.`,
    })
    return { bundle: null, diagnostics, ok: false }
  }

  // ── 2. Cargar y clonar las 7 configs canónicas ───────────────────────
  const canonicalVibeProfile = VIBE_REGISTRY[baseDNA]
  const canonicalLiquidProfile = PROFILE_REGISTRY[baseDNA]
  const canonicalColorConstitution = COLOR_CONSTITUTIONS[baseDNA]
  const canonicalVibeConfig = VIBE_CONFIG[baseDNA]
  const canonicalStereoConfig = STEREO_CONFIG[baseDNA]
  const canonicalMovementPreset = MOVEMENT_PRESETS[baseDNA]
  const canonicalTiltOffset = TILT_OFFSET_BY_VIBE[baseDNA] ?? -0.325

  if (!canonicalVibeProfile || !canonicalLiquidProfile || !canonicalColorConstitution || !canonicalVibeConfig || !canonicalStereoConfig || !canonicalMovementPreset) {
    diagnostics.push({
      severity: 'error',
      path: 'baseDNA',
      message: `Falta una o más configs canónicas para baseDNA "${baseDNA}".`,
    })
    return { bundle: null, diagnostics, ok: false }
  }

  // Deep clone — los registries canónicos NO se mutan.
  const vibeProfile = deepClone(canonicalVibeProfile)
  const liquidProfile = deepClone(canonicalLiquidProfile)
  const colorConstitution = deepClone(canonicalColorConstitution)
  const vibeConfig = deepClone(canonicalVibeConfig) as unknown as Record<string, unknown>
  const stereoConfig = deepClone(canonicalStereoConfig) as unknown as Record<string, unknown>
  const movementPreset = deepClone(canonicalMovementPreset) as unknown as Record<string, unknown>
  let tiltOffset = canonicalTiltOffset
  const patternConfigs: Partial<Record<GoldenPatternId, GraftablePatternConfig>> = {}
  let spatial: SpatialOverride | undefined
  let grandMaster: GrandMasterOverride | undefined

  // ── 3. Walk del override y aplicar ───────────────────────────────────
  // Procesamos physics, color, movement por separado para construir el
  // fullPath con el prefijo correcto.
  const targets: Record<string, unknown> = {
    liquidProfile,
    colorConstitution,
    vibeConfig,
    stereoConfig,
    movementPreset,
  }

  // Track de rutas mutadas por el usuario (para invariantes condicionales).
  const mutatedPaths = new Set<string>()

  const applyLeaf = (fullPath: string, value: unknown): void => {
    // 3a. Bloquear sealed
    if (isSealed(fullPath)) {
      diagnostics.push({
        severity: 'error',
        path: fullPath,
        message: `Ruta sellada: ${fullPath} es un parámetro de seguridad/integridad y no puede mutarse.`,
        requested: value as number | string | boolean,
      })
      return
    }

    // 3b. Mapear ruta
    const mapping = mapOverridePath(fullPath)
    if (!mapping) {
      diagnostics.push({
        severity: 'warn',
        path: fullPath,
        message: `Gen desconocido: la ruta ${fullPath} no mapea a ningún config canónico.`,
      })
      return
    }

    // Registrar la ruta como mutada (para invariantes condicionales).
    mutatedPaths.add(fullPath)

    // 3c. Clamp valores numéricos contra GENE_RANGES
    let finalValue = value
    if (typeof value === 'number') {
      const range = getGeneRange(fullPath)
      if (range) {
        const result = clampGene(fullPath, value)
        if (result.clamped) {
          diagnostics.push({
            severity: 'warn',
            path: fullPath,
            message: `Valor ${value} fuera de rango [${range.min}, ${range.max}]. Clampeado a ${result.value}.`,
            requested: value,
            applied: result.value,
          })
        }
        finalValue = result.value
      }
    }

    // 3d. Aplicar al target
    switch (mapping.target) {
      case 'tiltOffset':
        if (typeof finalValue === 'number') tiltOffset = finalValue
        break
      case 'patternConfigs': {
        // canonicalPath = '<pattern>.<gene>'
        const segs = mapping.canonicalPath.split('.')
        if (segs.length >= 2) {
          const patternId = segs[0] as GoldenPatternId
          const geneName = segs.slice(1).join('.')
          if (!patternConfigs[patternId]) {
            // Clonar el PATTERN_CONFIG canónico del patrón como base
            const canonical = PATTERN_CONFIG[patternId as keyof typeof PATTERN_CONFIG]
            if (canonical) {
              patternConfigs[patternId] = deepClone(canonical) as GraftablePatternConfig
            } else {
              patternConfigs[patternId] = {
                cycleBeats: 16,
                phraseDuration: 64,
                safeHarborPhase: 0,
                safeHarborWindow: Math.PI / 4,
                hardDeadlineExtra: 16,
                transitionBeats: 2,
              }
            }
          }
          ;(patternConfigs[patternId] as unknown as Record<string, unknown>)[geneName] = finalValue
        }
        break
      }
      case 'spatial':
        spatial = setByPath((spatial ?? {}) as Record<string, unknown>, mapping.canonicalPath, finalValue) as SpatialOverride
        break
      case 'grandMaster':
        grandMaster = setByPath((grandMaster ?? {}) as Record<string, unknown>, mapping.canonicalPath, finalValue) as GrandMasterOverride
        break
      default: {
        // liquidProfile, colorConstitution, vibeConfig, stereoConfig, movementPreset
        const targetObj = targets[mapping.target]
        if (targetObj) {
          const updated = setByPath(targetObj as Record<string, unknown>, mapping.canonicalPath, finalValue)
          targets[mapping.target] = updated
        }
        break
      }
    }
  }

  // Walk cada capa del override
  if (doc.physics) {
    forEachLeaf(doc.physics, 'physics', (path, value) => applyLeaf(path, value))
  }
  if (doc.color) {
    forEachLeaf(doc.color, 'color', (path, value) => applyLeaf(path, value))
  }
  if (doc.movement) {
    forEachLeaf(doc.movement, 'movement', (path, value) => applyLeaf(path, value))
  }

  // ── 4. Construir bundle ──────────────────────────────────────────────
  // Los targets pueden haber sido reemplazados por setByPath (immutable update),
  // así que leemos de targets, no de las variables locales originales.
  const key = doc.meta.key as CustomVibeKey
  const bundle: FusedVibeBundle = {
    key,
    baseDNA,
    vibeProfile,
    liquidProfile: targets.liquidProfile as typeof liquidProfile,
    colorConstitution: targets.colorConstitution as typeof colorConstitution,
    vibeConfig: targets.vibeConfig as unknown as FusedVibeBundle['vibeConfig'],
    stereoConfig: targets.stereoConfig as unknown as FusedVibeBundle['stereoConfig'],
    movementPreset: targets.movementPreset as unknown as FusedVibeBundle['movementPreset'],
    tiltOffset,
    ...(Object.keys(patternConfigs).length > 0 ? { patternConfigs } : {}),
    ...(spatial ? { spatial } : {}),
    ...(grandMaster ? { grandMaster } : {}),
  }

  // ── 5. Aplicar invariantes ───────────────────────────────────────────
  enforceInvariants(bundle, diagnostics, mutatedPaths)

  // ── 6. Resultado ─────────────────────────────────────────────────────
  const ok = !diagnostics.some((d) => d.severity === 'error')
  return { bundle, diagnostics, ok }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS EXPORTADOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Versión segura de `resolveCustomVibe` que acepta `unknown` (p.ej. JSON
 * parseado de disco) y valida antes de resolver.
 */
export function resolveCustomVibeSafe(input: unknown): ResolveResult {
  if (!isCustomVibeOverride(input)) {
    return {
      bundle: null,
      diagnostics: [
        {
          severity: 'error',
          path: 'root',
          message: 'Input no es un CustomVibeOverride válido.',
        },
      ],
      ok: false,
    }
  }
  return resolveCustomVibe(input)
}

/**
 * Devuelve el valor resuelto de un gen concreto después de la fusión,
 * o `undefined` si la ruta no existe en el bundle.
 */
export function getFusedValue(bundle: FusedVibeBundle, fullPath: string): unknown {
  const mapping = mapOverridePath(fullPath)
  if (!mapping) return undefined
  switch (mapping.target) {
    case 'liquidProfile':
      return getByPath(bundle.liquidProfile, mapping.canonicalPath)
    case 'colorConstitution':
      return getByPath(bundle.colorConstitution, mapping.canonicalPath)
    case 'vibeConfig':
      return getByPath(bundle.vibeConfig, mapping.canonicalPath)
    case 'stereoConfig':
      return getByPath(bundle.stereoConfig, mapping.canonicalPath)
    case 'movementPreset':
      return getByPath(bundle.movementPreset, mapping.canonicalPath)
    case 'tiltOffset':
      return bundle.tiltOffset
    case 'patternConfigs':
      return getByPath(bundle.patternConfigs, mapping.canonicalPath)
    case 'spatial':
      return getByPath(bundle.spatial, mapping.canonicalPath)
    case 'grandMaster':
      return getByPath(bundle.grandMaster, mapping.canonicalPath)
    default:
      return undefined
  }
}
