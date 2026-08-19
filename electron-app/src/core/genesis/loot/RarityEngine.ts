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
//  🔬 WAVE 7540: FULL-SPECTRUM TIER REBALANCE.
//  The old thresholds (COMMON<0.18, MYTHIC≥0.40) compressed 60% of the
//  theoretical [0,1] range into MYTHIC, producing a bimodal distribution
//  (only COMMON and MYTHIC). High-weight operators like crossover (0.85)
//  mathematically bypassed RARE/EPIC/LEGENDARY because:
//    0.30·novelty + 0.20·0.85 = 0.47 > 0.40 → MYTHIC with ANY σ_norm > 0.
//
//  New thresholds stretch across the full [0,1] spectrum so every tier has
//  a meaningful probability mass. With DRIFT_MAX=0.70, σ_norm grows more
//  gradually, and the operator_weight floor (0.47 for crossover) now lands
//  in EPIC [0.45, 0.65) instead of MYTHIC — requiring genuine L2 divergence
//  + novelty to reach MYTHIC.
//
//  Tier mapping (WAVE 7540 — FULL-SPECTRUM):
//    COMMON     [0.00, 0.30)   shield = 3
//    RARE       [0.30, 0.45)   shield = 6
//    EPIC       [0.45, 0.65)   shield = 10
//    LEGENDARY  [0.65, 0.85)   shield = 15
//    MYTHIC     [0.85, 1.00]   shield = 20
// ═══════════════════════════════════════════════════════════════════════════

import type { MutationOperator, RarityTier } from '../types'

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

// 🔬 WAVE 7540: Raised from 0.40 → 0.70.
// The L2 metric now includes D_temporal (15%) and D_interp (10%) components
// (WAVE 7530), making typical L2 distances significantly higher than when
// only D_curve + D_phase dominated. A DRIFT_MAX of 0.40 was normalizing
// σ_norm to 1.0 too quickly (L2=0.40 → σ_norm=1.0), compressing the entire
// dynamic range into the top of the scale. With 0.70, σ_norm grows more
// gradually, giving the tier thresholds room to breathe.
const DRIFT_MAX = 0.70

// 🔬 WAVE 7540: Lowered from 0.12 → 0.10.
// Only true micro-mutations (L2 < 0.10) are force-clamped to COMMON.
// The old 0.12 threshold was capturing mutations that, with the new
// DRIFT_MAX=0.70, would produce σ_norm=0.17 — a legitimate RARE candidate.
const COMMON_FORCE_L2_THRESHOLD = 0.10

const OPERATOR_WEIGHTS: Readonly<Record<MutationOperator, number>> = Object.freeze({
  focal_mutation: 0.15,
  spatial_resonance: 0.20,
  gene_augmentation: 0.50,
  adaptive_pruning: 0.55,
  macro_splice: 0.60,
  proportional_stretch: 0.35,
  curve_adaptation: 0.25,
  crossover: 0.85,
  color_hue_shift: 0.30,
})

const NEONATAL_SHIELD: Readonly<Record<RarityTier, number>> = Object.freeze({
  COMMON: 3,
  RARE: 6,
  EPIC: 10,
  LEGENDARY: 15,
  MYTHIC: 20,
})

const RARITY_BONUS: Readonly<Record<RarityTier, number>> = Object.freeze({
  COMMON: 1.0,
  RARE: 1.1,
  EPIC: 1.25,
  LEGENDARY: 1.4,
  MYTHIC: 1.5,
})

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface RarityInput {
  l2Distance: number
  operator: MutationOperator
  bezierSignature: Float32Array
  populationSignatures: readonly Float32Array[]
}

export interface RarityOutput {
  score: number
  tier: RarityTier
  neonatalShield: number
  rarityBonus: number
  components: {
    sigmaNorm: number
    novelty: number
    operatorWeight: number
  }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/**
 * Cosine similarity between two equal-length Float32Array vectors.
 * Returns 0 if either vector is all zeros.
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length)
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Computes novelty = 1 − max_cosine_similarity(signature, population).
 * If population is empty, novelty = 1 (maximally novel).
 */
function computeNovelty(
  signature: Float32Array,
  population: readonly Float32Array[],
): number {
  if (population.length === 0) return 1.0
  let maxSim = -1
  for (const other of population) {
    const sim = cosineSimilarity(signature, other)
    if (sim > maxSim) maxSim = sim
  }
  return clamp01(1 - Math.max(0, maxSim))
}

/**
 * Maps a raw ρ score [0,1] to a RarityTier.
 *
 * 🔬 WAVE 7540: FULL-SPECTRUM REBALANCE.
 *
 * The old thresholds (WAVE 7528) compressed 60% of the [0,1] range into
 * MYTHIC [0.40, 1.00], causing a bimodal distribution where only COMMON
 * (via force-gate) and MYTHIC (via high operator_weight) were reachable.
 *
 * New thresholds stretch across the full spectrum so every tier has
 * meaningful probability mass:
 *   COMMON     [0.00, 0.30)   — minor mutations, low novelty, low-weight ops
 *   RARE       [0.30, 0.45)   — moderate mutations with some novelty
 *   EPIC       [0.45, 0.65)   — significant structural changes + good novelty
 *   LEGENDARY  [0.65, 0.85)   — rare, highly novel organisms from heavy ops
 *   MYTHIC     [0.85, 1.00]   — extreme divergence + max novelty + heavy op
 *
 * With these thresholds, crossover (op_w=0.85) + novelty=1.0 gives:
 *   ρ = 0.50·σ_norm + 0.30 + 0.17 = 0.50·σ_norm + 0.47
 *   σ_norm=0.00 → ρ=0.47 (EPIC, not MYTHIC)
 *   σ_norm=0.36 → ρ=0.65 (LEGENDARY)
 *   σ_norm=0.76 → ρ=0.85 (MYTHIC — requires L2 ≈ 0.53, real divergence)
 */
export function tierFromScore(score: number): RarityTier {
  // WAVE 7540: Full-spectrum thresholds
  if (score < 0.30) return 'COMMON'
  if (score < 0.45) return 'RARE'
  if (score < 0.65) return 'EPIC'
  if (score < 0.85) return 'LEGENDARY'
  return 'MYTHIC'
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
export function computeRarity(input: RarityInput): RarityOutput {
  const sigmaNorm = clamp01(input.l2Distance / DRIFT_MAX)
  const novelty = computeNovelty(input.bezierSignature, input.populationSignatures)
  const operatorWeight = OPERATOR_WEIGHTS[input.operator] ?? 0.15

  const score = clamp01(
    sigmaNorm * 0.50 + novelty * 0.30 + operatorWeight * 0.20,
  )

  // WAVE 6000.V8.1: Lowered force-common threshold from 0.25 to 0.18.
  // Minor mutations (L2 < 0.18) are always COMMON. RARE+ achievable via
  // curve/phase mutations without requiring structural destruction.
  const tier: RarityTier = input.l2Distance < COMMON_FORCE_L2_THRESHOLD
    ? 'COMMON'
    : tierFromScore(score)
  const neonatalShield = NEONATAL_SHIELD[tier]
  const rarityBonus = RARITY_BONUS[tier]

  return {
    score,
    tier,
    neonatalShield,
    rarityBonus,
    components: { sigmaNorm, novelty, operatorWeight },
  }
}

/**
 * Simplified rarity computation when population signatures are not available
 * (e.g., first spawn or cold start). Novelty defaults to 0.10 (unproven).
 * WAVE 6000.V8: Reduced from 0.5 to 0.10 — unproven novelty must not be rewarded.
 */
export function computeRaritySimple(
  l2Distance: number,
  operator: MutationOperator,
): RarityOutput {
  const sigmaNorm = clamp01(l2Distance / DRIFT_MAX)
  const novelty = 0.10
  const operatorWeight = OPERATOR_WEIGHTS[operator] ?? 0.15

  const score = clamp01(
    sigmaNorm * 0.50 + novelty * 0.30 + operatorWeight * 0.20,
  )

  const tier: RarityTier = l2Distance < COMMON_FORCE_L2_THRESHOLD
    ? 'COMMON'
    : tierFromScore(score)
  const neonatalShield = NEONATAL_SHIELD[tier]
  const rarityBonus = RARITY_BONUS[tier]

  return {
    score,
    tier,
    neonatalShield,
    rarityBonus,
    components: { sigmaNorm, novelty, operatorWeight },
  }
}

// ─── RE-EXPORT CONSTANTS ────────────────────────────────────────────────────

export { DRIFT_MAX, OPERATOR_WEIGHTS, NEONATAL_SHIELD, RARITY_BONUS }
