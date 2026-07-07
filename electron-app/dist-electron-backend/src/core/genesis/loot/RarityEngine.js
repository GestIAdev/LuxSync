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
//  Tier mapping (WAVE 6000.V7 recalibrated for DRIFT_MAX=0.55):
//    COMMON     [0.00, 0.25)   shield = 3
//    RARE       [0.25, 0.48)   shield = 6
//    EPIC       [0.48, 0.70)   shield = 10
//    LEGENDARY  [0.70, 0.88)   shield = 15
//    MYTHIC     [0.88, 1.00]   shield = 20
// ═══════════════════════════════════════════════════════════════════════════
// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const DRIFT_MAX = 0.55;
// WAVE 6000.V4: L2 distance below this threshold forces COMMON tier,
// regardless of novelty score. Prevents rarity inflation from minor mutations.
const COMMON_FORCE_L2_THRESHOLD = 0.08;
const OPERATOR_WEIGHTS = Object.freeze({
    point_mutation: 0.15,
    hue_drift: 0.15,
    phase_epigenetics: 0.20,
    gene_duplication: 0.50,
    gene_deletion: 0.55,
    gene_splice: 0.60,
    temporal_stretch: 0.35,
    interpolation_drift: 0.25,
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
    if (score < 0.25)
        return 'COMMON';
    if (score < 0.48)
        return 'RARE';
    if (score < 0.70)
        return 'EPIC';
    if (score < 0.88)
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
    // WAVE 6000.V4: Deflation — minor mutations (L2 < 0.08) are always COMMON,
    // regardless of novelty. RARE+ reserved for meaningful structural divergence.
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
 * (e.g., first spawn or cold start). Novelty defaults to 0.5 (neutral).
 */
export function computeRaritySimple(l2Distance, operator) {
    return computeRarity({
        l2Distance,
        operator,
        bezierSignature: new Float32Array(128),
        populationSignatures: [],
    });
}
// ─── RE-EXPORT CONSTANTS ────────────────────────────────────────────────────
export { DRIFT_MAX, OPERATOR_WEIGHTS, NEONATAL_SHIELD, RARITY_BONUS };
