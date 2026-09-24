/**
 * 🜨 WAVE 8030-P2 — Tests del FieldEngine (motor de campos de Asteria)
 *
 * Cubre: buffers pre-asignados e in-place (zero-alloc), reset a la
 * identidad por evaluate, escritura del gesto `base`, resolución de
 * máscaras para kinds no implementados, tolerancia a nodeIds huérfanos.
 */

import { describe, test, expect } from 'vitest'
import {
  createFieldEngine,
  evaluateStack,
  OWNER_NONE,
  type FieldPlanes,
  type ScalarPlane,
} from '../fieldEngine'
import type { NodeAtlas } from '../../store/useAsteriaStore'
import type { NodeAtlasEntry } from '../../../../../../core/aether/types'
import type { Gesture, LayerPaint } from '../AsteriaProject'
import { createDefaultPaint } from '../AsteriaProject'
import { srgbToLinear } from '../colorMath'
import type { HephParamId } from '../../../../../../core/hephaestus/types'

/**
 * 🜨 WAVE 8193: evaluateStack devuelve FieldPlanes — los gestos de estos
 * tests no llevan `paint`, así que todo cae al plano 'intensity' del
 * defaultPaint (equivalente exacto al FieldSnapshot V1).
 */
function ev(
  stack: readonly Gesture[],
  atlas: NodeAtlas,
  paint?: LayerPaint,
): ScalarPlane {
  return evaluateStack(stack, atlas, paint).scalar.get('intensity')!
}

/** Plano de un param concreto (tests multi-plano). */
function planeOf(
  planes: FieldPlanes,
  p: HephParamId,
): ScalarPlane | undefined {
  return planes.scalar.get(p)
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

function entry(nodeId: string, x?: number, z?: number): NodeAtlasEntry {
  return {
    nodeId,
    deviceId: nodeId.split(':')[0],
    cellSuffix: nodeId.includes(':') ? nodeId.slice(nodeId.indexOf(':') + 1) : nodeId,
    family: 'IMPACT',
    zoneId: 'front',
    position: x !== undefined && z !== undefined ? { x, y: 3, z } : undefined,
    role: 'cell',
  }
}

function makeAtlas(): NodeAtlas {
  const entries = [
    entry('fx-1:impact', -2, -1),
    entry('fx-1:color', -2, -1),
    entry('fx-2:petal-l:impact', 1.5, 2),
    entry('fx-3:impact'), // sin posición — el motor debe tolerarlo
  ]
  const byNodeId = new Map(entries.map((e) => [e.nodeId, e]))
  return { entries, byNodeId }
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 FieldEngine — WAVE 8030-P2', () => {
  test('identidad: pila vacía → cero planos activos (∪ params = ∅)', () => {
    const planes = evaluateStack([], makeAtlas())
    expect(planes.count).toBe(4)
    expect(planes.scalar.size).toBe(0)
  })

  test('base: escribe delay/gain uniforme y cubre todos los nodos', () => {
    const stack: Gesture[] = [{ kind: 'base', id: 'b1', delayMs: 120, gain: 0.5 }]
    const snap = ev(stack, makeAtlas())
    expect(Array.from(snap.delayMs)).toEqual([120, 120, 120, 120])
    expect(Array.from(snap.gain)).toEqual([0.5, 0.5, 0.5, 0.5])
    expect(Array.from(snap.mask)).toEqual([1, 1, 1, 1])
  })

  test('glyph (WAVE 8050): nodos fuera del rect del texto no se cubren', () => {
    // 'LX' en (0,0) scaleM=1 → rect ≈ 1.57×1 m centrado; fx-1 (-2,-1) y
    // fx-2 (1.5,2) quedan fuera → cobertura 0 → máscara 0.
    const stack: Gesture[] = [
      {
        kind: 'glyph', id: 'g1', op: 'replace', text: 'LX',
        mask: { nodeIds: ['fx-1:impact', 'fx-2:petal-l:impact'] },
        transform: { x: 0, z: 0, scaleM: 1, rotDeg: 0 },
        channel: 'gain', antialias: true,
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(Array.from(snap.mask)).toEqual([0, 0, 0, 0])
    expect(Array.from(snap.delayMs)).toEqual([0, 0, 0, 0])
  })

  // ── GLYPH (§T5/WAVE 8050): cobertura → gain / barrido → delay ──

  test('glyph gain: la cobertura del píxel escribe gain; fuera → sin cubrir', () => {
    // Atlas: a en (0,0) → celda (2,3) del tallo de 'I'; b en (-0.4,0)
    // → celda (0,3) vacía. 'I' scaleM=1.4 → celda 0.2 m.
    const atlas: NodeAtlas = {
      entries: [entry('a:cell', 0, 0), entry('b:cell', -0.4, 0)],
      byNodeId: new Map(),
    }
    const stack: Gesture[] = [
      {
        kind: 'glyph', id: 'g1', op: 'replace', text: 'I',
        mask: { nodeIds: ['a:cell', 'b:cell'] },
        transform: { x: 0, z: 0, scaleM: 1.4, rotDeg: 0 },
        channel: 'gain', antialias: false,
      },
    ]
    const snap = ev(stack, atlas)
    expect(snap.gain[0]).toBe(1)      // sobre el tallo
    expect(snap.gain[1]).toBe(1)      // fuera → identidad (no pisado)
    expect(Array.from(snap.mask)).toEqual([1, 0])
    expect(snap.delayMs[0]).toBe(0)   // canal gain no toca delay
  })

  test('glyph (WAVE 8160-M3): dentro del bbox pero FUERA de la máscara → intacto', () => {
    // 'I' scaleM=1.4: a (0,0) y b (0.05,0) caen AMBOS sobre el tallo
    // (u≈2.5/2.75 → col 2 encendida). La máscara solo trae 'a:cell':
    // b está dentro del rectángulo matemático pero jamás se evalúa.
    const atlas: NodeAtlas = {
      entries: [entry('a:cell', 0, 0), entry('b:cell', 0.05, 0)],
      byNodeId: new Map(),
    }
    const stack: Gesture[] = [
      {
        kind: 'glyph', id: 'g1', op: 'replace', text: 'I',
        mask: { nodeIds: ['a:cell'] },
        transform: { x: 0, z: 0, scaleM: 1.4, rotDeg: 0 },
        channel: 'gain', antialias: false,
      },
    ]
    const snap = ev(stack, atlas)
    expect(snap.mask[0]).toBe(1)   // en máscara + cubierto
    expect(snap.mask[1]).toBe(0)   // dentro del bbox, fuera de máscara
    expect(snap.gain[1]).toBe(1)   // identidad intacta — cero tinta
  })

  test('glyph delay: barrido — delay = u·celda·1000 ms (1 m/s)', () => {
    // a en x=0 → u=2.5 celdas → 0.5 m desde el borde → 500 ms
    const atlas: NodeAtlas = {
      entries: [entry('a:cell', 0, 0)],
      byNodeId: new Map(),
    }
    const stack: Gesture[] = [
      {
        kind: 'glyph', id: 'g1', op: 'replace', text: 'I',
        mask: { nodeIds: ['a:cell'] },
        transform: { x: 0, z: 0, scaleM: 1.4, rotDeg: 0 },
        channel: 'delay', antialias: false,
      },
    ]
    const snap = ev(stack, atlas)
    expect(snap.delayMs[0]).toBeCloseTo(500, 3)
    expect(snap.gain[0]).toBe(1) // canal delay no toca gain
    expect(snap.mask[0]).toBe(1)
  })

  test('glyph invert (WAVE 8183): la letra escribe gain 0 — bloquea la luz', () => {
    // 'I' scaleM=1.4 → rect 1.0×1.4: a sobre el tallo (col 2), b en la
    // col 0 vacía DENTRO del rect, c fuera del rect.
    const atlas: NodeAtlas = {
      entries: [
        entry('a:cell', 0, 0), entry('b:cell', -0.4, 0), entry('c:cell', -2, 0),
      ],
      byNodeId: new Map(),
    }
    const stack: Gesture[] = [
      {
        kind: 'glyph', id: 'g1', op: 'replace', text: 'I',
        mask: { nodeIds: ['a:cell', 'b:cell', 'c:cell'] },
        transform: { x: 0, z: 0, scaleM: 1.4, rotDeg: 0 },
        channel: 'gain', antialias: false, invert: true,
      },
    ]
    const snap = ev(stack, atlas)
    // a: letra invertida → reclamada con gain 0 (texto negro)
    expect(snap.mask[0]).toBe(1)
    expect(snap.gain[0]).toBe(0)
    // b: fondo del rect invertido → reclamado con gain 1
    expect(snap.mask[1]).toBe(1)
    expect(snap.gain[1]).toBe(1)
    // c: fuera del rect → el negativo no inunda la máscara
    expect(snap.mask[2]).toBe(0)
    expect(snap.gain[2]).toBe(1)
  })

  test('glyph invert + delay: el fondo barre, las letras quedan fuera del frente', () => {
    const atlas: NodeAtlas = {
      entries: [entry('a:cell', 0, 0), entry('b:cell', -0.4, 0)],
      byNodeId: new Map(),
    }
    const stack: Gesture[] = [
      {
        kind: 'glyph', id: 'g1', op: 'replace', text: 'I',
        mask: { nodeIds: ['a:cell', 'b:cell'] },
        transform: { x: 0, z: 0, scaleM: 1.4, rotDeg: 0 },
        channel: 'delay', antialias: false, invert: true,
      },
    ]
    const snap = ev(stack, atlas)
    // a (letra): cov'=0 y canal delay → NO reclamada — la onda la esquiva
    expect(snap.mask[0]).toBe(0)
    // b (fondo): cov'=1 → reclamada, delay = u(0.5)·0.2m·1000 = 100 ms
    expect(snap.mask[1]).toBe(1)
    expect(snap.delayMs[1]).toBeCloseTo(100, 3)
  })

  // ── WAVE (§5.2/T4): delay = dist/speed·1000 ──

  test('wave point: delay = dist euclídea / speedMps · 1000', () => {
    // fx-1 en (-2,-1), fx-2 en (1.5,2); emisor en (0,0), 10 m/s
    // dist(fx-1) = √5 ≈ 2.2361 m → 223.6 ms ; dist(fx-2) = 2.5 m → 250 ms
    const stack: Gesture[] = [
      {
        kind: 'wave', id: 'w1', op: 'replace',
        mask: { nodeIds: ['fx-1:impact', 'fx-2:petal-l:impact'] },
        emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 10,
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(snap.delayMs[0]).toBeCloseTo(Math.sqrt(5) * 100, 3)
    expect(snap.delayMs[2]).toBeCloseTo(250, 3)
    expect(snap.mask[3]).toBe(0) // fx-3 sin posición: sin cobertura
    // Sin falloffM → gain no tocado (identidad)
    expect(snap.gain[0]).toBe(1)
  })

  test('wave falloffM: gain = max(0, 1 - dist/falloffM)', () => {
    const stack: Gesture[] = [
      {
        kind: 'wave', id: 'w1', op: 'replace',
        mask: { nodeIds: ['fx-2:petal-l:impact'] }, // dist = 2.5 m
        emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 10, falloffM: 5,
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(snap.gain[2]).toBeCloseTo(0.5, 4) // 1 - 2.5/5
  })

  test('wave line: proyección sobre dirDeg; detrás del plano → 0', () => {
    // dir 0° = +X. fx-2 en x=1.5 → dist 1.5 → 150 ms a 10 m/s.
    const stack: Gesture[] = [
      {
        kind: 'wave', id: 'w1', op: 'replace',
        mask: { nodeIds: ['fx-1:impact', 'fx-2:petal-l:impact'] },
        emitter: { x: 0, z: 0 }, shape: 'line', dirDeg: 0, speedMps: 10,
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(snap.delayMs[2]).toBeCloseTo(150, 3)
    expect(snap.delayMs[0]).toBe(0) // fx-1 en x=-2: detrás del frente
  })

  test('wave huygens: min(dist) a cualquier emisor', () => {
    const stack: Gesture[] = [
      {
        kind: 'wave', id: 'w1', op: 'replace',
        mask: { nodeIds: ['fx-2:petal-l:impact'] }, // en (1.5, 2)
        emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 10,
        huygens: [{ x: 1.5, z: 0 }], // a 2 m del nodo vs 2.5 m del primario
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(snap.delayMs[2]).toBeCloseTo(200, 3)
  })

  // ── CHRONO (§5.2/T3): tMs del punto más cercano ≤ radiusM ──

  test('chrono captureRealTime: delay = tMs del punto más cercano (🜨 8197: el primero pintado dispara primero)', () => {
    const stack: Gesture[] = [
      {
        kind: 'chrono', id: 'c1', op: 'replace',
        mask: { nodeIds: ['fx-1:impact', 'fx-1:color', 'fx-2:petal-l:impact'] },
        stroke: [
          { x: -2, z: -1, tMs: 0 },     // justo sobre fx-1
          { x: 1.5, z: 2.2, tMs: 800 }, // cerca de fx-2 (0.2 m)
        ],
        captureRealTime: true,
        radiusM: 0.5,
      },
    ]
    const snap = ev(stack, makeAtlas())
    // Dirección natural (sin INVERT): primer punto → menor delay →
    // dispara primero; último punto → mayor delay → dispara último.
    expect(snap.delayMs[0]).toBe(0)
    expect(snap.delayMs[2]).toBe(800)
    expect(snap.mask[2]).toBe(1)
  })

  test('chrono: nodo fuera del radio no recibe cobertura ni delay', () => {
    const stack: Gesture[] = [
      {
        kind: 'chrono', id: 'c1', op: 'replace',
        mask: { nodeIds: ['fx-2:petal-l:impact'] }, // en (1.5, 2)
        stroke: [{ x: 10, z: 10, tMs: 500 }],
        captureRealTime: true,
        radiusM: 0.5,
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(snap.mask[2]).toBe(0)
    expect(snap.delayMs[2]).toBe(0)
  })

  test('chrono arcLength: reparametriza a velocidad constante', () => {
    // Trazo: (0,0)→(3,0) t=0ms, (3,0)→(4,0) t=900ms.
    // Real: pt1 t=900. Arc: arcLen total=4m, pt1 a 3m → 3/4·900=675ms.
    const atlas: NodeAtlas = (() => {
      const e = [entry('fx-a:impact', 3, 0.1)]
      return { entries: e, byNodeId: new Map(e.map((x) => [x.nodeId, x])) }
    })()
    const stack: Gesture[] = [
      {
        kind: 'chrono', id: 'c1', op: 'replace',
        mask: { nodeIds: ['fx-a:impact'] },
        stroke: [
          { x: 0, z: 0, tMs: 0 },
          { x: 3, z: 0, tMs: 900 },
          { x: 4, z: 0, tMs: 1000 },
        ],
        captureRealTime: false,
        radiusM: 0.5,
      },
    ]
    const snap = ev(stack, atlas)
    expect(snap.delayMs[0]).toBeCloseTo(750, 1) // 3/4 de 1000 ms
  })

  // ── MANUAL: entries directas ──

  test('manual: escribe delay/gain por entry, respeta canal parcial', () => {
    const stack: Gesture[] = [
      { kind: 'base', id: 'b', delayMs: 10, gain: 0.5 },
      {
        kind: 'manual', id: 'm1',
        entries: [
          { nodeId: 'fx-1:impact', delayMs: 999 },              // solo delay
          { nodeId: 'fx-1:color', gain: 0.25 },                 // solo gain
          { nodeId: 'fx-2:petal-l:impact', delayMs: 5, gain: 2 },
        ],
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(snap.delayMs[0]).toBe(999)
    // 🜨 8196: la capa posee su amplitud — la entry solo-delay estampa
    // el gain de capa (1), no hereda el 0.5 del base.
    expect(snap.gain[0]).toBe(1)
    expect(snap.delayMs[1]).toBe(10)  // delay intacto (canal gain only)
    expect(snap.gain[1]).toBe(0.25)
    expect(snap.delayMs[2]).toBe(5)
    expect(snap.gain[2]).toBe(2)
    // fx-3 no listado en manual: conserva los valores del base
    expect(snap.delayMs[3]).toBe(10)
    expect(snap.gain[3]).toBe(0.5)
  })

  test('blend ops: wave con op=add suma sobre el delay del base', () => {
    const stack: Gesture[] = [
      { kind: 'base', id: 'b', delayMs: 100, gain: 1 },
      {
        kind: 'wave', id: 'w1', op: 'add',
        mask: { nodeIds: ['fx-2:petal-l:impact'] }, // dist 2.5 m a 10 m/s
        emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 10,
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(snap.delayMs[2]).toBeCloseTo(350, 3) // 100 + 250
  })

  // ── SLICE (§5.2): bucketing por eje + simetría + shuffle ──

  test('slice x linear: normaliza min/max → cuantiza → delay = ub·span', () => {
    // fx-1 x=-2 (min), fx-2 x=1.5 (max). buckets=2 → fx-1 → 0, fx-2 → span.
    const stack: Gesture[] = [
      {
        kind: 'slice', id: 's1', op: 'replace', axis: 'x',
        buckets: 2, spanMs: 1000, symmetry: 'linear',
        mask: { nodeIds: ['fx-1:impact', 'fx-1:color', 'fx-2:petal-l:impact'] },
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(snap.delayMs[0]).toBe(0)
    expect(snap.delayMs[1]).toBe(0)
    expect(snap.delayMs[2]).toBe(1000)
    expect(snap.mask[3]).toBe(0) // sin posición: eje espacial no lo cubre
  })

  test('slice dmx: orden de patch, cubre nodos SIN posición', () => {
    // eje no-espacial: fx-3 (índice 3, sin position) también se rebana
    const stack: Gesture[] = [
      {
        kind: 'slice', id: 's1', op: 'replace', axis: 'dmx',
        buckets: 4, spanMs: 900, symmetry: 'linear',
        mask: { nodeIds: ['fx-1:impact', 'fx-1:color', 'fx-2:petal-l:impact', 'fx-3:impact'] },
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(snap.delayMs[0]).toBe(0)         // idx 0 → bucket 0
    expect(snap.delayMs[3]).toBe(900)       // idx 3 → bucket 3 → ub 1
    expect(snap.mask[3]).toBe(1)
  })

  test('slice zone: cubos por ordinal de zoneId', () => {
    const e = [
      entry('fx-1:impact', -2, -1),
      { ...entry('fx-2:impact', 1.5, 2), zoneId: 'back' },
    ]
    const atlas: NodeAtlas = { entries: e, byNodeId: new Map(e.map((x) => [x.nodeId, x])) }
    const stack: Gesture[] = [
      {
        kind: 'slice', id: 's1', op: 'replace', axis: 'zone',
        buckets: 2, spanMs: 500, symmetry: 'linear',
        mask: { nodeIds: ['fx-1:impact', 'fx-2:impact'] },
      },
    ]
    const snap = ev(stack, atlas)
    expect(snap.delayMs[0]).toBe(0)    // 'front' → ordinal 0
    expect(snap.delayMs[1]).toBe(500)  // 'back'  → ordinal 1
  })

  test('slice center-out: cubo central = delay 0, extremos = span', () => {
    const stack: Gesture[] = [
      {
        kind: 'slice', id: 's1', op: 'replace', axis: 'dmx',
        buckets: 3, spanMs: 500, symmetry: 'center-out',
        mask: { nodeIds: ['fx-1:impact', 'fx-1:color', 'fx-2:petal-l:impact'] },
      },
    ]
    const snap = ev(stack, makeAtlas())
    // idx 0→b0(ub 0→|−1|=1→500) · idx1→b1(ub .5→0→0) · idx2→b2(ub 1→1→500)
    expect(snap.delayMs[0]).toBe(500)
    expect(snap.delayMs[1]).toBe(0)
    expect(snap.delayMs[2]).toBe(500)
  })

  test('slice shuffleSeed: determinista y dentro de [0, span]', () => {
    const mk = (): Gesture => ({
      kind: 'slice', id: 's1', op: 'replace', axis: 'dmx',
      buckets: 4, spanMs: 600, symmetry: 'linear', shuffleSeed: 42,
      mask: { nodeIds: ['fx-1:impact', 'fx-1:color', 'fx-2:petal-l:impact', 'fx-3:impact'] },
    })
    const a = ev([mk()], makeAtlas())
    const delays1 = Array.from(a.delayMs)
    const b = ev([mk()], makeAtlas())
    expect(Array.from(b.delayMs)).toEqual(delays1) // determinismo
    for (const d of delays1) {
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(600)
    }
  })

  // ── NOISE (§5.2): fBm por posición → delay orgánico ──

  test('noise: determinista por (seed, posición), acotado a [0, amountMs]', () => {
    const mk = (seed: number): Gesture => ({
      kind: 'noise', id: 'n1', op: 'replace', seed, scaleM: 1.5,
      amountMs: 120, octaves: 2,
      mask: { nodeIds: ['fx-1:impact', 'fx-1:color', 'fx-2:petal-l:impact', 'fx-3:impact'] },
    })
    const s1 = ev([mk(7)], makeAtlas())
    const first = Array.from(s1.delayMs)
    const s2 = ev([mk(7)], makeAtlas())
    expect(Array.from(s2.delayMs)).toEqual(first) // determinismo
    for (let i = 0; i < 3; i++) {
      expect(s1.delayMs[i]).toBeGreaterThanOrEqual(0)
      expect(s1.delayMs[i]).toBeLessThanOrEqual(120)
      expect(s1.mask[i]).toBe(1)
    }
    expect(s1.mask[3]).toBe(0) // sin posición → sin ruido
    // Seed distinta → campo distinto (al menos un nodo difiere)
    const s3 = ev([mk(99)], makeAtlas())
    expect(
      first.some((d, i) => d !== s3.delayMs[i]),
    ).toBe(true)
  })

  test('nodeIds huérfanos en máscara se ignoran (rig drift)', () => {
    const stack: Gesture[] = [
      {
        kind: 'noise', id: 'n1', op: 'add', seed: 7, scaleM: 1, amountMs: 50, octaves: 2,
        mask: { nodeIds: ['fx-1:impact', 'fx-ghost:impact', 'fx-99:nada'] },
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(Array.from(snap.mask)).toEqual([1, 0, 0, 0])
  })

  test('zero-alloc: evaluate() devuelve SIEMPRE la misma referencia de buffers', () => {
    const engine = createFieldEngine(makeAtlas())
    const s1 = engine.evaluate([])
    const s2 = engine.evaluate([{ kind: 'base', id: 'b', delayMs: 5, gain: 2 }])
    expect(s1).toBe(s2)
    // El plano nace en el primer evaluate con capas; la Map es estable —
    // s1.scalar y s2.scalar son la MISMA referencia.
    const p = s1.scalar.get('intensity')!
    expect(s2.scalar.get('intensity')).toBe(p)
    // Y el buffer refleja el nuevo estado (in-place)
    expect(p.delayMs[0]).toBe(5)
  })

  test('reset entre evaluates: un gesto retirado libera sus planos', () => {
    const engine = createFieldEngine(makeAtlas())
    engine.evaluate([{ kind: 'base', id: 'b', delayMs: 10, gain: 1 }])
    const snap = engine.evaluate([])
    // Pila vacía → ∪ params = ∅ → cero planos (la cobertura queda libre)
    expect(snap.scalar.size).toBe(0)
  })

  test('indexOf: lookup O(1) nodeId→índice', () => {
    const engine = createFieldEngine(makeAtlas())
    expect(engine.indexOf('fx-2:petal-l:impact')).toBe(2)
    expect(engine.indexOf('fx-ghost:x')).toBe(-1)
  })

  // ── 🜨 WAVE 8181: post-proceso del inspector — timeScale / invert / gain ──

  test('chrono timeScale: multiplica el delay capturado (×2 = chase al doble de lento)', () => {
    const mk = (timeScale?: number): Gesture => ({
      kind: 'chrono', id: 'c1', op: 'replace', timeScale,
      mask: { nodeIds: ['fx-2:petal-l:impact'] },
      stroke: [{ x: 0, z: 0, tMs: 0 }, { x: 1.5, z: 2, tMs: 800 }],
      captureRealTime: true, radiusM: 0.5,
    })
    expect(ev([mk()], makeAtlas()).delayMs[2]).toBe(800)
    expect(ev([mk(2)], makeAtlas()).delayMs[2]).toBe(1600)
    expect(ev([mk(0.5)], makeAtlas()).delayMs[2]).toBe(400)
  })

  test('chrono invert: el final del trazo dispara primero (totalMs − tMs)', () => {
    const stack: Gesture[] = [
      {
        kind: 'chrono', id: 'c1', op: 'replace', invert: true,
        mask: { nodeIds: ['fx-1:impact', 'fx-2:petal-l:impact'] },
        stroke: [
          { x: -2, z: -1, tMs: 0 },    // sobre fx-1 → invierte a 800
          { x: 1.5, z: 2, tMs: 800 },  // sobre fx-2 → invierte a 0
        ],
        captureRealTime: true, radiusM: 0.5,
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(snap.delayMs[0]).toBe(800)  // pintado primero, dispara último
    expect(snap.delayMs[2]).toBe(0)    // pintado último, dispara primero
  })

  test('chrono gain: definido → estampa gain en nodos cubiertos (canal both)', () => {
    const stack: Gesture[] = [
      { kind: 'base', id: 'b', delayMs: 0, gain: 1 },
      {
        kind: 'chrono', id: 'c1', op: 'replace', gain: 0.4,
        mask: { nodeIds: ['fx-1:impact'] },
        stroke: [{ x: -2, z: -1, tMs: 300 }],
        captureRealTime: true, radiusM: 0.5,
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(snap.delayMs[0]).toBe(300)
    expect(snap.gain[0]).toBeCloseTo(0.4, 4)
    expect(snap.gain[2]).toBe(1) // fuera del trazo → identidad del base
  })

  test('wave gain: sin falloff estampa gain plano; con falloff lo multiplica', () => {
    const flat: Gesture[] = [
      {
        kind: 'wave', id: 'w1', op: 'replace', gain: 0.6,
        mask: { nodeIds: ['fx-2:petal-l:impact'] },
        emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 10,
      },
    ]
    expect(ev(flat, makeAtlas()).gain[2]).toBeCloseTo(0.6, 4)
    // falloff 5 m a dist 2.5 → 0.5; × capa 0.5 → 0.25
    const scaled: Gesture[] = [
      {
        kind: 'wave', id: 'w1', op: 'replace', gain: 0.5, falloffM: 5,
        mask: { nodeIds: ['fx-2:petal-l:impact'] },
        emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 10,
      },
    ]
    expect(ev(scaled, makeAtlas()).gain[2]).toBeCloseTo(0.25, 4)
  })

  test('slice gain: estampa gain uniforme sobre los buckets cubiertos', () => {
    const stack: Gesture[] = [
      {
        kind: 'slice', id: 's1', op: 'replace', axis: 'dmx', gain: 0.3,
        buckets: 2, spanMs: 500, symmetry: 'linear',
        mask: { nodeIds: ['fx-1:impact', 'fx-2:petal-l:impact'] },
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(snap.gain[0]).toBeCloseTo(0.3, 4)
    expect(snap.gain[2]).toBeCloseTo(0.3, 4)
  })

  test('noise gain: definido → canal both (delay + estampa)', () => {
    const stack: Gesture[] = [
      {
        kind: 'noise', id: 'n1', op: 'replace', seed: 7, scaleM: 1.5,
        amountMs: 100, octaves: 1, gain: 0.7,
        mask: { nodeIds: ['fx-1:impact'] },
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(snap.gain[0]).toBeCloseTo(0.7, 4)
    expect(snap.mask[0]).toBe(1)
  })

  test('glyph gain: multiplica la cobertura del píxel en canal gain', () => {
    const atlas: NodeAtlas = {
      entries: [entry('a:cell', 0, 0)],
      byNodeId: new Map(),
    }
    const stack: Gesture[] = [
      {
        kind: 'glyph', id: 'g1', op: 'replace', text: 'I', gain: 0.5,
        mask: { nodeIds: ['a:cell'] },
        transform: { x: 0, z: 0, scaleM: 1.4, rotDeg: 0 },
        channel: 'gain', antialias: false,
      },
    ]
    const snap = ev(stack, atlas)
    expect(snap.gain[0]).toBeCloseTo(0.5, 4) // cov 1 × 0.5
  })

  test('manual gain: multiplica entries con gain y rellena las que no tienen', () => {
    const stack: Gesture[] = [
      {
        kind: 'manual', id: 'm1', gain: 0.5,
        entries: [
          { nodeId: 'fx-1:impact', gain: 0.8 },   // 0.8 × 0.5 = 0.4
          { nodeId: 'fx-1:color', delayMs: 50 },  // sin gain propio → 0.5
        ],
      },
    ]
    const snap = ev(stack, makeAtlas())
    expect(snap.gain[0]).toBeCloseTo(0.4, 4)
    expect(snap.gain[1]).toBeCloseTo(0.5, 4)
    expect(snap.delayMs[1]).toBe(50) // delay intacto
  })

  // ── 🜨 WAVE 8196 — PHANTOM GAIN: la capa posee su amplitud ──

  test('🜨 8196 phantom gain: gestos temporales sin `gain` explícito estampan 1.0 — no heredan la base', () => {
    // Regresión del bug E2E reportado: un SLICE con GAIN visual 100%
    // (fallback `?? 1` del inspector) sobre BASE oscura no emitía pulso —
    // el kernel evaluaba `gain === undefined` como salto de canal
    // (sChan=1), el plano conservaba base.gain y bakeGainIntoCurve
    // multiplicaba la envolvente por él. Doctrina: gain undefined ≡ 1.0.
    const stack: Gesture[] = [
      { kind: 'base', id: 'b', delayMs: 0, gain: 0.18 },
      {
        kind: 'wave', id: 'w1', op: 'replace',
        mask: { nodeIds: ['fx-1:impact'] },
        emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 10,
      },
      {
        kind: 'chrono', id: 'c1', op: 'replace',
        mask: { nodeIds: ['fx-1:color'] },
        stroke: [{ x: -2, z: -1, tMs: 300 }],
        captureRealTime: true, radiusM: 0.5,
      },
      {
        kind: 'noise', id: 'n1', op: 'replace', seed: 7, scaleM: 1.5,
        amountMs: 100, octaves: 1,
        mask: { nodeIds: ['fx-2:petal-l:impact'] },
      },
      {
        kind: 'slice', id: 's1', op: 'replace', axis: 'dmx',
        buckets: 2, spanMs: 500, symmetry: 'linear',
        mask: { nodeIds: ['fx-3:impact'] },
      },
    ]
    const snap = ev(stack, makeAtlas())
    // Los 4 nodos cubiertos estampan gain 1.0 — NUNCA el 0.18 del base.
    expect(snap.gain[0]).toBe(1)   // wave sin gain
    expect(snap.gain[1]).toBe(1)   // chrono sin gain
    expect(snap.gain[2]).toBe(1)   // noise sin gain
    expect(snap.gain[3]).toBe(1)   // slice sin gain (axis dmx cubre sin posición)
    expect(snap.mask[3]).toBe(1)
  })

  test('🜨 8196 phantom gain: manual entry sin campos no reclama; entry solo-delay estampa gain de capa', () => {
    const stack: Gesture[] = [
      { kind: 'base', id: 'b', delayMs: 0, gain: 0.18 },
      {
        kind: 'manual', id: 'm1', gain: 0.3,
        entries: [
          { nodeId: 'fx-1:impact' },                // vacía → no reclama
          { nodeId: 'fx-1:color', delayMs: 50 },    // solo delay → estampa 0.3
        ],
      },
    ]
    const snap = ev(stack, makeAtlas())
    // Entry vacía → no escribe nada: delay/gain conservan el base
    // (mask sigue =1 por el claim del base, no por la entry).
    expect(snap.delayMs[0]).toBe(0)
    expect(snap.gain[0]).toBeCloseTo(0.18, 4)
    expect(snap.delayMs[1]).toBe(50)
    expect(snap.gain[1]).toBeCloseTo(0.3, 4) // layerGain de la capa manual
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 🜨 WAVE 8193 — MULTI-PLANO: paint.params enruta, owner por capa, zero-alloc
// ─────────────────────────────────────────────────────────────────────────────

describe('🜨 FieldEngine multi-plano — WAVE 8193', () => {
  test('paint.params enruta la geometría solo a los planos declarados', () => {
    const stack: Gesture[] = [
      { kind: 'base', id: 'b', delayMs: 0, gain: 1 },
      {
        kind: 'manual', id: 'm1',
        paint: { params: ['pan'] }, // este gesto pinta 'pan', no 'intensity'
        entries: [{ nodeId: 'fx-1:impact', delayMs: 120 }],
      },
    ]
    const planes = evaluateStack(stack, makeAtlas())
    const intensity = planeOf(planes, 'intensity')!
    const pan = planeOf(planes, 'pan')!
    // 'intensity' solo ve el base: delay identidad, owner 0
    expect(intensity.delayMs[0]).toBe(0)
    expect(intensity.owner[0]).toBe(0)
    // 'pan' recibe el gesto manual: delay 120, owner = índice del gesto (1)
    expect(pan.delayMs[0]).toBe(120)
    expect(pan.owner[0]).toBe(1)
    // nodos fuera de la máscara del gesto: sin cobertura, sin owner
    expect(pan.mask[1]).toBe(0)
    expect(pan.owner[1]).toBe(OWNER_NONE)
  })

  test('ensurePlanes: al cambiar ∪ params solo se reasigna lo nuevo; el resto conserva buffer', () => {
    const engine = createFieldEngine(makeAtlas())
    const paint = createDefaultPaint()
    const stack: Gesture[] = [
      { kind: 'base', id: 'b', delayMs: 0, gain: 1 },
      {
        kind: 'manual', id: 'm1', paint: { params: ['intensity', 'pan'] },
        entries: [{ nodeId: 'fx-1:impact', delayMs: 10 }],
      },
    ]
    const p1 = engine.evaluate(stack, paint)
    const intensityRef = p1.scalar.get('intensity')!
    expect(p1.scalar.has('pan')).toBe(true)
    // Retirar 'pan' del conjunto activo → 'intensity' sobrevive intacto
    const stack2: Gesture[] = [
      stack[0],
      { ...(stack[1] as Gesture & { kind: 'manual' }), paint: { params: ['intensity'] } },
    ]
    const p2 = engine.evaluate(stack2, paint)
    expect(p2.scalar.has('pan')).toBe(false)
    expect(p2.scalar.get('intensity')).toBe(intensityRef)
    expect(p2.scalar.get('intensity')!.delayMs).toBe(intensityRef.delayMs)
  })

  test('🜨 G-ZERO-ALLOC-RAF: 1000 evaluate() sin mutar paint → buffers idénticos por referencia', () => {
    const engine = createFieldEngine(makeAtlas())
    const paint = createDefaultPaint()
    const stack: Gesture[] = [
      { kind: 'base', id: 'b', delayMs: 0, gain: 1 },
      {
        kind: 'wave', id: 'w1', op: 'add',
        emitter: { x: 0, z: 0 }, shape: 'point', speedMps: 10,
        mask: { nodeIds: ['fx-1:impact', 'fx-2:petal-l:impact'] },
        paint: { params: ['intensity', 'pan'] },
      },
    ]
    const planes = engine.evaluate(stack, paint)
    // Captura de identidad: FieldPlanes, ScalarPlane y los 4 TypedArrays
    const refs = [...planes.scalar.entries()].map(
      ([p, pl]) => [p, pl, pl.delayMs, pl.gain, pl.mask, pl.owner] as const,
    )
    expect(refs.length).toBe(2)
    for (let i = 0; i < 1000; i++) {
      expect(engine.evaluate(stack, paint)).toBe(planes) // mismo FieldPlanes
    }
    for (const [p, pl, d, g, m, o] of refs) {
      const cur = planes.scalar.get(p)!
      expect(cur).toBe(pl)
      expect(cur.delayMs).toBe(d)
      expect(cur.gain).toBe(g)
      expect(cur.mask).toBe(m)
      expect(cur.owner).toBe(o)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 🜨 WAVE 8194 — COLOR PLANE: álgebra de luz §3.4 en RGB lineal
// ─────────────────────────────────────────────────────────────────────────────

const RED_LIN = srgbToLinear(1)
const BLUE_LIN = srgbToLinear(1)

describe('🜨 FieldEngine — ColorPlane (WAVE 8194)', () => {
  test("'color' en params → plano de color activo, fuera del Map escalar", () => {
    const stack: Gesture[] = [
      {
        kind: 'base', id: 'b', delayMs: 0, gain: 1,
        paint: { params: ['intensity', 'color'], color: '#ff0000' },
      },
    ]
    const planes = evaluateStack(stack, makeAtlas())
    expect(planes.color).not.toBeNull()
    expect(planes.scalar.has('color')).toBe(false)
    // El base pinta el color por defecto del paint sobre TODOS los nodos
    const cp = planes.color!
    expect(Array.from(cp.mask)).toEqual([1, 1, 1, 1])
    expect(Array.from(cp.alpha)).toEqual([1, 1, 1, 1])
    expect(Array.from(cp.owner)).toEqual([0, 0, 0, 0])
  })

  test('replace + opacity: el color se compone por cobertura·opacity en lineal', () => {
    // Base rojo a opacity 1 + capa manual azul a 0.5 sobre el nodo 0:
    // rgb = red·(1−0.5) + blue·0.5 (over sobre lienzo ya opaco).
    const stack: Gesture[] = [
      {
        kind: 'base', id: 'b', delayMs: 0, gain: 1,
        paint: { params: ['color'], color: '#ff0000' },
      },
      {
        kind: 'manual', id: 'm1',
        paint: { params: ['color'], color: '#0000ff', opacity: 0.5 },
        entries: [{ nodeId: 'fx-1:color', delayMs: 0 }],
      },
    ]
    const cp = evaluateStack(stack, makeAtlas()).color!
    // Nodo 1 = 'fx-1:color' (índice 1): mezcla 50/50 en lineal
    expect(cp.rgb[3]).toBeCloseTo(RED_LIN * 0.5, 5)
    expect(cp.rgb[4]).toBeCloseTo(0, 5)
    expect(cp.rgb[5]).toBeCloseTo(BLUE_LIN * 0.5, 5)
    expect(cp.alpha[1]).toBeCloseTo(0.5 + 1 * 0.5, 5) // over: 1
    expect(cp.owner[1]).toBe(1)
    // Nodo 0 ('fx-1:impact') solo vio el base → rojo puro
    expect(cp.rgb[0]).toBeCloseTo(RED_LIN, 5)
    expect(cp.rgb[2]).toBeCloseTo(0, 5)
    expect(cp.owner[0]).toBe(0)
  })

  test('add: suma de luz en lineal con clamp a 1', () => {
    const stack: Gesture[] = [
      {
        kind: 'base', id: 'b', delayMs: 0, gain: 1,
        paint: { params: ['color'], color: '#ff0000', opacity: 0.6 },
      },
      {
        kind: 'manual', id: 'm1', op: 'add',
        paint: { params: ['color'], color: '#00ff00' },
        entries: [{ nodeId: 'fx-1:impact', delayMs: 0 }],
      },
    ]
    const cp = evaluateStack(stack, makeAtlas()).color!
    const green = srgbToLinear(1)
    // nodo 0: C_i + C_L·a — rojo·0.6 ya acumulado + verde·1 (r:0.6+0,
    // g:0+1, b:0) — suma de luz canal a canal, sin clamp que intervenga.
    expect(cp.rgb[0]).toBeCloseTo(RED_LIN * 0.6, 5)
    expect(cp.rgb[1]).toBeCloseTo(green, 5)
    expect(cp.rgb[2]).toBeCloseTo(0, 5)
    // alpha: over de la capa add a=1 → 1
    expect(cp.alpha[0]).toBeCloseTo(1, 5)
  })

  test('mul/min/max: Multiply filtra, Darken techaea con lerp(1,C_L,a), Lighten eleva', () => {
    // Base gris medio (#808080) sobre el nodo 0; tres gestos idénticos
    // en nodos distintos prueban mul, min y max contra un azul.
    const gray = srgbToLinear(0.50196)
    const stack: Gesture[] = [
      {
        kind: 'base', id: 'b', delayMs: 0, gain: 1,
        paint: { params: ['color'], color: '#808080' },
      },
      {
        kind: 'manual', id: 'mmul', op: 'mul',
        paint: { params: ['color'], color: '#0000ff' },
        entries: [{ nodeId: 'fx-1:impact', delayMs: 0 }],
      },
      {
        kind: 'manual', id: 'mmin', op: 'min',
        paint: { params: ['color'], color: '#0000ff' },
        entries: [{ nodeId: 'fx-1:color', delayMs: 0 }],
      },
      {
        kind: 'manual', id: 'mmax', op: 'max',
        paint: { params: ['color'], color: '#0000ff' },
        entries: [{ nodeId: 'fx-2:petal-l:impact', delayMs: 0 }],
      },
    ]
    const cp = evaluateStack(stack, makeAtlas()).color!
    // nodo 0 — mul: C·lerp(1, blue, 1) = gray·blue → (0, 0, gray)
    expect(cp.rgb[0]).toBeCloseTo(0, 5)
    expect(cp.rgb[2]).toBeCloseTo(gray, 5)
    // nodo 1 — min: min(gray, lerp(1, blue, 1)) = min(gray, blue) →
    // r:0, g:0, b:min(gray,1)=gray
    expect(cp.rgb[3]).toBeCloseTo(0, 5)
    expect(cp.rgb[5]).toBeCloseTo(gray, 5)
    // nodo 2 — max: max(gray, blue·1) → r:gray, g:gray, b:1
    expect(cp.rgb[6]).toBeCloseTo(gray, 5)
    expect(cp.rgb[7]).toBeCloseTo(gray, 5)
    expect(cp.rgb[8]).toBeCloseTo(BLUE_LIN, 5)
    expect(Array.from(cp.alpha)).toEqual([1, 1, 1, 1])
  })

  test('alpha=0 → mask=0: el lienzo transparente no emite color', () => {
    // Solo la capa manual pinta color y solo sobre 'fx-1:color';
    // el resto de nodos jamás recibe tinta de color.
    const stack: Gesture[] = [
      { kind: 'base', id: 'b', delayMs: 0, gain: 1, paint: { params: ['intensity'] } },
      {
        kind: 'manual', id: 'm1',
        paint: { params: ['color'], color: '#00ff00' },
        entries: [{ nodeId: 'fx-1:color', delayMs: 0 }],
      },
    ]
    const cp = evaluateStack(stack, makeAtlas()).color!
    expect(Array.from(cp.alpha)).toEqual([0, 1, 0, 0])
    expect(Array.from(cp.mask)).toEqual([0, 1, 0, 0])
  })

  test('ensurePlanes: color entra/sale del conjunto activo sin tocar escalares', () => {
    const engine = createFieldEngine(makeAtlas())
    const withColor: Gesture[] = [
      {
        kind: 'base', id: 'b', delayMs: 0, gain: 1,
        paint: { params: ['intensity', 'color'], color: '#ff0000' },
      },
    ]
    const p1 = engine.evaluate(withColor)
    const cp = p1.color
    expect(cp).not.toBeNull()
    const cpRef = cp!
    const intensity = p1.scalar.get('intensity')!
    // Quitar 'color' → plano retirado, intensity conserva buffer
    const without: Gesture[] = [
      { ...withColor[0], paint: { params: ['intensity'] } } as Gesture,
    ]
    const p2 = engine.evaluate(without)
    expect(p2.color).toBeNull()
    expect(p2.scalar.get('intensity')).toBe(intensity)
    // Reintroducir 'color' → NUEVO plano (el viejo se liberó), mismo result
    const p3 = engine.evaluate(withColor)
    expect(p3).toBe(p1)
    expect(p3.color).not.toBeNull()
    expect(p3.color).not.toBe(cpRef)
    // Y estable en repaints: misma instancia evaluate tras evaluate
    expect(engine.evaluate(withColor).color).toBe(p3.color)
  })

  test('zero-alloc: el ColorPlane y sus buffers son estables en el RAF', () => {
    const engine = createFieldEngine(makeAtlas())
    const stack: Gesture[] = [
      {
        kind: 'base', id: 'b', delayMs: 0, gain: 1,
        paint: { params: ['intensity', 'color'], color: '#ff0000' },
      },
    ]
    const planes = engine.evaluate(stack)
    const cp = planes.color!
    const { rgb, alpha, mask, delayMs, gain, owner } = cp
    for (let i = 0; i < 500; i++) {
      const p = engine.evaluate(stack)
      expect(p.color).toBe(cp)
    }
    expect(cp.rgb).toBe(rgb)
    expect(cp.alpha).toBe(alpha)
    expect(cp.mask).toBe(mask)
    expect(cp.delayMs).toBe(delayMs)
    expect(cp.gain).toBe(gain)
    expect(cp.owner).toBe(owner)
  })
})
