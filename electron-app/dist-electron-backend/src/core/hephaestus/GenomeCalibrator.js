/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ GENOME CALIBRATOR — Normative A/C/O anchoring for the cognitive genome
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * P2#6: Provides semantic anchoring for the FrozenGenome cube (A/C/O).
 *
 * The genome is a point in [0,1]³ — aggression, chaos, organicity.
 * Without calibration, these numbers are floating abstractions.
 * This module defines reference anchors that give meaning to the axes:
 *
 * AGGRESSION (A):
 *   0.00 — Ambient wash (minimal movement, static color)
 *   0.25 — Gentle chase (slow cross-fade, soft transitions)
 *   0.50 — Active beam (purposeful movement, clear rhythmic structure)
 *   0.75 — Aggressive strobe (rapid intensity changes, hard cuts)
 *   1.00 — Maximum assault (continuous max strobe, full intensity)
 *
 * CHAOS (C):
 *   0.00 — Deterministic (every fixture identical, perfect symmetry)
 *   0.25 — Organized variation (slight phase offset, predictable spread)
 *   0.50 — Controlled disorder (random zone assignment, moderate phase spread)
 *   0.75 — Wild scatter (large phase offsets, unpredictable fixture behavior)
 *   1.00 — Pure noise (fully randomized, no spatial coherence)
 *
 * ORGANICITY (O):
 *   0.00 — Mechanical (linear ramps, step functions, robotic precision)
 *   0.25 — Subtle life (slight easing, gentle bezier curves)
 *   0.50 — Natural flow (smooth spline interpolation, organic acceleration)
 *   0.75 — Liquid motion (elastic easing, bounce, organic overshoot)
 *   1.00 — Fully organic (breathing-like, irregular natural rhythms)
 *
 * @module core/hephaestus/GenomeCalibrator
 */
/**
 * The canonical reference anchors. These are the "ruler marks" on each axis.
 * Authors can compare their declared genome against these to understand
 * where their effect sits in the semantic space.
 */
export const GENOME_ANCHORS = Object.freeze([
    Object.freeze({
        id: 'ambient-wash',
        label: 'Ambient Wash',
        genome: Object.freeze({ aggression: 0.0, chaos: 0.0, organicity: 0.25 }),
        description: 'Minimal movement, static color, slow fades. The "candle" anchor.',
    }),
    Object.freeze({
        id: 'gentle-chase',
        label: 'Gentle Chase',
        genome: Object.freeze({ aggression: 0.25, chaos: 0.25, organicity: 0.50 }),
        description: 'Slow cross-fade with soft transitions. The "sunrise" anchor.',
    }),
    Object.freeze({
        id: 'active-beam',
        label: 'Active Beam',
        genome: Object.freeze({ aggression: 0.50, chaos: 0.50, organicity: 0.50 }),
        description: 'Purposeful movement with clear rhythmic structure. The "spotlight" anchor.',
    }),
    Object.freeze({
        id: 'aggressive-strobe',
        label: 'Aggressive Strobe',
        genome: Object.freeze({ aggression: 0.75, chaos: 0.60, organicity: 0.15 }),
        description: 'Rapid intensity changes, hard cuts. The "assault" anchor.',
    }),
    Object.freeze({
        id: 'maximum-assault',
        label: 'Maximum Assault',
        genome: Object.freeze({ aggression: 1.0, chaos: 0.75, organicity: 0.0 }),
        description: 'Continuous max strobe, full intensity. The "ceiling" anchor.',
    }),
    Object.freeze({
        id: 'organic-flow',
        label: 'Organic Flow',
        genome: Object.freeze({ aggression: 0.40, chaos: 0.30, organicity: 0.75 }),
        description: 'Smooth spline interpolation, organic acceleration. The "water" anchor.',
    }),
    Object.freeze({
        id: 'pure-noise',
        label: 'Pure Noise',
        genome: Object.freeze({ aggression: 0.60, chaos: 1.0, organicity: 0.50 }),
        description: 'Fully randomized, no spatial coherence. The "chaos ceiling" anchor.',
    }),
    Object.freeze({
        id: 'mechanical-precision',
        label: 'Mechanical Precision',
        genome: Object.freeze({ aggression: 0.50, chaos: 0.0, organicity: 0.0 }),
        description: 'Linear ramps, step functions, robotic precision. The "machine" anchor.',
    }),
]);
/**
 * Axis labels for display and validation.
 */
export const GENOME_AXIS_LABELS = Object.freeze({
    aggression: 'Aggression',
    chaos: 'Chaos',
    organicity: 'Organicity',
});
/**
 * Axis descriptions with tick marks for UI display.
 */
export const GENOME_AXIS_TICKS = Object.freeze({
    aggression: Object.freeze([
        Object.freeze({ value: 0.0, label: 'Ambient' }),
        Object.freeze({ value: 0.25, label: 'Gentle' }),
        Object.freeze({ value: 0.50, label: 'Active' }),
        Object.freeze({ value: 0.75, label: 'Aggressive' }),
        Object.freeze({ value: 1.0, label: 'Maximum' }),
    ]),
    chaos: Object.freeze([
        Object.freeze({ value: 0.0, label: 'Deterministic' }),
        Object.freeze({ value: 0.25, label: 'Organized' }),
        Object.freeze({ value: 0.50, label: 'Disorder' }),
        Object.freeze({ value: 0.75, label: 'Wild' }),
        Object.freeze({ value: 1.0, label: 'Pure Noise' }),
    ]),
    organicity: Object.freeze([
        Object.freeze({ value: 0.0, label: 'Mechanical' }),
        Object.freeze({ value: 0.25, label: 'Subtle' }),
        Object.freeze({ value: 0.50, label: 'Natural' }),
        Object.freeze({ value: 0.75, label: 'Liquid' }),
        Object.freeze({ value: 1.0, label: 'Organic' }),
    ]),
});
/**
 * Validate a genome — all three axes must be in [0, 1].
 * Returns null if valid, or an error message describing the violation.
 */
export function validateGenome(genome) {
    const { aggression, chaos, organicity } = genome;
    if (!Number.isFinite(aggression) || aggression < 0 || aggression > 1)
        return `aggression=${aggression} out of [0,1]`;
    if (!Number.isFinite(chaos) || chaos < 0 || chaos > 1)
        return `chaos=${chaos} out of [0,1]`;
    if (!Number.isFinite(organicity) || organicity < 0 || organicity > 1)
        return `organicity=${organicity} out of [0,1]`;
    return null;
}
/**
 * Find the nearest reference anchor by Euclidean distance in A/C/O space.
 * Useful for UI display ("this effect is closest to 'Active Beam'").
 */
export function nearestAnchor(genome) {
    let best = GENOME_ANCHORS[0];
    let bestDist = Infinity;
    for (const anchor of GENOME_ANCHORS) {
        const da = anchor.genome.aggression - genome.aggression;
        const dc = anchor.genome.chaos - genome.chaos;
        const do_ = anchor.genome.organicity - genome.organicity;
        const dist = da * da + dc * dc + do_ * do_;
        if (dist < bestDist) {
            bestDist = dist;
            best = anchor;
        }
    }
    return best;
}
/**
 * Describe a genome position in human-readable terms using the axis ticks.
 * Returns a string like "Active / Disorder / Natural".
 */
export function describeGenome(genome) {
    const tick = (ticks, v) => {
        let best = ticks[0];
        let bestDist = Infinity;
        for (const t of ticks) {
            const d = Math.abs(t.value - v);
            if (d < bestDist) {
                bestDist = d;
                best = t;
            }
        }
        return best.label;
    };
    const a = tick(GENOME_AXIS_TICKS.aggression, genome.aggression);
    const c = tick(GENOME_AXIS_TICKS.chaos, genome.chaos);
    const o = tick(GENOME_AXIS_TICKS.organicity, genome.organicity);
    return `${a} / ${c} / ${o}`;
}
