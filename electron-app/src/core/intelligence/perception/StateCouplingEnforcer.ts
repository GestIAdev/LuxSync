// ═══════════════════════════════════════════════════════════════════════════
// 🔗 M-SARFE Phase 3: STATE COUPLING ENFORCER
// ═══════════════════════════════════════════════════════════════════════════
// Ensures Zone and Phase never contradict each other.
// When they conflict, ZONE WINS (hard physics over soft narrative).
//
// Rules:
//   Rule 1: Zone 'silence' → Phase must be 'silence'
//   Rule 2: Zone 'valley'/'ambient' → Phase cannot be 'climax' (force 'valley')
//   Rule 3: Zone 'peak'/'intense' → Phase cannot be 'silence'/'valley' (force 'building')
//   Exception: Phase 'textural' can coexist with any Zone.
//   Exception: Phase 'intro'/'outro' can coexist with any Zone.
// ═══════════════════════════════════════════════════════════════════════════

import type { MultiSpectralZone } from '../../protocol/MusicalContext'
import type { ValidatedNarrativePhase, NarrativePhase } from './ThermodynamicVetoEngine'

/**
 * AcousticRealityState — the single source of truth.
 *
 * Replaces the fragmented state (energyContext.zone + contextualMemory.narrative + pattern.section).
 * Every downstream consumer reads from THIS object.
 */
export interface AcousticRealityState {
  readonly timestamp: number
  readonly zone: MultiSpectralZone
  readonly phase: ValidatedNarrativePhase
  readonly couplingCorrected: boolean
  readonly zScores: {
    low: number
    mid: number
    high: number
    total: number
  }
  readonly crestFactors: {
    low: number
    high: number
  }
  readonly spectralTension: number
  readonly spectralDivergence: number
}

/**
 * State Coupling Enforcer
 *
 * After the TVE produces a ValidatedNarrativePhase and the MSEL produces
 * a MultiSpectralZone, this module ensures they are consistent.
 */
export class StateCouplingEnforcer {

  enforce(
    zone: MultiSpectralZone,
    phase: ValidatedNarrativePhase,
  ): { zone: MultiSpectralZone; phase: ValidatedNarrativePhase; corrected: boolean } {

    // Exception: textural phase can coexist with any zone
    if (phase.phase === 'textural') {
      return { zone, phase, corrected: false }
    }

    // Exception: intro/outro are temporal markers, not energy states
    if (phase.phase === 'intro' || phase.phase === 'outro') {
      return { zone, phase, corrected: false }
    }

    // Hard rule: silence zone → silence phase
    if (zone.label === 'silence' && phase.phase !== 'silence') {
      return {
        zone,
        phase: this.overridePhase(phase, 'silence',
          `COUPLING ENFORCED: zone=silence but phase=${phase.phase}. Overridden to silence.`),
        corrected: true,
      }
    }

    // Hard rule: valley/ambient zone cannot be climax
    if ((zone.label === 'valley' || zone.label === 'ambient') &&
        phase.phase === 'climax') {
      return {
        zone,
        phase: this.overridePhase(phase, 'valley',
          `COUPLING ENFORCED: zone=${zone.label} but phase=climax. Overridden to valley. The music does not support a climax.`),
        corrected: true,
      }
    }

    // Hard rule: peak/intense zone cannot be silence/valley
    if ((zone.label === 'peak' || zone.label === 'intense') &&
        (phase.phase === 'silence' || phase.phase === 'valley')) {
      return {
        zone,
        phase: this.overridePhase(phase, 'building',
          `COUPLING ENFORCED: zone=${zone.label} but phase=${phase.phase}. Overridden to building. High energy detected but narrative phase lagged.`),
        corrected: true,
      }
    }

    return { zone, phase, corrected: false }
  }

  private overridePhase(
    original: ValidatedNarrativePhase,
    newPhase: NarrativePhase,
    reason: string,
  ): ValidatedNarrativePhase {
    return {
      ...original,
      phase: newPhase,
      verdict: 'OVERRIDDEN',
      reason: `${original.reason} → ${reason}`,
      confidence: 0.90,
    }
  }
}
