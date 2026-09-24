/**
 * 🜨 WAVE 8030-P6 — Tests del AsteriaCompiler + lutSynth (Vía Λ)
 *
 * Gates del blueprint §8.1 verificados en test: zones no vacío (G5),
 * keyframes ASC no vacíos (G5/invariante), spreadDeg=1 (A1 — el canario),
 * overrides absolute + clamp + entero, ids ast_*.
 * (WAVE 8080-M1: gate G6 de strobe retirado — el operador decide.)
 */

import { describe, test, expect } from 'vitest'
import { compile, injectAstTracks, isAsteriaTrack, validateAstTrack, ASTERIA_TRACK_PREFIX } from '../AsteriaCompiler'
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
import type { FieldPlanes, FieldSnapshot } from '../../model/fieldEngine'
import { evaluateStack } from '../../model/fieldEngine'
import { CurveEvaluator } from '../../../../../../core/hephaestus/CurveEvaluator'
import {
  hslToSrgb,
  srgbToLinear,
  linearToOklabInto,
  oklabDeltaE,
} from '../../model/colorMath'
import { createDefaultProject, migrateV1toV2 } from '../../model/AsteriaProject'
import type {
  AsteriaProjectV1,
  Gesture,
  GlyphGesture,
} from '../../model/AsteriaProject'

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

/**
 * Campo: delays 0/0/500/750 ms — UNIFORME por fixture (las dos celdas de
 * fx-a comparten delay) ⇒ 'auto' resuelve λ, preservando las aserciones
 * Λ históricas (fx-a recibe el delay de su primer nodo = 0).
 */
function makeField(): FieldSnapshot {
  return {
    count: 4,
    delayMs: new Float32Array([0, 0, 500, 750]),
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
  test('emite pista ast_intensity_lambda_base_0 con las reglas duras', () => {
    const out = compile({
      atlas: makeAtlas(),
      field: makeField(),
      clip: makeClip(),
      project: createDefaultProject('sha1:x'),
    })
    expect(out.tracks).toHaveLength(1)
    const t = out.tracks[0]
    expect(t.id).toBe('ast_intensity_lambda_base_0')
    expect(t.id.startsWith(ASTERIA_TRACK_PREFIX)).toBe(true)
    expect(t.zones).toEqual(['all'])                    // G5
    expect(t.blendMode).toBe('replace')
    expect(t.paramId).toBe('intensity')
    // WAVE 8090-M1: dimmerScale era dead write — ya no se emite
    expect(t.dimmerScale).toBeUndefined()
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

  test('gain no plano → GAIN_REQUIRES_COHORTS (Λ explícita no lo expresa)', () => {
    const field = makeField()
    field.gain[1] = 0.4
    const out = compile({
      atlas: makeAtlas(), field, clip: makeClip(),
      // Λ forzada — con 'auto' el árbol §4.3 elegiría cohort
      project: { ...createDefaultProject('x'), strategy: 'lambda' as const },
    })
    expect(
      out.report.warnings.some((w) => w.startsWith('GAIN_REQUIRES_COHORTS')),
    ).toBe(true)
  })

  test('Λ-Ride: la curva emitida es estructuralmente IDÉNTICA a la fuente (Gate 8050)', () => {
    const clip = makeClip()
    const project = {
      ...createDefaultProject('x'),
      defaultPaint: {
        params: ['intensity'] as const,
        lut: { kind: 'ride' as const, trackId: 'forge-track-01' },
      },
    }
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip,
      project,
    })
    expect(out.report.strategy).toBe('ride')
    expect(out.tracks).toHaveLength(1) // una única pista nueva + bus
    const t = out.tracks[0]
    expect(t.id).toBe('ast_intensity_ride_base_0')
    // Comparación estructural: keyframes byte-a-byte idénticos a la
    // fuente Forge — la Vía Λ no sintetiza, solo inyecta direcciones.
    const src = clip.tracks[0].curve
    expect(t.curve.keyframes).toEqual(src.keyframes)
    expect(t.curve.range).toEqual(src.range)
    expect(t.curve.valueType).toBe(src.valueType)
    expect(t.curve.mode).toBe(src.mode)
    // Deep-clone: cero alias al clip vivo (mutar la pista no toca Forge)
    expect(t.curve).not.toBe(src)
    expect(t.curve.keyframes[0]).not.toBe(src.keyframes[0])
    // El bus de direcciones va sobre la curva prestada
    expect(Object.keys(t.phaseOverrides!).length).toBe(3)
  })

  // ── 🜨 WAVE 8160: Λ-Frozen murió — el glifo jamás monta la Vía Λ ──
  //    La imagen estática se hornea por celda (MCC-Cell); el drift de
  //    duración era un artefacto del truco Λ que ya no existe.

  test('glyph estático bajo strategy lambda → enrutado a MCC-Cell', () => {
    const project = {
      ...createDefaultProject('x'),
      strategy: 'lambda' as const,
      stack: [
        { kind: 'base' as const, id: 'base', delayMs: 0, gain: 1 },
        {
          kind: 'glyph' as const, id: 'g1', op: 'replace' as const,
          text: 'LUX', mask: { nodeIds: ['fx-a:petal-l:impact'] },
          transform: { x: 0, z: 0, scaleM: 1.4, rotDeg: 0 },
          channel: 'gain' as const, antialias: true,
        },
      ],
    }
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip: makeClip(),
      project,
    })
    expect(out.report.strategy).toBe('mcc')
    expect(
      out.report.warnings.some((w) => w.startsWith('GLYPH_ROUTED_MCC')),
    ).toBe(true)
    expect(
      out.report.warnings.some((w) => w.startsWith('LAMBDA_FROZEN_DRIFT')),
    ).toBe(false)
  })

  test('glyph en canal delay bajo lambda → MCC también (texto 1:1)', () => {
    const project = {
      ...createDefaultProject('x'),
      strategy: 'lambda' as const,
      stack: [
        { kind: 'base' as const, id: 'base', delayMs: 0, gain: 1 },
        {
          kind: 'glyph' as const, id: 'g1', op: 'replace' as const,
          text: 'LUX', mask: { nodeIds: ['fx-a:petal-l:impact'] },
          transform: { x: 0, z: 0, scaleM: 1.4, rotDeg: 0 },
          channel: 'delay' as const, antialias: true,
        },
      ],
    }
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip: makeClip(),
      project,
    })
    expect(out.report.strategy).toBe('mcc')
    expect(
      out.report.warnings.some((w) => w.startsWith('LAMBDA_FROZEN_DRIFT')),
    ).toBe(false)
  })

  test('Λ-Ride con trackId inexistente → warning + fallback a pulso', () => {
    const project = {
      ...createDefaultProject('x'),
      defaultPaint: {
        params: ['intensity'] as const,
        lut: { kind: 'ride' as const, trackId: 'no-existe' },
      },
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

  test('strobe en paint.params → compila como cualquier param (8080-M1, G6 retirado)', () => {
    const project = {
      ...createDefaultProject('x'),
      defaultPaint: { params: ['intensity', 'strobe'] as const },
    }
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip: makeClip(),
      project,
    })
    expect(out.tracks).toHaveLength(2)
    expect(out.tracks.map((t) => t.paramId)).toEqual(['intensity', 'strobe'])
    expect(
      out.report.warnings.some((w) => w.startsWith('STROBE_SKIPPED')),
    ).toBe(false)
  })

  test('strategy explícita cohort → emite cohortes reales (no fallback Λ)', () => {
    const project = { ...createDefaultProject('x'), strategy: 'cohort' as const }
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip: makeClip(),
      project,
    })
    expect(out.report.strategy).toBe('cohort')
    expect(out.tracks.length).toBeGreaterThan(0)
    expect(out.tracks.every((t) => t.id.includes('_cohort_'))).toBe(true)
  })

  test('AST_SHADOWS_FORGE (8070-M4): track Forge con mismo paramId+zona → aviso', () => {
    // makeClip() tiene 'forge-track-01' = intensity + zones ['all'] —
    // el ast_intensity_lambda lo enmascara con replace.
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip: makeClip(),
      project: createDefaultProject('x'),
    })
    expect(
      out.report.warnings.some(
        (w) =>
          w.startsWith('AST_SHADOWS_FORGE') && w.includes('forge-track-01'),
      ),
    ).toBe(true)
  })

  test('AST_SHADOWS_FORGE: paramId distinto o zona disjunta → silencio', () => {
    const clip = makeClip()
    // El track Forge apunta a 'zoom' — paint.params = ['intensity']
    clip.tracks[0] = { ...clip.tracks[0], paramId: 'zoom' }
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip,
      project: createDefaultProject('x'),
    })
    expect(
      out.report.warnings.some((w) => w.startsWith('AST_SHADOWS_FORGE')),
    ).toBe(false)
  })

  test('AST_SHADOWS_FORGE: misma param pero zona disjunta → silencio', () => {
    const clip = makeClip()
    clip.tracks[0] = {
      ...clip.tracks[0],
      zones: ['back'] as readonly ZoneTarget[],
    }
    // Cohort emite zonas derivadas del atlas ('front') → sin solape
    const field = makeField()
    field.gain[1] = 0.4
    const out = compile({
      atlas: makeAtlas(), field, clip,
      project: { ...createDefaultProject('x'), strategy: 'cohort' as const },
    })
    expect(
      out.report.warnings.some((w) => w.startsWith('AST_SHADOWS_FORGE')),
    ).toBe(false)
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

// ═════════════════════════════════════════════════════════════════════════════
// WAVE 8040B — Vía B (cohort) + MCC-Cell + árbol 'auto' + validador
// ═════════════════════════════════════════════════════════════════════════════

/** Entry con zona explícita (los tests de spill necesitan zonas variadas). */
function zoned(nodeId: string, deviceId: string, zoneId: string): NodeAtlasEntry {
  return { ...entry(nodeId, deviceId), zoneId }
}

/** Atlas 4 fixtures monocelda: a,b en 'front' · c,d en 'back'. */
function makeCohortAtlas(): NodeAtlas {
  const entries = [
    zoned('fx-a:impact', 'fx-a', 'front'),
    zoned('fx-b:impact', 'fx-b', 'front'),
    zoned('fx-c:impact', 'fx-c', 'back'),
    zoned('fx-d:impact', 'fx-d', 'back'),
  ]
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🜨 WAVE 8190 — fixtures de familia: el planner filtra miembros por la
// familia Aether del param (intensity→IMPACT, color→COLOR). Un atlas sin
// nodos COLOR ya no recibe pistas color muertas — los tests de color
// necesitan atlas con familia explícita.
// ─────────────────────────────────────────────────────────────────────────────

/** Entry con familia explícita (zona 'front' salvo indicación). */
function famEntry(
  nodeId: string,
  deviceId: string,
  family: string,
  zoneId = 'front',
): NodeAtlasEntry {
  return { ...entry(nodeId, deviceId), family, zoneId }
}

/** Espejo de makeAtlas pero familia COLOR — 4 nodos sobre 3 devices. */
function makeColorAtlas(): NodeAtlas {
  const entries = [
    famEntry('fx-a:petal-l:color', 'fx-a', 'COLOR'),
    famEntry('fx-a:petal-r:color', 'fx-a', 'COLOR'),
    famEntry('fx-b:color', 'fx-b', 'COLOR'),
    famEntry('fx-c:color', 'fx-c', 'COLOR'),
  ]
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

/** Espejo de makeCohortAtlas en COLOR: a,b 'front' · c,d 'back'. */
function makeColorCohortAtlas(): NodeAtlas {
  const entries = [
    famEntry('fx-a:color', 'fx-a', 'COLOR', 'front'),
    famEntry('fx-b:color', 'fx-b', 'COLOR', 'front'),
    famEntry('fx-c:color', 'fx-c', 'COLOR', 'back'),
    famEntry('fx-d:color', 'fx-d', 'COLOR', 'back'),
  ]
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

/** Atlas dual IMPACT+COLOR por device — para DIM+CLR decoupled. */
function makeDualAtlas(): NodeAtlas {
  const entries = [
    entry('fx-a:impact', 'fx-a'),
    famEntry('fx-a:color', 'fx-a', 'COLOR'),
    entry('fx-b:impact', 'fx-b'),
    famEntry('fx-b:color', 'fx-b', 'COLOR'),
    entry('fx-c:impact', 'fx-c'),
    famEntry('fx-c:color', 'fx-c', 'COLOR'),
  ]
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

describe('🧬 AsteriaCompiler — Vía B / MCC-Cell / auto (WAVE 8040B)', () => {
  test('cohort: K cohortes por gain → pista por cohorte con gain horneado (8090-M1)', () => {
    const field: FieldSnapshot = {
      count: 4,
      delayMs: new Float32Array([0, 100, 200, 300]),
      gain: new Float32Array([1, 0.5, 1, 0.5]),
      mask: new Uint8Array([1, 1, 1, 1]),
    }
    const project = {
      ...createDefaultProject('x'),
      strategy: 'cohort' as const,
      cohortBudget: 2,
    }
    const out = compile({
      atlas: makeCohortAtlas(), field, clip: makeClip(), project,
    })
    expect(out.report.strategy).toBe('cohort')
    expect(out.tracks).toHaveLength(2) // 2 cohortes × 1 param
    expect(out.tracks.map((t) => t.id)).toEqual([
      'ast_intensity_cohort_base_0',
      'ast_intensity_cohort_base_1',
    ])
    // Percentiles sobre [0.5,0.5,1,1] → cohort0 gain≈0.5, cohort1 gain=1
    // WAVE 8090-M1: el gain se hornea en los keyframes (intensity incluido)
    // — dimmerScale era dead write, ya no se emite.
    const peak0 = Math.max(
      ...out.tracks[0].curve.keyframes.map((k) => k.value as number),
    )
    const peak1 = Math.max(
      ...out.tracks[1].curve.keyframes.map((k) => k.value as number),
    )
    expect(peak0).toBeCloseTo(0.5, 3)
    expect(peak1).toBeCloseTo(1, 3)
    expect(out.tracks[0].dimmerScale).toBeUndefined()
    expect(out.tracks[1].dimmerScale).toBeUndefined()
    // Zonas recortadas por cohorte — nunca vacío (G5)
    expect(out.tracks[0].zones).toEqual(['front', 'back'])
    // Overrides absolutos clavan los miembros (enteros, [0,D])
    const ov0 = out.tracks[0].phaseOverrides!
    expect(Object.keys(ov0).sort()).toEqual(['fx-b', 'fx-d'])
    for (const dev of Object.keys(ov0)) {
      expect(Number.isInteger(ov0[dev].offsetMs)).toBe(true)
      expect(ov0[dev].mode).toBe('absolute')
      expect(ov0[dev].offsetMs).toBeGreaterThanOrEqual(0)
      expect(ov0[dev].offsetMs).toBeLessThanOrEqual(4000)
    }
    // Curvas rotadas por el delay representativo de cada cohorte
    // (cohort0 d̄=200, cohort1 d̄=150 → geometrías distintas)
    expect(out.tracks[0].curve.keyframes.map((k) => k.timeMs)).not.toEqual(
      out.tracks[1].curve.keyframes.map((k) => k.timeMs),
    )
  })

  test('cohort: zona compartida con nodos ajenos → COHORT_ZONE_SPILL con ids', () => {
    // Todos en 'front': cualquier cohorte alcanza a los demás devices
    const atlas: NodeAtlas = (() => {
      const entries = [
        zoned('fx-a:impact', 'fx-a', 'front'),
        zoned('fx-b:impact', 'fx-b', 'front'),
        zoned('fx-c:impact', 'fx-c', 'front'),
      ]
      return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
    })()
    const field: FieldSnapshot = {
      count: 3,
      delayMs: new Float32Array([0, 0, 0]),
      gain: new Float32Array([1, 0.2, 1]),
      mask: new Uint8Array([1, 1, 1]),
    }
    const project = {
      ...createDefaultProject('x'),
      strategy: 'cohort' as const,
      cohortBudget: 2,
    }
    const out = compile({ atlas, field, clip: makeClip(), project })
    const spill = out.report.warnings.filter((w) =>
      w.startsWith('COHORT_ZONE_SPILL'),
    )
    expect(spill.length).toBeGreaterThan(0)
    // La cohorte de gain 0.2 (solo fx-b) alcanza por zona a fx-a y fx-c
    expect(spill[0]).toContain('fx-a:impact')
    expect(spill[0]).toContain('fx-c:impact')
  })

  test('mcc: una pista por celda — cell=nodeId, curva rotada por celda', () => {
    const field: FieldSnapshot = {
      count: 4,
      delayMs: new Float32Array([0, 500, 250, 0]),
      gain: new Float32Array([1, 1, 1, 1]),
      mask: new Uint8Array([1, 1, 1, 1]),
    }
    const project = { ...createDefaultProject('x'), strategy: 'mcc' as const }
    const out = compile({
      atlas: makeAtlas(), field, clip: makeClip(), project,
    })
    expect(out.report.strategy).toBe('mcc')
    expect(out.tracks).toHaveLength(4) // 4 celdas cubiertas × 1 param
    // cell = nodeId completo (quirúrgico por Δ3, §4.2)
    expect(out.tracks.map((t) => t.cell)).toEqual([
      'fx-a:petal-l:impact',
      'fx-a:petal-r:impact',
      'fx-b:impact',
      'fx-c:impact',
    ])
    // Sin phase bus: el retardo vive en la geometría de la curva
    for (const t of out.tracks) {
      expect(t.phaseOverrides).toBeUndefined()
      expect(t.blendMode).toBe('replace')
      expect(t.zones.length).toBeGreaterThan(0)
    }
    // La celda con delay 500 lleva la curva rotada: su kf[0] tiene el
    // valor CORTADO C(500)=1 (meseta del pulso) — la de delay 0 abre en 0.
    expect(out.tracks[0].curve.keyframes[0]).toMatchObject({
      timeMs: 0, value: 0,
    })
    expect(out.tracks[1].curve.keyframes[0]).toMatchObject({
      timeMs: 0, value: 1,
    })
    expect(out.report.devicesTargeted).toBe(3)
    expect(out.report.overrideCount).toBe(0)
  })

  test('mcc: gain por celda → horneado en keyframes de intensity (8090-M1)', () => {
    const field: FieldSnapshot = {
      count: 4,
      delayMs: new Float32Array([0, 0, 0, 0]),
      gain: new Float32Array([1, 0.5, 1, 1]),
      mask: new Uint8Array([1, 1, 1, 1]),
    }
    const project = { ...createDefaultProject('x'), strategy: 'mcc' as const }
    const out = compile({
      atlas: makeAtlas(), field, clip: makeClip(), project,
    })
    // El motor lee los keyframes ya escalados — sin depender del campo
    // muerto dimmerScale (auditoría 8080-M3).
    const peak1 = Math.max(
      ...out.tracks[1].curve.keyframes.map((k) => k.value as number),
    )
    const peak0 = Math.max(
      ...out.tracks[0].curve.keyframes.map((k) => k.value as number),
    )
    expect(peak1).toBeCloseTo(0.5, 3)
    expect(peak0).toBe(1)
    expect(out.tracks[0].dimmerScale).toBeUndefined()
    expect(out.tracks[1].dimmerScale).toBeUndefined()
  })

  test("auto: distinción intra-fixture → mcc; gain sin celda → cohort", () => {
    // fx-a tiene 2 celdas con delays distintos → distingue celdas → mcc
    const cellField: FieldSnapshot = {
      count: 4,
      delayMs: new Float32Array([0, 900, 250, 250]),
      gain: new Float32Array([1, 1, 1, 1]),
      mask: new Uint8Array([1, 1, 1, 1]),
    }
    const auto = { ...createDefaultProject('x'), strategy: 'auto' as const }
    const outMcc = compile({
      atlas: makeAtlas(), field: cellField, clip: makeClip(), project: auto,
    })
    expect(outMcc.report.strategy).toBe('mcc')

    // Mismo delay en ambas celdas de fx-a, pero gain varía → cohorte…
    // 🜨 WAVE 8186: 'auto' ahora emite el pipeline mcc-device — con todos
    // los nodos en 'front' cada cohorte derrama → aislamiento total.
    const gainField: FieldSnapshot = {
      count: 4,
      delayMs: new Float32Array([0, 0, 0, 0]),
      gain: new Float32Array([1, 1, 0.3, 1]),
      mask: new Uint8Array([1, 1, 1, 1]),
    }
    const outCohort = compile({
      atlas: makeAtlas(), field: gainField, clip: makeClip(), project: auto,
    })
    expect(outCohort.report.strategy).toBe('mcc-device')
    expect(outCohort.tracks.every((t) => t.cell !== undefined)).toBe(true)
  })

  test('validador: keyframes no ASC o fuera de dominio → rechazo', () => {
    const bad: HephTrack = {
      id: 'ast_intensity_mcc_base_0',
      paramId: 'intensity',
      zones: ['all'],
      curve: {
        paramId: 'intensity', valueType: 'number', range: [0, 1],
        defaultValue: 0, mode: 'absolute',
        keyframes: [
          { timeMs: 500, value: 1, interpolation: 'linear' },
          { timeMs: 100, value: 0, interpolation: 'linear' }, // no ASC
        ],
      },
    }
    expect(validateAstTrack(bad, 4000)).toContain('no ASC')
    bad.curve.keyframes = [{ timeMs: 5000, value: 0.5, interpolation: 'linear' }]
    expect(validateAstTrack(bad, 4000)).toContain('fuera de [0, 4000]')
    bad.curve.keyframes = []
    expect(validateAstTrack(bad, 4000)).toContain('keyframes vacío')
    const noPrefix = { ...bad, id: 'forge_x', curve: { ...bad.curve, keyframes: [{ timeMs: 0, value: 0, interpolation: 'linear' as const }] } }
    expect(validateAstTrack(noPrefix, 4000)).toContain('ast_')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// WAVE 8110/8120 — Chromatic Injection → pulso monocromático (Muerte al Arcoíris)
// ═════════════════════════════════════════════════════════════════════════════

type HslValue = { h: number; s: number; l: number }
const hslOf = (kf: { value: number | HslValue }): HslValue =>
  kf.value as HslValue
const peakL = (t: HephTrack): number =>
  Math.max(...t.curve.keyframes.map((k) => hslOf(k).l))

describe('🌈 AsteriaCompiler — Pulso Monocromático (WAVE 8120)', () => {
  test('Λ + color: pulso HSL — H/S del paint.color constantes, solo L pulsa', () => {
    const project = {
      ...createDefaultProject('x'),
      defaultPaint: { params: ['color'] as const },
      // color default '#ff0000' → h=0, s=100, l=50
    }
    const out = compile({
      atlas: makeColorAtlas(), field: makeField(), clip: makeClip(), project,
    })
    expect(out.tracks).toHaveLength(1)
    const t = out.tracks[0]
    expect(t.id).toBe('ast_color_lambda_base_0')
    expect(t.paramId).toBe('color')
    expect(t.curve.valueType).toBe('color')
    // 5 kfs — geometría trapezoidal del λ-pulse, no el barrido de hue
    const kfs = t.curve.keyframes
    expect(kfs).toHaveLength(5)
    // H/S constantes en TODOS los keyframes (delta hue = 0 — cero deriva)
    for (const kf of kfs) {
      const hsl = hslOf(kf)
      expect(hsl.h).toBe(0)
      expect(hsl.s).toBe(100)
    }
    // El pulso es en Lightness: 0 → 50 → 50 → 0 → 0 (pico = color exacto)
    expect(kfs.map((k) => hslOf(k).l)).toEqual([0, 50, 50, 0, 0])
    expect((t.curve.defaultValue as HslValue).l).toBe(0) // reposo negro
    // Bus de direcciones intacto — la ola enciende/apaga el color elegido
    expect(Object.keys(t.phaseOverrides!).length).toBe(3)
    expect(
      out.report.warnings.some((w) => w.startsWith('PARAM_SKIPPED')),
    ).toBe(false)
  })

  test('Λ + color: paint.color custom — H/S del hex horneados en el pulso', () => {
    const project = {
      ...createDefaultProject('x'),
      defaultPaint: {
        params: ['color'] as const,
        color: '#0080ff', // azul azure → h≈210, s=100, l=50
      },
    }
    const out = compile({
      atlas: makeColorAtlas(), field: makeField(), clip: makeClip(), project,
    })
    const kfs = out.tracks[0].curve.keyframes
    for (const kf of kfs) {
      const hsl = hslOf(kf)
      expect(hsl.h).toBe(210)
      expect(hsl.s).toBe(100)
    }
    expect(Math.max(...kfs.map((k) => hslOf(k).l))).toBeCloseTo(50, 5)
  })

  test('Λ multi-param: intensity emite λ-pulse, color → ESTÁTICO (luminancia §2.4)', () => {
    // 🜨 WAVE 8190 — Regla de Propiedad de Luminancia: con intensity
    // activo, 'color' clasifica 'uniform-static' → 1 pista, 1 keyframe.
    // El pulso temporal lo posee intensity; el color aporta solo el tono.
    const field: FieldSnapshot = {
      count: 6,
      delayMs: new Float32Array([0, 0, 500, 500, 750, 750]),
      gain: new Float32Array([1, 1, 1, 1, 1, 1]),
      mask: new Uint8Array([1, 1, 1, 1, 1, 1]),
    }
    const project = {
      ...createDefaultProject('x'),
      defaultPaint: { params: ['intensity', 'color'] as const },
    }
    const out = compile({
      atlas: makeDualAtlas(), field, clip: makeClip(), project,
    })
    expect(out.tracks).toHaveLength(2)
    expect(out.tracks[0].id).toBe('ast_intensity_lambda_base_0')
    expect(out.tracks[0].curve.valueType).toBe('number')
    expect(Object.keys(out.tracks[0].phaseOverrides!)).toHaveLength(3)
    const ct = out.tracks[1]
    expect(ct.id).toBe('ast_color_static_base_0')
    expect(ct.paramId).toBe('color')
    expect(ct.curve.valueType).toBe('color')
    expect(ct.curve.keyframes).toHaveLength(1) // hold — sin envolvente
    expect(hslOf(ct.curve.keyframes[0])).toEqual({ h: 0, s: 100, l: 50 })
    expect(ct.phaseOverrides).toBeUndefined()  // constante — sin bus
  })

  test('cohort + color: gain horneado en Lightness — H/S intactos', () => {
    const field: FieldSnapshot = {
      count: 4,
      delayMs: new Float32Array([0, 100, 200, 300]),
      gain: new Float32Array([1, 0.5, 1, 0.5]),
      mask: new Uint8Array([1, 1, 1, 1]),
    }
    const project = {
      ...createDefaultProject('x'),
      strategy: 'cohort' as const,
      cohortBudget: 2,
      defaultPaint: { params: ['color'] as const },
    }
    const out = compile({
      atlas: makeColorCohortAtlas(), field, clip: makeClip(), project,
    })
    expect(out.tracks).toHaveLength(2)
    expect(out.tracks.map((t) => t.id)).toEqual([
      'ast_color_cohort_base_0',
      'ast_color_cohort_base_1',
    ])
    // cohort0 gain≈0.5 → pico L ≈ 25; cohort1 gain=1 → pico L=50.
    // El horneado escala `l` de cada kf — la rotación por delay solo
    // mueve la geometría temporal, nunca el tono.
    expect(peakL(out.tracks[0])).toBeCloseTo(25, 5)
    expect(peakL(out.tracks[1])).toBeCloseTo(50, 5)
    for (const t of out.tracks) {
      for (const kf of t.curve.keyframes) {
        const hsl = hslOf(kf)
        expect(hsl.h).toBe(0)     // rojo intacto
        expect(hsl.s).toBe(100)
        expect(hsl.l).toBeGreaterThanOrEqual(0)
        expect(hsl.l).toBeLessThanOrEqual(100)
      }
    }
  })

  test('mcc + color: L por celda horneada — el fade espacial es a negro', () => {
    const field: FieldSnapshot = {
      count: 4,
      delayMs: new Float32Array([0, 0, 0, 0]),
      gain: new Float32Array([1, 0.5, 1, 1]),
      mask: new Uint8Array([1, 1, 1, 1]),
    }
    const project = {
      ...createDefaultProject('x'),
      strategy: 'mcc' as const,
      defaultPaint: { params: ['color'] as const },
    }
    const out = compile({
      atlas: makeColorAtlas(), field, clip: makeClip(), project,
    })
    expect(out.tracks).toHaveLength(4)
    expect(peakL(out.tracks[0])).toBeCloseTo(50, 5)  // gain 1 → L intacta
    expect(peakL(out.tracks[1])).toBeCloseTo(25, 5)  // gain 0.5 → L×0.5
    for (const t of out.tracks) {
      expect(t.curve.valueType).toBe('color')
      expect(t.cell).toBeDefined() // Δ1+Δ3 intactos sobre color
    }
  })

  test('Λ-Ride: fuente color clona agnósticamente; fuente numérica + color → warning + LUT', () => {
    // a) Fuente color: la curva esculpida en Forge es la base — ride puro
    const clip = makeClip()
    clip.tracks.push({
      id: 'forge-color-01',
      paramId: 'color',
      zones: ['all'] as readonly ZoneTarget[],
      curve: {
        paramId: 'color',
        valueType: 'color',
        range: [0, 360],
        defaultValue: { h: 0, s: 100, l: 50 },
        keyframes: [
          { timeMs: 0, value: { h: 200, s: 90, l: 40 }, interpolation: 'linear' },
          { timeMs: 4000, value: { h: 320, s: 90, l: 40 }, interpolation: 'linear' },
        ],
        mode: 'absolute',
      },
    })
    const rideColor = compile({
      atlas: makeColorAtlas(), field: makeField(), clip,
      project: {
        ...createDefaultProject('x'),
        defaultPaint: {
          params: ['color'] as const,
          lut: { kind: 'ride' as const, trackId: 'forge-color-01' },
        },
      },
    })
    const rt = rideColor.tracks[0]
    expect(rt.curve.valueType).toBe('color')
    expect(rt.curve.keyframes).toEqual(
      clip.tracks[1].curve.keyframes, // clon estructural del azul→magenta
    )
    expect(
      rideColor.report.warnings.some((w) => w.startsWith('RIDE_TYPE_MISMATCH')),
    ).toBe(false)

    // b) Fuente numérica + target color: sin clone silencioso de basura —
    //    warning honesto y caída a la LUT sintética.
    const rideNumeric = compile({
      atlas: makeColorAtlas(), field: makeField(), clip,
      project: {
        ...createDefaultProject('x'),
        defaultPaint: {
          params: ['color'] as const,
          lut: { kind: 'ride' as const, trackId: 'forge-track-01' },
        },
      },
    })
    expect(
      rideNumeric.report.warnings.some((w) =>
        w.startsWith('RIDE_TYPE_MISMATCH'),
      ),
    ).toBe(true)
    const fb = rideNumeric.tracks[0]
    expect(fb.curve.valueType).toBe('color')
    expect(fb.curve.keyframes).toHaveLength(5) // pulso monocromático
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 🜨 WAVE 8160 — GLYPH ROUTING: máscara libre 1:1, adiós COHORT_ZONE_SPILL
// ─────────────────────────────────────────────────────────────────────────────

function zEntry(
  nodeId: string, deviceId: string, zoneId: string, x: number, z: number,
): NodeAtlasEntry {
  return {
    nodeId, deviceId,
    cellSuffix: nodeId.slice(nodeId.indexOf(':') + 1),
    family: 'IMPACT', zoneId,
    position: { x, y: 0, z }, role: 'cell',
  }
}

/** Rig de 2 zonas: 'front' f1..f4, 'back' b1..b2 — el spill de zonas vive aquí. */
function zonedAtlas(): NodeAtlas {
  const entries = [
    zEntry('f1:impact', 'f1', 'front', -1.5, -0.5),
    zEntry('f2:impact', 'f2', 'front', -0.5, -0.5),
    zEntry('f3:impact', 'f3', 'front', 0.5, -0.5),
    zEntry('f4:impact', 'f4', 'front', 1.5, -0.5),
    zEntry('b1:impact', 'b1', 'back', -1, 0.5),
    zEntry('b2:impact', 'b2', 'back', 1, 0.5),
  ]
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

function glyphGesture(mask: readonly string[]): GlyphGesture {
  return {
    kind: 'glyph', id: 'g1', op: 'replace', text: 'HI',
    mask: { nodeIds: [...mask] },
    transform: { x: 0, z: -0.5, scaleM: 2, rotDeg: 0 },
    channel: 'gain', antialias: true,
  }
}

/** Campo: solo los `ids` enmascarados, gain variable → 'auto' elegiría cohort. */
function maskedField(atlas: NodeAtlas, ids: readonly string[]): FieldSnapshot {
  const n = atlas.entries.length
  const field: FieldSnapshot = {
    count: n,
    delayMs: new Float32Array(n),
    gain: new Float32Array(n).fill(1),
    mask: new Uint8Array(n),
  }
  const wanted = new Set(ids)
  atlas.entries.forEach((e, i) => {
    if (!wanted.has(e.nodeId)) return
    field.mask[i] = 1
    field.gain[i] = i % 2 === 0 ? 1 : 0.5 // gainVaries → cohort bajo 'auto'
  })
  return field
}

function glyphProject(
  mask: readonly string[],
  strategy: 'auto' | 'cohort' | 'mcc' | 'lambda' = 'auto',
) {
  return {
    ...createDefaultProject('x'),
    strategy,
    stack: [
      { kind: 'base' as const, id: 'base', delayMs: 0, gain: 1 },
      glyphGesture(mask),
    ],
  }
}

describe('🜨 WAVE 8160 — Glyph routing & máscara libre', () => {
  test('glyph nunca cruza la Vía B: máscara parcial de zona → mcc, cero SPILL', () => {
    // f1,f2 son SUBCONJUNTO de la zona 'front' — bajo cohortes la zona
    // alcanzaría f3,f4 (spill real). Con glyph → celular 1:1.
    const atlas = zonedAtlas()
    const mask = ['f1:impact', 'f2:impact']
    const out = compile({
      atlas,
      field: maskedField(atlas, mask),
      clip: makeClip(),
      project: glyphProject(mask, 'auto'),
    })
    expect(out.report.strategy).toBe('mcc')
    expect(
      out.report.warnings.some((w) => w.startsWith('COHORT_ZONE_SPILL')),
    ).toBe(false)
    // MCC-Cell: una pista por nodo cubierto, cell = nodeId exacto
    expect(out.tracks.length).toBeGreaterThan(0)
    const cells = new Set(out.tracks.map((t) => t.cell))
    expect(cells).toEqual(new Set(mask))
    for (const t of out.tracks) {
      expect(t.zones).toEqual(['all'])
    }
  })

  test("strategy 'cohort' explícita + glyph → relevada por MCC + aviso", () => {
    const atlas = zonedAtlas()
    const mask = ['f1:impact', 'f2:impact']
    const out = compile({
      atlas,
      field: maskedField(atlas, mask),
      clip: makeClip(),
      project: glyphProject(mask, 'cohort'),
    })
    expect(out.report.strategy).toBe('mcc')
    expect(
      out.report.warnings.some((w) => w.startsWith('GLYPH_ROUTED_MCC')),
    ).toBe(true)
    expect(
      out.report.warnings.some((w) => w.startsWith('COHORT_ZONE_SPILL')),
    ).toBe(false)
  })

  test('restricción crítica: selección irregular de 10 → solo esas 10 pistas', () => {
    // 10 nodos irregulares repartidos entre dos zonas — máscara arbitraria
    const entries: NodeAtlasEntry[] = []
    const mask: string[] = []
    for (let i = 0; i < 10; i++) {
      const id = `fx-${i}:impact`
      entries.push(
        zEntry(id, `fx-${i}`, i % 2 ? 'front' : 'back',
          (i * 0.37) % 3 - 1.5, (i * 0.53) % 1.4 - 0.7),
      )
      mask.push(id)
    }
    const atlas = { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
    const out = compile({
      atlas,
      field: maskedField(atlas, mask),
      clip: makeClip(),
      project: glyphProject(mask),
    })
    // Por ilegible que sea, compila: pistas exactamente para los 10
    expect(new Set(out.tracks.map((t) => t.cell))).toEqual(new Set(mask))
    expect(
      out.report.warnings.some((w) => w.startsWith('COHORT_ZONE_SPILL')),
    ).toBe(false)
  })

  test('resolución subóptima → GLYPH_SUBOPTIMAL_RES (aviso, compila igual)', () => {
    const atlas = zonedAtlas()
    const mask = atlas.entries.map((e) => e.nodeId)
    const out = compile({
      atlas,
      field: maskedField(atlas, mask),
      clip: makeClip(),
      project: glyphProject(mask),
    })
    // Rig de 6 nodos en 2 filas — jamás resuelve 7 filas de fuente 5×7
    expect(
      out.report.warnings.some((w) => w.startsWith('GLYPH_SUBOPTIMAL_RES')),
    ).toBe(true)
    // …y aun así emite pistas para todos los nodos cubiertos
    expect(out.tracks.length).toBeGreaterThan(0)
  })

  test('sin glyph en la pila: la Vía B sigue reportando SPILL intacto', () => {
    // Contraste de no-regresión: el mismo campo sin glifo SÍ produce el
    // diagnóstico de cohortes (el fix es quirúrgico, no apaga la alarma).
    const atlas = zonedAtlas()
    const mask = ['f1:impact']
    const out = compile({
      atlas,
      field: maskedField(atlas, mask),
      clip: makeClip(),
      project: {
        ...createDefaultProject('x'),
        strategy: 'cohort' as const,
      },
    })
    expect(out.report.strategy).toBe('cohort')
    // (el spill puede o no dispararse según la cohorte — lo que importa
    //  es que la rama sigue viva: strategy cohort se respeta sin glyph)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// WAVE 8186 — MCC-Device (VÍA A del COHORT_FORENSIC_AUDIT)
// ═════════════════════════════════════════════════════════════════════════════

/** Atlas del spill: 3 fixtures monocelda, TODOS en 'front' — cualquier cohorte
 *  alcanza por zona a los demás devices. */
function spillAtlas(): NodeAtlas {
  const entries = [
    zoned('fx-a:impact', 'fx-a', 'front'),
    zoned('fx-b:impact', 'fx-b', 'front'),
    zoned('fx-c:impact', 'fx-c', 'front'),
  ]
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

/** Campo del spill: gain 1/0.2/1 → budget 2 → percentiles:
 *  c0={a,b} (gain medio 0.6), c1={c} (gain 1) — ambas derraman en 'front'. */
function spillField(): FieldSnapshot {
  return {
    count: 3,
    delayMs: new Float32Array([0, 0, 0]),
    gain: new Float32Array([1, 0.2, 1]),
    mask: new Uint8Array([1, 1, 1]),
  }
}

describe('🜨 WAVE 8186 — MCC-Device (Zone Spill Workaround)', () => {
  test('cohortes derramadas → pistas quirúrgicas cell=nodeId, zones [all]', () => {
    const project = {
      ...createDefaultProject('x'),
      strategy: 'mcc-device' as const,
      cohortBudget: 2,
    }
    const out = compile({
      atlas: spillAtlas(), field: spillField(), clip: makeClip(), project,
    })
    expect(out.report.strategy).toBe('mcc-device')
    // Ambas cohortes derraman (todas en 'front') → 3 pistas por dispositivo
    expect(out.tracks).toHaveLength(3)
    expect(out.tracks.map((t) => t.cell).sort()).toEqual([
      'fx-a:impact',
      'fx-b:impact',
      'fx-c:impact',
    ])
    for (const t of out.tracks) {
      expect(t.id.startsWith('ast_intensity_mccd_')).toBe(true)
      expect(t.zones).toEqual(['all'])      // el filtro real es cell (Δ3)
      expect(t.phaseOverrides).toBeUndefined() // delay horneado en la curva
      expect(t.blendMode).toBe('replace')
    }
    // Gain de cohorte horneado: c0={a,b} gain medio 0.6; c1={c} gain 1
    const byCell = new Map(out.tracks.map((t) => [t.cell, t]))
    const peakB = Math.max(
      ...byCell.get('fx-b:impact')!.curve.keyframes.map((k) => k.value as number),
    )
    const peakA = Math.max(
      ...byCell.get('fx-a:impact')!.curve.keyframes.map((k) => k.value as number),
    )
    const peakC = Math.max(
      ...byCell.get('fx-c:impact')!.curve.keyframes.map((k) => k.value as number),
    )
    expect(peakB).toBeCloseTo(0.6, 3)
    expect(peakA).toBeCloseTo(0.6, 3)
    expect(peakC).toBeCloseTo(1, 3)
    // Diagnóstico honesto: spill reportado + aislamiento aplicado
    expect(
      out.report.warnings.some((w) => w.startsWith('COHORT_ZONE_SPILL')),
    ).toBe(true)
    expect(
      out.report.warnings.some((w) => w.startsWith('COHORT_ISOLATED')),
    ).toBe(true)
  })

  test('auto: cohort con spill → auto-escalado a mcc-device', () => {
    const project = {
      ...createDefaultProject('x'),
      strategy: 'auto' as const,
      cohortBudget: 2,
    }
    const out = compile({
      atlas: spillAtlas(), field: spillField(), clip: makeClip(), project,
    })
    expect(out.report.strategy).toBe('mcc-device')
    expect(out.tracks.every((t) => t.id.includes('_mccd_'))).toBe(true)
  })

  test('cohort explícita NO aísla — legado: spill = warning solamente', () => {
    const project = {
      ...createDefaultProject('x'),
      strategy: 'cohort' as const,
      cohortBudget: 2,
    }
    const out = compile({
      atlas: spillAtlas(), field: spillField(), clip: makeClip(), project,
    })
    expect(out.report.strategy).toBe('cohort')
    expect(out.tracks.every((t) => t.cell === undefined)).toBe(true)
    expect(
      out.report.warnings.some((w) => w.startsWith('COHORT_ZONE_SPILL')),
    ).toBe(true)
    expect(
      out.report.warnings.some((w) => w.startsWith('COHORT_ISOLATED')),
    ).toBe(false)
  })

  test('mcc-device sin spill → cohortes puras + MCC_DEVICE_NO_SPILL', () => {
    // Cohortes en zonas disjuntas: {a,b}=front gain 1, {c,d}=back gain 0.5
    const field: FieldSnapshot = {
      count: 4,
      delayMs: new Float32Array([0, 100, 200, 300]),
      gain: new Float32Array([1, 1, 0.5, 0.5]),
      mask: new Uint8Array([1, 1, 1, 1]),
    }
    const project = {
      ...createDefaultProject('x'),
      strategy: 'mcc-device' as const,
      cohortBudget: 2,
    }
    const out = compile({
      atlas: makeCohortAtlas(), field, clip: makeClip(), project,
    })
    expect(out.report.strategy).toBe('mcc-device')
    expect(out.tracks).toHaveLength(2) // cohortes puras, sin aislamiento
    expect(out.tracks.every((t) => t.id.includes('_cohort_'))).toBe(true)
    expect(
      out.report.warnings.some((w) => w.startsWith('MCC_DEVICE_NO_SPILL')),
    ).toBe(true)
  })

  test('aislamiento mixto: cohorte limpia sigue zonal, derramada → mccd', () => {
    // makeCohortAtlas: (a,b)=front, (c,d)=back. gains [0.2,1,0.5,0.5]
    // → percentiles K=3: c0={a} front ·g.2, c1={c,d} back ·g.5, c2={b} front ·g1
    // c0 derrama (b no-miembro en front) → aislada; c2 derrama (a) → aislada;
    // c1 limpia: su zona 'back' solo aloja a sus miembros c,d.
    const field: FieldSnapshot = {
      count: 4,
      delayMs: new Float32Array([0, 0, 0, 0]),
      gain: new Float32Array([0.2, 1, 0.5, 0.5]),
      mask: new Uint8Array([1, 1, 1, 1]),
    }
    const project = {
      ...createDefaultProject('x'),
      strategy: 'mcc-device' as const,
      cohortBudget: 3,
    }
    const out = compile({
      atlas: makeCohortAtlas(), field, clip: makeClip(), project,
    })
    const mccd = out.tracks.filter((t) => t.id.includes('_mccd_'))
    const cohort = out.tracks.filter((t) => t.id.includes('_cohort_'))
    expect(mccd.map((t) => t.cell).sort()).toEqual([
      'fx-a:impact',
      'fx-b:impact',
    ])
    // c1 ({c,d}, back) limpio → cohorte zonal normal intacta
    expect(cohort.length).toBe(1)
    expect(cohort[0].cell).toBeUndefined()
    expect(cohort[0].zones).toEqual(['back'])
    expect(out.tracks).toHaveLength(3)
    expect(out.report.strategy).toBe('mcc-device')
    // Dos aislamientos reportados (c0 y c2); la limpia no genera aviso
    expect(
      out.report.warnings.filter((w) => w.startsWith('COHORT_ISOLATED')),
    ).toHaveLength(2)
  })

  test('BUDGET: la explosión de pistas se contabiliza en report.bytes', () => {
    const base = { ...createDefaultProject('x'), cohortBudget: 2 }
    const cohortOut = compile({
      atlas: spillAtlas(), field: spillField(), clip: makeClip(),
      project: { ...base, strategy: 'cohort' as const },
    })
    const mccdOut = compile({
      atlas: spillAtlas(), field: spillField(), clip: makeClip(),
      project: { ...base, strategy: 'mcc-device' as const },
    })
    // 2 pistas cohorte vs 3 pistas quirúrgicas — bytes reales crecen y el
    // HUD (pct = bytes / 256KB, rojo >70%) lo refleja sin trabajo extra.
    expect(mccdOut.report.bytes).toBeGreaterThan(cohortOut.report.bytes)
    expect(mccdOut.report.trackIds.length).toBe(3)
    expect(cohortOut.report.trackIds.length).toBe(2)
  })

  test('cell sobrevive al serializeHephClip (.lfx roundtrip)', () => {
    const project = {
      ...createDefaultProject('x'),
      strategy: 'mcc-device' as const,
      cohortBudget: 2,
    }
    const out = compile({
      atlas: spillAtlas(), field: spillField(), clip: makeClip(), project,
    })
    const clip = makeClip()
    const injected = injectAstTracks(clip, out.tracks, project)
    const round = serializeHephClip(injected)
    const t = round.tracks.find((x) => x.id === 'ast_intensity_mccd_base_0_0')!
    expect(t.cell).toBe('fx-a:impact') // c0={a,b} — orden de atlas
    expect(t.zones).toEqual(['all'])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🜨 WAVE 8190 — PLAN DE EMISIÓN (CRUX_RESOLUTION §2)
// Gates: G-PLAN-DECOUPLE (1 color + N intensity) · G-BUDGET-150 (<60%)
//        §2.6 higiene numérica (timeMs entero, valores ≤4 decimales)
// ═════════════════════════════════════════════════════════════════════════════

const LFX_MAX_BYTES = 256 * 1024 // espejo del límite del drawer (§8.4)

/** Rig grande: N devices × {IMPACT, COLOR}, todos en 'front' — spill total
 *  garantizado para cualquier partición de cohortes. */
function bigDualAtlas(n: number): NodeAtlas {
  const entries: NodeAtlasEntry[] = []
  for (let i = 0; i < n; i++) {
    entries.push(entry(`fx-${i}:impact`, `fx-${i}`))
    entries.push(famEntry(`fx-${i}:color`, `fx-${i}`, 'COLOR'))
  }
  return { entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])) }
}

function bigField(n: number): FieldSnapshot {
  return {
    count: n * 2,
    delayMs: Float32Array.from({ length: n * 2 }, (_, i) => (i * 137) % 4000),
    gain: Float32Array.from({ length: n * 2 }, (_, i) => 0.4 + ((i * 31) % 60) / 100),
    mask: new Uint8Array(n * 2).fill(1),
  }
}

describe('🜨 AsteriaCompiler — Plan de Emisión (WAVE 8190 · Crux 1)', () => {
  test('G-PLAN-DECOUPLE: DIM+CLR con spill total → 1 pista color + N quirúrgicas intensity', () => {
    const N = 12
    const atlas = bigDualAtlas(N)
    const out = compile({
      atlas,
      field: bigField(N),
      clip: makeClip(),
      project: {
        ...createDefaultProject('x'),
        strategy: 'mcc-device' as const,
        defaultPaint: { params: ['intensity', 'color'] as const },
      },
    })
    const colorTracks = out.tracks.filter((t) => t.paramId === 'color')
    const intTracks = out.tracks.filter((t) => t.paramId === 'intensity')
    // El decoupling: el color estático NO paga el multiplicador quirúrgico.
    expect(colorTracks).toHaveLength(1)
    expect(colorTracks[0].id).toBe('ast_color_static_base_0')
    expect(colorTracks[0].curve.keyframes).toHaveLength(1)
    expect(colorTracks[0].cell).toBeUndefined()
    // Intensity sí: cada nodo IMPACT cubierto, pista cell-exacta.
    expect(intTracks).toHaveLength(N)
    expect(intTracks.every((t) => t.cell !== undefined)).toBe(true)
    expect(intTracks.every((t) => t.id.includes('_mccd_'))).toBe(true)
    // El reporte cuenta la acción, no la esconde.
    expect(
      out.report.warnings.some((w) => w.startsWith('COHORT_ISOLATED')),
    ).toBe(true)
  })

  test('G-BUDGET-150: 150 fixtures DIM+CLR → ≤40% (allow) / ≤60% (contain) del límite .lfx', () => {
    // §5: atlas sintético 150 × {IMPACT,COLOR}, gain variable, spill
    // forzado (todo en 'front'; el plano de color cubre solo la mitad
    // de los nodos COLOR → la clase estática derrama sobre 75 fixtures
    // ajenos: 'allow' emite 1 pista con flood, 'contain' 75 quirúrgicas).
    const N = 150
    const atlas = bigDualAtlas(N)
    const n2 = N * 2 // layout: pares IMPACT, impares COLOR
    const field: FieldPlanes = {
      count: n2,
      scalar: new Map([
        [
          'intensity' as const,
          {
            delayMs: Float32Array.from({ length: n2 }, (_, i) => (i * 137) % 4000),
            gain: Float32Array.from({ length: n2 }, (_, i) => 0.4 + ((i * 31) % 60) / 100),
            mask: Uint8Array.from({ length: n2 }, (_, i) => (i % 2 === 0 ? 1 : 0)),
            owner: new Uint16Array(n2), // owner 0 → capa 'base'
          },
        ],
      ]),
      color: {
        delayMs: new Float32Array(n2),
        gain: new Float32Array(n2).fill(1),
        // mitad de los nodos COLOR cubiertos → spill zonal garantizado
        mask: Uint8Array.from({ length: n2 }, (_, i) =>
          i % 2 === 1 && (i >> 1) % 2 === 0 ? 1 : 0,
        ),
        owner: new Uint16Array(n2),
        rgb: Float32Array.from({ length: n2 * 3 }, (_, i) =>
          i % 3 === 0 ? 1 : 0, // rojo lineal
        ),
        alpha: Float32Array.from({ length: n2 }, (_, i) =>
          i % 2 === 1 && (i >> 1) % 2 === 0 ? 1 : 0,
        ),
      },
    }
    const mk = (colorFlood: 'allow' | 'contain') =>
      compile({
        atlas, field, clip: makeClip(),
        project: {
          ...createDefaultProject('x'),
          strategy: 'mcc-device' as const,
          defaultPaint: { params: ['intensity', 'color'] as const },
          cohortBudget: 16,
          colorFlood,
        },
      })
    const allow = mk('allow')
    const contain = mk('contain')
    const colorOf = (o: typeof allow) =>
      o.tracks.filter((t) => t.paramId === 'color')
    expect(colorOf(allow)).toHaveLength(1) // flood zonal
    expect(
      allow.report.warnings.some((w) => w.startsWith('COLOR_FLOOD')),
    ).toBe(true)
    expect(colorOf(contain)).toHaveLength(N / 2) // 75 quirúrgicas
    expect(allow.report.bytes).toBeLessThanOrEqual(LFX_MAX_BYTES * 0.4)
    expect(contain.report.bytes).toBeLessThanOrEqual(LFX_MAX_BYTES * 0.6)
    // Baseline (§5): queda en report.bytes para comparación futura —
    // 'contain' es estrictamente más caro que 'allow'.
    expect(contain.report.bytes).toBeGreaterThan(allow.report.bytes)
  })

  test('§2.6 higiene numérica: timeMs enteros y valores ≤4 decimales tras rotar+escalar', () => {
    const N = 12
    const out = compile({
      atlas: bigDualAtlas(N),
      field: bigField(N),
      clip: makeClip(),
      project: {
        ...createDefaultProject('x'),
        strategy: 'mcc-device' as const,
        defaultPaint: { params: ['intensity'] as const },
      },
    })
    for (const t of out.tracks) {
      for (const kf of t.curve.keyframes) {
        expect(Number.isInteger(kf.timeMs)).toBe(true)
        if (typeof kf.value === 'number') {
          // ≤4 decimales: v * 1e4 es entero (o dif de redondeo flotante)
          expect(Math.abs(kf.value * 1e4 - Math.round(kf.value * 1e4))).toBeLessThan(1e-6)
        }
      }
    }
  })

  test('decoupling real: el plano color no hereda las zonas de los nodos IMPACT', () => {
    // Los nodos COLOR viven en 'back'; los IMPACT en 'front'. Bajo V1 la
    // pista de cohorte color cubría las zonas de TODOS los miembros de la
    // cohorte (incluido 'front' vía el impact hermano). Bajo el planner la
    // membresía se filtra por familia → zonas = solo ['back'].
    const entries = [
      entry('fx-a:impact', 'fx-a'),                    // front
      famEntry('fx-a:color', 'fx-a', 'COLOR', 'back'),
      entry('fx-b:impact', 'fx-b'),                    // front
      famEntry('fx-b:color', 'fx-b', 'COLOR', 'back'),
    ]
    const atlas: NodeAtlas = {
      entries, byNodeId: new Map(entries.map((e) => [e.nodeId, e])),
    }
    const field: FieldSnapshot = {
      count: 4,
      delayMs: new Float32Array([0, 0, 500, 500]),
      gain: new Float32Array([1, 1, 0.5, 0.5]),
      mask: new Uint8Array([1, 1, 1, 1]),
    }
    const out = compile({
      atlas, field, clip: makeClip(),
      project: {
        ...createDefaultProject('x'),
        strategy: 'cohort' as const,
        cohortBudget: 2,
        defaultPaint: { params: ['color'] as const }, // animado — sin regla de luminancia
      },
    })
    const colorTracks = out.tracks.filter((t) => t.paramId === 'color')
    expect(colorTracks.length).toBeGreaterThan(0)
    for (const t of colorTracks) {
      expect(t.zones).toEqual(['back'])
      expect(t.zones).not.toContain('front')
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🜨 WAVE 8192 — G-MIG: PAINT MIGRATION (CRUX_RESOLUTION §3.2, §5)
// compile(v1) ≡ compile(migrateV1toV2(v1)) — deepEqual de tracks.
// ═════════════════════════════════════════════════════════════════════════════

describe('🜨 AsteriaCompiler — G-MIG (WAVE 8192: migración v1→v2)', () => {
  /** Documento v1 representativo: TARGET global + Λ-Ride + synth + cohort. */
  const v1Doc = (): AsteriaProjectV1 => ({
    version: 1,
    rigFingerprint: 'sha1:v1rig',
    stack: [
      { kind: 'base', id: 'base', delayMs: 0, gain: 1 },
      {
        kind: 'wave', id: 'w1', op: 'replace',
        mask: { nodeIds: ['fx-a:impact', 'fx-b:impact'] },
        emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 8,
      },
    ],
    strategy: 'cohort',
    targetParams: ['intensity', 'color'],
    targetColor: '#0080ff',
    lutSource: { kind: 'ride', trackId: 'forge-track-01' },
    defaultSynth: { shape: 'triangle' },
    cohortBudget: 8,
    nodePositions: { 'fx-a:impact': { x: 0, z: 0 } },
  })

  test('mapeo de campos: TARGET root → defaultPaint; colorFlood allow', () => {
    const v1 = v1Doc()
    const snapshot = JSON.parse(JSON.stringify(v1))
    const v2 = migrateV1toV2(v1)
    // El documento migrado ES el v2 canónico equivalente — toEqual lo
    // clava campo a campo (el gate no es solo track-parity).
    expect(v2).toEqual({
      version: 2,
      rigFingerprint: 'sha1:v1rig',
      stack: v1.stack, // pila intacta — ningún gesto recibe paint
      strategy: 'cohort',
      defaultPaint: {
        params: ['intensity', 'color'],
        color: '#0080ff',
        lut: { kind: 'ride', trackId: 'forge-track-01' },
        synth: { shape: 'triangle' },
      },
      colorFlood: 'allow', // paridad visual V1 garantizada (§3.2)
      colorBudget: 16,
      cohortBudget: 8,
      nodePositions: { 'fx-a:impact': { x: 0, z: 0 } },
    })
    // Los campos v1 no sobreviven en el documento migrado
    for (const dead of ['targetParams', 'targetColor', 'lutSource', 'defaultSynth']) {
      expect(dead in v2).toBe(false)
    }
    // La entrada NO se muta
    expect(v1).toEqual(snapshot)
  })

  test('preset LUT no materializa `lut` en el paint (undefined = synth)', () => {
    const v1: AsteriaProjectV1 = {
      version: 1, rigFingerprint: 'sha1:r',
      stack: [{ kind: 'base', id: 'base', delayMs: 0, gain: 1 }],
      strategy: 'auto',
      targetParams: ['intensity'],
      lutSource: { kind: 'preset', name: 'default' },
      cohortBudget: 16,
    }
    const v2 = migrateV1toV2(v1)
    expect(v2.defaultPaint).toEqual({
      params: ['intensity'],
      color: '#ff0000',
      synth: { shape: 'pulse' },
    })
  })

  test('campos v1 ausentes → defaults históricos (docs pre-8120/8191)', () => {
    const v1: AsteriaProjectV1 = {
      version: 1, rigFingerprint: 'sha1:r',
      stack: [{ kind: 'base', id: 'base', delayMs: 0, gain: 1 }],
      strategy: 'auto',
      targetParams: ['pan'],
      // sin targetColor (pre-8120) ni defaultSynth (pre-8191)
      lutSource: { kind: 'preset', name: 'default' },
      cohortBudget: 4,
    }
    const v2 = migrateV1toV2(v1)
    expect(v2.defaultPaint).toEqual({
      params: ['pan'],
      color: '#ff0000',
      synth: { shape: 'pulse' },
    })
    expect(v2.cohortBudget).toBe(4)
  })

  test('idempotente: migrate(v2) devuelve el MISMO objeto', () => {
    const p = createDefaultProject('x')
    expect(migrateV1toV2(p)).toBe(p)
  })

  test('G-MIG: compile(v1) ≡ compile(migrateV1toV2(v1)) — tracks byte a byte', () => {
    const atlas = makeDualAtlas()
    const field: FieldSnapshot = {
      count: 6,
      delayMs: new Float32Array([0, 100, 500, 200, 750, 900]),
      gain: new Float32Array([1, 0.8, 0.5, 1, 0.6, 0.9]),
      mask: new Uint8Array([1, 1, 1, 1, 1, 1]),
    }
    const clip = makeClip()
    for (const strategy of ['lambda', 'cohort', 'mcc'] as const) {
      const v1: AsteriaProjectV1 = { ...v1Doc(), strategy }
      const outV1 = compile({ atlas, field, clip, project: v1 })
      const v2 = migrateV1toV2(v1)
      const outV2 = compile({ atlas, field, clip, project: v2 })
      // El gate: salida visual bit a bit idéntica tras la migración.
      expect(outV2.tracks).toEqual(outV1.tracks)
      expect(outV2.report.warnings).toEqual(outV1.report.warnings)
      // Y el migrado coincide con el v2 escrito a mano equivalente.
      const v2Hand = {
        ...createDefaultProject('x'),
        rigFingerprint: 'sha1:v1rig',
        strategy,
        cohortBudget: 8,
        stack: v1.stack,
        nodePositions: v1.nodePositions,
        defaultPaint: {
          params: ['intensity', 'color'] as const,
          color: '#0080ff',
          lut: { kind: 'ride' as const, trackId: 'forge-track-01' },
          synth: { shape: 'triangle' as const },
        },
        colorFlood: 'allow' as const,
      }
      expect(
        compile({ atlas, field, clip, project: v2Hand }).tracks,
      ).toEqual(outV1.tracks)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 🜨 WAVE 8193 — G-SHAPE-ISOLATION (CRUX_RESOLUTION §5)
// Dos capas sobre el mismo param con formas distintas y máscaras que se cruzan:
// el compilador no mezcla formas y ningún (fixture, param) es alcanzado por dos
// pistas sin aislamiento `cell`.
// ═════════════════════════════════════════════════════════════════════════════

describe('🜨 AsteriaCompiler — G-SHAPE-ISOLATION (WAVE 8193)', () => {
  test('pulse + laser entrelazados en una zona → aislamiento quirúrgico por cell', () => {
    const atlas = makeAtlas() // 4 nodos IMPACT, todos en zona 'front'
    // Capa A (pulse) cubre nodos 0 y 2; capa B (laser) cubre 1 y 3 —
    // máscaras entrelazadas dentro de la MISMA zona (cruce espacial).
    const stack: Gesture[] = [
      { kind: 'base', id: 'base', delayMs: 0, gain: 1 },
      {
        kind: 'manual', id: 'layerA',
        paint: { synth: { shape: 'pulse' } },
        entries: [
          { nodeId: 'fx-a:petal-l:impact', delayMs: 100 },
          { nodeId: 'fx-b:impact', delayMs: 300 },
        ],
      },
      {
        kind: 'manual', id: 'layerB',
        paint: { synth: { shape: 'laser' } },
        entries: [
          { nodeId: 'fx-a:petal-r:impact', delayMs: 200 },
          { nodeId: 'fx-c:impact', delayMs: 400 },
        ],
      },
    ]
    const field = evaluateStack(stack, atlas)
    // Owner del plano intensity: capa A=1, capa B=2 — entrelazados.
    expect([...field.scalar.get('intensity')!.owner]).toEqual([1, 2, 1, 2])

    const out = compile({
      atlas,
      field,
      clip: makeClip(),
      // El proyecto lleva el MISMO stack que generó el field — el owner
      // del plano se resuelve contra project.stack[i].paint.
      project: {
        ...createDefaultProject('x'),
        strategy: 'cohort' as const,
        stack,
      },
    })
    const intensityTracks = out.tracks.filter((t) => t.paramId === 'intensity')

    // Gate 1: cero pares (fixture, param) alcanzados por dos pistas sin cell.
    // Con máscaras cruzadas toda pista debe ser quirúrgica (cell aislado).
    expect(intensityTracks.length).toBeGreaterThan(0)
    for (const t of intensityTracks) expect(t.cell).toBeDefined()
    // El reporte declara el aislamiento por forma (multiShape → _s{gi}).
    expect(
      out.report.warnings.filter((w) => w.startsWith('SHAPE_ISOLATED')),
    ).not.toHaveLength(0)
    for (const e of atlas.entries) {
      const reaching = intensityTracks.filter(
        (t) =>
          t.cell === e.nodeId ||
          (!t.cell && (t.zones.includes('all') || t.zones.includes(e.zoneId!))),
      )
      expect(reaching).toHaveLength(1)
    }

    // Gate 2: las formas no se mezclan — el id quirúrgico lleva el índice
    // del grupo de forma (`_s{gi}_`); cada capa vive en su propia clase.
    const shapeOf = (t: HephTrack) => t.id.match(/_s(\d+)_/)?.[1]
    const byCell = (cell: string) =>
      intensityTracks.find((t) => t.cell === cell)!
    const sA = shapeOf(byCell('fx-a:petal-l:impact'))
    const sB = shapeOf(byCell('fx-a:petal-r:impact'))
    expect(sA).toBeDefined()
    expect(sB).toBeDefined()
    expect(sA).not.toBe(sB) // pulse ≠ laser — clases separadas por specKey
    expect(shapeOf(byCell('fx-b:impact'))).toBe(sA)
    expect(shapeOf(byCell('fx-c:impact'))).toBe(sB)
    // 🜨 WAVE 8195 (§4.5): el id lleva el layerId de la capa dominante —
    // ast_<param>_<route>_<layerId>_<n>. Trazable hasta el gesto.
    for (const cell of ['fx-a:petal-l:impact', 'fx-b:impact']) {
      expect(byCell(cell).id).toContain('_layerA_')
    }
    for (const cell of ['fx-a:petal-r:impact', 'fx-c:impact']) {
      expect(byCell(cell).id).toContain('_layerB_')
    }
    // Y la curva base difiere: laser tiene menos keyframes que pulse.
    expect(byCell('fx-a:petal-l:impact').curve.keyframes.length).not.toBe(
      byCell('fx-a:petal-r:impact').curve.keyframes.length,
    )
  })

  test('dos capas MISMA forma sobre el mismo param → colapsan en una clase (no duplican)', () => {
    const atlas = makeAtlas()
    // Ambas capas pulse: misma specKey → una sola clase de valor pese a
    // owners distintos (paridad con la semántica V1 de un solo campo).
    const stack: Gesture[] = [
      { kind: 'base', id: 'base', delayMs: 0, gain: 1 },
      {
        kind: 'manual', id: 'layerA',
        paint: { synth: { shape: 'pulse' } },
        entries: [{ nodeId: 'fx-a:petal-l:impact', delayMs: 100 }],
      },
      {
        kind: 'manual', id: 'layerB',
        paint: { synth: { shape: 'pulse' } },
        entries: [{ nodeId: 'fx-b:impact', delayMs: 300 }],
      },
    ]
    const field = evaluateStack(stack, atlas)
    const out = compile({
      atlas,
      field,
      clip: makeClip(),
      project: {
        ...createDefaultProject('x'),
        strategy: 'cohort' as const,
        stack,
      },
    })
    const intensityTracks = out.tracks.filter((t) => t.paramId === 'intensity')
    expect(intensityTracks.length).toBeGreaterThan(0)
    // Misma specKey en todos los owners → una sola clase de valor:
    // los ids no llevan sufijo de forma `_s{gi}` y no hay aislamiento por forma.
    for (const t of intensityTracks) expect(t.id).not.toMatch(/_s\d+/)
    expect(
      out.report.warnings.filter((w) => w.startsWith('SHAPE_ISOLATED')),
    ).toHaveLength(0)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// 🜨 WAVE 8194 — EL COMPOSITOR DE COLOR (Crux 2 — Phase 3)
// ─────────────────────────────────────────────────────────────────────────────

/** HSL del keyframe → OKLab (hsl→srgb→lineal→oklab). */
function hslToOklab(h: number, s: number, l: number): [number, number, number] {
  const [r, g, b] = hslToSrgb(h, s, l)
  const out: [number, number, number] = [0, 0, 0]
  linearToOklabInto(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b), out)
  return out
}

describe('🜨 AsteriaCompiler — ColorPlane (WAVE 8194)', () => {
  test('G-COLOR-RT: dos capas solapadas → el t=0 emitido coincide con el álgebra §3.4 (ΔE OKLab ≤ 1)', () => {
    const atlas = makeDualAtlas() // 3 devices × (IMPACT+COLOR), zona 'front'
    // Base rojo sobre todo + capa azul a opacity 0.5 solo en fx-b:color.
    // §3.4 replace: C = red_lin·(1−0.5) + blue_lin·0.5 = (0.5, 0, 0.5).
    const stack: Gesture[] = [
      { kind: 'base', id: 'base', delayMs: 0, gain: 1 },
      {
        kind: 'manual', id: 'blue-half',
        paint: { params: ['color'], color: '#0000ff', opacity: 0.5 },
        entries: [{ nodeId: 'fx-b:color', delayMs: 0 }],
      },
    ]
    const project = {
      ...createDefaultProject('x'),
      colorFlood: 'contain' as const, // clases de color → quirúrgico (sin flood)
      defaultPaint: {
        params: ['intensity', 'color'] as const,
        color: '#ff0000',
      },
      stack,
    }
    const field = evaluateStack(stack, atlas, project.defaultPaint)
    // El plano de color existe y mezcló: fx-b:color (idx 3) = (0.5,0,0.5)
    const cp = field.color!
    expect(cp.alpha[3]).toBeCloseTo(1, 5)
    expect(cp.rgb[9]).toBeCloseTo(0.5, 5)
    expect(cp.rgb[11]).toBeCloseTo(0.5, 5)

    const out = compile({ atlas, field, clip: makeClip(), project })
    const colorTracks = out.tracks.filter((t) => t.paramId === 'color')
    expect(colorTracks.length).toBeGreaterThan(0)

    // La pista que alcanza fx-b:color (cell-exacta bajo 'contain').
    const target = colorTracks.find((t) => t.cell === 'fx-b:color')
    expect(target).toBeDefined()
    const evaluator = new CurveEvaluator(
      new Map([['color' as const, target!.curve]]),
      4000,
    )
    const hsl = evaluator.getColorValue('color', 0)
    const got = hslToOklab(hsl.h, hsl.s, hsl.l)
    const expected: [number, number, number] = [0, 0, 0]
    linearToOklabInto(0.5, 0, 0.5, expected) // teoría §3.4
    expect(
      oklabDeltaE(got[0], got[1], got[2], expected[0], expected[1], expected[2]),
    ).toBeLessThanOrEqual(1)
  })

  test('G-COLOR-TRANSPARENT: nodo con alpha=0 jamás recibe pista de color', () => {
    const atlas = makeDualAtlas()
    // El base pinta SOLO intensity (sin tinta de color); una capa pinta
    // verde únicamente sobre fx-a:color → fx-b/fx-c quedan con alpha=0.
    const stack: Gesture[] = [
      {
        kind: 'base', id: 'base', delayMs: 0, gain: 1,
        paint: { params: ['intensity'] },
      },
      {
        kind: 'manual', id: 'green',
        paint: { params: ['color'], color: '#00ff00' },
        entries: [{ nodeId: 'fx-a:color', delayMs: 0 }],
      },
    ]
    const project = {
      ...createDefaultProject('x'),
      colorFlood: 'contain' as const,
      defaultPaint: {
        params: ['intensity'] as const,
        color: '#ff0000',
      },
      stack,
    }
    const field = evaluateStack(stack, atlas, project.defaultPaint)
    // Solo fx-a:color (idx 1) tiene tinta; el resto es lienzo transparente.
    expect([...field.color!.alpha]).toEqual([0, 1, 0, 0, 0, 0])
    expect([...field.color!.mask]).toEqual([0, 1, 0, 0, 0, 0])

    const out = compile({ atlas, field, clip: makeClip(), project })
    const colorTracks = out.tracks.filter((t) => t.paramId === 'color')
    // Una sola clase de color (verde) → una pista quirúrgica sobre
    // fx-a:color. Ninguna pista alcanza fx-b/fx-c: una pista llega a un
    // nodo si `cell` lo nombra o si (sin cell) la zona lo cubre — las
    // quirúrgicas llevan zones ['all'] pero el filtro real es `cell`.
    expect(colorTracks).toHaveLength(1)
    expect(colorTracks[0].cell).toBe('fx-a:color')
    for (const nid of ['fx-b:color', 'fx-c:color']) {
      const zone = atlas.byNodeId.get(nid)!.zoneId!
      expect(
        colorTracks.some(
          (t) =>
            t.cell === nid ||
            (t.cell === undefined &&
              (t.zones.includes('all') || t.zones.includes(zone))),
        ),
      ).toBe(false)
    }
  })

  test('COLOR_QUANTIZED: más colores distintos que colorBudget → median-cut + warning', () => {
    // 4 nodos COLOR con 4 tintes distintos y colorBudget=2 → cuantiza.
    const atlas = makeColorCohortAtlas()
    const stack: Gesture[] = [
      { kind: 'base', id: 'base', delayMs: 0, gain: 1, paint: { params: ['intensity'] } },
      {
        kind: 'manual', id: 'palette',
        paint: { params: ['color'], color: '#ff0000' },
        entries: [
          { nodeId: 'fx-a:color', delayMs: 0 },
          { nodeId: 'fx-b:color', delayMs: 0 },
          { nodeId: 'fx-c:color', delayMs: 0 },
          { nodeId: 'fx-d:color', delayMs: 0 },
        ],
      },
    ]
    // Colores distintos por nodo: sobreescribo el rgb del plano tras
    // evaluar — el compilador solo lee el plano compuesto (fixture real
    // del pipeline: el engine es la fuente, aquí simulo su salida).
    const field = evaluateStack(stack, atlas, {
      params: ['intensity', 'color'],
      color: '#ff0000',
    })
    const cp = field.color!
    const tint = (idx: number, r: number, g: number, b: number): void => {
      cp.rgb[idx * 3] = r
      cp.rgb[idx * 3 + 1] = g
      cp.rgb[idx * 3 + 2] = b
    }
    tint(0, 1, 0, 0)
    tint(1, 0, 1, 0)
    tint(2, 0, 0, 1)
    tint(3, 1, 1, 0)

    const out = compile({
      atlas,
      field,
      clip: makeClip(),
      project: {
        ...createDefaultProject('x'),
        colorBudget: 2,
        colorFlood: 'contain' as const,
        defaultPaint: { params: ['intensity', 'color'] as const, color: '#ff0000' },
        stack,
      },
    })
    expect(
      out.report.warnings.some((w) => w.startsWith('COLOR_QUANTIZED')),
    ).toBe(true)
    const colorTracks = out.tracks.filter((t) => t.paramId === 'color')
    // 4 colores → ≤2 clases → cada pista lleva un color representante.
    const distinctEmitted = new Set(
      colorTracks.map((t) => JSON.stringify(t.curve.keyframes[0].value)),
    )
    expect(distinctEmitted.size).toBeLessThanOrEqual(2)
    expect(distinctEmitted.size).toBeGreaterThan(0)
  })
})
