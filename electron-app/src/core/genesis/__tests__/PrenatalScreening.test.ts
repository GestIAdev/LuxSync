// ═══════════════════════════════════════════════════════════════════════════
// 🧪 WAVE 5000.V3 — ERA VI: CRASH TEST — Prenatal Screening Gates
// ═══════════════════════════════════════════════════════════════════════════
//  Tests:
//  1. G3 fail — genome aggression=1.5 (out of [0,1])
//  2. G4 fail — 3+ energy zones selected (max 2 allowed)
//  3. G5 fail — empty curves (no tracks with ≥2 keyframes)
//  4. All-pass case — valid clip returns viable: true
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { prenatalScreening } from '../screening/PrenatalScreening'
import type { HephAutomationClipV3, HephTrack } from '../../hephaestus/types'
import type { CognitiveDNA, SimulationMeta } from '../../arsenal/lfxTypes'

// ─── MOCK CLIP FACTORY ───────────────────────────────────────────────────────

function makeValidDNA(): CognitiveDNA {
  return {
    genome: { aggression: 0.5, chaos: 0.3, organicity: 0.7 },
    textureAffinity: 'universal',
    compatibleVibes: ['techno-club'],
    validSections: ['drop'],
    energyZone: { min: 'ambient', max: 'gentle' },
    aggressionRange: { min: 0.3, max: 0.8 },
    spatialBehavior: 'static',
  }
}

function makeValidSim(): SimulationMeta {
  return {
    beautyWeights: { base: 0.5, energyMultiplier: 1.0, vibeBonus: 0.3 },
    gpuCost: 0.2,
    fatigueImpact: 0.1,
    minDurationMs: 1000,
    cooldownMs: 5000,
    isStrobe: false,
    isDivineCandidate: false,
    isHeavyCandidate: false,
    zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: null },
  }
}

function makeValidTrack(): HephTrack {
  return {
    id: 'track-1',
    paramId: 'intensity',
    zones: ['all'],
    curve: {
      paramId: 'intensity',
      valueType: 'number',
      range: [0, 1],
      defaultValue: 0,
      keyframes: [
        { timeMs: 0, value: 0.5, interpolation: 'linear' },
        { timeMs: 1000, value: 0.9, interpolation: 'linear' },
      ],
      mode: 'absolute',
    },
  }
}

function makeClip(overrides: {
  dna?: CognitiveDNA
  sim?: SimulationMeta
  tracks?: HephTrack[]
  id?: string
  name?: string
  durationMs?: number
} = {}): HephAutomationClipV3 {
  return {
    id: overrides.id ?? 'clip-screen-001',
    name: overrides.name ?? 'Screening Test',
    author: 'vitest',
    category: 'composite',
    tags: [],
    vibeCompat: ['techno-club'],
    spatialZones: ['all'],
    mixBus: 'global',
    priority: 5,
    durationMs: overrides.durationMs ?? 2000,
    effectType: 'chase',
    tracks: overrides.tracks ?? [makeValidTrack()],
    staticParams: {},
    cognitiveDNA: overrides.dna ?? makeValidDNA(),
    simulationMeta: overrides.sim ?? makeValidSim(),
    schemaVersion: '3.0',
  }
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('🧬 PrenatalScreening — Lethal Gate Failures', () => {

  // ── G3: Genome range [0,1] ───────────────────────────────────────────────

  it('G3: should return viable=false when aggression=1.5 (out of [0,1])', () => {
    const dna = makeValidDNA()
    // Override aggression to out-of-range value
    ;(dna as any).genome = { aggression: 1.5, chaos: 0.3, organicity: 0.7 }

    const clip = makeClip({ dna })
    const result = prenatalScreening(clip)

    expect(result.viable).toBe(false)
    expect(result.abortReason).toContain('G3')
  })

  it('G3: should return viable=false when chaos=-0.2 (out of [0,1])', () => {
    const dna = makeValidDNA()
    ;(dna as any).genome = { aggression: 0.5, chaos: -0.2, organicity: 0.7 }

    const clip = makeClip({ dna })
    const result = prenatalScreening(clip)

    expect(result.viable).toBe(false)
    expect(result.abortReason).toContain('G3')
  })

  // ── G4: Energy zone span > 2 ─────────────────────────────────────────────

  it('G4: should return viable=false when 3+ energy zones span', () => {
    const dna = makeValidDNA()
    // silence → peak = 5 zones (way over the 2-zone max)
    ;(dna as any).energyZone = { min: 'silence', max: 'peak' }

    const clip = makeClip({ dna })
    const result = prenatalScreening(clip)

    expect(result.viable).toBe(false)
    expect(result.abortReason).toContain('G4')
  })

  it('G4: should return viable=false when 0 energy zones selected', () => {
    const dna = makeValidDNA()
    // Invalid zone names → zoneSpan=0
    ;(dna as any).energyZone = { min: 'invalid_zone', max: 'another_invalid' }

    const clip = makeClip({ dna })
    const result = prenatalScreening(clip)

    expect(result.viable).toBe(false)
    expect(result.abortReason).toContain('G4')
  })

  // ── G5: Empty curves ─────────────────────────────────────────────────────

  it('G5: should return viable=false when tracks array is empty', () => {
    const clip = makeClip({ tracks: [] })
    const result = prenatalScreening(clip)

    expect(result.viable).toBe(false)
    expect(result.abortReason).toContain('G5')
  })

  it('G5: should return viable=false when all tracks have <2 keyframes', () => {
    const thinTrack: HephTrack = {
      id: 'thin',
      paramId: 'intensity',
      zones: ['all'],
      curve: {
        paramId: 'intensity',
        valueType: 'number',
        range: [0, 1],
        defaultValue: 0,
        keyframes: [{ timeMs: 0, value: 0.5, interpolation: 'linear' }],
        mode: 'absolute',
      },
    }

    const clip = makeClip({ tracks: [thinTrack] })
    const result = prenatalScreening(clip)

    expect(result.viable).toBe(false)
    expect(result.abortReason).toContain('G5')
  })

  // ── All-pass case ─────────────────────────────────────────────────────────

  it('should return viable=true for a fully valid clip', () => {
    const clip = makeClip()
    const result = prenatalScreening(clip)

    expect(result.viable).toBe(true)
    expect(result.abortReason).toBe(null)
    expect(result.gates).toHaveLength(7)
  })

  // ── G1: Structure ─────────────────────────────────────────────────────────

  it('G1: should return viable=false when id is empty', () => {
    const clip = makeClip({ id: '  ' })
    const result = prenatalScreening(clip)

    expect(result.viable).toBe(false)
    expect(result.abortReason).toContain('G1')
  })

  it('G1: should return viable=false when durationMs=0', () => {
    const clip = makeClip({ durationMs: 0 })
    const result = prenatalScreening(clip)

    expect(result.viable).toBe(false)
    expect(result.abortReason).toContain('G1')
  })
})
