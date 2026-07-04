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
//  Tier mapping:
//    COMMON     [0.00, 0.30)   shield = 3
//    RARE       [0.30, 0.55)   shield = 6
//    EPIC       [0.55, 0.78)   shield = 10
//    LEGENDARY  [0.78, 0.92)   shield = 15
//    MYTHIC     [0.92, 1.00]   shield = 20
// ═══════════════════════════════════════════════════════════════════════════

import type { MutationOperator, RarityTier } from '../types'

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const DRIFT_MAX = 0.35

const OPERATOR_WEIGHTS: Readonly<Record<MutationOperator, number>> = Object.freeze({
  point_mutation: 0.15,
  hue_drift: 0.15,
  phase_epigenetics: 0.15,
  gene_duplication: 0.50,
  gene_deletion: 0.50,
  temporal_stretch: 0.50,
  crossover: 0.85,
  transposition: 0.85,
  context_drift: 0.65,
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
 */
export function tierFromScore(score: number): RarityTier {
  if (score < 0.30) return 'COMMON'
  if (score < 0.55) return 'RARE'
  if (score < 0.78) return 'EPIC'
  if (score < 0.92) return 'LEGENDARY'
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

  const tier = tierFromScore(score)
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
 * (e.g., first spawn or cold start). Novelty defaults to 0.5 (neutral).
 */
export function computeRaritySimple(
  l2Distance: number,
  operator: MutationOperator,
): RarityOutput {
  return computeRarity({
    l2Distance,
    operator,
    bezierSignature: new Float32Array(128),
    populationSignatures: [],
  })
}

// ─── RE-EXPORT CONSTANTS ────────────────────────────────────────────────────

export { DRIFT_MAX, OPERATOR_WEIGHTS, NEONATAL_SHIELD, RARITY_BONUS }
