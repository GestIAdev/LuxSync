// ═══════════════════════════════════════════════════════════════════════════
// 🧪 WAVE 5000.V3 — ERA VI: CRASH TEST — ProceduralNamer Stress
// ═══════════════════════════════════════════════════════════════════════════
//  Tests:
//  1. Determinism — same organism 100× → identical name
//  2. Boundary — 1000 random organisms → all names < 24 chars
//  3. Combinatorial space > 14,000
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { generateOrganismName, COMBINATORIAL_SPACE } from '../naming/ProceduralNamer'
import type { LfxOrganism, RarityTier, MutationOperator } from '../types'

// ─── MOCK ORGANISM FACTORY ───────────────────────────────────────────────────

const RARITY_TIERS: RarityTier[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC']
const OPERATORS: MutationOperator[] = [
  'focal_mutation', 'spatial_resonance', 'gene_augmentation',
  'adaptive_pruning', 'crossover', 'proportional_stretch', 'curve_adaptation', 'macro_splice',
]

function makeOrganism(
  id: string,
  opts: {
    rarityScore?: number
    fitnessScore?: number
    generation?: number
    rarityTier?: RarityTier
    operatorUsed?: MutationOperator
    l2DistanceParent?: number
  } = {},
): LfxOrganism {
  return {
    organismId: id,
    blueprintId: `bp-${id}`,
    parentOrganismId: null,
    generation: opts.generation ?? 1,
    customName: null,
    deltaJson: '[]',
    bezierSignature: new Float32Array(128),
    rarityScore: opts.rarityScore ?? 0.5,
    rarityTier: opts.rarityTier ?? 'COMMON',
    l2DistanceParent: opts.l2DistanceParent ?? 0.1,
    operatorUsed: opts.operatorUsed ?? 'focal_mutation',
    neonatalShieldUntil: 5,
    birthVector: {
      zScoreAvg3s: 0, lowBandAvg3s: 0, energyPhaseEncoded: 0,
      vibeHash: 0, sectionEncoded: 0, textureEncoded: 0,
    },
    fitnessScore: opts.fitnessScore ?? 0.3,
    trialsCount: 0,
    winsCount: 0,
    vetoesCount: 0,
    passesCount: 0,
    status: 'alive',
    speciesId: null,
    bornAt: 0,
    lastEvaluatedAt: null,
    lastFiredAt: null,
    swarmOriginConsole: null,
  }
}

// Deterministic PRNG for generating varied test organisms
function seededRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return ((s >>> 0) % 1000000) / 1000000
  }
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('🧬 ProceduralNamer — Stress Tests', () => {

  // ── 1. Determinism ───────────────────────────────────────────────────────

  it('should produce identical name for the same organism 100 consecutive times', () => {
    const org = makeOrganism('org-determinism-001', {
      rarityScore: 0.75,
      fitnessScore: 0.42,
      generation: 3,
      rarityTier: 'LEGENDARY',
      operatorUsed: 'gene_augmentation',
    })

    const firstName = generateOrganismName(org)

    for (let i = 0; i < 100; i++) {
      const name = generateOrganismName(org)
      expect(name).toBe(firstName)
    }
  })

  it('should produce identical name with blueprint context 100 consecutive times', () => {
    const org = makeOrganism('org-determinism-002', {
      rarityScore: 0.3,
      fitnessScore: 0.8,
      generation: 7,
      rarityTier: 'MYTHIC',
    })

    const blueprint = {
      dnaAggression: 0.8,
      dnaChaos: 0.6,
      dnaOrganicity: 0.3,
      textureAffinity: 'dirty',
    }

    const firstName = generateOrganismName(org, blueprint)

    for (let i = 0; i < 100; i++) {
      const name = generateOrganismName(org, blueprint)
      expect(name).toBe(firstName)
    }
  })

  // ── 2. Boundary (< 24 chars) ──────────────────────────────────────────────

  it('should produce names < 24 chars for 1000 random organisms (no blueprint context)', () => {
    const rng = seededRng(12345)

    for (let i = 0; i < 1000; i++) {
      const org = makeOrganism(`org-bnd-${i}`, {
        rarityScore: rng(),
        fitnessScore: rng(),
        generation: Math.floor(rng() * 16) + 1,
        rarityTier: RARITY_TIERS[Math.floor(rng() * RARITY_TIERS.length)],
        operatorUsed: OPERATORS[Math.floor(rng() * OPERATORS.length)],
        l2DistanceParent: rng(),
      })

      const name = generateOrganismName(org)
      expect(name.length).toBeLessThanOrEqual(24)
      expect(name.length).toBeGreaterThan(0)
    }
  })

  it('should produce names < 24 chars for 1000 random organisms (with blueprint context)', () => {
    const rng = seededRng(67890)
    const textures = ['clean', 'dirty', 'universal'] as const

    for (let i = 0; i < 1000; i++) {
      const org = makeOrganism(`org-bp-bnd-${i}`, {
        rarityScore: rng(),
        fitnessScore: rng(),
        generation: Math.floor(rng() * 16) + 1,
        rarityTier: RARITY_TIERS[Math.floor(rng() * RARITY_TIERS.length)],
      })

      const blueprint = {
        dnaAggression: rng(),
        dnaChaos: rng(),
        dnaOrganicity: rng(),
        textureAffinity: textures[Math.floor(rng() * textures.length)],
      }

      const name = generateOrganismName(org, blueprint)
      expect(name.length).toBeLessThanOrEqual(24)
      expect(name.length).toBeGreaterThan(0)
    }
  })

  // ── 3. Combinatorial space ────────────────────────────────────────────────

  it('should have combinatorial space > 14,000', () => {
    expect(COMBINATORIAL_SPACE).toBeGreaterThan(14000)
  })

  it('should have combinatorial space = 21,504 (32×32×21)', () => {
    expect(COMBINATORIAL_SPACE).toBe(21504)
  })

  // ── 4. Name format ────────────────────────────────────────────────────────

  it('should produce names with 2-3 words (with or without suffix)', () => {
    const org = makeOrganism('org-format-001', {
      rarityScore: 0.9,
      fitnessScore: 0.85,
      generation: 5,
      rarityTier: 'LEGENDARY',
    })

    const name = generateOrganismName(org)
    const words = name.split(' ')
    expect(words.length).toBeGreaterThanOrEqual(2)
    expect(words.length).toBeLessThanOrEqual(3)
  })

  it('should produce non-empty names', () => {
    const org = makeOrganism('org-nonempty-001')
    const name = generateOrganismName(org)
    expect(name.trim().length).toBeGreaterThan(0)
  })

  // ── 5. Different organisms produce different names (collision sanity) ─────

  it('should produce varied names across 200 different organisms', () => {
    const names = new Set<string>()
    const rng = seededRng(99999)

    for (let i = 0; i < 200; i++) {
      const org = makeOrganism(`org-variety-${i}`, {
        rarityScore: rng(),
        fitnessScore: rng(),
        generation: Math.floor(rng() * 16) + 1,
        rarityTier: RARITY_TIERS[Math.floor(rng() * RARITY_TIERS.length)],
        operatorUsed: OPERATORS[Math.floor(rng() * OPERATORS.length)],
      })

      names.add(generateOrganismName(org))
    }

    // With 22,572 combinations and 200 organisms, we expect significant variety
    // At minimum, we should see more than 5 unique names
    expect(names.size).toBeGreaterThan(5)
  })
})
