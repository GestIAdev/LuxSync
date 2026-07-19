// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA III: RarityEngine (Loot System)
// ═══════════════════════════════════════════════════════════════════════════
//  Pure functions that compute the rarity of a newborn organism.
//
//  ρ(m) = σ_norm(m) · 0.50  +  novelty(m) · 0.30  +  operator_weight(m) · 0.20
//
//  σ_norm     = clamp01(l2_distance / DRIFT_MAX)
//  novelty    = 1 − max_cosine_similarity(signature, all_alive)  [0 if no population]
//  operator_w = per-operator weight table
//
//  Tier mapping (WAVE 7166 V3 RE-SCALE — V3 L2 max ~0.34):
//    COMMON     [0.00, 0.12)   shield = 3
//    RARE       [0.12, 0.20)   shield = 6
//    EPIC       [0.20, 0.28)   shield = 10
//    LEGENDARY  [0.28, 0.33)   shield = 15
//    MYTHIC     [0.33, 1.00]   shield = 20
// ═══════════════════════════════════════════════════════════════════════════
// ─── CONSTANTS ──────────────────────────────────────────────────────────────
// WAVE 7166: Lowered from 0.55 → 0.40 — V3 L2 distances are compressed
// because D_structural weight is only 0.05 and mutations are surgical.
const DRIFT_MAX = 0.40;
// WAVE 7166: Lowered from 0.18 → 0.08 — trivial mutations stay COMMON.
const COMMON_FORCE_L2_THRESHOLD = 0.08;
const OPERATOR_WEIGHTS = Object.freeze({
    focal_mutation: 0.15,
    hue_drift: 0.15,
    spatial_resonance: 0.20,
    gene_augmentation: 0.50,
    adaptive_pruning: 0.55,
    macro_splice: 0.60,
    proportional_stretch: 0.35,
    curve_adaptation: 0.25,
    crossover: 0.85,
    transposition: 0.85,
    context_drift: 0.65,
});
const NEONATAL_SHIELD = Object.freeze({
    COMMON: 3,
    RARE: 6,
    EPIC: 10,
    LEGENDARY: 15,
    MYTHIC: 20,
});
const RARITY_BONUS = Object.freeze({
    COMMON: 1.0,
    RARE: 1.1,
    EPIC: 1.25,
    LEGENDARY: 1.4,
    MYTHIC: 1.5,
});
// ─── HELPERS ────────────────────────────────────────────────────────────────
function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}
/**
 * Cosine similarity between two equal-length Float32Array vectors.
 * Returns 0 if either vector is all zeros.
 */
function cosineSimilarity(a, b) {
    const len = Math.min(a.length, b.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < len; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0)
        return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
/**
 * Computes novelty = 1 − max_cosine_similarity(signature, population).
 * If population is empty, novelty = 1 (maximally novel).
 */
function computeNovelty(signature, population) {
    if (population.length === 0)
        return 1.0;
    let maxSim = -1;
    for (const other of population) {
        const sim = cosineSimilarity(signature, other);
        if (sim > maxSim)
            maxSim = sim;
    }
    return clamp01(1 - Math.max(0, maxSim));
}
/**
 * Maps a raw ρ score [0,1] to a RarityTier.
 */
export function tierFromScore(score) {
    // WAVE 7166: Re-scaled for V3 L2 distribution (max ~0.34)
    if (score < 0.12)
        return 'COMMON';
    if (score < 0.20)
        return 'RARE';
    if (score < 0.28)
        return 'EPIC';
    if (score < 0.33)
        return 'LEGENDARY';
    return 'MYTHIC';
}
// ─── MAIN EXPORT ────────────────────────────────────────────────────────────
/**
 * Computes the full rarity profile for a newborn organism.
 *
 * ρ(m) = σ_norm · 0.50 + novelty · 0.30 + operator_weight · 0.20
 *
 * @param input L2 distance, operator, bezier signature, and population signatures
 * @returns RarityOutput with score, tier, neonatal shield, and bonus
 */
export function computeRarity(input) {
    const sigmaNorm = clamp01(input.l2Distance / DRIFT_MAX);
    const novelty = computeNovelty(input.bezierSignature, input.populationSignatures);
    const operatorWeight = OPERATOR_WEIGHTS[input.operator] ?? 0.15;
    const score = clamp01(sigmaNorm * 0.50 + novelty * 0.30 + operatorWeight * 0.20);
    // WAVE 6000.V8.1: Lowered force-common threshold from 0.25 to 0.18.
    // Minor mutations (L2 < 0.18) are always COMMON. RARE+ achievable via
    // curve/phase mutations without requiring structural destruction.
    const tier = input.l2Distance < COMMON_FORCE_L2_THRESHOLD
        ? 'COMMON'
        : tierFromScore(score);
    const neonatalShield = NEONATAL_SHIELD[tier];
    const rarityBonus = RARITY_BONUS[tier];
    return {
        score,
        tier,
        neonatalShield,
        rarityBonus,
        components: { sigmaNorm, novelty, operatorWeight },
    };
}
/**
 * Simplified rarity computation when population signatures are not available
 * (e.g., first spawn or cold start). Novelty defaults to 0.10 (unproven).
 * WAVE 6000.V8: Reduced from 0.5 to 0.10 — unproven novelty must not be rewarded.
 */
export function computeRaritySimple(l2Distance, operator) {
    const sigmaNorm = clamp01(l2Distance / DRIFT_MAX);
    const novelty = 0.10;
    const operatorWeight = OPERATOR_WEIGHTS[operator] ?? 0.15;
    const score = clamp01(sigmaNorm * 0.50 + novelty * 0.30 + operatorWeight * 0.20);
    const tier = l2Distance < COMMON_FORCE_L2_THRESHOLD
        ? 'COMMON'
        : tierFromScore(score);
    const neonatalShield = NEONATAL_SHIELD[tier];
    const rarityBonus = RARITY_BONUS[tier];
    return {
        score,
        tier,
        neonatalShield,
        rarityBonus,
        components: { sigmaNorm, novelty, operatorWeight },
    };
}
// ─── RE-EXPORT CONSTANTS ────────────────────────────────────────────────────
export { DRIFT_MAX, OPERATOR_WEIGHTS, NEONATAL_SHIELD, RARITY_BONUS };
