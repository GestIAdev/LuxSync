/**
 * 🜨 WAVE 8196 — CELL-AWARE BLEND SLOTS (Preview Squelch fix)
 *
 * Verifica que `evaluateFixtureParams` honra `track.cell` con la misma
 * regla del runtime vivo (`blendSuffix = ':paramId#cell'`):
 *
 *   - Dos pistas quirúrgicas sobre el mismo paramId pero celdas
 *     distintas NO colapsan en un solo blend — cada celda es un slot
 *     independiente. El readout por fixture es LTP (última pista del
 *     array gana el display del canal), igual que NodeArbiter.
 *   - Pistas sin `cell` conservan el blend legacy por paramId.
 *   - Una pista cell y una zone track en el mismo fixture no se
 *     contaminan — viven en slots separados.
 *
 * Nota: el filtrado pista→fixture (cell → deviceId) vive en
 * `useHephPreview.resolveTrackFixtureSet` — cubierto en su propio test.
 * Aquí `applicableTracks` simula lo que el preview entrega al fixture.
 */

import { describe, test, expect } from 'vitest'
import { evaluateFixtureParams } from '../HephEvaluationKernel'
import { buildTrackEvaluators } from '../HephSharedMath'
import type {
  HephAutomationClipV3, HephTrack, HephCurve, HephParamId,
  BlendMode, HSL, ZoneTarget,
} from '../types'
import type { EffectCategory } from '../../effects/types'

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

function constCurve(paramId: HephParamId, value: number): HephCurve {
  return {
    paramId,
    valueType: 'number',
    range: [0, 1],
    defaultValue: 0,
    mode: 'absolute',
    keyframes: [{ timeMs: 0, value, interpolation: 'hold' }],
  }
}

function constColor(h: number, s: number, l: number): HephCurve {
  return {
    paramId: 'color',
    valueType: 'color',
    range: [0, 360],
    defaultValue: { h: 0, s: 0, l: 50 } as HSL,
    mode: 'absolute',
    keyframes: [{ timeMs: 0, value: { h, s, l } as HSL, interpolation: 'hold' }],
  }
}

function cellTrack(
  id: string, paramId: HephParamId, cell: string,
  curve: HephCurve, blendMode?: BlendMode,
): HephTrack {
  // Asteria surgical track: zones=['all'] placeholder + cell = filtro real.
  return { id, paramId, zones: ['all'] as ZoneTarget[], curve, cell, blendMode }
}

function zoneTrack(
  id: string, paramId: HephParamId,
  curve: HephCurve, blendMode?: BlendMode,
): HephTrack {
  return { id, paramId, zones: ['all'] as ZoneTarget[], curve, blendMode }
}

function forgeClip(tracks: HephTrack[], durationMs = 1000): HephAutomationClipV3 {
  return {
    id: 'cell-slots-test',
    name: 'cell-slots',
    author: 'WAVE-8196',
    category: 'physical' as EffectCategory,
    tags: ['test'],
    vibeCompat: [],
    spatialZones: ['all'],
    mixBus: 'htp',
    priority: 50,
    durationMs,
    effectType: 'heph_custom',
    tracks,
    staticParams: {},
    schemaVersion: '3.0',
  }
}

function evalTracks(tracks: HephTrack[], timeMs = 500) {
  const clip = forgeClip(tracks)
  const evaluators = buildTrackEvaluators(tracks, clip.durationMs)
  return evaluateFixtureParams(clip, evaluators, tracks, timeMs)
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 WAVE 8196 — evaluateFixtureParams: cell-aware blend slots', () => {
  test('mismo paramId + celdas distintas NO colapsan (slots #cell aislados)', () => {
    // Discriminador: blend 'max'. Pre-8196: max(0.9, 0.2) = 0.9 en un solo
    // slot paramId. Post-8196: 'intensity#fx-a:c2' e 'intensity#fx-a:c1'
    // son slots independientes → el readout LTP es la última pista = 0.2.
    const tracks = [
      cellTrack('t-c2', 'intensity', 'fx-a:c2', constCurve('intensity', 0.9), 'max'),
      cellTrack('t-c1', 'intensity', 'fx-a:c1', constCurve('intensity', 0.2), 'max'),
    ]
    const r = evalTracks(tracks)
    expect(r.numeric.get('intensity')).toBeCloseTo(0.2, 4)
  })

  test('orden inverso → el otro slot gana el readout (LTP real)', () => {
    const tracks = [
      cellTrack('t-c1', 'intensity', 'fx-a:c1', constCurve('intensity', 0.2), 'max'),
      cellTrack('t-c2', 'intensity', 'fx-a:c2', constCurve('intensity', 0.9), 'max'),
    ]
    const r = evalTracks(tracks)
    expect(r.numeric.get('intensity')).toBeCloseTo(0.9, 4)
  })

  test('misma celda + mismo param → blend normal DENTRO del slot', () => {
    const tracks = [
      cellTrack('t1', 'intensity', 'fx-a:c1', constCurve('intensity', 0.4), 'add'),
      cellTrack('t2', 'intensity', 'fx-a:c1', constCurve('intensity', 0.4), 'add'),
    ]
    const r = evalTracks(tracks)
    expect(r.numeric.get('intensity')).toBeCloseTo(0.8, 4) // 0.4 + 0.4
  })

  test('pistas sin cell conservan el blend legacy por paramId', () => {
    const tracks = [
      zoneTrack('t1', 'intensity', constCurve('intensity', 0.4), 'add'),
      zoneTrack('t2', 'intensity', constCurve('intensity', 0.4), 'add'),
    ]
    const r = evalTracks(tracks)
    expect(r.numeric.get('intensity')).toBeCloseTo(0.8, 4)
  })

  test('cell track + zone track no se contaminan (slots separados, LTP)', () => {
    // Zone track primero (replace 0.5), cell track después (0.9):
    // slots 'intensity' e 'intensity#fx-a:c1' → readout = última = 0.9.
    const fwd = evalTracks([
      zoneTrack('t-zone', 'intensity', constCurve('intensity', 0.5), 'replace'),
      cellTrack('t-cell', 'intensity', 'fx-a:c1', constCurve('intensity', 0.9), 'replace'),
    ])
    expect(fwd.numeric.get('intensity')).toBeCloseTo(0.9, 4)
    // Orden inverso → el zone track gana el display.
    const rev = evalTracks([
      cellTrack('t-cell', 'intensity', 'fx-a:c1', constCurve('intensity', 0.9), 'replace'),
      zoneTrack('t-zone', 'intensity', constCurve('intensity', 0.5), 'replace'),
    ])
    expect(rev.numeric.get('intensity')).toBeCloseTo(0.5, 4)
  })

  test('color tracks con cell: slots #cell independientes (add no se suma entre celdas)', () => {
    // Discriminador: blend 'add'. Pre-8196: rojo+azul en el mismo slot
    // 'color' → magenta (255,0,255). Post-8196: 'color#fx-a:c1' y
    // 'color#fx-a:c2' aislados → LTP último = azul puro (0,0,255).
    const tracks = [
      cellTrack('t-c1', 'color', 'fx-a:c1', constColor(0, 100, 50), 'add'),   // rojo
      cellTrack('t-c2', 'color', 'fx-a:c2', constColor(240, 100, 50), 'add'), // azul
    ]
    const r = evalTracks(tracks)
    expect(r.hasColor).toBe(true)
    expect(r.r).toBe(0)
    expect(r.b).toBe(255)
    expect(r.g).toBe(0)
  })

  test('misma celda + color: blend normal dentro del slot', () => {
    const tracks = [
      cellTrack('t1', 'color', 'fx-a:c1', constColor(0, 100, 50), 'add'),   // rojo
      cellTrack('t2', 'color', 'fx-a:c1', constColor(240, 100, 50), 'add'), // azul
    ]
    const r = evalTracks(tracks)
    expect(r.hasColor).toBe(true)
    // Mismo slot → add → rojo + azul = magenta
    expect(r.r).toBe(255)
    expect(r.b).toBe(255)
  })
})
