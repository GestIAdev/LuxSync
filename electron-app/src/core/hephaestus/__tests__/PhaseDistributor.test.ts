/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ PHASE DISTRIBUTOR TEST SUITE — WAVE 2401
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Validación forense del motor de distribución de fases.
 * Cada test demuestra que la matemática es DETERMINISTA y cumple
 * los contratos definidos en el Blueprint Fase 1.
 *
 * PILARES DE VALIDACIÓN:
 * 1. 🛡️ Edge Cases: Empty input, single fixture, spread=0
 * 2. 📐 Linear: Distribución uniforme, offsets equidistantes
 * 3. 🪞 Mirror: Simetría especular desde los bordes
 * 4. 🎯 Center-Out: Expansión radial desde el centro
 * 5. 🦅 Wings: Sub-grupo con ciclos independientes
 * 6. ↩️ Direction: Inversión de propagación
 * 7. 📊 Sort Contract: Siempre ordenado por phaseOffsetMs ASC
 * 8. 🔢 normalizedIndex: Siempre en rango [0, 1]
 * 9. 🏋️ Stress: N grande, configuraciones extremas
 *
 * @module tests/PhaseDistributor.test
 * @version WAVE 2401
 */

import { describe, test, expect } from 'vitest'
import { PhaseDistributor } from '../runtime/PhaseDistributor'
import type { PhaseConfig, FixturePhase } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Genera N fixture IDs: ['f0', 'f1', ..., 'f(N-1)'] */
function fixtureIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `f${i}`)
}

/** Config por defecto: linear, spread=0.5, 1 wing, direction forward */
function config(overrides: Partial<PhaseConfig> = {}): PhaseConfig {
  return {
    spread: 0.5,
    symmetry: 'linear',
    wings: 1,
    direction: 1,
    ...overrides,
  }
}

/** Extrae solo los offsets de un resultado (mantiene el orden del array) */
function offsets(result: FixturePhase[]): number[] {
  return result.map(fp => fp.phaseOffsetMs)
}

/** Extrae los fixture IDs del resultado (en el orden del array — post-sort) */
function ids(result: FixturePhase[]): string[] {
  return result.map(fp => fp.fixtureId)
}

/** Verifica que un array está ordenado ASC */
function isSortedAsc(arr: number[]): boolean {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[i - 1]) return false
  }
  return true
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════

describe('⚒️ WAVE 2401: PhaseDistributor — The Phase Math Engine', () => {

  // ═════════════════════════════════════════════════════════════════════════
  // 🛡️ EDGE CASES
  // ═════════════════════════════════════════════════════════════════════════

  describe('🛡️ Edge Cases', () => {
    test('empty fixture array returns empty result', () => {
      const result = PhaseDistributor.resolve([], config(), 1000)
      expect(result).toEqual([])
      expect(result.length).toBe(0)
    })

    test('single fixture always gets offset=0', () => {
      const result = PhaseDistributor.resolve(['solo'], config({ spread: 0.8 }), 2000)
      expect(result.length).toBe(1)
      expect(result[0].fixtureId).toBe('solo')
      expect(result[0].phaseOffsetMs).toBe(0)
      expect(result[0].normalizedIndex).toBe(0)
    })

    test('spread=0 gives all fixtures offset=0', () => {
      const fids = fixtureIds(8)
      const result = PhaseDistributor.resolve(fids, config({ spread: 0 }), 1000)
      expect(result.length).toBe(8)
      for (const fp of result) {
        expect(fp.phaseOffsetMs).toBe(0)
      }
    })

    test('spread=0 preserves all fixture IDs', () => {
      const fids = fixtureIds(5)
      const result = PhaseDistributor.resolve(fids, config({ spread: 0 }), 1000)
      const resultIds = result.map(fp => fp.fixtureId).sort()
      expect(resultIds).toEqual([...fids].sort())
    })

    test('negative spread is clamped to 0', () => {
      const fids = fixtureIds(4)
      const result = PhaseDistributor.resolve(fids, config({ spread: -0.5 }), 1000)
      for (const fp of result) {
        expect(fp.phaseOffsetMs).toBe(0)
      }
    })

    test('spread > 1 is clamped to 1', () => {
      const fids = fixtureIds(3)
      const result = PhaseDistributor.resolve(fids, config({ spread: 2.0 }), 1000)
      // spreadMs would be 1000 * 1.0 = 1000 (clamped)
      const maxOffset = Math.max(...offsets(result))
      expect(maxOffset).toBeLessThanOrEqual(1000)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 📐 LINEAR SYMMETRY
  // ═════════════════════════════════════════════════════════════════════════

  describe('📐 Linear Symmetry', () => {
    test('4 fixtures, spread=0.5, 1000ms → [0, 166.67, 333.33, 500]', () => {
      const result = PhaseDistributor.resolve(
        fixtureIds(4),
        config({ spread: 0.5, symmetry: 'linear' }),
        1000
      )
      // spreadMs = 1000 * 0.5 = 500ms
      // step = 500 / 3 = 166.667ms
      const offs = offsets(result)
      expect(offs.length).toBe(4)
      // Check sorted ASC
      expect(isSortedAsc(offs)).toBe(true)
      // The minimum should be 0
      expect(Math.min(...offs)).toBeCloseTo(0, 2)
      // The maximum should be 500
      expect(Math.max(...offs)).toBeCloseTo(500, 2)
    })

    test('2 fixtures, spread=1.0, 2000ms → [0, 2000]', () => {
      const result = PhaseDistributor.resolve(
        fixtureIds(2),
        config({ spread: 1.0, symmetry: 'linear' }),
        2000
      )
      const offs = offsets(result)
      expect(offs).toContain(0)
      expect(offs).toContain(2000)
    })

    test('linear offsets are equidistant', () => {
      const result = PhaseDistributor.resolve(
        fixtureIds(5),
        config({ spread: 0.4, symmetry: 'linear' }),
        1000
      )
      // spreadMs = 400ms, step = 100ms
      // Pre-sort offsets to check equidistance
      const offs = offsets(result) // already sorted ASC by contract
      const step = offs[1] - offs[0]
      for (let i = 2; i < offs.length; i++) {
        expect(offs[i] - offs[i - 1]).toBeCloseTo(step, 5)
      }
    })

    test('spread=1.0: max offset equals durationMs', () => {
      const result = PhaseDistributor.resolve(
        fixtureIds(6),
        config({ spread: 1.0, symmetry: 'linear' }),
        3000
      )
      expect(Math.max(...offsets(result))).toBeCloseTo(3000, 2)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🪞 MIRROR SYMMETRY
  // ═════════════════════════════════════════════════════════════════════════

  describe('🪞 Mirror Symmetry', () => {
    test('mirror: edges have same offset, center has max', () => {
      const fids = fixtureIds(5)
      const result = PhaseDistributor.resolve(
        fids,
        config({ spread: 0.5, symmetry: 'mirror' }),
        1000
      )
      // Fixture order was f0..f4 → after phase computation:
      // f0 and f4 should have same offset (edge pair)
      // f1 and f3 should have same offset (inner pair)
      // f2 should have the highest offset (center)
      const byId = new Map(result.map(fp => [fp.fixtureId, fp.phaseOffsetMs]))
      expect(byId.get('f0')).toBeCloseTo(byId.get('f4')!, 5)
      expect(byId.get('f1')).toBeCloseTo(byId.get('f3')!, 5)
    })

    test('mirror: even count (4 fixtures) is symmetric', () => {
      const result = PhaseDistributor.resolve(
        fixtureIds(4),
        config({ spread: 0.5, symmetry: 'mirror' }),
        1000
      )
      const byId = new Map(result.map(fp => [fp.fixtureId, fp.phaseOffsetMs]))
      // f0 ↔ f3, f1 ↔ f2
      expect(byId.get('f0')).toBeCloseTo(byId.get('f3')!, 5)
      expect(byId.get('f1')).toBeCloseTo(byId.get('f2')!, 5)
    })

    test('mirror: 2 fixtures get offset [0, 0]', () => {
      const result = PhaseDistributor.resolve(
        fixtureIds(2),
        config({ spread: 0.5, symmetry: 'mirror' }),
        1000
      )
      const byId = new Map(result.map(fp => [fp.fixtureId, fp.phaseOffsetMs]))
      expect(byId.get('f0')).toBeCloseTo(byId.get('f1')!, 5)
    })

    test('mirror output is sorted ASC', () => {
      const result = PhaseDistributor.resolve(
        fixtureIds(8),
        config({ spread: 0.6, symmetry: 'mirror' }),
        2000
      )
      expect(isSortedAsc(offsets(result))).toBe(true)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🎯 CENTER-OUT SYMMETRY
  // ═════════════════════════════════════════════════════════════════════════

  describe('🎯 Center-Out Symmetry', () => {
    test('center-out: center fixture has offset=0, edges have max', () => {
      const fids = fixtureIds(5)
      const result = PhaseDistributor.resolve(
        fids,
        config({ spread: 0.5, symmetry: 'center-out' }),
        1000
      )
      // f2 is the center → dist=0 → offset=0
      // f0 and f4 are edges → dist=2 → offset=spreadMs=500
      const byId = new Map(result.map(fp => [fp.fixtureId, fp.phaseOffsetMs]))
      expect(byId.get('f2')).toBeCloseTo(0, 5)
      expect(byId.get('f0')).toBeCloseTo(500, 2)
      expect(byId.get('f4')).toBeCloseTo(500, 2)
    })

    test('center-out: edges have equal offsets (symmetric)', () => {
      const fids = fixtureIds(7)
      const result = PhaseDistributor.resolve(
        fids,
        config({ spread: 0.4, symmetry: 'center-out' }),
        1000
      )
      const byId = new Map(result.map(fp => [fp.fixtureId, fp.phaseOffsetMs]))
      // f0 ↔ f6, f1 ↔ f5, f2 ↔ f4
      expect(byId.get('f0')).toBeCloseTo(byId.get('f6')!, 5)
      expect(byId.get('f1')).toBeCloseTo(byId.get('f5')!, 5)
      expect(byId.get('f2')).toBeCloseTo(byId.get('f4')!, 5)
      // Center
      expect(byId.get('f3')).toBeCloseTo(0, 5)
    })

    test('center-out: even count (6 fixtures)', () => {
      const result = PhaseDistributor.resolve(
        fixtureIds(6),
        config({ spread: 0.5, symmetry: 'center-out' }),
        1000
      )
      const byId = new Map(result.map(fp => [fp.fixtureId, fp.phaseOffsetMs]))
      // f0 ↔ f5, f1 ↔ f4, f2 ↔ f3
      expect(byId.get('f0')).toBeCloseTo(byId.get('f5')!, 5)
      expect(byId.get('f1')).toBeCloseTo(byId.get('f4')!, 5)
      expect(byId.get('f2')).toBeCloseTo(byId.get('f3')!, 5)
    })

    test('center-out output is sorted ASC', () => {
      const result = PhaseDistributor.resolve(
        fixtureIds(10),
        config({ spread: 0.5, symmetry: 'center-out' }),
        2000
      )
      expect(isSortedAsc(offsets(result))).toBe(true)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🦅 WINGS
  // ═════════════════════════════════════════════════════════════════════════

  describe('🦅 Wings', () => {
    test('wings=2, linear: each half has independent distribution', () => {
      const fids = fixtureIds(6)
      const result = PhaseDistributor.resolve(
        fids,
        config({ spread: 0.5, symmetry: 'linear', wings: 2 }),
        1000
      )
      // Wing 1: f0, f1, f2 → local indices 0,1,2
      // Wing 2: f3, f4, f5 → local indices 0,1,2
      // Both wings should produce the same offset pattern
      const byId = new Map(result.map(fp => [fp.fixtureId, fp.phaseOffsetMs]))
      expect(byId.get('f0')).toBeCloseTo(byId.get('f3')!, 5)
      expect(byId.get('f1')).toBeCloseTo(byId.get('f4')!, 5)
      expect(byId.get('f2')).toBeCloseTo(byId.get('f5')!, 5)
    })

    test('wings=1 is default behavior (no subdivision)', () => {
      const fids = fixtureIds(4)
      const resultWings1 = PhaseDistributor.resolve(
        fids,
        config({ spread: 0.5, symmetry: 'linear', wings: 1 }),
        1000
      )
      const resultDefault = PhaseDistributor.resolve(
        fids,
        config({ spread: 0.5, symmetry: 'linear' }),
        1000
      )
      // Should produce identical results
      for (let i = 0; i < fids.length; i++) {
        expect(resultWings1[i].phaseOffsetMs).toBeCloseTo(resultDefault[i].phaseOffsetMs, 5)
      }
    })

    test('wings=N (same as fixture count): all get same offset', () => {
      const fids = fixtureIds(4)
      const result = PhaseDistributor.resolve(
        fids,
        config({ spread: 0.5, symmetry: 'linear', wings: 4 }),
        1000
      )
      // Each wing has 1 fixture → all localN=1 → offset=0
      for (const fp of result) {
        expect(fp.phaseOffsetMs).toBe(0)
      }
    })

    test('wings > N is clamped to N', () => {
      const fids = fixtureIds(3)
      const result = PhaseDistributor.resolve(
        fids,
        config({ spread: 0.5, symmetry: 'linear', wings: 10 }),
        1000
      )
      // wings clamped to 3 → each wing has 1 fixture → offset=0
      for (const fp of result) {
        expect(fp.phaseOffsetMs).toBe(0)
      }
    })

    test('wings=2 with mirror produces mirrored wings', () => {
      const fids = fixtureIds(8)
      const result = PhaseDistributor.resolve(
        fids,
        config({ spread: 0.5, symmetry: 'mirror', wings: 2 }),
        1000
      )
      // Wing 1: f0,f1,f2,f3 → mirror pattern
      // Wing 2: f4,f5,f6,f7 → same mirror pattern
      const byId = new Map(result.map(fp => [fp.fixtureId, fp.phaseOffsetMs]))
      // f0 in wing1 ↔ f4 in wing2 (both local index 0)
      expect(byId.get('f0')).toBeCloseTo(byId.get('f4')!, 5)
      // f1 in wing1 ↔ f5 in wing2
      expect(byId.get('f1')).toBeCloseTo(byId.get('f5')!, 5)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // ↩️ DIRECTION
  // ═════════════════════════════════════════════════════════════════════════

  describe('↩️ Direction', () => {
    test('direction=-1 reverses offsets: last fixture gets offset=0', () => {
      const fids = fixtureIds(4)
      const forward = PhaseDistributor.resolve(
        fids,
        config({ spread: 0.5, symmetry: 'linear', direction: 1 }),
        1000
      )
      const reverse = PhaseDistributor.resolve(
        fids,
        config({ spread: 0.5, symmetry: 'linear', direction: -1 }),
        1000
      )
      const fwdById = new Map(forward.map(fp => [fp.fixtureId, fp.phaseOffsetMs]))
      const revById = new Map(reverse.map(fp => [fp.fixtureId, fp.phaseOffsetMs]))

      // In forward: f0=0, f3=500
      // In reverse: f0=500, f3=0
      const spreadMs = 500
      for (const id of fids) {
        expect(revById.get(id)! + fwdById.get(id)!).toBeCloseTo(spreadMs, 2)
      }
    })

    test('direction=-1: mirror is still symmetric (direction only flips within pattern)', () => {
      const fids = fixtureIds(5)
      const result = PhaseDistributor.resolve(
        fids,
        config({ spread: 0.5, symmetry: 'mirror', direction: -1 }),
        1000
      )
      const byId = new Map(result.map(fp => [fp.fixtureId, fp.phaseOffsetMs]))
      // Mirror pairs should still match
      expect(byId.get('f0')).toBeCloseTo(byId.get('f4')!, 5)
      expect(byId.get('f1')).toBeCloseTo(byId.get('f3')!, 5)
    })

    test('direction=-1 output is still sorted ASC', () => {
      const result = PhaseDistributor.resolve(
        fixtureIds(6),
        config({ spread: 0.5, symmetry: 'linear', direction: -1 }),
        1000
      )
      expect(isSortedAsc(offsets(result))).toBe(true)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 📊 SORT CONTRACT & normalizedIndex
  // ═════════════════════════════════════════════════════════════════════════

  describe('📊 Sort Contract & Normalized Index', () => {
    test('output is ALWAYS sorted by phaseOffsetMs ASC (linear)', () => {
      const result = PhaseDistributor.resolve(fixtureIds(20), config({ spread: 0.8 }), 5000)
      expect(isSortedAsc(offsets(result))).toBe(true)
    })

    test('output is ALWAYS sorted by phaseOffsetMs ASC (mirror)', () => {
      const result = PhaseDistributor.resolve(
        fixtureIds(15),
        config({ spread: 0.6, symmetry: 'mirror' }),
        3000
      )
      expect(isSortedAsc(offsets(result))).toBe(true)
    })

    test('output is ALWAYS sorted by phaseOffsetMs ASC (center-out)', () => {
      const result = PhaseDistributor.resolve(
        fixtureIds(12),
        config({ spread: 0.7, symmetry: 'center-out' }),
        4000
      )
      expect(isSortedAsc(offsets(result))).toBe(true)
    })

    test('all fixture IDs are preserved (no duplicates, no losses)', () => {
      const fids = fixtureIds(10)
      const result = PhaseDistributor.resolve(fids, config({ spread: 0.5 }), 1000)
      const resultIds = ids(result).sort()
      expect(resultIds).toEqual([...fids].sort())
    })

    test('normalizedIndex is always in [0, 1] range', () => {
      const result = PhaseDistributor.resolve(
        fixtureIds(20),
        config({ spread: 0.8, symmetry: 'linear', wings: 3 }),
        5000
      )
      for (const fp of result) {
        expect(fp.normalizedIndex).toBeGreaterThanOrEqual(0)
        expect(fp.normalizedIndex).toBeLessThanOrEqual(1)
      }
    })

    test('normalizedIndex for 2 fixtures is [0, 1]', () => {
      const result = PhaseDistributor.resolve(
        fixtureIds(2),
        config({ spread: 0.5, symmetry: 'linear' }),
        1000
      )
      const normalized = result.map(fp => fp.normalizedIndex).sort((a, b) => a - b)
      expect(normalized[0]).toBe(0)
      expect(normalized[1]).toBeCloseTo(1, 5)
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🔁 DETERMINISM
  // ═════════════════════════════════════════════════════════════════════════

  describe('🔁 Determinism', () => {
    test('same inputs produce identical outputs (pure function)', () => {
      const fids = fixtureIds(8)
      const cfg = config({ spread: 0.6, symmetry: 'mirror', wings: 2, direction: -1 })
      const dur = 3000

      const result1 = PhaseDistributor.resolve(fids, cfg, dur)
      const result2 = PhaseDistributor.resolve(fids, cfg, dur)

      expect(result1.length).toBe(result2.length)
      for (let i = 0; i < result1.length; i++) {
        expect(result1[i].fixtureId).toBe(result2[i].fixtureId)
        expect(result1[i].phaseOffsetMs).toBe(result2[i].phaseOffsetMs)
        expect(result1[i].normalizedIndex).toBe(result2[i].normalizedIndex)
      }
    })
  })

  // ═════════════════════════════════════════════════════════════════════════
  // 🏋️ STRESS TESTS
  // ═════════════════════════════════════════════════════════════════════════

  describe('🏋️ Stress Tests', () => {
    test('100 fixtures, all symmetry modes produce valid output', () => {
      const fids = fixtureIds(100)
      const dur = 10000

      for (const symmetry of ['linear', 'mirror', 'center-out'] as const) {
        const result = PhaseDistributor.resolve(
          fids,
          config({ spread: 0.5, symmetry, wings: 4 }),
          dur
        )

        // All fixtures present
        expect(result.length).toBe(100)

        // Sorted ASC
        expect(isSortedAsc(offsets(result))).toBe(true)

        // All offsets are non-negative
        for (const fp of result) {
          expect(fp.phaseOffsetMs).toBeGreaterThanOrEqual(0)
        }

        // All offsets are ≤ spreadMs (5000)
        for (const fp of result) {
          expect(fp.phaseOffsetMs).toBeLessThanOrEqual(5000 + 0.01)
        }

        // normalizedIndex in [0, 1]
        for (const fp of result) {
          expect(fp.normalizedIndex).toBeGreaterThanOrEqual(0)
          expect(fp.normalizedIndex).toBeLessThanOrEqual(1)
        }
      }
    })

    test('performance: resolve 1000 fixtures completes in < 50ms', () => {
      const fids = fixtureIds(1000)
      const cfg = config({ spread: 0.5, symmetry: 'center-out', wings: 10, direction: -1 })

      const start = performance.now()
      const result = PhaseDistributor.resolve(fids, cfg, 60000)
      const elapsed = performance.now() - start

      expect(result.length).toBe(1000)
      expect(elapsed).toBeLessThan(50) // Should be < 5ms realistically
    })
  })
})
