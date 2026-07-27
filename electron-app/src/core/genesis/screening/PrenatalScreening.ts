// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA II: Prenatal Screening
// ═══════════════════════════════════════════════════════════════════════════
//  Evaluates a mutated clip through the 7 canonical Hephaestus gates (G1-G7)
//  BEFORE it is born into the database. Non-viable organisms die here —
//  zero inserts to lfx_organisms.
//
//  REGLA DE ORO:
//    G3 (genome [0,1]) → fail = abort
//    G4 (>2 energy zones) → fail = abort
//    G5 (empty curves) → fail = abort
//    G6 (strobe inconsistent) → fail = abort
//    G1 (structure) → fail = abort
//    G2 (checksum) → N/A (not checked prenatally)
//    G7 (redundancy / clone) → fail = abort (WAVE 6000.V6)
//    G7-spatial (spatial behavior) → warn only (not abort)
// ═══════════════════════════════════════════════════════════════════════════

import type { HephAutomationClipV3 } from '../../hephaestus/types'
import type { CognitiveDNA, SimulationMeta } from '../../arsenal/lfxTypes'
import { ENERGY_ZONES } from '../../arsenal/LfxClipInstance'

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type GateId = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7'
export type GateStatus = 'pass' | 'warn' | 'fail' | 'na'

export interface PrenatalGateResult {
  id: GateId
  status: GateStatus
  label: string
  description: string
}

export interface ScreeningResult {
  viable: boolean
  gates: PrenatalGateResult[]
  abortReason: string | null
}

// ─── GATE EVALUATORS (pure, no side effects) ────────────────────────────────

function evalG1(clip: HephAutomationClipV3): PrenatalGateResult {
  const pass =
    clip.id.trim().length > 0 &&
    clip.name.trim().length > 0 &&
    clip.durationMs > 0
  return {
    id: 'G1',
    status: pass ? 'pass' : 'fail',
    label: 'SCHEMA',
    description: pass ? 'Clip structure valid' : 'Missing id, name, or durationMs',
  }
}

function evalG2(): PrenatalGateResult {
  return {
    id: 'G2',
    status: 'na',
    label: 'CHECKSUM',
    description: 'Not evaluated prenatally — verified on save',
  }
}

function evalG3(dna: CognitiveDNA | undefined): PrenatalGateResult {
  if (!dna) {
    return { id: 'G3', status: 'na', label: 'GENOME', description: 'No cognitiveDNA' }
  }
  const { aggression, chaos, organicity } = dna.genome
  const ok = (v: number) => v >= 0 && v <= 1
  const pass = ok(aggression) && ok(chaos) && ok(organicity)
  return {
    id: 'G3',
    status: pass ? 'pass' : 'fail',
    label: 'GENOME',
    description: pass
      ? `A=${aggression.toFixed(3)} C=${chaos.toFixed(3)} O=${organicity.toFixed(3)} — OK`
      : `Out of [0,1]: A=${aggression} C=${chaos} O=${organicity}`,
  }
}

function evalG4(dna: CognitiveDNA | undefined): PrenatalGateResult {
  if (!dna) {
    return { id: 'G4', status: 'na', label: 'COMPAT', description: 'No cognitiveDNA' }
  }
  const hasVibe = dna.compatibleVibes.length >= 1
  const hasSection = dna.validSections.length >= 1

  const lo = ENERGY_ZONES.indexOf(dna.energyZone.min as typeof ENERGY_ZONES[number])
  const hi = ENERGY_ZONES.indexOf(dna.energyZone.max as typeof ENERGY_ZONES[number])
  const zoneSpan = lo >= 0 && hi >= 0 ? hi - lo + 1 : 0

  if (zoneSpan === 0) {
    return {
      id: 'G4',
      status: 'fail',
      label: 'COMPAT',
      description: 'Orphan effect: no energy zones selected',
    }
  }
  if (zoneSpan > 2) {
    return {
      id: 'G4',
      status: 'fail',
      label: 'COMPAT',
      description: `Montecarlo violated: ${zoneSpan} zones (max 2)`,
    }
  }

  const pass = hasVibe && hasSection
  return {
    id: 'G4',
    status: pass ? 'pass' : 'fail',
    label: 'COMPAT',
    description: pass
      ? `${dna.compatibleVibes.length} vibe(s) · ${dna.validSections.length} section(s) · ${zoneSpan} zone(s)`
      : `Missing: ${!hasVibe ? 'compatible vibes ' : ''}${!hasSection ? 'valid sections' : ''}`.trim(),
  }
}

function evalG5(clip: HephAutomationClipV3): PrenatalGateResult {
  if (clip.tracks.length === 0) {
    return {
      id: 'G5',
      status: 'fail',
      label: 'CURVES',
      description: 'No parameter tracks',
    }
  }
  let richCurves = 0
  for (const track of clip.tracks) {
    if (track.curve.keyframes.length >= 2) richCurves++
  }
  const pass = richCurves >= 1
  return {
    id: 'G5',
    status: pass ? 'pass' : 'fail',
    label: 'CURVES',
    description: pass
      ? `${richCurves}/${clip.tracks.length} track(s) with ≥2 keyframes`
      : 'All tracks have <2 keyframes — clip outputs nothing',
  }
}

function evalG6(clip: HephAutomationClipV3, simMeta: SimulationMeta | undefined): PrenatalGateResult {
  if (!simMeta) {
    return { id: 'G6', status: 'na', label: 'STROBE', description: 'No simulationMeta' }
  }
  if (!simMeta.isStrobe) {
    return { id: 'G6', status: 'pass', label: 'STROBE', description: 'Non-strobe: OK' }
  }

  // 🧬 WAVE 5000.V3 FIX: If the clip has a dedicated STROBE channel track,
  // a single static keyframe (value in [0,1]) is valid — the fixture's
  // hardware strobe macro handles the flashing. Only require ≥4 keyframes
  // when strobe is simulated artificially via intensity (dimmer chaser).
  const strobeTrack = clip.tracks.find(
    (t) => t.paramId === 'strobe',
  )
  if (strobeTrack) {
    const kfs = strobeTrack.curve.keyframes
    const validStatic = kfs.length >= 1 && kfs.every((k) => typeof k.value === 'number' && k.value >= 0 && k.value <= 1)
    return {
      id: 'G6',
      status: validStatic ? 'pass' : 'fail',
      label: 'STROBE',
      description: validStatic
        ? `Strobe channel — static value OK (${kfs.length} keyframe(s))`
        : 'Strobe channel — keyframe value out of range [0,1]',
    }
  }

  // No dedicated strobe track — check if strobe is simulated via intensity chaser
  const intensityTrack = clip.tracks.find((t) => t.paramId === 'intensity')
  const hasStrobicPattern = !!intensityTrack && intensityTrack.curve.keyframes.length >= 4
  return {
    id: 'G6',
    status: hasStrobicPattern ? 'pass' : 'fail',
    label: 'STROBE',
    description: hasStrobicPattern
      ? `Strobe — intensity has ${intensityTrack!.curve.keyframes.length} keyframes`
      : 'Strobe declared but no strobe track and intensity has <4 keyframes',
  }
}

// ─── TUNABLE THRESHOLDS ─────────────────────────────────────────────────────

/** 🧬 G7 CLONE ABORT THRESHOLD: L2 distance below this = functional clone → abort. */
const G7_CLONE_ABORT_L2_THRESHOLD = 0.02

// ─── GATE EVALUATORS (pure, no side effects) ────────────────────────────────

function evalG7Redundancy(l2Distance: number | undefined): PrenatalGateResult {
  if (l2Distance === undefined) {
    return { id: 'G7', status: 'na', label: 'REDUNDANCY', description: 'L2 distance not provided' }
  }
  if (l2Distance < G7_CLONE_ABORT_L2_THRESHOLD) {
    return {
      id: 'G7',
      status: 'fail',
      label: 'REDUNDANCY',
      description: `Functional clone of ancestor (L2=${l2Distance.toFixed(4)} < ${G7_CLONE_ABORT_L2_THRESHOLD}). Mutation lacked structural divergence.`,
    }
  }
  return {
    id: 'G7',
    status: 'pass',
    label: 'REDUNDANCY',
    description: `L2=${l2Distance.toFixed(4)} — sufficient divergence from ancestor`,
  }
}

function evalG7Spatial(clip: HephAutomationClipV3, dna: CognitiveDNA | undefined): PrenatalGateResult {
  if (!dna) {
    return { id: 'G7', status: 'na', label: 'SPATIAL', description: 'No cognitiveDNA' }
  }
  const { spatialBehavior } = dna
  const hasPan = clip.tracks.some((t) => t.paramId === 'pan')
  const hasTilt = clip.tracks.some((t) => t.paramId === 'tilt')
  const hasMovement = hasPan || hasTilt

  if (spatialBehavior === 'static') {
    return {
      id: 'G7',
      status: !hasMovement ? 'pass' : 'warn',
      label: 'SPATIAL',
      description: !hasMovement ? 'Static: no pan/tilt — correct' : 'Declared static but has pan/tilt',
    }
  }

  if (spatialBehavior === 'absolute' || spatialBehavior === 'relative_offset') {
    return {
      id: 'G7',
      status: hasMovement ? 'pass' : 'warn',
      label: 'SPATIAL',
      description: hasMovement ? `${spatialBehavior}: pan/tilt present` : `${spatialBehavior} but no pan/tilt`,
    }
  }

  return { id: 'G7', status: 'pass', label: 'SPATIAL', description: `Behavior: ${spatialBehavior}` }
}

// ─── MAIN EXPORT ────────────────────────────────────────────────────────────

/**
 * Runs all 7 gates on a mutated clip. Returns viability verdict.
 *
 * ABORT conditions (viable: false):
 *   G1 fail, G3 fail, G4 fail, G5 fail, G6 fail, G7 fail (redundancy)
 *
 * WARN-only (does NOT abort):
 *   G7-spatial warn
 *
 * @param l2Distance Optional L2 distance from parent. When provided,
 *   G7 redundancy gate rejects clones with L2 < 0.02.
 */
export function prenatalScreening(
  clip: HephAutomationClipV3,
  l2Distance?: number,
): ScreeningResult {
  const dna = clip.cognitiveDNA
  const sim = clip.simulationMeta

  const gates: PrenatalGateResult[] = [
    evalG1(clip),
    evalG2(),
    evalG3(dna),
    evalG4(dna),
    evalG5(clip),
    evalG6(clip, sim),
    evalG7Redundancy(l2Distance),
    evalG7Spatial(clip, dna),
  ]

  // Hard-fail gates: G1, G3, G4, G5, G6, G7 (redundancy)
  const hardFailGates: GateId[] = ['G1', 'G3', 'G4', 'G5', 'G6', 'G7']
  const abortGate = gates.find(
    (g) => hardFailGates.includes(g.id) && g.status === 'fail',
  )

  return {
    viable: !abortGate,
    gates,
    abortReason: abortGate
      ? `${abortGate.id} (${abortGate.label}): ${abortGate.description}`
      : null,
  }
}
