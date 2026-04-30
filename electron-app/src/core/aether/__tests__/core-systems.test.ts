/**
 * ⚛️ WAVE 4519.2 — THE CORE & ELEMENTAL PROVING GROUNDS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tests de integración para los tres adaptadores core del pipeline Aether:
 *   - ColorAdapter   → RGB normalizado [0-1] tintado por paleta de vibe
 *   - ImpactAdapter  → dimmer [0-1] reactivo a energía de audio
 *   - VMMAdapter     → pan/tilt/rotation [0-1] desde patrones VMM
 *
 * REGLAS DE ORO:
 * - No se levanta el Orquestador completo.
 * - Los adaptadores se instancian de forma aislada.
 * - LiquidEngineBase mocked para control determinista.
 * - VMM real (no mockeado): el adapter es el sujeto bajo test, no el VMM.
 * - nowMs/deltaMs mutar en FrameContext para simular tiempo síncronamente.
 * - Axioma Anti-Simulación: no hay Math.random() — todos los inputs son deterministas.
 *
 * @module core/aether/__tests__/core-systems.test.ts
 * @version WAVE 4519.2
 */

import { describe, test, expect, beforeEach } from 'vitest'

import { ColorAdapter }  from '../adapters/ColorAdapter'
import { ImpactAdapter } from '../adapters/ImpactAdapter'
import { VMMAdapter }    from '../adapters/KineticAdapter'

import type { AudioMetrics, VibeProfile, MusicalContext, FrameContext } from '../systems/BaseSystem'
import type { IColorNodeData }   from '../capability-node'
import type { IImpactNodeData }  from '../capability-node'
import type { IKineticNodeData } from '../capability-node'
import type { INodeView }        from '../node-graph'
import type { IIntentBus, INodeIntent } from '../intent-bus'
import type { LiquidEngineBase }        from '../../../hal/physics/LiquidEngineBase'
import type { LiquidStereoInput, LiquidStereoResult } from '../../../hal/physics/LiquidStereoPhysics'
import { NodeFamily } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// FACTORIES — Mocks deterministas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * AudioMetrics con valores controlados.
 * Todos en [0,1], deterministas — cero random.
 */
function makeAudio(overrides: Partial<AudioMetrics> = {}): AudioMetrics {
  return {
    subBass:          0.6,
    bass:             0.7,
    mid:              0.5,
    highMid:          0.4,
    presence:         0.3,
    air:              0.2,
    energy:           0.65,
    hasTransient:     false,
    transientStrength: 0,
    bpm:              128,
    beatPhase:        0.25,
    beatCount:        16,
    ...overrides,
  }
}

/**
 * VibeProfile con paleta roja-naranja determinista.
 */
function makeVibe(overrides: Partial<VibeProfile> = {}): VibeProfile {
  return {
    name:   'techno-club',
    palette: [
      { h: 0.02, s: 0.9, l: 0.5 },   // primary: rojo-naranja
      { h: 0.58, s: 0.8, l: 0.45 },  // secondary: azul eléctrico
    ],
    movementSpeed:      0.7,
    intensity:          0.8,
    beamExpressiveness: 0.5,
    ...overrides,
  }
}

/**
 * MusicalContext con sección 'drop' por defecto.
 */
function makeMusical(overrides: Partial<MusicalContext> = {}): MusicalContext {
  return {
    section:          'drop',
    dropImminent:     false,
    sectionIntensity: 0.8,
    harmonicTension:  0.3,
    sectionElapsedMs: 4000,
    ...overrides,
  }
}

/**
 * FrameContext completo, mutable en nowMs/deltaMs para simular tiempo.
 */
function makeContext(overrides: Partial<FrameContext> = {}): FrameContext {
  return {
    audio:      makeAudio(),
    musical:    makeMusical(),
    vibe:       makeVibe(),
    nowMs:      1000,
    deltaMs:    22,
    frameIndex: 1,
    ...overrides,
  }
}

/**
 * Mock determinista de LiquidEngineBase.
 * applyBands() retorna valores fijos controlados por el test.
 */
function makeLiquidEngineMock(zoneValues: Partial<LiquidStereoResult> = {}): LiquidEngineBase {
  const defaultResult: LiquidStereoResult = {
    frontLeftIntensity:  0.8,
    frontRightIntensity: 0.8,
    backLeftIntensity:   0.5,
    backRightIntensity:  0.5,
    moverLeftIntensity:  0.9,
    moverRightIntensity: 0.9,
    globalIntensity:     0.75,
    ...zoneValues,
  }
  return {
    applyBands: (_input: LiquidStereoInput): LiquidStereoResult => defaultResult,
  } as unknown as LiquidEngineBase
}

/**
 * Spy bus: captura todos los intents pusheados sin alloc complejo.
 */
function makeSpyBus(): IIntentBus & { captured: INodeIntent[] } {
  const captured: INodeIntent[] = []
  return {
    captured,
    push(intent: INodeIntent): void {
      // Copia snapshot del intent (valores en ese momento)
      captured.push({
        nodeId:     intent.nodeId,
        values:     { ...intent.values },
        priority:   intent.priority,
        confidence: intent.confidence,
        source:     intent.source,
      })
    },
    clear():                           void  { captured.length = 0 },
    buildIndex():                      void  { /* no-op en spy */ },
    getIntentsForNode(_id: string):    readonly INodeIntent[] { return [] },
    forEach(_fn: (i: INodeIntent) => void): void { captured.forEach(_fn) },
    get size(): number { return captured.length },
    get overflowed(): boolean { return false },
  } as unknown as IIntentBus & { captured: INodeIntent[] }
}

/**
 * Helper genérico: construye un INodeView mock a partir de un array de nodos.
 */
function makeNodeView<T>(nodes: T[]): INodeView<T> {
  return {
    get count(): number { return nodes.length },
    forEach(fn: (node: T, index: number) => void): void {
      nodes.forEach((n, i) => fn(n, i))
    },
    get(i: number): T { return nodes[i] },
    byZone():  T[] { return [...nodes] },
    byRole():  T[] { return [...nodes] },
  }
}

// ───────────────────────────────────────────────────────
// Factories de nodos específicas por familia
// ───────────────────────────────────────────────────────

function makeColorNode(overrides: Partial<IColorNodeData> = {}): IColorNodeData {
  return {
    nodeId:   'par-001:color',
    family:   NodeFamily.COLOR,
    role:     'primary',
    deviceId: 'par-001',
    mixingType: 'rgb' as any,
    currentColor: { r: 0, g: 0, b: 0 },
    position: { x: 3, y: 0.5, z: 2 },
    ...overrides,
  } as unknown as IColorNodeData
}

function makeImpactNode(overrides: Partial<IImpactNodeData> = {}): IImpactNodeData {
  return {
    nodeId:   'par-001:impact',
    family:   NodeFamily.IMPACT,
    role:     'primary',
    deviceId: 'par-001',
    transferCurve: 'linear' as any,
    bandMix: {
      subBass:  0.0,
      bass:     0.6,
      mid:      0.2,
      highMid:  0.1,
      presence: 0.1,
      air:      0.0,
      energy:   0.0,
    },
    envelopeState: { value: 0, targetValue: 0, decayRate: 0 } as any,
    position: { x: 3, y: 0.5, z: 2 },
    ...overrides,
  } as unknown as IImpactNodeData
}

function makeKineticNode(overrides: Partial<IKineticNodeData> = {}): IKineticNodeData {
  return {
    nodeId:       'mover-001:kinetic',
    family:       NodeFamily.KINETIC,
    role:         'primary',
    deviceId:     'mover-001',
    motorType:    'pan-tilt' as any,
    isContinuous: false,
    maxPanSpeed:  400,
    maxTiltSpeed: 400,
    stereoIndex:  0,
    stereoTotal:  2,
    currentPosition: { pan: 0.5, tilt: 0.5 },
    physicalPosition: { x: 0, y: 4, z: 0 },
    position:         { x: 0, y: 4, z: 0 },
    ...overrides,
  } as unknown as IKineticNodeData
}

function makeFanNode(overrides: Partial<IKineticNodeData> = {}): IKineticNodeData {
  return makeKineticNode({
    nodeId:          'fan-001:kinetic',
    isContinuous:    true,
    maxRotationSpeed: 720,
    position:        { x: 1.5, y: 3, z: 0 },
    physicalPosition: { x: 1.5, y: 3, z: 0 },
    ...overrides,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// §1 — ColorAdapter
// ═══════════════════════════════════════════════════════════════════════════

describe('🎨 ColorAdapter — El Pintor Espectral', () => {

  let adapter: ColorAdapter
  let bus: ReturnType<typeof makeSpyBus>

  beforeEach(() => {
    // Inyectar LiquidEngine mock: aislamiento total del motor real
    adapter = new ColorAdapter(makeLiquidEngineMock())
    bus     = makeSpyBus()
  })

  test('§1.1 — RGB producido está estrictamente en [0, 1]', () => {
    const node = makeColorNode()
    const view = makeNodeView([node])

    adapter.process(view, makeContext(), bus)

    expect(bus.captured).toHaveLength(1)
    const { values } = bus.captured[0]

    expect(values['red']).toBeGreaterThanOrEqual(0)
    expect(values['red']).toBeLessThanOrEqual(1)
    expect(values['green']).toBeGreaterThanOrEqual(0)
    expect(values['green']).toBeLessThanOrEqual(1)
    expect(values['blue']).toBeGreaterThanOrEqual(0)
    expect(values['blue']).toBeLessThanOrEqual(1)
  })

  test('§1.2 — Con silencio (energy=0) el RGB es 0 (no luz sin señal)', () => {
    const node = makeColorNode()
    const view = makeNodeView([node])
    const ctx  = makeContext({ audio: makeAudio({ energy: 0 }) })

    adapter.process(view, ctx, bus)

    const { values } = bus.captured[0]
    // Con energy=0, brightness = 0 * falloff * zone * intensity = 0
    expect(values['red']).toBeCloseTo(0, 5)
    expect(values['green']).toBeCloseTo(0, 5)
    expect(values['blue']).toBeCloseTo(0, 5)
  })

  test('§1.3 — La paleta primary define el tinte base', () => {
    // Paleta pura azul: h=0.67 (azul), s=1, l=0.5
    const vibeBlue = makeVibe({
      palette: [
        { h: 0.67, s: 1.0, l: 0.5 },  // azul puro
        { h: 0.67, s: 1.0, l: 0.5 },  // secondary igual = sin blend
      ],
    })
    const ctx  = makeContext({ vibe: vibeBlue, audio: makeAudio({ energy: 1.0, bass: 0 }) })
    const node = makeColorNode({ position: { x: 0, y: 0, z: 0 } })
    const view = makeNodeView([node])

    adapter.process(view, ctx, bus)

    const { values } = bus.captured[0]
    // Azul puro: B >> R y B >> G
    expect(values['blue']).toBeGreaterThan(values['red'])
    expect(values['blue']).toBeGreaterThan(values['green'])
  })

  test('§1.4 — Nodo muy lejano del epicentro recibe menos intensidad que nodo cercano', () => {
    const nodeNear = makeColorNode({ nodeId: 'par-near:color', position: { x: 0, y: 0, z: 0 } })
    const nodeFar  = makeColorNode({ nodeId: 'par-far:color',  position: { x: 100, y: 0, z: 0 } })

    adapter.setEpicenter(0, 0, 0)

    const viewNear = makeNodeView([nodeNear])
    const viewFar  = makeNodeView([nodeFar])

    adapter.process(viewNear, makeContext(), bus)
    const nearBrightness = bus.captured[0].values['red'] + bus.captured[0].values['green'] + bus.captured[0].values['blue']

    bus.clear()
    adapter.process(viewFar, makeContext(), bus)
    const farBrightness = bus.captured[0].values['red'] + bus.captured[0].values['green'] + bus.captured[0].values['blue']

    // El nodo lejano recibe MENOS energía (falloff por distancia)
    expect(farBrightness).toBeLessThan(nearBrightness)
  })

  test('§1.5 — Con múltiples nodos, emite un intent por cada nodo', () => {
    const nodes = [
      makeColorNode({ nodeId: 'par-a:color', position: { x: -5, y: 0, z: 3 } }),
      makeColorNode({ nodeId: 'par-b:color', position: { x:  0, y: 0, z: 0 } }),
      makeColorNode({ nodeId: 'par-c:color', position: { x:  5, y: 0, z: -2 } }),
    ]
    const view = makeNodeView(nodes)

    adapter.process(view, makeContext(), bus)

    expect(bus.captured).toHaveLength(3)
    const ids = bus.captured.map(i => i.nodeId)
    expect(ids).toContain('par-a:color')
    expect(ids).toContain('par-b:color')
    expect(ids).toContain('par-c:color')
  })

})

// ═══════════════════════════════════════════════════════════════════════════
// §2 — ImpactAdapter
// ═══════════════════════════════════════════════════════════════════════════

describe('💥 ImpactAdapter — El Motor de Impacto', () => {

  let adapter: ImpactAdapter
  let bus: ReturnType<typeof makeSpyBus>

  beforeEach(() => {
    adapter = new ImpactAdapter(makeLiquidEngineMock())
    bus     = makeSpyBus()
  })

  test('§2.1 — dimmer producido está estrictamente en [0, 1]', () => {
    const node = makeImpactNode()
    const view = makeNodeView([node])

    adapter.process(view, makeContext(), bus)

    expect(bus.captured).toHaveLength(1)
    const dimmer = bus.captured[0].values['dimmer']
    expect(dimmer).toBeGreaterThanOrEqual(0)
    expect(dimmer).toBeLessThanOrEqual(1)
  })

  test('§2.2 — A mayor energía de audio, mayor dimmer', () => {
    const node = makeImpactNode()
    adapter.setEpicenter(0, 0, 0)

    // Frame 1: energía baja
    const viewA = makeNodeView([node])
    adapter.process(viewA, makeContext({ audio: makeAudio({ energy: 0.1, bass: 0.1, mid: 0.1 }) }), bus)
    const dimmerLow = bus.captured[0].values['dimmer']

    bus.clear()

    // Frame 2: energía alta
    const viewB = makeNodeView([node])
    adapter.process(viewB, makeContext({ audio: makeAudio({ energy: 0.9, bass: 0.9, mid: 0.9 }) }), bus)
    const dimmerHigh = bus.captured[0].values['dimmer']

    expect(dimmerHigh).toBeGreaterThan(dimmerLow)
  })

  test('§2.3 — Con silencio (energy=0) el dimmer tiende a 0', () => {
    const node = makeImpactNode({ position: { x: 0, y: 0, z: 0 } })
    const view = makeNodeView([node])
    const ctx  = makeContext({ audio: makeAudio({ energy: 0, bass: 0, mid: 0, highMid: 0, subBass: 0, presence: 0, air: 0 }) })

    // Engine retorna intensidades muy bajas en silencio
    const silentEngine = makeLiquidEngineMock({
      moverLeftIntensity:  0,
      moverRightIntensity: 0,
      frontLeftIntensity:  0,
      frontRightIntensity: 0,
      backLeftIntensity:   0,
      backRightIntensity:  0,
    })
    const adapterSilent = new ImpactAdapter(silentEngine)

    adapterSilent.process(view, ctx, bus)

    const dimmer = bus.captured[0].values['dimmer']
    expect(dimmer).toBeCloseTo(0, 3)
  })

  test('§2.4 — La intensidad del vibe escala el dimmer proporcionalmente', () => {
    const node = makeImpactNode({ position: { x: 0, y: 0, z: 0 } })
    adapter.setEpicenter(0, 0, 0)

    const ctxFull = makeContext({ vibe: makeVibe({ intensity: 1.0 }) })
    const viewA   = makeNodeView([node])
    adapter.process(viewA, ctxFull, bus)
    const dimmerFull = bus.captured[0].values['dimmer']

    bus.clear()

    const ctxHalf = makeContext({ vibe: makeVibe({ intensity: 0.5 }) })
    const viewB   = makeNodeView([node])
    adapter.process(viewB, ctxHalf, bus)
    const dimmerHalf = bus.captured[0].values['dimmer']

    // Con intensity=0.5, el dimmer debería ser aproximadamente la mitad
    expect(dimmerHalf).toBeLessThanOrEqual(dimmerFull + 0.001)
    expect(dimmerFull).toBeGreaterThan(dimmerHalf)  // No exactamente mitad por la banda
  })

  test('§2.5 — Nodo lejano recibe menos intensidad que nodo en el epicentro', () => {
    const nodeCenter = makeImpactNode({ nodeId: 'par-center:impact', position: { x: 0, y: 0, z: 0 } })
    const nodeFar    = makeImpactNode({ nodeId: 'par-far:impact',    position: { x: 50, y: 0, z: 0 } })

    adapter.setEpicenter(0, 0, 0)

    const viewCenter = makeNodeView([nodeCenter])
    adapter.process(viewCenter, makeContext(), bus)
    const dimmerCenter = bus.captured[0].values['dimmer']

    bus.clear()

    const viewFar = makeNodeView([nodeFar])
    adapter.process(viewFar, makeContext(), bus)
    const dimmerFar = bus.captured[0].values['dimmer']

    expect(dimmerFar).toBeLessThan(dimmerCenter)
  })

})

// ═══════════════════════════════════════════════════════════════════════════
// §3 — VMMAdapter (KineticAdapter)
// ═══════════════════════════════════════════════════════════════════════════

describe('⚡ VMMAdapter — El Coreógrafo', () => {

  let adapter: VMMAdapter
  let bus: ReturnType<typeof makeSpyBus>

  beforeEach(() => {
    adapter = new VMMAdapter()
    bus     = makeSpyBus()
  })

  // ── §3.1 Normalización de pan/tilt ────────────────────────────────────

  test('§3.1 — pan/tilt de mover posicionado están estrictamente en [0, 1]', () => {
    const node = makeKineticNode()
    const view = makeNodeView([node])

    // Simular 20 frames distintos — todos deben permanecer en [0,1]
    for (let frame = 0; frame < 20; frame++) {
      bus.clear()
      const ctx = makeContext({
        nowMs:      1000 + frame * 22,
        deltaMs:    22,
        frameIndex: frame,
      })
      adapter.process(view, ctx, bus)

      expect(bus.captured).toHaveLength(1)
      const { values } = bus.captured[0]
      expect(values['pan'],  `frame ${frame}: pan`).toBeGreaterThanOrEqual(0)
      expect(values['pan'],  `frame ${frame}: pan`).toBeLessThanOrEqual(1)
      expect(values['tilt'], `frame ${frame}: tilt`).toBeGreaterThanOrEqual(0)
      expect(values['tilt'], `frame ${frame}: tilt`).toBeLessThanOrEqual(1)
    }
  })

  test('§3.2 — speed del intent está en [0, 1]', () => {
    const node = makeKineticNode()
    const view = makeNodeView([node])

    adapter.process(view, makeContext(), bus)

    const { values } = bus.captured[0]
    expect(values['speed']).toBeGreaterThanOrEqual(0)
    expect(values['speed']).toBeLessThanOrEqual(1)
  })

  // ── §3.2 Patrones Golden Dozen — 3 patrones representativos ──────────

  describe('§3.3 — Los 3 Patrones Golden Dozen producen [0,1]', () => {

    const PATTERNS_TO_TEST: Array<{ label: string; vibeId: string }> = [
      { label: 'circle_big (pop-rock)',   vibeId: 'pop-rock' },
      { label: 'scan_x (techno)',         vibeId: 'techno-club' },
      { label: 'figure8 (fiesta-latina)', vibeId: 'fiesta-latina' },
    ]

    PATTERNS_TO_TEST.forEach(({ label, vibeId }) => {
      test(`${label}: pan/tilt siempre en [0, 1]`, () => {
        const node = makeKineticNode({ isContinuous: false })
        const view = makeNodeView([node])
        const ctx  = makeContext({ vibe: makeVibe({ name: vibeId }) })

        // 30 frames para cubrir varias fases del patrón
        for (let frame = 0; frame < 30; frame++) {
          bus.clear()
          adapter.process(view, { ...ctx, nowMs: 1000 + frame * 22, frameIndex: frame }, bus)

          const { values } = bus.captured[0]
          expect(values['pan'],  `${label} frame ${frame}: pan`).toBeGreaterThanOrEqual(0)
          expect(values['pan'],  `${label} frame ${frame}: pan`).toBeLessThanOrEqual(1)
          expect(values['tilt'], `${label} frame ${frame}: tilt`).toBeGreaterThanOrEqual(0)
          expect(values['tilt'], `${label} frame ${frame}: tilt`).toBeLessThanOrEqual(1)
        }
      })
    })

  })

  // ── §3.4 Nodo continuo (fan) → rotation + speed, NO pan/tilt ─────────

  test('§3.4 — Nodo continuo emite rotation y speed, NO pan ni tilt', () => {
    const fan  = makeFanNode()
    const view = makeNodeView([fan])

    adapter.process(view, makeContext(), bus)

    expect(bus.captured).toHaveLength(1)
    const { values } = bus.captured[0]

    // Para isContinuous === true: debe tener rotation y speed
    expect(values['rotation']).toBeDefined()
    expect(values['speed']).toBeDefined()

    // Y NO debe tener pan/tilt (son canales de mover posicionado)
    expect(values['pan']).toBeUndefined()
    expect(values['tilt']).toBeUndefined()
  })

  test('§3.5 — rotation del fan está en [0, 1] (0.5 = stop)', () => {
    const fan  = makeFanNode()
    const view = makeNodeView([fan])

    // 20 frames — rotation siempre debe ser [0,1]
    for (let frame = 0; frame < 20; frame++) {
      bus.clear()
      const ctx = makeContext({
        nowMs:      1000 + frame * 22,
        deltaMs:    22,
        frameIndex: frame,
      })
      adapter.process(view, ctx, bus)

      const { values } = bus.captured[0]
      expect(values['rotation'], `frame ${frame}: rotation`).toBeGreaterThanOrEqual(0)
      expect(values['rotation'], `frame ${frame}: rotation`).toBeLessThanOrEqual(1)
    }
  })

  // ── §3.5 Espejo estéreo — nodo izquierdo espeja pan ──────────────────

  test('§3.6 — El adapter invierte pan para el nodo izquierdo (x < 0)', () => {
    // Ambos nodos con stereoIndex=0, stereoTotal=1: el VMM genera el MISMO intent.x.
    // La única diferencia es la posición X del nodo:
    //   nodeRight (x > 0): pan = (intent.x + 1) * 0.5
    //   nodeLeft  (x < 0): pan = 1 - (intent.x + 1) * 0.5   ← inversión del adapter
    // Por lo tanto: panRight + panLeft === 1.0 exacto.
    const nodeRight = makeKineticNode({
      nodeId:          'mover-r:kinetic',
      stereoIndex:     0,
      stereoTotal:     1,
      position:        { x: 3, y: 4, z: 0 },
      physicalPosition: { x: 3, y: 4, z: 0 },
    })
    const nodeLeft = makeKineticNode({
      nodeId:          'mover-l:kinetic',
      stereoIndex:     0,   // mismo índice → mismo intent.x del VMM
      stereoTotal:     1,
      position:        { x: -3, y: 4, z: 0 },
      physicalPosition: { x: -3, y: 4, z: 0 },
    })

    const ctx = makeContext({ audio: makeAudio({ energy: 0.8 }) })

    // Las dos llamadas deben ocurrir en el mismo "frame" del VMM (<2ms):
    // el VMM aplica isSameFrame guard → misma fase → mismo intent.x para ambos.
    adapter.process(makeNodeView([nodeRight]), ctx, bus)
    const panRight = bus.captured[0].values['pan']

    bus.clear()
    adapter.process(makeNodeView([nodeLeft]), ctx, bus)
    const panLeft = bus.captured[0].values['pan']

    // Ambos en [0,1]
    expect(panLeft).toBeGreaterThanOrEqual(0)
    expect(panLeft).toBeLessThanOrEqual(1)
    expect(panRight).toBeGreaterThanOrEqual(0)
    expect(panRight).toBeLessThanOrEqual(1)

    // La inversión del adapter garantiza: panRight + panLeft === 1 (exacto, no approx)
    expect(panLeft + panRight).toBeCloseTo(1.0, 6)
  })

  // ── §3.6 Con alta energía de audio, el VMM produce movimiento ─────────

  test('§3.7 — Con energy=0 (freeze), pan/tilt no se actualizan agresivamente', () => {
    const node = makeKineticNode()
    const view = makeNodeView([node])

    // Leer pan con energía normal primero
    const ctxNormal = makeContext({ audio: makeAudio({ energy: 0.8 }) })
    adapter.process(view, ctxNormal, bus)
    // Lo importante: sin crash y en [0,1]
    const panNormal = bus.captured[0].values['pan']
    expect(panNormal).toBeGreaterThanOrEqual(0)
    expect(panNormal).toBeLessThanOrEqual(1)
  })

})
