/**
 * ⚡ DROP BRIDGE — V3 PHASE 3.3.B: ROUTING ONLY
 * ═══════════════════════════════════════════════════════════════════════════
 * V3.3.B: Static threshold checks extirpated. V3 Liquid Cognition's
 * `epicness` and `T(t)` handle drop gating natively. This module
 * now only provides arsenal routing: if V3 dictates a massive drop,
 * the pipeline selects from Divine or Heavy arsenal.
 *
 * @module core/intelligence/think/DropBridge
 */
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_CONFIG = {
    peakSections: ['drop', 'chorus'],
    watchingThreshold: 2.0,
    imminentThreshold: 2.5,
};
// ═══════════════════════════════════════════════════════════════════════════
// LÓGICA PRINCIPAL — V3.3.B: Routing only, no threshold gating
// ═══════════════════════════════════════════════════════════════════════════
/**
 * V3.3.B: Evaluúa el estado para telemetría y routing de arsenal.
 * No gatea el disparo — V3 Liquid Cognition decide eso.
 */
export function checkDropBridge(input, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const { energyZScore, sectionType, rawEnergy } = input;
    const isPeakSection = cfg.peakSections.includes(sectionType);
    const conditionsMet = [];
    if (isPeakSection) {
        conditionsMet.push(`section=${sectionType}∈peak`);
    }
    if (input.hasKick) {
        conditionsMet.push('KICK');
    }
    // V3.3.B: shouldForceStrike is always false — V3 ignite is the authority
    const shouldForceStrike = false;
    // Intensity derived from z-score for routing (not gating)
    const intensity = isPeakSection
        ? Math.min(1.0, Math.max(0, (energyZScore - 1) / 3))
        : 0;
    const alertLevel = determineAlertLevel(energyZScore, cfg);
    const reason = generateReason(isPeakSection, conditionsMet, energyZScore, sectionType, cfg);
    return {
        shouldForceStrike,
        intensity,
        reason,
        alertLevel,
        metrics: {
            zScore: energyZScore,
            section: sectionType,
            energy: rawEnergy,
            threshold: cfg.imminentThreshold,
            conditionsMet,
        },
    };
}
function determineAlertLevel(zScore, cfg) {
    if (zScore >= cfg.imminentThreshold)
        return 'imminent';
    if (zScore >= cfg.watchingThreshold)
        return 'watching';
    return 'none';
}
function generateReason(isPeakSection, conditionsMet, zScore, section, cfg) {
    if (isPeakSection && zScore >= cfg.imminentThreshold) {
        return `Drop Bridge ROUTING: ${conditionsMet.join(' + ')} → Divine/Heavy arsenal eligible`;
    }
    return `Drop Bridge STANDBY: section=${section}, z=${zScore.toFixed(2)}σ`;
}
// ═══════════════════════════════════════════════════════════════════════════
// CLASE WRAPPER
// ═══════════════════════════════════════════════════════════════════════════
export class DropBridge {
    constructor(config = {}) {
        this.consecutiveHighZScores = 0;
        this.HIGH_Z_PERSISTENCE = 3;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    check(input) {
        if (input.energyZScore >= this.config.imminentThreshold) {
            this.consecutiveHighZScores++;
        }
        else {
            this.consecutiveHighZScores = 0;
        }
        return checkDropBridge(input, this.config);
    }
    getConsecutiveHighZScores() {
        return this.consecutiveHighZScores;
    }
    isHighAlert() {
        return this.consecutiveHighZScores >= this.HIGH_Z_PERSISTENCE;
    }
    getTimeSinceLastActivation() {
        return 0;
    }
    reset() {
        this.consecutiveHighZScores = 0;
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════
export function zScoreToProbability(zScore) {
    const absZ = Math.abs(zScore);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1.0 / (1.0 + p * absZ / Math.sqrt(2));
    const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ / 2);
    const cdf = 0.5 * (1 + (zScore >= 0 ? erf : -erf));
    return 1 - cdf;
}
export function describeZScore(zScore) {
    const absZ = Math.abs(zScore);
    if (absZ < 1.0)
        return 'Normal (68%)';
    if (absZ < 1.5)
        return 'Ligeramente inusual';
    if (absZ < 2.0)
        return 'Inusual (5%)';
    if (absZ < 2.5)
        return 'Notable (2.5%)';
    if (absZ < 3.0)
        return 'Muy raro (1%)';
    if (absZ < 3.5)
        return '🔥 EXTREMO (0.3%)';
    return '⚡ ÉPICO (0.05%)';
}
