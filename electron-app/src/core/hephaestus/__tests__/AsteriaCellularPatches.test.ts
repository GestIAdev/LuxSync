/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 ASTERIA CELLULAR PATCHES TEST — WAVE 8040 (Δ1 + Δ2)
 *
 * Verifica los dos primeros discriminadores del blueprint §11:
 *   Δ1 — El blend map discrimina por `track.cell`: dos pistas sobre el mismo
 *        (fixture, paramId) con celda distinta NO colapsan. El sufijo se
 *        precalcula en patch-time (`blendSuffix`) — una sola concatenación
 *        por muestra, igual que el código legado.
 *   Δ2 — `HephFixtureOutput.cell` propaga la celda al output pre-alocado.
 *
 * Compatibilidad V3: pistas sin `cell` generan el mismo blend key que antes
 * (`fixtureId:paramId`) → el comportamiento de fusión legado es bit-exacto.
 *
 * E2E real: `playFromClip` + `tick()` sobre el Runtime de producción, con
 * `fixtureIds` externos para no depender del TitanOrchestrator.
 *
 * @module tests/hephaestus/AsteriaCellularPatches
 * @version WAVE 8040
 */

import { describe, test, expect } from 'vitest'
import { HephaestusRuntime } from '../runtime/HephaestusRuntime'
import type {
  HephAutomationClipV3,
  HephCurve,
  HephTrack,
  ZoneTarget,
} from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

function constCurve(value: number, paramId: HephCurve['paramId'] = 'intensity'): HephCurve {
  return {
    paramId,
    valueType: 'number',
    range: [0, 1],
    defaultValue: 0,
    keyframes: [{ timeMs: 0, value, interpolation: 'hold' }],
    mode: 'absolute',
  }
}

function makeClip(tracks: HephTrack[]): HephAutomationClipV3 {
  return {
    id: 'test-clip-cellular',
    name: 'Test Cellular Clip',
    author: 'Asteria',
    category: 'composite' as import('../../effects/types').EffectCategory,
    tags: ['test', 'asteria'],
    vibeCompat: ['universal'],
    spatialZones: ['all'] as readonly ZoneTarget[],
    mixBus: 'global',
    priority: 70,
    durationMs: 4000,
    effectType: 'heph_custom',
    tracks,
    staticParams: {},
    schemaVersion: '3.0',
  }
}

function makeTrack(id: string, value: number, cell?: string): HephTrack {
  return {
    id,
    paramId: 'intensity',
    zones: ['all'] as readonly ZoneTarget[],
    curve: constCurve(value),
    ...(cell !== undefined && { cell }),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('🧬 WAVE 8040 — Parches celulares del Runtime (Δ1/Δ2)', () => {

  test('Δ1: dos pistas mismo (fixture, param) con cell distinto NO colapsan', () => {
    const rt = new HephaestusRuntime()
    const clip = makeClip([
      makeTrack('ast_petal_l', 0.4, 'petal-l'),
      makeTrack('ast_petal_r', 0.8, 'petal-r'),
    ])

    rt.playFromClip(clip, { fixtureIds: ['tungsten-1'], loop: true })
    const outs = rt.tick(Date.now() + 100)

    const intensityOuts = outs.filter(o => o.fixtureId === 'tungsten-1' && o.parameter === 'intensity')
    expect(intensityOuts).toHaveLength(2)

    const byCell = new Map(intensityOuts.map(o => [o.cell, o.normalizedValue]))
    expect(byCell.get('petal-l')).toBeCloseTo(0.4, 5)
    expect(byCell.get('petal-r')).toBeCloseTo(0.8, 5)

    rt.stopAll()
  })

  test('Δ1-compat: dos pistas sin cell sobre mismo (fixture, param) SIGUEN fundiendo (V3 intacto)', () => {
    const rt = new HephaestusRuntime()
    const clip = makeClip([
      makeTrack('trk_a', 0.4),
      makeTrack('trk_b', 0.8),
    ])

    rt.playFromClip(clip, { fixtureIds: ['par-1'], loop: true })
    const outs = rt.tick(Date.now() + 100)

    const intensityOuts = outs.filter(o => o.fixtureId === 'par-1' && o.parameter === 'intensity')
    // Mismo blend key 'par-1:intensity' → una sola salida fusionada (max → 0.8).
    expect(intensityOuts).toHaveLength(1)
    expect(intensityOuts[0].normalizedValue).toBeCloseTo(0.8, 5)
    // Sin cell → el campo queda undefined (Δ2: no contamina el output).
    expect(intensityOuts[0].cell).toBeUndefined()

    rt.stopAll()
  })

  test('Δ2: output.cell propaga la celda del track; ausente → undefined', () => {
    const rt = new HephaestusRuntime()
    const clip = makeClip([
      makeTrack('ast_cell', 0.5, 'petal-l'),
      {
        id: 'trk_plain',
        paramId: 'strobe',
        zones: ['all'] as readonly ZoneTarget[],
        curve: constCurve(0.5, 'strobe'),
      },
    ])

    rt.playFromClip(clip, { fixtureIds: ['tungsten-1'], loop: true })
    const outs = rt.tick(Date.now() + 100)

    const cellOut = outs.find(o => o.parameter === 'intensity')
    const plainOut = outs.find(o => o.parameter === 'strobe')
    expect(cellOut?.cell).toBe('petal-l')
    expect(plainOut?.cell).toBeUndefined()

    rt.stopAll()
  })

  test('Δ1: cell track + pista plana mismo param NO se mezclan entre sí', () => {
    const rt = new HephaestusRuntime()
    const clip = makeClip([
      makeTrack('trk_plain', 0.3),                 // key: 'fx:intensity'
      makeTrack('ast_cell', 0.9, 'petal-l'),       // key: 'fx:intensity#petal-l'
    ])

    rt.playFromClip(clip, { fixtureIds: ['fx'], loop: true })
    const outs = rt.tick(Date.now() + 100)

    const intensityOuts = outs.filter(o => o.parameter === 'intensity')
    expect(intensityOuts).toHaveLength(2)
    const plain = intensityOuts.find(o => o.cell === undefined)
    const cell = intensityOuts.find(o => o.cell === 'petal-l')
    expect(plain?.normalizedValue).toBeCloseTo(0.3, 5)
    expect(cell?.normalizedValue).toBeCloseTo(0.9, 5)

    rt.stopAll()
  })
})
