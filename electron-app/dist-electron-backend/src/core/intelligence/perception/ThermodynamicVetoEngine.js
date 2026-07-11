// ═══════════════════════════════════════════════════════════════════════════
// 🌡️ M-SARFE Phase 3: THERMODYNAMIC VETO ENGINE (TVE)
// ═══════════════════════════════════════════════════════════════════════════
// "The Worker proposes. The Main Thread disposes."
//
// The Worker's sectionType is a HYPOTHESIS. This engine checks it against
// real-time Z-Scores, crest factors, and spectral tension. If the hypothesis
// contradicts the evidence, it is vetoed.
// ═══════════════════════════════════════════════════════════════════════════
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
    validate(proposedSection, evidence, zone) {
        const ev = evidence;
        const proposed = proposedSection;
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
            };
        }
        // ─────────────────────────────────────────────────────────────
        // GATE 1: CLIMAX VALIDATION
        // ─────────────────────────────────────────────────────────────
        if (proposed === 'drop' || proposed === 'chorus') {
            const isClassicalClimax = ev.zTotal > +0.5 && ev.zLow > +0.3;
            const isTexturalClimax = ev.spectralTension > 0.8 && ev.zHigh > +1.5 && ev.cfHigh > 5.0;
            if (isClassicalClimax) {
                return this.accept(proposed, 'climax', ev, `Classical climax validated: Z_total=${ev.zTotal.toFixed(1)} Z_low=${ev.zLow.toFixed(1)}`);
            }
            if (isTexturalClimax) {
                return {
                    phase: 'textural',
                    proposedSection: proposed,
                    verdict: 'OVERRIDDEN',
                    reason: `Textural climax detected: T=${ev.spectralTension.toFixed(2)} Z_high=${ev.zHigh.toFixed(1)} CF_high=${ev.cfHigh.toFixed(1)}. Classical drop overridden to textural.`,
                    confidence: 0.85,
                    evidence: ev,
                };
            }
            return this.downgrade(proposed, ev, zone);
        }
        // ─────────────────────────────────────────────────────────────
        // GATE 2: TEXTURAL_DROP VALIDATION
        // ─────────────────────────────────────────────────────────────
        if (proposed === 'textural_drop') {
            if (ev.zHigh > +1.0 && ev.spectralTension > 0.6) {
                return this.accept(proposed, 'textural', ev, `Textural drop validated: Z_high=${ev.zHigh.toFixed(1)} T=${ev.spectralTension.toFixed(2)}`);
            }
            return this.downgrade(proposed, ev, zone);
        }
        // ─────────────────────────────────────────────────────────────
        // GATE 3: BUILDUP VALIDATION
        // ─────────────────────────────────────────────────────────────
        if (proposed === 'buildup') {
            if (ev.energyDelta > 0.02 && ev.zTotal > -0.5) {
                return this.accept(proposed, 'building', ev, `Buildup validated: ΔE=${ev.energyDelta.toFixed(3)} Z_total=${ev.zTotal.toFixed(1)}`);
            }
            return {
                phase: ev.zTotal < -0.5 ? 'valley' : 'building',
                proposedSection: proposed,
                verdict: 'DOWNGRADED',
                reason: `Buildup not validated: ΔE=${ev.energyDelta.toFixed(3)} (not rising). Downgraded to ${ev.zTotal < -0.5 ? 'valley' : 'building'}.`,
                confidence: 0.60,
                evidence: ev,
            };
        }
        // ─────────────────────────────────────────────────────────────
        // GATE 4: BREAKDOWN VALIDATION
        // ─────────────────────────────────────────────────────────────
        if (proposed === 'breakdown') {
            if (ev.energyDelta < -0.05 && ev.spectralTension < 0.3) {
                return this.accept(proposed, 'release', ev, `Breakdown validated: ΔE=${ev.energyDelta.toFixed(3)} T=${ev.spectralTension.toFixed(2)}`);
            }
            if (ev.energyDelta < -0.05 && ev.spectralTension > 0.6) {
                return {
                    phase: 'textural',
                    proposedSection: proposed,
                    verdict: 'OVERRIDDEN',
                    reason: `Breakdown overridden to textural: ΔE=${ev.energyDelta.toFixed(3)} but T=${ev.spectralTension.toFixed(2)}. Energy falling with high tension = textural release.`,
                    confidence: 0.75,
                    evidence: ev,
                };
            }
            return this.downgrade(proposed, ev, zone);
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
                };
            }
            if (ev.energyDelta > 0.05 && ev.zTotal > 0) {
                return {
                    phase: 'building',
                    proposedSection: proposed,
                    verdict: 'UPGRADED',
                    reason: `Verse upgraded to building: ΔE=${ev.energyDelta.toFixed(3)} Z_total=${ev.zTotal.toFixed(1)}. Energy is rising.`,
                    confidence: 0.65,
                    evidence: ev,
                };
            }
            return this.accept(proposed, 'building', ev, `Verse accepted as building (neutral state)`);
        }
        // ─────────────────────────────────────────────────────────────
        // GATE 6: INTRO / OUTRO — Pass-through
        // ─────────────────────────────────────────────────────────────
        if (proposed === 'intro')
            return this.accept(proposed, 'intro', ev, 'Intro passthrough');
        if (proposed === 'outro')
            return this.accept(proposed, 'outro', ev, 'Outro passthrough');
        // Default: accept as building
        return this.accept(proposed, 'building', ev, 'Default accept as building');
    }
    // ───────────────────────────────────────────────────────────────
    // Helper methods
    // ───────────────────────────────────────────────────────────────
    accept(proposed, phase, ev, reason) {
        return {
            phase,
            proposedSection: proposed,
            verdict: 'ACCEPTED',
            reason,
            confidence: 0.80,
            evidence: ev,
        };
    }
    downgrade(proposed, ev, zone) {
        const phase = zone.ordinal <= 1 ? 'valley' :
            zone.ordinal <= 3 ? 'building' :
                'building';
        return {
            phase,
            proposedSection: proposed,
            verdict: 'DOWNGRADED',
            reason: `Section "${proposed}" DOWNGRADED to ${phase}. Acoustic evidence: Z_total=${ev.zTotal.toFixed(1)} zone=${zone.label}. Energy does not support climax.`,
            confidence: 0.70,
            evidence: ev,
        };
    }
}
