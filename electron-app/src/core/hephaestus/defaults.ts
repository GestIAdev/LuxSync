/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEFAULT CONSTANTS — Single source of truth for Hephaestus V3 defaults.
 * Consumed by: useHephaestusEditorStore, DnaRail, NewClipModal.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { CognitiveDNA, SimulationMeta } from '../arsenal/lfxTypes'

export const DEFAULT_COGNITIVE_DNA: Readonly<CognitiveDNA> = Object.freeze({
  archetype: 'utility',
  genome: { aggression: 0.5, chaos: 0.5, organicity: 0.5 },
  textureAffinity: 'universal',
  compatibleVibes: [],
  validSections: [],
  energyZone: { min: 'ambient', max: 'peak' } as { min: 'ambient'; max: 'peak' },
  aggressionRange: { min: 0, max: 1 },
  pressureRange: { min: 0, max: 0 },
  spatialBehavior: 'absolute',
  ikCompatibility: undefined,
})

export const DEFAULT_SIMULATION_META: Readonly<SimulationMeta> = Object.freeze({
  beautyWeights: { base: 0.5, energyMultiplier: 1.0, vibeBonus: 0.0 },
  gpuCost: 0.3,
  fatigueImpact: 0.06,
  minDurationMs: 1000,
  cooldownMs: 7000,
  isStrobe: false,
  isDivineCandidate: false,
  isHeavyCandidate: false,
  zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: null },
})
