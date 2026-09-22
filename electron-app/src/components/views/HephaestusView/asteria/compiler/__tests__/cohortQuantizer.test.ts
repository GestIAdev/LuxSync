/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 ASTERIA — cohortQuantizer tests (WAVE 8040 · Vía B)
 *
 * Verifica la cuantización por PERCENTILES del blueprint §8.3-1:
 *   - ≤ K cohortes, cardinal casi igual entre cubos.
 *   - Representante = media del cubo (gain y delayMs).
 *   - nodeIds en orden canónico del atlas.
 *   - Determinismo total: misma entrada → misma partición.
 *   - Cobertura completa: ningún nodo cubierto se pierde ni se duplica;
 *     nodos con mask=0 quedan fuera.
 *
 * @module asteria/compiler/__tests__/cohortQuantizer
 * @version WAVE 8040
 */

import { describe, test, expect } from 'vitest'
import { quantizeGainCohorts, type GainCohort } from '../cohortQuantizer'
import type { FieldSnapshot } from '../../model/fieldEngine'
import type { NodeAtlasEntry } from '../../../../../core/aether/types'

// ═══════════════════════════════════════════════════════════════════════════
// FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

function makeAtlas(ids: string[]): NodeAtlasEntry[] {
  return ids.map(id => {
    const sep = id.indexOf(':')
    return {
      nodeId: id,
      deviceId: sep >= 0 ? id.slice(0, sep) : id,
      cellSuffix: sep >= 0 ? id.slice(sep + 1) : id,
      family: 'impact',
      zoneId: 'all',
      role: 'primary',
    } as unknown as NodeAtlasEntry
  })
}

function makeField(n: number, gains: number[], delays?: number[], maskAll = true): FieldSnapshot {
  return {
    delayMs: new Float32Array(delays ?? new Array(n).fill(0)),
    gain: new Float32Array(gains),
    mask: new Uint8Array(new Array(n).fill(maskAll ? 1 : 0)),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('🧬 quantizeGainCohorts — Vía B (§8.3)', () => {

  test('input vacío / sin cobertura → []', () => {
    expect(quantizeGainCohorts(makeField(0, []), [], 16)).toEqual([])
    const field = makeField(3, [0.5, 0.5, 0.5])
    field.mask.fill(0)
    expect(quantizeGainCohorts(field, makeAtlas(['a:x', 'b:x', 'c:x']), 16)).toEqual([])
  })

  test('K ≤ 0 → []', () => {
    const field = makeField(2, [0.5, 0.8])
    expect(quantizeGainCohorts(field, makeAtlas(['a:x', 'b:x']), 0)).toEqual([])
  })

  test('menos nodos que K → cada nodo su propia cohorte', () => {
    const atlas = makeAtlas(['fx-1:impact', 'fx-2:impact'])
    const field = makeField(2, [0.5, 0.9])
    const cohorts = quantizeGainCohorts(field, atlas, 16)
    expect(cohorts).toHaveLength(2)
    expect(cohorts[0].gain).toBeCloseTo(0.5, 5)
    expect(cohorts[0].nodeIds).toEqual(['fx-1:impact'])
    expect(cohorts[1].gain).toBeCloseTo(0.9, 5)
    expect(cohorts[1].nodeIds).toEqual(['fx-2:impact'])
  })

  test('K=1 → cohorte única con gain medio de todos los cubiertos', () => {
    const atlas = makeAtlas(['a:x', 'b:x', 'c:x', 'd:x'])
    const field = makeField(4, [0.2, 0.4, 0.6, 0.8])
    const cohorts = quantizeGainCohorts(field, atlas, 1)
    expect(cohorts).toHaveLength(1)
    expect(cohorts[0].gain).toBeCloseTo(0.5, 5)
    expect(cohorts[0].nodeIds).toEqual(['a:x', 'b:x', 'c:x', 'd:x'])
  })

  test('percentiles: cubos de cardinal casi igual (10 nodos, K=3 → 3/4/3)', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `fx-${i}:impact`)
    const atlas = makeAtlas(ids)
    const gains = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    const field = makeField(10, gains)
    const cohorts = quantizeGainCohorts(field, atlas, 3)

    expect(cohorts).toHaveLength(3)
    // Fronteras round(c·10/3): [0,3),[3,7),[7,10) → 3/4/3
    expect(cohorts.map(c => c.nodeIds.length)).toEqual([3, 4, 3])
    // Representantes = media del cubo
    expect(cohorts[0].gain).toBeCloseTo((0.0 + 0.1 + 0.2) / 3, 5)
    expect(cohorts[1].gain).toBeCloseTo((0.3 + 0.4 + 0.5 + 0.6) / 4, 5)
    expect(cohorts[2].gain).toBeCloseTo((0.7 + 0.8 + 0.9) / 3, 5)
  })

  test('nodos con mask=0 quedan fuera de toda cohorte', () => {
    const atlas = makeAtlas(['a:x', 'b:x', 'c:x'])
    const field = makeField(3, [0.2, 0.8, 0.5])
    field.mask[1] = 0 // b:x descubierto
    const cohorts = quantizeGainCohorts(field, atlas, 4)
    const all = cohorts.flatMap(c => c.nodeIds)
    expect(all).not.toContain('b:x')
    expect(all.sort()).toEqual(['a:x', 'c:x'])
  })

  test('gains duplicados comparten cubo de forma determinista', () => {
    const atlas = makeAtlas(['a:x', 'b:x', 'c:x', 'd:x'])
    const field = makeField(4, [0.5, 0.5, 0.5, 1.0])
    const cohorts = quantizeGainCohorts(field, atlas, 2)
    // Frontera round(4/2)=2 → [0.5,0.5] | [0.5,1.0]
    expect(cohorts).toHaveLength(2)
    expect(cohorts[0].gain).toBeCloseTo(0.5, 5)
    expect(cohorts[0].nodeIds).toEqual(['a:x', 'b:x'])
    expect(cohorts[1].gain).toBeCloseTo(0.75, 5)
    expect(cohorts[1].nodeIds).toEqual(['c:x', 'd:x'])
  })

  test('determinismo: misma entrada → misma partición byte a byte', () => {
    const atlas = makeAtlas(['a:x', 'b:x', 'c:x', 'd:x', 'e:x'])
    const field = makeField(5, [0.9, 0.1, 0.5, 0.1, 0.7])
    const r1 = quantizeGainCohorts(field, atlas, 3)
    const r2 = quantizeGainCohorts(field, atlas, 3)
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2))
  })

  test('cobertura completa: ningún cubierto se pierde ni duplica', () => {
    const ids = Array.from({ length: 23 }, (_, i) => `dev-${i}:cell`)
    const atlas = makeAtlas(ids)
    const field = makeField(23, ids.map((_, i) => (i * 37) % 11 / 10))
    const K = 7
    const cohorts = quantizeGainCohorts(field, atlas, K)

    const all = cohorts.flatMap(c => c.nodeIds)
    expect(all.length).toBe(ids.length)
    expect(new Set(all).size).toBe(ids.length) // sin duplicados
    expect(cohorts.length).toBeLessThanOrEqual(K)
  })

  test('delayMs representativo = media del cubo', () => {
    const atlas = makeAtlas(['a:x', 'b:x', 'c:x', 'd:x'])
    const field = makeField(4, [0.1, 0.2, 0.8, 0.9], [100, 300, 500, 700])
    const cohorts = quantizeGainCohorts(field, atlas, 2)
    expect(cohorts[0].delayMs).toBeCloseTo(200, 5) // mean(100,300)
    expect(cohorts[1].delayMs).toBeCloseTo(600, 5) // mean(500,700)
  })

  test('cohortes ordenadas por gain ascendente', () => {
    const atlas = makeAtlas(['a:x', 'b:x', 'c:x'])
    const field = makeField(3, [0.9, 0.1, 0.5])
    const cohorts = quantizeGainCohorts(field, atlas, 3)
    const gains = cohorts.map((c: GainCohort) => c.gain)
    expect(gains).toEqual([...gains].sort((x, y) => x - y))
  })
})
