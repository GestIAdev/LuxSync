/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  WAVE 4521.3 — LIQUID AETHER ADAPTER TESTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Suite de tests para LiquidAetherAdapter (Capa L0 del IntentBus).
 *
 * REGLAS DE ORO:
 * - NodeGraph mockeado — aislamiento total del motor real.
 * - LiquidStereoResult y ProcessedFrame inyectados como valores deterministas.
 * - Zero Math.random() — Axioma Anti-Simulación.
 * - Bus Spy captura todos los intents: se copia el snapshot en el push.
 * - Cada test verifica un contrato específico del adaptador.
 *
 * @module core/aether/__tests__/liquid-aether-adapter.test.ts
 * @version WAVE 4521.3
 */

import { describe, test, expect, beforeEach } from 'vitest'

import { LiquidAetherAdapter } from '../adapters/LiquidAetherAdapter'

import type { INodeGraph, INodeView } from '../node-graph'
import type { IIntentBus, INodeIntent } from '../intent-bus'
import type { IImpactNodeData, IColorNodeData } from '../capability-node'
import type { LiquidStereoResult } from '../../../hal/physics/LiquidStereoPhysics'
import type { ProcessedFrame } from '../../../hal/physics/LiquidEngineBase'
import { NodeFamily } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// FACTORIES — Mocks deterministas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * LiquidStereoResult con todas las 9 intensidades zonales en 0 por defecto.
 */
function makeStereoResult(overrides: Partial<LiquidStereoResult> = {}): LiquidStereoResult {
  return {
    frontLeftIntensity:  0,
    frontRightIntensity: 0,
    backLeftIntensity:   0,
    backRightIntensity:  0,
    moverLeftIntensity:  0,
    moverRightIntensity: 0,
    strobeActive:        false,
    strobeIntensity:     0,
    floorIntensity:      0,
    ambientIntensity:    0,
    airIntensity:        0,
    ...overrides,
  }
}

/**
 * ProcessedFrame mínimo para tests — campos no relevantes en 0.
 */
function makeFrame(overrides: Partial<ProcessedFrame> = {}): ProcessedFrame {
  const bands = {
    subBass: 0, bass: 0, lowMid: 0, mid: 0,
    highMid: 0, treble: 0, ultraAir: 0,
  }
  return {
    bands,
    morphFactor:       0,
    recoveryFactor:    1.0,
    isBreakdown:       false,
    isVetoed:          false,
    isKick:            false,
    isKickEdge:        false,
    acidMode:          false,
    noiseMode:         false,
    harshness:         0,
    flatness:          0,
    spectralCentroid:  0,
    rawTrebleDelta:    0,
    rawHighMidDelta:   0,
    rawMidDelta:       0,
    now:               1000,
    frontLeft:         0,
    frontRight:        0,
    backRight:         0,
    snareAttack:       0,
    backLeft:          0,
    moverLeft:         0,
    moverRight:        0,
    strobeActive:      false,
    strobeIntensity:   0,
    floorIntensity:    0,
    ambientIntensity:  0,
    airIntensity:      0,
    ...overrides,
  }
}

/**
 * Nodo IMPACT mínimo.
 */
function makeImpactNode(overrides: Partial<IImpactNodeData> = {}): IImpactNodeData {
  return {
    nodeId:   'par-001:impact',
    family:   NodeFamily.IMPACT,
    role:     'primary',
    deviceId: 'par-001',
    zoneId:   'frontLeft',
    channels: [{ type: 'dimmer', dmxOffset: 0, defaultValue: 0 }],
    constraints: { responseType: 'led', minChangeTimeMs: 0, maxValue: 255 },
    transferCurve: 'linear',
    bandMix: {
      subBass: 0, bass: 0.6, mid: 0.2,
      highMid: 0.1, presence: 0.1, air: 0, energy: 0,
    },
    envelopeState: { value: 0, targetValue: 0, decayRate: 0 },
    position: { x: -3, y: 0.5, z: 2 },
    ...overrides,
  } as unknown as IImpactNodeData
}

/**
 * Nodo IMPACT con canal shutter (strobe-capable).
 */
function makeStrobeCapableNode(overrides: Partial<IImpactNodeData> = {}): IImpactNodeData {
  return makeImpactNode({
    nodeId:   'strobe-001:impact',
    channels: [
      { type: 'dimmer',  dmxOffset: 0, defaultValue: 0 },
      { type: 'shutter', dmxOffset: 1, defaultValue: 0 },
    ],
    ...overrides,
  })
}

/**
 * Nodo COLOR mínimo.
 */
function makeColorNode(overrides: Partial<IColorNodeData> = {}): IColorNodeData {
  return {
    nodeId:   'led-001:color',
    family:   NodeFamily.COLOR,
    role:     'primary',
    deviceId: 'led-001',
    zoneId:   'ambient',
    channels: [
      { type: 'red',        dmxOffset: 0, defaultValue: 0 },
      { type: 'green',      dmxOffset: 1, defaultValue: 0 },
      { type: 'blue',       dmxOffset: 2, defaultValue: 0 },
      { type: 'brightness', dmxOffset: 3, defaultValue: 0 },
    ],
    constraints: { responseType: 'led', minChangeTimeMs: 0, maxValue: 255 },
    mixingType:    'rgb',
    currentColor:  { r: 0, g: 0, b: 0 },
    position:      { x: 0, y: 2, z: 0 },
    ...overrides,
  } as unknown as IColorNodeData
}

/**
 * Spy bus: captura todos los intents pusheados como snapshots inmutables.
 */
function makeSpyBus(): IIntentBus & { captured: INodeIntent[] } {
  const captured: INodeIntent[] = []
  return {
    captured,
    push(intent: INodeIntent): void {
      captured.push({
        nodeId:     intent.nodeId,
        values:     { ...intent.values },
        priority:   intent.priority,
        confidence: intent.confidence,
        source:     intent.source,
      })
    },
    clear():                                    void  { captured.length = 0 },
    buildIndex():                               void  { /* spy no-op */ },
    getIntentsForNode(_id: string):             readonly INodeIntent[] { return [] },
    forEach(fn: (i: INodeIntent) => void):      void  { captured.forEach(fn) },
    get size():                                 number  { return captured.length },
    get overflowed():                           boolean { return false },
  } as unknown as IIntentBus & { captured: INodeIntent[] }
}

/**
 * Construye un INodeView<T> a partir de un array de nodos (zero-overhead mock).
 */
function makeNodeView<T>(nodes: T[]): INodeView<T> {
  return {
    get count():                              number { return nodes.length },
    forEach(fn: (node: T, index: number) =>  void): void { nodes.forEach((n, i) => fn(n, i)) },
    get(i: number):                          T { return nodes[i] },
    byZone():                                T[] { return [...nodes] },
    byRole():                                T[] { return [...nodes] },
  }
}

/**
 * Construye un INodeGraph mock que retorna las views inyectadas por familia.
 */
function makeNodeGraph(views: {
  impact?: IImpactNodeData[]
  color?:  IColorNodeData[]
}): INodeGraph {
  const impactView = makeNodeView<IImpactNodeData>(views.impact ?? [])
  const colorView  = makeNodeView<IColorNodeData>(views.color ?? [])
  const emptyView  = makeNodeView<never>([])

  return {
    getView(family: NodeFamily): INodeView<unknown> {
      if (family === NodeFamily.IMPACT) return impactView as INodeView<unknown>
      if (family === NodeFamily.COLOR)  return colorView  as INodeView<unknown>
      return emptyView as INodeView<unknown>
    },
    registerDevice()   { return [] },
    unregisterDevice() { /* no-op */ },
    getNodeData()      { return undefined },
    get size()         { return (views.impact?.length ?? 0) + (views.color?.length ?? 0) },
  } as unknown as INodeGraph
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('🌊 LiquidAetherAdapter — Capa L0 del IntentBus', () => {

  // ─────────────────────────────────────────────────────────────────────
  // §1 — Zone Routing: canal dimmer correctamente mapeado por zoneId
  // ─────────────────────────────────────────────────────────────────────

  describe('§1 — Zone Routing (IMPACT nodes)', () => {

    test('§1.1 — Nodo "floor" recibe floorIntensity en canal dimmer con priority=0', () => {
      const floorNode  = makeImpactNode({ nodeId: 'par-floor:impact', zoneId: 'floor',     position: { x: 0, y: 0, z: 0 } })
      const frontNode  = makeImpactNode({ nodeId: 'par-front:impact', zoneId: 'frontLeft', position: { x: 0, y: 0, z: 0 } })
      const graph = makeNodeGraph({ impact: [floorNode, frontNode] })
      const bus   = makeSpyBus()

      const result = makeStereoResult({
        floorIntensity:     0.8,
        frontLeftIntensity: 0.5,
      })

      const adapter = new LiquidAetherAdapter(graph)
      adapter.ingest(makeFrame(), result, bus)

      // Dos nodos IMPACT → dos intents dimmer
      const impactIntents = bus.captured.filter(i => 'dimmer' in i.values)
      expect(impactIntents).toHaveLength(2)

      const floorIntent = bus.captured.find(i => i.nodeId === 'par-floor:impact')
      const frontIntent = bus.captured.find(i => i.nodeId === 'par-front:impact')

      expect(floorIntent).toBeDefined()
      expect(frontIntent).toBeDefined()

      // Valores exactos (sin posición → falloff=1.0, sin epicentro custom)
      expect(floorIntent!.values['dimmer']).toBeCloseTo(0.8, 5)
      expect(frontIntent!.values['dimmer']).toBeCloseTo(0.5, 5)

      // Todos los intents son L0
      expect(floorIntent!.priority).toBe(0)
      expect(frontIntent!.priority).toBe(0)
    })

    test('§1.2 — Todos los zoneIds del LiquidStereoResult se enrutan correctamente', () => {
      const zones = [
        { zoneId: 'frontLeft',   field: 'frontLeftIntensity',   value: 0.1 },
        { zoneId: 'frontRight',  field: 'frontRightIntensity',  value: 0.2 },
        { zoneId: 'backLeft',    field: 'backLeftIntensity',    value: 0.3 },
        { zoneId: 'backRight',   field: 'backRightIntensity',   value: 0.4 },
        { zoneId: 'moverLeft',   field: 'moverLeftIntensity',   value: 0.5 },
        { zoneId: 'moverRight',  field: 'moverRightIntensity',  value: 0.6 },
        { zoneId: 'floor',       field: 'floorIntensity',       value: 0.7 },
        { zoneId: 'ambient',     field: 'ambientIntensity',     value: 0.8 },
        { zoneId: 'air',         field: 'airIntensity',         value: 0.9 },
      ] as const

      for (const { zoneId, field, value } of zones) {
        const node    = makeImpactNode({ nodeId: `node-${zoneId}:impact`, zoneId, position: undefined })
        const graph   = makeNodeGraph({ impact: [node] })
        const bus     = makeSpyBus()
        const result  = makeStereoResult({ [field]: value } as Partial<LiquidStereoResult>)

        new LiquidAetherAdapter(graph).ingest(makeFrame(), result, bus)

        const intent = bus.captured[0]
        expect(intent.values['dimmer']).toBeCloseTo(value, 5)
      }
    })

    test('§1.3 — Dimmer está clampeado a [0, 1] incluso si la zona tiene valor extremo', () => {
      const node  = makeImpactNode({ zoneId: 'floor' })
      const graph = makeNodeGraph({ impact: [node] })
      const bus   = makeSpyBus()
      // Valor imposible (> 1) — el adapter debe clampear
      const result = makeStereoResult({ floorIntensity: 1.5 })

      new LiquidAetherAdapter(graph).ingest(makeFrame(), result, bus)

      expect(bus.captured[0].values['dimmer']).toBeLessThanOrEqual(1)
      expect(bus.captured[0].values['dimmer']).toBeGreaterThanOrEqual(0)
    })

    test('§1.4 — Falloff por distancia reduce la intensidad para nodos lejanos', () => {
      // Nodo a 24m del epicentro (maxRadiusM=12 por defecto → falloff=0)
      const farNode  = makeImpactNode({
        nodeId:   'par-far:impact',
        zoneId:   'floor',
        position: { x: 0, y: 0, z: 24 },
      })
      // Nodo en el epicentro → falloff=1
      const nearNode = makeImpactNode({
        nodeId:   'par-near:impact',
        zoneId:   'floor',
        position: { x: 0, y: 0, z: 0 },
      })

      const graph  = makeNodeGraph({ impact: [farNode, nearNode] })
      const bus    = makeSpyBus()
      const result = makeStereoResult({ floorIntensity: 1.0 })

      new LiquidAetherAdapter(graph).ingest(makeFrame(), result, bus)

      const farIntent  = bus.captured.find(i => i.nodeId === 'par-far:impact')!
      const nearIntent = bus.captured.find(i => i.nodeId === 'par-near:impact')!

      expect(farIntent.values['dimmer']).toBe(0)
      expect(nearIntent.values['dimmer']).toBeCloseTo(1.0, 5)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // §2 — Strobe Filtering
  // ─────────────────────────────────────────────────────────────────────

  describe('§2 — Strobe Filtering (shutter channel gate)', () => {

    test('§2.1 — Solo el nodo con canal shutter recibe el intent de strobe', () => {
      const noStrobeNode    = makeImpactNode({ nodeId: 'par-no-strobe:impact' })
      const strobeCapNode   = makeStrobeCapableNode({ nodeId: 'strobe-001:impact' })

      const graph  = makeNodeGraph({ impact: [noStrobeNode, strobeCapNode] })
      const bus    = makeSpyBus()
      const result = makeStereoResult({ strobeActive: true, strobeIntensity: 0.9 })

      new LiquidAetherAdapter(graph).ingest(makeFrame({ strobeActive: true }), result, bus)

      // Debe haber exactamente UN intent de shutter (del nodo strobe-capable)
      const shutterIntents = bus.captured.filter(i => 'shutter' in i.values)
      expect(shutterIntents).toHaveLength(1)
      expect(shutterIntents[0].nodeId).toBe('strobe-001:impact')
    })

    test('§2.2 — El intent de strobe tiene shutter=1.0 y strobeRate igual a result.strobeIntensity', () => {
      const strobeCapNode  = makeStrobeCapableNode()
      const graph  = makeNodeGraph({ impact: [strobeCapNode] })
      const bus    = makeSpyBus()
      const result = makeStereoResult({ strobeActive: true, strobeIntensity: 0.9 })

      new LiquidAetherAdapter(graph).ingest(makeFrame(), result, bus)

      const strobeIntent = bus.captured.find(i => 'shutter' in i.values)
      expect(strobeIntent).toBeDefined()
      expect(strobeIntent!.values['shutter']).toBe(1.0)
      expect(strobeIntent!.values['strobeRate']).toBeCloseTo(0.9, 5)
      expect(strobeIntent!.priority).toBe(0)
    })

    test('§2.3 — Con strobeActive=false, no se emite ningún intent de shutter', () => {
      const strobeCapNode = makeStrobeCapableNode()
      const graph  = makeNodeGraph({ impact: [strobeCapNode] })
      const bus    = makeSpyBus()
      const result = makeStereoResult({ strobeActive: false, strobeIntensity: 0.9 })

      new LiquidAetherAdapter(graph).ingest(makeFrame(), result, bus)

      const shutterIntents = bus.captured.filter(i => 'shutter' in i.values)
      expect(shutterIntents).toHaveLength(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // §3 — Color Mood Intensity
  // ─────────────────────────────────────────────────────────────────────

  describe('§3 — Color Mood Intensity (brightness only)', () => {

    test('§3.1 — Nodo COLOR recibe brightness derivado de morphFactor×recoveryFactor×zoneIntensity', () => {
      const colorNode = makeColorNode({ zoneId: 'ambient', position: { x: 0, y: 0, z: 0 } })
      const graph     = makeNodeGraph({ color: [colorNode] })
      const bus       = makeSpyBus()
      const result    = makeStereoResult({ ambientIntensity: 0.8 })
      const frame     = makeFrame({ morphFactor: 0.5, recoveryFactor: 1.0 })

      new LiquidAetherAdapter(graph).ingest(frame, result, bus)

      const colorIntents = bus.captured.filter(i => 'brightness' in i.values)
      expect(colorIntents).toHaveLength(1)

      // mood = clamp01(0.5 × 1.0) = 0.5, zone = 0.8, falloff = 1.0 (sin pos → 1.0)
      // brightness = clamp01(0.5 × 0.8 × 1.0) = 0.4
      expect(colorIntents[0].values['brightness']).toBeCloseTo(0.4, 5)
      expect(colorIntents[0].priority).toBe(0)
    })

    test('§3.2 — El intent de COLOR NO contiene claves r, g, ni b', () => {
      const colorNode = makeColorNode({ zoneId: 'ambient' })
      const graph     = makeNodeGraph({ color: [colorNode] })
      const bus       = makeSpyBus()
      const result    = makeStereoResult({ ambientIntensity: 0.8 })
      const frame     = makeFrame({ morphFactor: 0.5, recoveryFactor: 1.0 })

      new LiquidAetherAdapter(graph).ingest(frame, result, bus)

      const colorIntent = bus.captured.find(i => 'brightness' in i.values)
      expect(colorIntent).toBeDefined()
      expect(colorIntent!.values['r']).toBeUndefined()
      expect(colorIntent!.values['g']).toBeUndefined()
      expect(colorIntent!.values['b']).toBeUndefined()
    })

    test('§3.3 — Con morphFactor=0, brightness es exactamente 0 (no luz sin mood)', () => {
      const colorNode = makeColorNode({ zoneId: 'ambient' })
      const graph     = makeNodeGraph({ color: [colorNode] })
      const bus       = makeSpyBus()
      const result    = makeStereoResult({ ambientIntensity: 1.0 })
      const frame     = makeFrame({ morphFactor: 0, recoveryFactor: 1.0 })

      new LiquidAetherAdapter(graph).ingest(frame, result, bus)

      const colorIntent = bus.captured.find(i => 'brightness' in i.values)
      expect(colorIntent!.values['brightness']).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // §4 — Zero-Alloc Stale Cleanup
  // ─────────────────────────────────────────────────────────────────────

  describe('§4 — Zero-Alloc Stale Cleanup (anti-ghost strobe)', () => {

    test('§4.1 — Un frame con strobeActive=true seguido de uno con strobeActive=false no emite shutter en el segundo frame', () => {
      const strobeCapNode = makeStrobeCapableNode()
      const graph   = makeNodeGraph({ impact: [strobeCapNode] })
      const bus     = makeSpyBus()

      const resultStrobe   = makeStereoResult({ strobeActive: true,  strobeIntensity: 0.9 })
      const resultNoStrobe = makeStereoResult({ strobeActive: false, strobeIntensity: 0.0 })

      const adapter = new LiquidAetherAdapter(graph)

      // Frame 1: strobe activo
      adapter.ingest(makeFrame(), resultStrobe, bus)
      const shutterCountFrame1 = bus.captured.filter(i => 'shutter' in i.values).length
      expect(shutterCountFrame1).toBe(1)

      // Frame 2: strobe inactivo
      bus.clear()
      adapter.ingest(makeFrame({ now: 2000 }), resultNoStrobe, bus)
      const shutterCountFrame2 = bus.captured.filter(i => 'shutter' in i.values).length
      expect(shutterCountFrame2).toBe(0)
    })

    test('§4.2 — El bus no recibe valores stale de dimmer de un frame anterior', () => {
      const node1  = makeImpactNode({ nodeId: 'par-A:impact', zoneId: 'floor', position: { x: 0, y: 0, z: 0 } })
      const graph  = makeNodeGraph({ impact: [node1] })
      const bus1   = makeSpyBus()
      const bus2   = makeSpyBus()

      const adapter = new LiquidAetherAdapter(graph)

      // Frame 1: floor = 0.9
      adapter.ingest(makeFrame(), makeStereoResult({ floorIntensity: 0.9 }), bus1)

      // Frame 2: floor = 0.1 (valores diferentes)
      adapter.ingest(makeFrame({ now: 2000 }), makeStereoResult({ floorIntensity: 0.1 }), bus2)

      expect(bus1.captured[0].values['dimmer']).toBeCloseTo(0.9, 5)
      expect(bus2.captured[0].values['dimmer']).toBeCloseTo(0.1, 5)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // §5 — Invariantes de Diseño
  // ─────────────────────────────────────────────────────────────────────

  describe('§5 — Invariantes de Diseño', () => {

    test('§5.1 — Con NodeGraph vacío no se emite ningún intent al bus', () => {
      const graph  = makeNodeGraph({})
      const bus    = makeSpyBus()
      const result = makeStereoResult({ floorIntensity: 1.0, strobeActive: true })

      new LiquidAetherAdapter(graph).ingest(makeFrame(), result, bus)

      expect(bus.captured).toHaveLength(0)
    })

    test('§5.2 — setEpicenter modifica el falloff para el siguiente frame', () => {
      const node = makeImpactNode({
        nodeId:   'par-near:impact',
        zoneId:   'floor',
        position: { x: 6, y: 0, z: 0 },  // a 6m del origen
      })
      const graph  = makeNodeGraph({ impact: [node] })
      const bus    = makeSpyBus()
      const result = makeStereoResult({ floorIntensity: 1.0 })

      const adapter = new LiquidAetherAdapter(graph)

      // Con epicentro en 0,0,0: falloff = 1 - 6/12 = 0.5
      adapter.ingest(makeFrame(), result, bus)
      const dimmerDefault = bus.captured[0].values['dimmer']
      expect(dimmerDefault).toBeCloseTo(0.5, 5)

      // Movemos epicentro al nodo → distancia = 0 → falloff = 1.0
      bus.clear()
      adapter.setEpicenter(6, 0, 0)
      adapter.ingest(makeFrame(), result, bus)
      const dimmerAfterMove = bus.captured[0].values['dimmer']
      expect(dimmerAfterMove).toBeCloseTo(1.0, 5)
    })

    test('§5.3 — Todos los intents emitidos tienen priority === 0 (L0 inmutable)', () => {
      const imNode   = makeImpactNode({ zoneId: 'frontLeft' })
      const strobeN  = makeStrobeCapableNode({ zoneId: 'frontRight' })
      const colNode  = makeColorNode({ zoneId: 'ambient' })

      const graph  = makeNodeGraph({ impact: [imNode, strobeN], color: [colNode] })
      const bus    = makeSpyBus()
      const result = makeStereoResult({
        frontLeftIntensity:  0.7,
        frontRightIntensity: 0.6,
        ambientIntensity:    0.5,
        strobeActive:        true,
        strobeIntensity:     0.8,
      })

      new LiquidAetherAdapter(graph).ingest(
        makeFrame({ morphFactor: 0.5, recoveryFactor: 1.0 }),
        result,
        bus,
      )

      for (const intent of bus.captured) {
        expect(intent.priority).toBe(0)
      }
    })
  })
})
