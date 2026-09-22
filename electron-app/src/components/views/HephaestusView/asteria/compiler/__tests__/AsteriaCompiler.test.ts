/**
 * 🜨 WAVE 8030-P6 — Tests del AsteriaCompiler + lutSynth (Vía Λ)
 *
 * Gates del blueprint §8.1 verificados en test: zones no vacío (G5),
 * keyframes ASC no vacíos (G5/invariante), spreadDeg=1 (A1 — el canario),
 * overrides absolute + clamp + entero, sin strobe (G6), ids ast_*.
 */

import { describe, test, expect } from 'vitest'
import { compile, injectAstTracks, isAsteriaTrack, ASTERIA_TRACK_PREFIX } from '../AsteriaCompiler'
import { synthesizeLambda } from '../lutSynth'
import { serializeHephClip } from '../../../../../../core/hephaestus/types'
import type {
  HephAutomationClipV3,
  HephCurve,
  HephTrack,
  ZoneTarget,
} from '../../../../../../core/hephaestus/types'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../../core/aether/types'
import type { FieldSnapshot } from '../../model/fieldEngine'
import { createDefaultProject } from '../../model/AsteriaProject'

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

function entry(nodeId: string, deviceId: string): NodeAtlasEntry {
  return {
    nodeId,
    deviceId,
    cellSuffix: nodeId.slice(nodeId.indexOf(':') + 1),
    family: 'IMPACT',
    zoneId: 'front',
    position: { x: 0, y: 0, z: 0 },
    role: 'cell',
  }
}

/** Atlas: 4 nodos sobre 2 fixtures (fx-a multicelular ×2, fx-b ×1, fx-c ×1). */
function makeAtlas(): NodeAtlas {
  const entries = [
    entry('fx-a:petal-l:impact', 'fx-a'),
    entry('fx-a:petal-r:impact', 'fx-a'),
    entry('fx-b:impact', 'fx-b'),
    entry('fx-c:impact', 'fx-c'),
  ]
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

/** Campo: delays 0/250/500/750 ms, todo cubierto, gain identidad. */
function makeField(): FieldSnapshot {
  return {
    count: 4,
    delayMs: new Float32Array([0, 250, 500, 750]),
    gain: new Float32Array([1, 1, 1, 1]),
    mask: new Uint8Array([1, 1, 1, 1]),
  }
}

function makeClip(durationMs = 4000): HephAutomationClipV3 {
  const curve: HephCurve = {
    paramId: 'intensity',
    valueType: 'number',
    range: [0, 1],
    defaultValue: 0,
    keyframes: [
      { timeMs: 0, value: 0, interpolation: 'linear' },
      { timeMs: durationMs / 2, value: 1, interpolation: 'linear' },
      { timeMs: durationMs, value: 0, interpolation: 'linear' },
    ],
    mode: 'absolute',
  }
  const track: HephTrack = {
    id: 'forge-track-01',
    paramId: 'intensity',
    zones: ['all'] as readonly ZoneTarget[],
    curve,
  }
  return {
    id: 'test-clip',
    name: 'Clip',
    author: 'test',
    category: 'composite' as import('../../../../../../core/effects/types').EffectCategory,
    tags: [],
    vibeCompat: ['universal'],
    spatialZones: ['all'] as readonly ZoneTarget[],
    mixBus: 'global',
    priority: 70,
    durationMs,
    effectType: 'heph_custom',
    tracks: [track],
    staticParams: {},
    schemaVersion: '3.0',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 AsteriaCompiler — Vía Λ (WAVE 8030-P6)', () => {
  test('emite pista ast_intensity_lambda_0 con las reglas duras', () => {
    const out = compile({
      atlas: makeAtlas(),
      field: makeField(),
      clip: makeClip(),
      project: createDefaultProject('sha1:x'),
    })
    expect(out.tracks).toHaveLength(1)
    const t = out.tracks[0]
    expect(t.id).toBe('ast_intensity_lambda_0')
    expect(t.id.startsWith(ASTERIA_TRACK_PREFIX)).toBe(true)
    expect(t.zones).toEqual(['all'])                    // G5
    expect(t.blendMode).toBe('replace')
    expect(t.paramId).toBe('intensity')
    expect(t.dimmerScale).toBe(1)
    // A1: spreadDeg=1 — el bus de overrides no puede morir
    expect(t.phaseConfig?.spreadDeg).toBe(1)
    // G5/invariante: keyframes no vacío, ASC, dentro de [0,D]
    expect(t.curve.keyframes.length).toBeGreaterThan(0)
    for (let k = 1; k < t.curve.keyframes.length; k++) {
      expect(t.curve.keyframes[k].timeMs).toBeGreaterThanOrEqual(
        t.curve.keyframes[k - 1].timeMs,
      )
    }
    for (const kf of t.curve.keyframes) {
      expect(kf.timeMs).toBeGreaterThanOrEqual(0)
      expect(kf.timeMs).toBeLessThanOrEqual(4000)
    }
  })

  test('overrides: por deviceId (no por celda), absolute, clamp+entero', () => {
    const out = compile({
      atlas: makeAtlas(),
      field: makeField(),
      clip: makeClip(4000),
      project: createDefaultProject('x'),
    })
    const ov = out.tracks[0].phaseOverrides!
    // 4 nodos → 3 devices; fx-a recibe el retardo de su PRIMER nodo (0)
    expect(Object.keys(ov).sort()).toEqual(['fx-a', 'fx-b', 'fx-c'])
    expect(ov['fx-a']).toEqual({ mode: 'absolute', offsetMs: 0 })
    expect(ov['fx-b']).toEqual({ mode: 'absolute', offsetMs: 500 })
    expect(ov['fx-c']).toEqual({ mode: 'absolute', offsetMs: 750 })
    expect(out.report.overrideCount).toBe(3)
    expect(out.report.devicesTargeted).toBe(3)
    expect(out.report.nodesCovered).toBe(4)
  })

  test('offsetMs clampado a [0, durationMs] y redondeado', () => {
    const field = makeField()
    field.delayMs[2] = 99999.7   // fuera de rango → clamp a D
    field.delayMs[3] = 333.777   // → 334
    const out = compile({
      atlas: makeAtlas(), field, clip: makeClip(4000),
      project: createDefaultProject('x'),
    })
    const ov = out.tracks[0].phaseOverrides!
    expect(ov['fx-b'].offsetMs).toBe(4000)
    expect(ov['fx-c'].offsetMs).toBe(334)
  })

  test('nodos sin cobertura (mask=0) no emiten dirección', () => {
    const field = makeField()
    field.mask[2] = 0 // fx-b sin cubrir
    field.mask[3] = 0 // fx-c sin cubrir
    const out = compile({
      atlas: makeAtlas(), field, clip: makeClip(),
      project: createDefaultProject('x'),
    })
    expect(Object.keys(out.tracks[0].phaseOverrides!)).toEqual(['fx-a'])
  })

  test('campo vacío → EMPTY_FIELD warning + pista sin overrides', () => {
    const field = makeField()
    field.mask.fill(0)
    const out = compile({
      atlas: makeAtlas(), field, clip: makeClip(),
      project: createDefaultProject('x'),
    })
    expect(out.report.warnings).toContain(
      'EMPTY_FIELD — sin nodos cubiertos',
    )
    expect(out.report.overrideCount).toBe(0)
  })

  test('gain no plano → GAIN_REQUIRES_COHORTS (Λ no lo expresa)', () => {
    const field = makeField()
    field.gain[1] = 0.4
    const out = compile({
      atlas: makeAtlas(), field, clip: makeClip(),
      project: createDefaultProject('x'),
    })
    expect(
      out.report.warnings.some((w) => w.startsWith('GAIN_REQUIRES_COHORTS')),
    ).toBe(true)
  })

  test('Λ-Ride: reutiliza la curva de un track Forge existente', () => {
    const project = {
      ...createDefaultProject('x'),
      lutSource: { kind: 'ride' as const, trackId: 'forge-track-01' },
    }
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip: makeClip(),
      project,
    })
    expect(out.report.strategy).toBe('ride')
    expect(out.tracks[0].id).toBe('ast_intensity_ride_0')
    // La curva es la del track fuente (triángulo de 3 kf), no el pulso Λ
    expect(out.tracks[0].curve.keyframes).toHaveLength(3)
    expect(out.tracks[0].curve.keyframes[1].value).toBe(1)
  })

  test('Λ-Ride con trackId inexistente → warning + fallback a pulso', () => {
    const project = {
      ...createDefaultProject('x'),
      lutSource: { kind: 'ride' as const, trackId: 'no-existe' },
    }
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip: makeClip(),
      project,
    })
    expect(
      out.report.warnings.some((w) => w.startsWith('RIDE_SOURCE_MISSING')),
    ).toBe(true)
    expect(out.tracks[0].curve.keyframes).toHaveLength(5) // pulso sintetizado
  })

  test('strobe en targetParams → skipped (G6)', () => {
    const project = {
      ...createDefaultProject('x'),
      targetParams: ['intensity', 'strobe'] as const,
    }
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip: makeClip(),
      project,
    })
    expect(out.tracks).toHaveLength(1)
    expect(out.tracks[0].paramId).toBe('intensity')
    expect(
      out.report.warnings.some((w) => w.startsWith('STROBE_SKIPPED')),
    ).toBe(true)
  })

  test('strategy cohort/mcc → warning + fallback Λ', () => {
    const project = { ...createDefaultProject('x'), strategy: 'cohort' as const }
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip: makeClip(),
      project,
    })
    expect(out.report.strategy).toBe('lambda')
    expect(
      out.report.warnings.some((w) => w.startsWith('STRATEGY_COHORT_PENDING')),
    ).toBe(true)
  })

  test('los tracks ast_* sobreviven serializeHephClip (whitelist)', () => {
    const clip = makeClip()
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip,
      project: createDefaultProject('x'),
    })
    const withAst: HephAutomationClipV3 = {
      ...clip,
      tracks: [...clip.tracks, ...out.tracks],
    }
    const ser = serializeHephClip(withAst)
    const ast = ser.tracks.find((t) => t.id.startsWith('ast_'))!
    expect(ast).toBeDefined()
    expect(ast.phaseConfig?.spreadDeg).toBe(1)
    expect(ast.phaseOverrides?.['fx-b'].offsetMs).toBe(500)
    // El track Forge convive intacto
    expect(ser.tracks.some((t) => t.id === 'forge-track-01')).toBe(true)
  })

  test('synthesizeLambda puro: LUT pulso + bus por deviceId', () => {
    const r = synthesizeLambda(makeField(), 4000, makeAtlas())
    expect(r.curve.keyframes.length).toBe(5)
    expect(r.curve.keyframes[0].timeMs).toBe(0)
    expect(r.curve.keyframes[4].timeMs).toBe(4000)
    expect(r.curve.keyframes[4].value).toBe(0) // cierre C⁰
    expect(r.devicesTargeted).toBe(3)
  })

  // ── injectAstTracks — sustitución quirúrgica (WAVE 8030-P7) ──

  test('injectAstTracks: reemplaza SOLO ast_*, Forge intacto, embebe proyecto', () => {
    const clip = makeClip()
    const prevAst: HephTrack = {
      id: 'ast_intensity_lambda_0',
      paramId: 'intensity',
      zones: ['all'],
      curve: {
        paramId: 'intensity', valueType: 'number', range: [0, 1],
        defaultValue: 0, mode: 'absolute',
        keyframes: [{ timeMs: 0, value: 0, interpolation: 'hold' }],
      },
    }
    clip.tracks.push(prevAst)

    const project = createDefaultProject('sha1:fp')
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip, project,
    })
    const next = injectAstTracks(clip, out.tracks, project)

    // El ast_ viejo fue reemplazado por el nuevo (mismo id, contenido nuevo)
    const asts = next.tracks.filter((t) => isAsteriaTrack(t.id))
    expect(asts).toHaveLength(1)
    expect(asts[0].phaseOverrides?.['fx-b'].offsetMs).toBe(500)
    // Forge intacto — misma referencia de track
    expect(next.tracks.find((t) => t.id === 'forge-track-01'))
      .toBe(clip.tracks[0])
    // La receta viaja embebida (D-4)
    expect(next.asteria).toBe(project)
    // Clip original inmutable
    expect(clip.asteria).toBeUndefined()
    expect(clip.tracks.filter((t) => isAsteriaTrack(t.id))).toHaveLength(1)
  })

  test('injectAstTracks con stack vacío compilado elimina los ast_*', () => {
    const clip = makeClip()
    clip.tracks.push({
      id: 'ast_intensity_lambda_0',
      paramId: 'intensity',
      zones: ['all'],
      curve: {
        paramId: 'intensity', valueType: 'number', range: [0, 1],
        defaultValue: 0, mode: 'absolute',
        keyframes: [{ timeMs: 0, value: 0, interpolation: 'hold' }],
      },
    })
    const next = injectAstTracks(clip, [], createDefaultProject('x'))
    expect(next.tracks).toHaveLength(1) // solo forge-track-01
    expect(next.tracks[0].id).toBe('forge-track-01')
  })
})
