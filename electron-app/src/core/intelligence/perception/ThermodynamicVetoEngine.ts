// ═══════════════════════════════════════════════════════════════════════════
// 🌡️ M-SARFE Phase 3: THERMODYNAMIC VETO ENGINE (TVE)
// ═══════════════════════════════════════════════════════════════════════════
// "The Worker proposes. The Main Thread disposes."
//
// The Worker's sectionType is a HYPOTHESIS. This engine checks it against
// real-time Z-Scores, crest factors, and spectral tension. If the hypothesis
// contradicts the evidence, it is vetoed.
// ═══════════════════════════════════════════════════════════════════════════

import type { SectionEvidence, SectionOutput } from '../../../workers/TrinityBridge'
import type { MultiSpectralZone } from '../../protocol/MusicalContext'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Narrative phase — the validated musical narrative state.
 *
 * Extended from the original 5 phases to 8 with:
 * - 'silence': Acoustic silence (all Z < -1.5)
 * - 'valley': Low energy, low tension, post-collapse
 * - 'textural': High tension, moderate energy (vocal scream, etc.)
 */
export type NarrativePhase =
  | 'silence'
  | 'valley'
  | 'building'
  | 'climax'
  | 'release'
  | 'textural'
  | 'intro'
  | 'outro'

/**
 * The verdict issued by the TVE when validating the Worker's hypothesis.
 */
export type VetoVerdict =
  | 'ACCEPTED'
  | 'DOWNGRADED'
  | 'UPGRADED'
  | 'OVERRIDDEN'
  | 'REJECTED'

/**
 * The result of thermodynamic validation.
 *
 * The phase is NO LONGER a blind mapping from sectionType string.
 * It is the result of evidence-based validation.
 */
export interface ValidatedNarrativePhase {
  readonly phase: NarrativePhase
  readonly proposedSection: SectionOutput['type']
  readonly verdict: VetoVerdict
  readonly reason: string
  readonly confidence: number
  readonly evidence: SectionEvidence
}

// ═══════════════════════════════════════════════════════════════════════════
// TVE CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Thermodynamic Veto Engine
 *
 * Validates the Worker's section hypothesis against real-time acoustic evidence.
 * 6 Gates:
 *   Gate 0: Silence Override (absolute veto)
 *   Gate 1: Climax Validation (classical vs textural)
 *   Gate 2: Textural Drop Validation
 *   Gate 3: Buildup Validation
 *   Gate 4: Breakdown Validation
 *   Gate 5: Verse Upgrade Check
 */
export class ThermodynamicVetoEngine {

  validate(
    proposedSection: SectionOutput['type'],
    evidence: SectionEvidence,
    zone: MultiSpectralZone,
  ): ValidatedNarrativePhase {

    const ev = evidence
    const proposed = proposedSection

    // ─────────────────────────────────────────────────────────────
    // GATE 0: SILENCE OVERRIDE — The absolute veto
    // ─────────────────────────────────────────────────────────────
    if (ev.zTotal < -1.5 && ev.zLow < -1.0 && ev.zHigh < -1.0) {
      return {
        phase: 'silence',
        proposedSection: proposed,
        verdict: 'REJECTED',
        reason: `SILENCE OVERRIDE: Z_total=${ev.zTotal.toFixed(1)} Z_low=${ev.zLow.toFixed(1)} Z_high=${ev.zHigh.toFixed(1)} — all bands below -1σ. Section "${proposed}" is hallucinated.`,
        confidence: 0.95,
        evidence: ev,
      }
    }

    // ─────────────────────────────────────────────────────────────
    // GATE 1: CLIMAX VALIDATION
    // ─────────────────────────────────────────────────────────────
    if (proposed === 'drop' || proposed === 'chorus') {
      // ⬇ Thresholds lowered: zTotal > 0.3 (was 0.5), zLow > 0.1 (was 0.3)
      // Techno minimal has moderate z-scores due to rolling baseline adaptation
      const isClassicalClimax = ev.zTotal > +0.3 && ev.zLow > +0.1
      // 🔬 WAVE 7523: Sustained energy climax — now requires Z-score confirmation
      // Raw energy alone (eTotal > 0.65) produces false climax in techno minimal
      // plateaus where energy is high but flat (Z ~0). Requiring zTotal > +0.3
      // aligns with isClassicalClimax and preserves genre-agnosticism (§1.7).
      const isSustainedClimax = ev.eTotal > 0.65 && ev.zTotal > +0.3
      const isTexturalClimax = ev.spectralTension > 0.8 && ev.zHigh > +1.5 && ev.cfHigh > 5.0

      if (isClassicalClimax || isSustainedClimax) {
        return this.accept(proposed, 'climax', ev,
          `Climax validated: ${isSustainedClimax ? `sustained E=${ev.eTotal.toFixed(2)}` : `Z_total=${ev.zTotal.toFixed(1)} Z_low=${ev.zLow.toFixed(1)}`}`)
      }

      if (isTexturalClimax) {
        return {
          phase: 'textural',
          proposedSection: proposed,
          verdict: 'OVERRIDDEN',
          reason: `Textural climax detected: T=${ev.spectralTension.toFixed(2)} Z_high=${ev.zHigh.toFixed(1)} CF_high=${ev.cfHigh.toFixed(1)}. Classical drop overridden to textural.`,
          confidence: 0.85,
          evidence: ev,
        }
      }

      return this.downgrade(proposed, ev, zone)
    }

    // ─────────────────────────────────────────────────────────────
    // GATE 2: TEXTURAL_DROP VALIDATION
    // ─────────────────────────────────────────────────────────────
    if (proposed === 'textural_drop') {
      if (ev.zHigh > +1.0 && ev.spectralTension > 0.6) {
        return this.accept(proposed, 'textural', ev,
          `Textural drop validated: Z_high=${ev.zHigh.toFixed(1)} T=${ev.spectralTension.toFixed(2)}`)
      }
      return this.downgrade(proposed, ev, zone)
    }

    // ─────────────────────────────────────────────────────────────
    // GATE 3: BUILDUP VALIDATION
    // ─────────────────────────────────────────────────────────────
    if (proposed === 'buildup') {
      if (ev.energyDelta > 0.02 && ev.zTotal > -0.5) {
        // 🔬 WAVE 7523: Sustained energy override now requires Z-score confirmation
        if (ev.eTotal > 0.65 && ev.zTotal > +0.3) {
          return this.accept(proposed, 'climax', ev,
            `Buildup overridden to climax: sustained E=${ev.eTotal.toFixed(2)} Z=${ev.zTotal.toFixed(1)} despite rising ΔE`)
        }
        return this.accept(proposed, 'building', ev,
          `Buildup validated: ΔE=${ev.energyDelta.toFixed(3)} Z_total=${ev.zTotal.toFixed(1)}`)
      }
      // 🔬 WAVE 7523: Sustained energy override for non-rising buildup — Z required
      if (ev.eTotal > 0.65 && ev.zTotal > +0.3) {
        return this.accept(proposed, 'climax', ev,
          `Buildup overridden to climax: sustained E=${ev.eTotal.toFixed(2)} Z=${ev.zTotal.toFixed(1)} with stable ΔE`)
      }
      return {
        phase: ev.zTotal < -0.5 ? 'valley' : 'building',
        proposedSection: proposed,
        verdict: 'DOWNGRADED',
        reason: `Buildup not validated: ΔE=${ev.energyDelta.toFixed(3)} (not rising). Downgraded to ${ev.zTotal < -0.5 ? 'valley' : 'building'}.`,
        confidence: 0.60,
        evidence: ev,
      }
    }

    // ─────────────────────────────────────────────────────────────
    // GATE 4: BREAKDOWN VALIDATION
    // ─────────────────────────────────────────────────────────────
    if (proposed === 'breakdown') {
      if (ev.energyDelta < -0.05 && ev.spectralTension < 0.3) {
        return this.accept(proposed, 'release', ev,
          `Breakdown validated: ΔE=${ev.energyDelta.toFixed(3)} T=${ev.spectralTension.toFixed(2)}`)
      }
      if (ev.energyDelta < -0.05 && ev.spectralTension > 0.6) {
        return {
          phase: 'textural',
          proposedSection: proposed,
          verdict: 'OVERRIDDEN',
          reason: `Breakdown overridden to textural: ΔE=${ev.energyDelta.toFixed(3)} but T=${ev.spectralTension.toFixed(2)}. Energy falling with high tension = textural release.`,
          confidence: 0.75,
          evidence: ev,
        }
      }
      return this.downgrade(proposed, ev, zone)
    }

    // ─────────────────────────────────────────────────────────────
    // GATE 5: VERSE UPGRADE CHECK
    // ─────────────────────────────────────────────────────────────
    if (proposed === 'verse' || proposed === 'unknown') {
      if (ev.spectralTension > 0.7 && ev.zHigh > +1.5) {
        return {
          phase: 'textural',
          proposedSection: proposed,
          verdict: 'UPGRADED',
          reason: `Verse upgraded to textural: T=${ev.spectralTension.toFixed(2)} Z_high=${ev.zHigh.toFixed(1)}. Hidden high-frequency tension detected.`,
          confidence: 0.70,
          evidence: ev,
        }
      }
      // 🔬 WAVE 7523: Sustained energy climax — Z-score required to prevent
      // false climax in techno minimal plateaus (high raw E, flat Z ~0)
      if (ev.eTotal > 0.65 && ev.zTotal > +0.3) {
        return {
          phase: 'climax',
          proposedSection: proposed,
          verdict: 'UPGRADED',
          reason: `Verse upgraded to climax: sustained E=${ev.eTotal.toFixed(2)} Z=${ev.zTotal.toFixed(1)}. High energy above context baseline.`,
          confidence: 0.70,
          evidence: ev,
        }
      }
      if (ev.energyDelta > 0.05 && ev.zTotal > 0) {
        return {
          phase: 'building',
          proposedSection: proposed,
          verdict: 'UPGRADED',
          reason: `Verse upgraded to building: ΔE=${ev.energyDelta.toFixed(3)} Z_total=${ev.zTotal.toFixed(1)}. Energy is rising.`,
          confidence: 0.65,
          evidence: ev,
        }
      }
      return this.accept(proposed, 'building', ev,
        `Verse accepted as building (neutral state)`)
    }

    // ─────────────────────────────────────────────────────────────
    // GATE 6: INTRO / OUTRO — Pass-through
    // ─────────────────────────────────────────────────────────────
    if (proposed === 'intro') return this.accept(proposed, 'intro', ev, 'Intro passthrough')
    if (proposed === 'outro') return this.accept(proposed, 'outro', ev, 'Outro passthrough')

    // 🔬 WAVE 7523: Default sustained energy → climax only if Z confirms
    if (ev.eTotal > 0.65 && ev.zTotal > +0.3) {
      return this.accept(proposed, 'climax', ev, `Default upgraded to climax: sustained E=${ev.eTotal.toFixed(2)} Z=${ev.zTotal.toFixed(1)}`)
    }
    return this.accept(proposed, 'building', ev, 'Default accept as building')
  }

  // ───────────────────────────────────────────────────────────────
  // Helper methods
  // ───────────────────────────────────────────────────────────────

  private accept(
    proposed: SectionOutput['type'],
    phase: NarrativePhase,
    ev: SectionEvidence,
    reason: string,
  ): ValidatedNarrativePhase {
    return {
      phase,
      proposedSection: proposed,
      verdict: 'ACCEPTED',
      reason,
      confidence: 0.80,
      evidence: ev,
    }
  }

  private downgrade(
    proposed: SectionOutput['type'],
    ev: SectionEvidence,
    zone: MultiSpectralZone,
  ): ValidatedNarrativePhase {
    // 🔬 WAVE 7523: Sustained energy override — Z-score required
    if (ev.eTotal > 0.65 && ev.zTotal > +0.3) {
      return {
        phase: 'climax' as NarrativePhase,
        proposedSection: proposed,
        verdict: 'OVERRIDDEN' as VetoVerdict,
        reason: `Section "${proposed}" DOWNGRADED but sustained E=${ev.eTotal.toFixed(2)} Z=${ev.zTotal.toFixed(1)} → climax override.`,
        confidence: 0.75,
        evidence: ev,
      }
    }

    const phase: NarrativePhase =
      zone.ordinal <= 1 ? 'valley' :
      zone.ordinal <= 3 ? 'building' :
      'building'

    return {
      phase,
      proposedSection: proposed,
      verdict: 'DOWNGRADED',
      reason: `Section "${proposed}" DOWNGRADED to ${phase}. Acoustic evidence: Z_total=${ev.zTotal.toFixed(1)} zone=${zone.label}. Energy does not support climax.`,
      confidence: 0.70,
      evidence: ev,
    }
  }
}
