// ═══════════════════════════════════════════════════════════════════════════
// 🧪 WAVE 5000.V3 — ERA VI: CRASH TEST — Genetic Operators Robustness
// ═══════════════════════════════════════════════════════════════════════════
//  Tests:
//  1. focalMutation — produces valid delta, clones correctly, original untouched
//  2. geneAugmentation — injects missing track, delta valid, original untouched
//  3. applyDelta — round-trip: applying delta to parent produces same child
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  focalMutation,
  geneAugmentation,
  applyDelta,
  type JsonPatchOp,
} from '../operators/GeneticOperators'
import type { HephAutomationClipV3, HephTrack, HephKeyframe } from '../../hephaestus/types'
import type { CognitiveDNA, SimulationMeta } from '../../arsenal/lfxTypes'

// ─── MOCK CLIP FACTORY ───────────────────────────────────────────────────────

function makeMockClip(): HephAutomationClipV3 {
  const keyframes: HephKeyframe[] = [
    { timeMs: 0, value: 0.5, interpolation: 'bezier', bezierHandles: [0.42, 0, 0.58, 1] },
    { timeMs: 500, value: 0.8, interpolation: 'bezier', bezierHandles: [0.42, 0, 0.58, 1] },
    { timeMs: 1000, value: 0.3, interpolation: 'bezier', bezierHandles: [0.42, 0, 0.58, 1] },
    { timeMs: 1500, value: 0.9, interpolation: 'bezier', bezierHandles: [0.42, 0, 0.58, 1] },
  ]

  const track1: HephTrack = {
    id: 'track-intensity-001',
    paramId: 'intensity',
    zones: ['all'],
    curve: {
      paramId: 'intensity',
      valueType: 'number',
      range: [0, 1],
      defaultValue: 0,
      keyframes,
      mode: 'absolute',
    },
  }

  const track2: HephTrack = {
    id: 'track-color-001',
    paramId: 'color',
    zones: ['front'],
    curve: {
      paramId: 'color',
      valueType: 'color',
      range: [0, 360],
      defaultValue: { h: 0, s: 100, l: 50 },
      keyframes: [
        { timeMs: 0, value: { h: 0, s: 100, l: 50 }, interpolation: 'linear' },
        { timeMs: 1000, value: { h: 180, s: 100, l: 50 }, interpolation: 'linear' },
      ],
      mode: 'absolute',
    },
  }

  const dna: CognitiveDNA = {
    genome: { aggression: 0.6, chaos: 0.4, organicity: 0.5 },
    textureAffinity: 'universal',
    compatibleVibes: ['techno-club'],
    validSections: ['drop', 'verse'],
    energyZone: { min: 'ambient', max: 'peak' },
    aggressionRange: { min: 0.3, max: 0.8 },
    pressureRange: { min: 0.2, max: 0.9 },
    spatialBehavior: 'static',
  }

  const sim: SimulationMeta = {
    beautyWeights: { base: 0.5, energyMultiplier: 1.2, vibeBonus: 0.3 },
    gpuCost: 0.2,
    fatigueImpact: 0.1,
    minDurationMs: 1000,
    cooldownMs: 5000,
    isStrobe: false,
    isDivineCandidate: false,
    isHeavyCandidate: false,
    zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: null },
  }

  return {
    id: 'clip-test-001',
    name: 'Test Clip',
    author: 'vitest',
    category: 'composite',
    tags: ['test'],
    vibeCompat: ['techno-club'],
    spatialZones: ['all', 'front'],
    mixBus: 'global',
    priority: 5,
    durationMs: 2000,
    effectType: 'chase',
    tracks: [track1, track2],
    staticParams: { speed: 1.0 },
    cognitiveDNA: dna,
    simulationMeta: sim,
    schemaVersion: '3.0',
  }
}

// ─── DEEP EQUALITY HELPER ────────────────────────────────────────────────────

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('🧬 GeneticOperators — Delta Robustness', () => {
  // ── 1. focalMutation ──────────────────────────────────────────────────────

  describe('focalMutation', () => {
    it('should produce a valid delta with at least one replace op', () => {
      const parent = makeMockClip()
      const result = focalMutation(parent, 42)

      expect(result.operator).toBe('focal_mutation')
      expect(result.delta.length).toBeGreaterThanOrEqual(1)
      expect(result.delta.every((op) => op.op === 'replace' || op.op === 'add' || op.op === 'remove')).toBe(true)
    })

    it('should NOT mutate the original clip by reference', () => {
      const parent = makeMockClip()
      const parentSnapshot = JSON.stringify(parent)
      focalMutation(parent, 42)

      expect(JSON.stringify(parent)).toBe(parentSnapshot)
    })

    it('should produce a child that differs from parent', () => {
      const parent = makeMockClip()
      const result = focalMutation(parent, 42)

      expect(deepEqual(result.clip, parent)).toBe(false)
    })

    it('should be deterministic with same seed', () => {
      const parent = makeMockClip()
      const r1 = focalMutation(parent, 123)
      const r2 = focalMutation(parent, 123)

      expect(JSON.stringify(r1.clip)).toBe(JSON.stringify(r2.clip))
      expect(JSON.stringify(r1.delta)).toBe(JSON.stringify(r2.delta))
    })

    it('should produce delta paths that start with /tracks/ for track mutations', () => {
      const parent = makeMockClip()
      const result = focalMutation(parent, 42)

      const trackOps = result.delta.filter((op) => !op.path.startsWith('/cognitiveDNA'))
      expect(trackOps.length).toBeGreaterThanOrEqual(1)
      expect(trackOps.every((op) => op.path.startsWith('/tracks/'))).toBe(true)
    })
  })

  // ── 2. geneAugmentation ────────────────────────────────────────────────────

  describe('geneAugmentation', () => {
    it('should add a new track to the child clip', () => {
      const parent = makeMockClip()
      const originalTrackCount = parent.tracks.length
      const result = geneAugmentation(parent, 42)

      expect(result.clip.tracks.length).toBe(originalTrackCount + 1)
    })

    it('should produce a delta with an add op at /tracks/-', () => {
      const parent = makeMockClip()
      const result = geneAugmentation(parent, 42)

      expect(result.delta.length).toBeGreaterThanOrEqual(1)
      const addOp = result.delta.find((op) => op.op === 'add' && op.path === '/tracks/-')
      expect(addOp).toBeDefined()
    })

    it('should NOT mutate the original clip by reference', () => {
      const parent = makeMockClip()
      const parentSnapshot = JSON.stringify(parent)
      geneAugmentation(parent, 42)

      expect(JSON.stringify(parent)).toBe(parentSnapshot)
    })

    it('should give the augmented track a new ID', () => {
      const parent = makeMockClip()
      const result = geneAugmentation(parent, 42)
      const newTrack = result.clip.tracks[result.clip.tracks.length - 1]

      expect(newTrack.id).not.toBe(parent.tracks[0].id)
      expect(newTrack.id).toContain('aug_')
    })

    it('should allow duplicate paramIds if zones differ (WAVE 7165 multicellular)', () => {
      // Build a clip where ALL augmentable params already exist
      const parent = makeMockClip()
      const allParamTracks: HephTrack[] = []
      const augmentableParams = ['intensity', 'color', 'strobe', 'pan', 'tilt', 'zoom'] as const
      for (const paramId of augmentableParams) {
        allParamTracks.push({
          id: `track-${paramId}-001`,
          paramId,
          zones: ['front'],
          curve: {
            paramId,
            valueType: paramId === 'color' ? 'color' : 'number',
            range: paramId === 'color' ? [0, 360] : paramId === 'pan' || paramId === 'tilt' ? [0, 255] : [0, 1],
            defaultValue: paramId === 'color' ? { h: 0, s: 100, l: 50 } : 0,
            keyframes: [
              { timeMs: 0, value: paramId === 'color' ? { h: 0, s: 100, l: 50 } : 0.5, interpolation: 'linear' },
              { timeMs: 1000, value: paramId === 'color' ? { h: 180, s: 100, l: 50 } : 0.8, interpolation: 'linear' },
            ],
            mode: 'absolute',
          },
        })
      }
      parent.tracks = allParamTracks

      const result = geneAugmentation(parent, 42)
      const newTrack = result.clip.tracks[result.clip.tracks.length - 1]

      // The new track SHOULD have a paramId that already exists (multicellular)
      const existingParamIds = new Set(parent.tracks.map((t) => t.paramId))
      expect(existingParamIds.has(newTrack.paramId)).toBe(true)

      // But the zone MUST be different from any existing track with the same paramId
      const sameParamTracks = parent.tracks.filter((t) => t.paramId === newTrack.paramId)
      for (const existing of sameParamTracks) {
        const existingZones = new Set(existing.zones)
        const newZones = newTrack.zones
        // At least one zone in newTrack should NOT be in any existing track with same paramId
        const hasNewZone = newZones.some((z) => !existingZones.has(z))
        expect(hasNewZone).toBe(true)
      }
    })

    it('should drift cognitiveDNA when present', () => {
      const parent = makeMockClip()
      const originalAggression = parent.cognitiveDNA!.genome.aggression
      const result = geneAugmentation(parent, 42)

      // DNA should be mutated (at least one genome field changed)
      const newDna = result.clip.cognitiveDNA!
      const changed =
        newDna.genome.aggression !== originalAggression ||
        newDna.genome.chaos !== parent.cognitiveDNA!.genome.chaos ||
        newDna.genome.organicity !== parent.cognitiveDNA!.genome.organicity
      expect(changed).toBe(true)
    })

    it('should be deterministic with same seed', () => {
      const parent = makeMockClip()
      const r1 = geneAugmentation(parent, 77)
      const r2 = geneAugmentation(parent, 77)

      expect(JSON.stringify(r1.clip)).toBe(JSON.stringify(r2.clip))
    })
  })

  // ── 3. applyDelta round-trip ──────────────────────────────────────────────

  describe('applyDelta', () => {
    it('should reproduce the same child when delta is applied to parent', () => {
      const parent = makeMockClip()
      const result = focalMutation(parent, 99)

      // Apply the delta to a fresh copy of the parent
      const reconstructed = applyDelta(parent, result.delta as JsonPatchOp[])

      // The reconstructed clip should match the child
      expect(JSON.stringify(reconstructed)).toBe(JSON.stringify(result.clip))
    })

    it('should handle geneAugmentation delta round-trip', () => {
      const parent = makeMockClip()
      const result = geneAugmentation(parent, 55)

      const reconstructed = applyDelta(parent, result.delta as JsonPatchOp[])
      expect(reconstructed.tracks.length).toBe(result.clip.tracks.length)
    })

    it('should return a deep clone (not the same reference as input)', () => {
      const parent = makeMockClip()
      const result = applyDelta(parent, [])

      expect(result).not.toBe(parent)
      expect(JSON.stringify(result)).toBe(JSON.stringify(parent))
    })
  })
})
