/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔬 resolveBaseValue.ts — Canonical Base Value Resolver
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Resolves the inherited base value of a gene from the canonical backend
 * registries. This is what the "ghost" of a slider shows — the value the
 * active baseDNA would produce if no mutations were applied.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE MAPPING PROBLEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Gene paths use dot-notation with GROUP segments as UI namespaces:
 *   physics.envelopes.envelopeKick.gateOn
 *   physics.transient.percBoost
 *   color.hue.elasticRotation
 *   movement.kinematics.panScale
 *
 * But the actual registry objects are (mostly) FLAT at the top level:
 *   PROFILE_REGISTRY['fiesta-latina'].envelopeKick.gateOn   (no "envelopes.")
 *   PROFILE_REGISTRY['fiesta-latina'].percBoost              (no "transient.")
 *   COLOR_CONSTITUTIONS['fiesta-latina'].elasticRotation     (no "hue.")
 *   VIBE_CONFIG['fiesta-latina'].panScale                    (no "kinematics.")
 *
 * This resolver strips the namespace-only group segments and maps the
 * remaining path to the correct location in the canonical registry.
 *
 * @module components/vibeLab/resolveBaseValue
 * @version FASE 4.3 — THE GHOST IN THE MACHINE
 */

import { getByPath } from '../../engine/vibe/custom/pathUtils'
import { PROFILE_REGISTRY } from '../../hal/physics/profiles/index'
import { COLOR_CONSTITUTIONS } from '../../engine/color/colorConstitutions'
import {
  VIBE_CONFIG,
  TILT_OFFSET_BY_VIBE,
  STEREO_CONFIG,
} from '../../engine/movement/VibeMovementManager'
import { MOVEMENT_PRESETS } from '../../engine/movement/VibeMovementPresets'
import { getGeneRange } from '../../engine/vibe/custom/GENE_RANGES'

// ═══════════════════════════════════════════════════════════════════════════
// PHYSICS — ILiquidProfile is flat at the top level
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Physics gene paths use these group segments as UI namespaces:
 *   physics.envelopes.<slot>.<gene>   → profile.<slot>.<gene>
 *   physics.transient.<gene>          → profile.<gene>
 *   physics.separation.<gene>         → profile.<gene>
 *   physics.sidechain.<gene>          → profile.<gene>
 *   physics.strobe.<gene>             → profile.<gene>
 *   physics.modes.<gene>              → profile.<gene>
 *   physics.morph.<gene>              → profile.<gene>
 *   physics.kick.<gene>               → profile.<gene>
 *   physics.ambient.<gene>            → profile.<gene>
 *
 * For overrides41, the group segment is also stripped:
 *   physics.overrides41.envelopes.<slot>.<gene> → profile.overrides41.<slot>.<gene>
 *   physics.overrides41.transient.<gene>        → profile.overrides41.<gene>
 *   etc.
 */

/** Groups that are UI-only namespaces (no corresponding nested object in ILiquidProfile). */
const PHYSICS_NAMESPACE_GROUPS = [
  'envelopes',
  'transient',
  'separation',
  'sidechain',
  'strobe',
  'modes',
  'morph',
  'kick',
  'ambient',
] as const

function resolvePhysics(path: string, baseDNA: string): unknown {
  const profile = PROFILE_REGISTRY[baseDNA]
  if (!profile) return undefined
  const profileObj = profile as unknown as Record<string, unknown>

  // ── overrides41 paths ──────────────────────────────────────────────
  // physics.overrides41.<group>.<...> → overrides41.<...>
  // physics.overrides41.envelopes.<slot>.<gene> → overrides41.<slot>.<gene>
  if (path.startsWith('physics.overrides41.')) {
    let subPath = path.replace(/^physics\.overrides41\./, '')
    // Strip the namespace group segment if present
    for (const grp of PHYSICS_NAMESPACE_GROUPS) {
      const prefix = `${grp}.`
      if (subPath.startsWith(prefix)) {
        subPath = subPath.slice(prefix.length)
        break
      }
    }
    const fullOverridePath = `overrides41.${subPath}`
    const val = getByPath(profileObj, fullOverridePath)
    if (val !== undefined) return val
    // Fallback: the base value (without overrides41 wrapper)
    return getByPath(profileObj, subPath)
  }

  // ── base physics paths ─────────────────────────────────────────────
  // physics.<group>.<...> → <...>  (strip the namespace group)
  let subPath = path.replace(/^physics\./, '')
  for (const grp of PHYSICS_NAMESPACE_GROUPS) {
    const prefix = `${grp}.`
    if (subPath.startsWith(prefix)) {
      subPath = subPath.slice(prefix.length)
      break
    }
  }
  return getByPath(profileObj, subPath)
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR — GenerationOptions has mixed flat/nested structure
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Color gene paths use group segments, but GenerationOptions has a mix:
 *
 * Namespace-only groups (fields are flat at the top level of GenerationOptions):
 *   color.hue.elasticRotation       → constitution.elasticRotation
 *   color.thermal.atmosphericTemp   → constitution.atmosphericTemp
 *   color.luminance.saturationRange → constitution.saturationRange
 *   color.harmony.fibonacciRotationDeg → constitution.fibonacciRotationDeg
 *   color.accent.kickPunch.l        → constitution.kickPunch.l  (kickPunch is nested)
 *   color.accent.pulseConfig.duration → constitution.pulseConfig.duration
 *
 * Group name mismatches (gene path group ≠ GenerationOptions field name):
 *   color.transitions.minDuration → constitution.transitionConfig.minDuration
 *   color.dimming.floor           → constitution.dimmingConfig.floor
 *
 * Actual nested groups (gene path group === GenerationOptions field name):
 *   color.mudGuard.minLightness     → constitution.mudGuard.minLightness
 *   color.neonProtocol.minSaturation → constitution.neonProtocol.minSaturation
 *   color.siderealClock.slotDurationMs → constitution.siderealClock.slotDurationMs
 *   color.oceanicModulation.hueInfluence → constitution.oceanicModulation.hueInfluence
 */

/** Color groups that are UI-only namespaces (strip them, look up flat field). */
const COLOR_NAMESPACE_GROUPS = ['hue', 'thermal', 'luminance', 'harmony', 'accent'] as const

/** Color groups that need name remapping to match GenerationOptions field names. */
const COLOR_GROUP_REMAP: Record<string, string> = {
  transitions: 'transitionConfig',
  dimming: 'dimmingConfig',
}

function resolveColor(path: string, baseDNA: string): unknown {
  const constitution = COLOR_CONSTITUTIONS[baseDNA as keyof typeof COLOR_CONSTITUTIONS]
  if (!constitution) return undefined
  const constObj = constitution as unknown as Record<string, unknown>

  let subPath = path.replace(/^color\./, '')

  // Check namespace-only groups → strip the group segment
  for (const grp of COLOR_NAMESPACE_GROUPS) {
    const prefix = `${grp}.`
    if (subPath.startsWith(prefix)) {
      subPath = subPath.slice(prefix.length)
      return getByPath(constObj, subPath)
    }
  }

  // Check group name remapping (transitions → transitionConfig, dimming → dimmingConfig)
  for (const [from, to] of Object.entries(COLOR_GROUP_REMAP)) {
    const prefix = `${from}.`
    if (subPath.startsWith(prefix)) {
      subPath = `${to}.${subPath.slice(prefix.length)}`
      return getByPath(constObj, subPath)
    }
  }

  // Actual nested groups (mudGuard, neonProtocol, siderealClock, oceanicModulation)
  // → traverse as-is
  return getByPath(constObj, subPath)
}

// ═══════════════════════════════════════════════════════════════════════════
// MOVEMENT — split across VIBE_CONFIG, MOVEMENT_PRESETS, TILT_OFFSET, STEREO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Movement gene paths are split across multiple registries:
 *
 *   movement.kinematics.panScale      → VIBE_CONFIG[baseDNA].panScale      (flat)
 *   movement.kinematics.tiltScale     → VIBE_CONFIG[baseDNA].tiltScale     (flat)
 *   movement.kinematics.baseFrequency → VIBE_CONFIG[baseDNA].baseFrequency (flat)
 *
 *   movement.stereo.offset            → STEREO_CONFIG[baseDNA].offset      (flat)
 *
 *   movement.tiltOffset               → TILT_OFFSET_BY_VIBE[baseDNA]       (scalar)
 *
 *   movement.physics.maxAcceleration  → MOVEMENT_PRESETS[baseDNA].physics.maxAcceleration (nested)
 *   movement.optics.zoomDefault       → MOVEMENT_PRESETS[baseDNA].optics.zoomDefault      (nested)
 *   movement.behavior.smoothFactor    → MOVEMENT_PRESETS[baseDNA].behavior.smoothFactor   (nested)
 *
 *   movement.spatial.fanAmplitude     → no registry; return range.min
 *   movement.grandMaster.globalSpeedMultiplier → no registry; return hardcoded default
 */

/** Hardcoded defaults for movement genes without a per-vibe registry. */
const MOVEMENT_HARDCODED_DEFAULTS: Record<string, number> = {
  'movement.grandMaster.globalSpeedMultiplier': 1.0,
  'movement.grandMaster.globalChaosAmount': 0,
  'movement.spatial.fanAmplitude': 0,
}

function resolveMovement(path: string, baseDNA: string): unknown {
  // ── kinematics → VIBE_CONFIG (flat fields) ─────────────────────────
  if (path.startsWith('movement.kinematics.')) {
    const vibeConfig = VIBE_CONFIG[baseDNA]
    if (vibeConfig) {
      const subPath = path.replace(/^movement\.kinematics\./, '')
      const val = getByPath(vibeConfig as unknown as Record<string, unknown>, subPath)
      if (val !== undefined) return val
    }
    return undefined
  }

  // ── stereo → STEREO_CONFIG (flat fields) ───────────────────────────
  if (path.startsWith('movement.stereo.')) {
    const stereo = STEREO_CONFIG[baseDNA]
    if (stereo) {
      const subPath = path.replace(/^movement\.stereo\./, '')
      const val = getByPath(stereo as unknown as Record<string, unknown>, subPath)
      if (val !== undefined) return val
    }
    return undefined
  }

  // ── tiltOffset → TILT_OFFSET_BY_VIBE (scalar) ──────────────────────
  if (path === 'movement.tiltOffset') {
    return TILT_OFFSET_BY_VIBE[baseDNA]
  }

  // ── physics / optics / behavior → MOVEMENT_PRESETS (nested) ────────
  // These paths already match the MOVEMENT_PRESETS structure:
  //   movement.physics.maxAcceleration → preset.physics.maxAcceleration
  //   movement.optics.zoomDefault      → preset.optics.zoomDefault
  //   movement.behavior.smoothFactor   → preset.behavior.smoothFactor
  if (
    path.startsWith('movement.physics.') ||
    path.startsWith('movement.optics.') ||
    path.startsWith('movement.behavior.')
  ) {
    const preset = MOVEMENT_PRESETS[baseDNA]
    if (preset) {
      const subPath = path.replace(/^movement\./, '')
      const val = getByPath(preset as unknown as Record<string, unknown>, subPath)
      if (val !== undefined) return val
    }
    return undefined
  }

  // ── spatial / grandMaster → no per-vibe registry ───────────────────
  if (path in MOVEMENT_HARDCODED_DEFAULTS) {
    return MOVEMENT_HARDCODED_DEFAULTS[path]
  }

  return undefined
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolves the base value of a gene from the canonical backend registries.
 *
 * @param path    Gene path (e.g., 'physics.envelopes.envelopeKick.gateOn')
 * @param baseDNA Base DNA vibe ID (e.g., 'fiesta-latina')
 * @returns The inherited value, or `undefined` if not found.
 *          Callers should fall back to `range.min` if needed.
 */
export function resolveBaseValue(path: string, baseDNA: string): unknown {
  if (path.startsWith('physics.')) {
    return resolvePhysics(path, baseDNA)
  }
  if (path.startsWith('color.')) {
    return resolveColor(path, baseDNA)
  }
  if (path.startsWith('movement.')) {
    return resolveMovement(path, baseDNA)
  }
  return undefined
}

/**
 * Resolves the base value as a number, with a fallback to the gene's
 * range.min if the canonical registry doesn't have the value.
 *
 * @param path    Gene path
 * @param baseDNA Base DNA vibe ID
 * @returns The inherited numeric value, or `range.min`, or `0`.
 */
export function resolveBaseValueNumber(path: string, baseDNA: string): number {
  const val = resolveBaseValue(path, baseDNA)
  if (typeof val === 'number') return val
  // Fallback to range.min — never return 0 blindly
  const range = getGeneRange(path)
  return range ? range.min : 0
}

/**
 * Resolves the base value as a tuple [min, max] for twin genes.
 *
 * @param minPath Gene path for the "min" gene of the pair
 * @param maxPath Gene path for the "max" gene of the pair
 * @param baseDNA Base DNA vibe ID
 * @returns A [min, max] tuple of inherited values.
 */
export function resolveBaseValueTuple(
  minPath: string,
  maxPath: string,
  baseDNA: string,
): [number, number] {
  return [resolveBaseValueNumber(minPath, baseDNA), resolveBaseValueNumber(maxPath, baseDNA)]
}
