/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡 WAVE 4811 — SAFETY GATE EVALUATORS G1–G7
 * Pure functions. Zero side effects. Deterministic.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { HephAutomationClip } from '../../../../core/hephaestus/types'
import type { CognitiveDNA, SimulationMeta } from '../../../../core/arsenal/lfxTypes'

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type GateId = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7'
export type GateStatus = 'pass' | 'warn' | 'fail' | 'na'

export interface GateResult {
  id: GateId
  status: GateStatus
  label: string
  description: string
  autoFixable: boolean
}

// ─── INDIVIDUAL EVALUATORS ──────────────────────────────────────────────────

/** G1: Clip structure valid — id, name, durationMs > 0. */
function evalG1(clip: HephAutomationClip): GateResult {
  const pass =
    clip.id.trim().length > 0 &&
    clip.name.trim().length > 0 &&
    clip.durationMs > 0

  return {
    id: 'G1',
    status: pass ? 'pass' : 'fail',
    label: 'SCHEMA',
    description: pass
      ? 'Clip structure valid'
      : `Missing: ${!clip.id ? 'id ' : ''}${!clip.name.trim() ? 'name ' : ''}${clip.durationMs <= 0 ? 'durationMs' : ''}`.trim(),
    autoFixable: false,
  }
}

/** G2: Checksum coherence — N/A in editor (only verified during save). */
function evalG2(): GateResult {
  return {
    id: 'G2',
    status: 'na',
    label: 'CHECKSUM',
    description: 'Verified on save — always skipped in editor',
    autoFixable: true,
  }
}

/** G3: Genome values strictly in [0, 1]. */
function evalG3(dna: CognitiveDNA | undefined): GateResult {
  if (!dna) {
    return {
      id: 'G3',
      status: 'na',
      label: 'GENOME',
      description: 'No Cognitive DNA — enable DNA to edit',
      autoFixable: false,
    }
  }
  const { aggression, chaos, organicity } = dna.genome
  const ok = (v: number) => v >= 0 && v <= 1
  const pass = ok(aggression) && ok(chaos) && ok(organicity)
  return {
    id: 'G3',
    status: pass ? 'pass' : 'fail',
    label: 'GENOME',
    description: pass
      ? `A=${aggression.toFixed(2)} C=${chaos.toFixed(2)} O=${organicity.toFixed(2)} — OK`
      : `Out of [0,1]: A=${aggression.toFixed(2)} C=${chaos.toFixed(2)} O=${organicity.toFixed(2)}`,
    autoFixable: true,
  }
}

/** G4: At least 1 vibe AND 1 section declared. */
function evalG4(dna: CognitiveDNA | undefined): GateResult {
  if (!dna) {
    return {
      id: 'G4',
      status: 'na',
      label: 'COMPAT',
      description: 'No Cognitive DNA — enable DNA to configure compatibility',
      autoFixable: false,
    }
  }
  const hasVibe = dna.compatibleVibes.length >= 1
  const hasSection = dna.validSections.length >= 1
  const pass = hasVibe && hasSection
  const warn = hasVibe || hasSection
  return {
    id: 'G4',
    status: pass ? 'pass' : warn ? 'warn' : 'fail',
    label: 'COMPAT',
    description: pass
      ? `${dna.compatibleVibes.length} vibe(s) · ${dna.validSections.length} section(s)`
      : `Missing: ${!hasVibe ? 'compatible vibes ' : ''}${!hasSection ? 'valid sections' : ''}`.trim(),
    autoFixable: false,
  }
}

/** G5: At least one curve with at least 2 keyframes. */
function evalG5(clip: HephAutomationClip): GateResult {
  if (clip.curves.size === 0) {
    return {
      id: 'G5',
      status: 'fail',
      label: 'CURVES',
      description: 'No parameter curves — add at least one with ≥2 keyframes',
      autoFixable: false,
    }
  }
  let richCurves = 0
  for (const curve of clip.curves.values()) {
    if (curve.keyframes.length >= 2) richCurves++
  }
  const pass = richCurves >= 1
  return {
    id: 'G5',
    status: pass ? 'pass' : 'warn',
    label: 'CURVES',
    description: pass
      ? `${richCurves}/${clip.curves.size} curve(s) with ≥2 keyframes`
      : 'All curves have <2 keyframes — clip will output nothing',
    autoFixable: false,
  }
}

/**
 * G6: Strobe declaration consistent with intensity curve.
 * If isStrobe=true, intensity must have ≥4 keyframes (pulse pattern proxy).
 */
function evalG6(clip: HephAutomationClip, simMeta: SimulationMeta | undefined): GateResult {
  if (!simMeta) {
    return {
      id: 'G6',
      status: 'na',
      label: 'STROBE',
      description: 'No simulation metadata — enable DNA for strobe declaration',
      autoFixable: false,
    }
  }
  if (!simMeta.isStrobe) {
    return {
      id: 'G6',
      status: 'pass',
      label: 'STROBE',
      description: 'Non-strobe clip: OK',
      autoFixable: false,
    }
  }
  const intensityCurve = clip.curves.get('intensity')
  const hasStrobicPattern = !!intensityCurve && intensityCurve.keyframes.length >= 4
  return {
    id: 'G6',
    status: hasStrobicPattern ? 'pass' : 'warn',
    label: 'STROBE',
    description: hasStrobicPattern
      ? `Strobe declared — intensity has ${intensityCurve!.keyframes.length} keyframes`
      : 'Strobe declared but intensity curve has <4 keyframes — verify strobe pattern',
    autoFixable: false,
  }
}

/** G7: spatialBehavior coherent with presence of pan/tilt curves. */
function evalG7(clip: HephAutomationClip, dna: CognitiveDNA | undefined): GateResult {
  if (!dna) {
    return {
      id: 'G7',
      status: 'na',
      label: 'SPATIAL',
      description: 'No spatialBehavior declared — enable DNA',
      autoFixable: false,
    }
  }
  const { spatialBehavior } = dna
  const hasPan = clip.curves.has('pan')
  const hasTilt = clip.curves.has('tilt')
  const hasMovement = hasPan || hasTilt

  if (spatialBehavior === 'static') {
    return {
      id: 'G7',
      status: !hasMovement ? 'pass' : 'warn',
      label: 'SPATIAL',
      description: !hasMovement
        ? 'Static: no pan/tilt curves — correct'
        : 'Declared static but clip has pan/tilt curves',
      autoFixable: false,
    }
  }

  if (spatialBehavior === 'absolute' || spatialBehavior === 'relative_offset') {
    return {
      id: 'G7',
      status: hasMovement ? 'pass' : 'warn',
      label: 'SPATIAL',
      description: hasMovement
        ? `${spatialBehavior}: pan/tilt curves present`
        : `${spatialBehavior} declared but no pan/tilt curves found`,
      autoFixable: false,
    }
  }

  return {
    id: 'G7',
    status: 'pass',
    label: 'SPATIAL',
    description: `Behavior: ${spatialBehavior}`,
    autoFixable: false,
  }
}

// ─── MAIN EXPORT ────────────────────────────────────────────────────────────

/** Evaluate all 7 safety gates. Pure — no mutations. */
export function evaluateGates(clip: HephAutomationClip): GateResult[] {
  return [
    evalG1(clip),
    evalG2(),
    evalG3(clip.cognitiveDNA),
    evalG4(clip.cognitiveDNA),
    evalG5(clip),
    evalG6(clip, clip.simulationMeta),
    evalG7(clip, clip.cognitiveDNA),
  ]
}

/** Auto-fix a specific gate in-place. Returns a partial clip update (or empty if not fixable). */
export function autoFixGate(
  gateId: GateId,
  clip: HephAutomationClip,
): Partial<HephAutomationClip> {
  if (gateId === 'G3' && clip.cognitiveDNA) {
    const dna = clip.cognitiveDNA
    return {
      cognitiveDNA: {
        ...dna,
        genome: {
          aggression: Math.max(0, Math.min(1, dna.genome.aggression)),
          chaos: Math.max(0, Math.min(1, dna.genome.chaos)),
          organicity: Math.max(0, Math.min(1, dna.genome.organicity)),
        },
      },
    }
  }
  return {}
}
