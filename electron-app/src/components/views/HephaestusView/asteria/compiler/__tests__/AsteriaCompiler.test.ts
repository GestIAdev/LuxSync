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
      lutSource: { kind: 'ride' as const, trackId: 'forge-track-01' },
    }
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip,
      project,
    })
    expect(out.report.strategy).toBe('ride')
    expect(out.tracks).toHaveLength(1) // una única pista nueva + bus
    const t = out.tracks[0]
    expect(t.id).toBe('ast_intensity_ride_0')
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

  test('Λ-Frozen: glifo estático (canal gain) sobre Vía Λ → aviso verbatim', () => {
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
    expect(
      out.report.warnings.some(
        (w) =>
          w.startsWith('LAMBDA_FROZEN_DRIFT') &&
          w.includes(
            'Λ-Frozen: imagen estática por escalado de duración — drift 3,3 %/disparo',
          ),
      ),
    ).toBe(true)
  })

  test('Λ-Frozen NO avisa con glifo en canal delay (texto en movimiento)', () => {
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
    expect(
      out.report.warnings.some((w) => w.startsWith('LAMBDA_FROZEN_DRIFT')),
    ).toBe(false)
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

  test('strobe en targetParams → compila como cualquier param (8080-M1, G6 retirado)', () => {
    const project = {
      ...createDefaultProject('x'),
      targetParams: ['intensity', 'strobe'] as const,
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
    // El track Forge apunta a 'zoom' — targetParams = ['intensity']
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
      'ast_intensity_cohort_0',
      'ast_intensity_cohort_1',
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

    // Mismo delay en ambas celdas de fx-a, pero gain varía → cohort
    const gainField: FieldSnapshot = {
      count: 4,
      delayMs: new Float32Array([0, 0, 0, 0]),
      gain: new Float32Array([1, 1, 0.3, 1]),
      mask: new Uint8Array([1, 1, 1, 1]),
    }
    const outCohort = compile({
      atlas: makeAtlas(), field: gainField, clip: makeClip(), project: auto,
    })
    expect(outCohort.report.strategy).toBe('cohort')
  })

  test('validador: keyframes no ASC o fuera de dominio → rechazo', () => {
    const bad: HephTrack = {
      id: 'ast_intensity_mcc_0',
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
// WAVE 8110 — Chromatic Injection: LUT arcoíris + gain→lightness
// ═════════════════════════════════════════════════════════════════════════════

type HslValue = { h: number; s: number; l: number }
const hslOf = (kf: { value: number | HslValue }): HslValue =>
  kf.value as HslValue

describe('🌈 AsteriaCompiler — Chromatic Injection (WAVE 8110)', () => {
  test('Λ + color: ast_color_lambda con LUT HSL — barrido 0→360 en 7 kfs', () => {
    const project = {
      ...createDefaultProject('x'),
      targetParams: ['color'] as const,
    }
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip: makeClip(), project,
    })
    expect(out.tracks).toHaveLength(1)
    const t = out.tracks[0]
    expect(t.id).toBe('ast_color_lambda_0')
    expect(t.paramId).toBe('color')
    expect(t.curve.valueType).toBe('color')
    expect(t.curve.range).toEqual([0, 360])
    // 7 keyframes — segmentos de 60°: lerpHue (shortest-path) siempre
    // avanza hacia adelante. Un único tramo 0→360 colapsaría (delta=0).
    const kfs = t.curve.keyframes
    expect(kfs).toHaveLength(7)
    for (let i = 0; i <= 6; i++) {
      const hsl = hslOf(kfs[i])
      expect(hsl.h).toBeCloseTo(i * 60, 5)
      expect(hsl.s).toBe(100)
      expect(hsl.l).toBe(50)
    }
    // Cierre C⁰: rojo → rojo (hue 360 ≡ 0 mod 360)
    expect(hslOf(kfs[0]).h).toBe(0)
    expect(hslOf(kfs[6]).h % 360).toBe(0)
    // Bus de direcciones intacto — offsets espaciales sobre el arcoíris
    expect(Object.keys(t.phaseOverrides!).length).toBe(3)
    // Sin warnings de tipo — color es ciudadano de primera clase
    expect(
      out.report.warnings.some((w) => w.startsWith('PARAM_SKIPPED')),
    ).toBe(false)
  })

  test('Λ multi-param: intensity emite λ-pulse numérica, color emite LUT', () => {
    const project = {
      ...createDefaultProject('x'),
      targetParams: ['intensity', 'color'] as const,
    }
    const out = compile({
      atlas: makeAtlas(), field: makeField(), clip: makeClip(), project,
    })
    expect(out.tracks).toHaveLength(2)
    expect(out.tracks[0].curve.valueType).toBe('number')
    expect(out.tracks[1].curve.valueType).toBe('color')
    expect(out.tracks[1].paramId).toBe('color')
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
      targetParams: ['color'] as const,
    }
    const out = compile({
      atlas: makeCohortAtlas(), field, clip: makeClip(), project,
    })
    expect(out.tracks).toHaveLength(2)
    expect(out.tracks.map((t) => t.id)).toEqual([
      'ast_color_cohort_0',
      'ast_color_cohort_1',
    ])
    // cohort0 gain≈0.5 → L horneada ≈ 25; cohort1 gain=1 → L=50.
    // La LUT rota por delay — el horneado toca solo `l`, nunca `h`/`s`.
    for (const kf of out.tracks[0].curve.keyframes) {
      const hsl = hslOf(kf)
      expect(hsl.l).toBeCloseTo(25, 5)
      expect(hsl.s).toBe(100)
    }
    for (const kf of out.tracks[1].curve.keyframes) {
      const hsl = hslOf(kf)
      expect(hsl.l).toBeCloseTo(50, 5)
      expect(hsl.s).toBe(100)
    }
    // Los keyframes horneados siguen siendo HSL válidos para blendRgb
    for (const kf of out.tracks[0].curve.keyframes) {
      const hsl = hslOf(kf)
      expect(Number.isFinite(hsl.h)).toBe(true)
      expect(Number.isFinite(hsl.s)).toBe(true)
      expect(Number.isFinite(hsl.l)).toBe(true)
      expect(hsl.l).toBeGreaterThanOrEqual(0)
      expect(hsl.l).toBeLessThanOrEqual(100)
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
      targetParams: ['color'] as const,
    }
    const out = compile({
      atlas: makeAtlas(), field, clip: makeClip(), project,
    })
    expect(out.tracks).toHaveLength(4)
    const l0 = hslOf(out.tracks[0].curve.keyframes[0]).l
    const l1 = hslOf(out.tracks[1].curve.keyframes[0]).l
    expect(l0).toBeCloseTo(50, 5)  // gain 1 → L intacta
    expect(l1).toBeCloseTo(25, 5)  // gain 0.5 → L×0.5 (fade a negro)
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
      atlas: makeAtlas(), field: makeField(), clip,
      project: {
        ...createDefaultProject('x'),
        targetParams: ['color'] as const,
        lutSource: { kind: 'ride' as const, trackId: 'forge-color-01' },
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
      atlas: makeAtlas(), field: makeField(), clip,
      project: {
        ...createDefaultProject('x'),
        targetParams: ['color'] as const,
        lutSource: { kind: 'ride' as const, trackId: 'forge-track-01' },
      },
    })
    expect(
      rideNumeric.report.warnings.some((w) =>
        w.startsWith('RIDE_TYPE_MISMATCH'),
      ),
    ).toBe(true)
    const fb = rideNumeric.tracks[0]
    expect(fb.curve.valueType).toBe('color')
    expect(fb.curve.keyframes).toHaveLength(7) // LUT arcoíris, no el pulso
  })
})
