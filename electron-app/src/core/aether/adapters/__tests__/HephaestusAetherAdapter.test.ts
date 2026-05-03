// WAVE 3522: THE FORGE TESTS — HephaestusAetherAdapter
// Suite de pruebas unitarias para el bridge L3+ entre HephaestusRuntime
// y el NodeArbiter. Mocks totales para NodeGraph y NodeArbiter (zero deps).
//
// CASOS:
//   P9  — Emisión correcta para isCustomClip === true (intensity + color)
//   P10 — Ignorar overlays isCustomClip === false
//   P11 — Ignorar fixtures sin nodos registrados en NodeGraph
//   P12 — Limpieza de capa L3+ via clear() e ingest([])

import { describe, test, expect, beforeEach, vi } from 'vitest'

import { HephaestusAetherAdapter } from '../HephaestusAetherAdapter'

import { NodeFamily } from '../../types'
import type { NodeId, DeviceId } from '../../types'
import type { INodeGraph } from '../../node-graph'
import type { INodeArbiter, INodeIntent } from '../../intent-bus'
import type { AnyNodeData } from '../../capability-node'
import type { HephFixtureOutput } from '../../../hephaestus/runtime/HephaestusRuntime'

// ═══════════════════════════════════════════════════════════════════════════
// FACTORIES — datos deterministas, zero Math.random()
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea un HephFixtureOutput mínimo y determinista.
 * Solo los campos que el adaptador consume.
 */
function makeOutput(overrides: Partial<HephFixtureOutput> = {}): HephFixtureOutput {
  return {
    fixtureId:       'fixture-001',
    zone:            'all',
    parameter:       'intensity',
    value:           204,               // DMX legacy (0-255)
    rgb:             undefined,
    fine:            undefined,
    source:          'hephaestus-runtime',
    normalizedValue: 0.8,
    normalizedRgb:   undefined,
    isCustomClip:    true,
    ...overrides,
  }
}

/**
 * Crea un AnyNodeData mínimo con la familia solicitada.
 */
function makeNodeData(nodeId: NodeId, family: NodeFamily): AnyNodeData {
  return {
    nodeId,
    family,
    role:     'primary',
    deviceId: 'fixture-001' as DeviceId,
    zoneId:   'all',
    channels: [],
    constraints: { responseType: 'led', minChangeTimeMs: 0, maxValue: 255 },
  } as unknown as AnyNodeData
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construye un mock de INodeGraph donde:
 * - getDeviceNodes(fixtureId) → nodeIds inyectados
 * - getNodeData(nodeId) → AnyNodeData inyectado
 *
 * El mock es determinista: los nodeIds y data son controlados desde el test.
 */
function makeGraphMock(
  nodesForDevice: Record<string, readonly NodeId[]>,
  nodeDataMap: Record<string, AnyNodeData>,
): INodeGraph {
  return {
    getDeviceNodes(deviceId: DeviceId): readonly NodeId[] {
      return nodesForDevice[deviceId as string] ?? []
    },
    getNodeData(nodeId: NodeId): AnyNodeData | undefined {
      return nodeDataMap[nodeId as string]
    },
    registerDevice:   () => [],
    unregisterDevice: () => undefined,
    getDevice:        () => undefined,
    getView:          () => ({ count: 0, forEach: () => {}, get: () => undefined, byZone: () => [], byRole: () => [] }),
    getNodesByFamily: () => [],
    getNodesByRole:   () => [],
    hasNode:          () => false,
    get size()        { return Object.keys(nodeDataMap).length },
  } as unknown as INodeGraph
}

/**
 * Construye un mock spy de INodeArbiter.
 * Captura los arrays pasados a setHephaestusIntents() como snapshots inmutables.
 */
function makeArbiterSpy(): INodeArbiter & { capturedHeph: INodeIntent[][] } {
  const capturedHeph: INodeIntent[][] = []
  return {
    capturedHeph,
    setHephaestusIntents(intents: readonly INodeIntent[]): void {
      // Snapshot: copia profunda del array + values de cada intent
      capturedHeph.push(
        intents.map(i => ({
          nodeId:     i.nodeId,
          values:     { ...i.values },
          priority:   i.priority,
          confidence: i.confidence,
          source:     i.source,
        })),
      )
    },
    // Resto del INodeArbiter — no relevantes para estos tests
    setSystemIntents:    () => undefined,
    setSeleneOverrides:  () => undefined,
    setManualOverride:   () => undefined,
    clearManualOverride: () => undefined,
    setEffectIntents:    () => undefined,
    setPlaybackIntents:  () => undefined,
    setBlackout:         () => undefined,
    arbitrate:           () => new Map() as any,
  } as unknown as INodeArbiter & { capturedHeph: INodeIntent[][] }
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('HephaestusAetherAdapter — Forge Tests (WAVE 3522)', () => {

  // ─────────────────────────────────────────────────────────────────────
  // P9 — Emisión correcta para isCustomClip === true
  // ─────────────────────────────────────────────────────────────────────

  describe('P9 — Emisión correcta (heph_custom clips)', () => {

    test('P9.1 — intensity emite intent IMPACT con dimmer normalizado', () => {
      const nodeId = 'fixture-001:impact' as NodeId
      const graph  = makeGraphMock(
        { 'fixture-001': [nodeId] },
        { [nodeId]: makeNodeData(nodeId, NodeFamily.IMPACT) },
      )
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      const outputs: HephFixtureOutput[] = [
        makeOutput({ parameter: 'intensity', normalizedValue: 0.75, isCustomClip: true }),
      ]

      adapter.ingest(outputs, arbiter)

      expect(arbiter.capturedHeph).toHaveLength(1)
      const intents = arbiter.capturedHeph[0]
      expect(intents).toHaveLength(1)

      const intent = intents[0]
      expect(intent.nodeId).toBe(nodeId)
      expect(intent.values.dimmer).toBeCloseTo(0.75)
      expect(intent.priority).toBe(350)
      expect(intent.source).toBe('hephaestus')
      expect(intent.confidence).toBe(1.0)
    })

    test('P9.2 — color emite intent COLOR con r, g, b normalizados', () => {
      const nodeId = 'fixture-001:color' as NodeId
      const graph  = makeGraphMock(
        { 'fixture-001': [nodeId] },
        { [nodeId]: makeNodeData(nodeId, NodeFamily.COLOR) },
      )
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      const outputs: HephFixtureOutput[] = [
        makeOutput({
          parameter:     'color',
          normalizedRgb: { r: 1.0, g: 0.5, b: 0.25 },
          value:         0,
          isCustomClip:  true,
        }),
      ]

      adapter.ingest(outputs, arbiter)

      expect(arbiter.capturedHeph).toHaveLength(1)
      const intent = arbiter.capturedHeph[0][0]
      expect(intent.nodeId).toBe(nodeId)
      expect(intent.values.red).toBeCloseTo(1.0)
      expect(intent.values.green).toBeCloseTo(0.5)
      expect(intent.values.blue).toBeCloseTo(0.25)
      expect(intent.priority).toBe(350)
      expect(intent.source).toBe('hephaestus')
    })

    test('P9.3 — intensity + color en mismo fixture emiten dos intents separados', () => {
      const impactNodeId = 'fixture-001:impact' as NodeId
      const colorNodeId  = 'fixture-001:color'  as NodeId
      const graph = makeGraphMock(
        { 'fixture-001': [impactNodeId, colorNodeId] },
        {
          [impactNodeId]: makeNodeData(impactNodeId, NodeFamily.IMPACT),
          [colorNodeId]:  makeNodeData(colorNodeId,  NodeFamily.COLOR),
        },
      )
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      const outputs: HephFixtureOutput[] = [
        makeOutput({ parameter: 'intensity', normalizedValue: 0.9, isCustomClip: true }),
        makeOutput({
          parameter:     'color',
          normalizedRgb: { r: 0.6, g: 0.3, b: 0.1 },
          value:         0,
          isCustomClip:  true,
        }),
      ]

      adapter.ingest(outputs, arbiter)

      const intents = arbiter.capturedHeph[0]
      expect(intents).toHaveLength(2)

      const impact = intents.find(i => i.nodeId === impactNodeId)
      const color  = intents.find(i => i.nodeId === colorNodeId)
      expect(impact).toBeDefined()
      expect(color).toBeDefined()
      expect(impact!.values.dimmer).toBeCloseTo(0.9)
      expect(color!.values.red).toBeCloseTo(0.6)
      expect(color!.values.green).toBeCloseTo(0.3)
      expect(color!.values.blue).toBeCloseTo(0.1)
    })

    test('P9.4 — strobe emite intent IMPACT con canal strobe', () => {
      const nodeId = 'fixture-001:impact' as NodeId
      const graph  = makeGraphMock(
        { 'fixture-001': [nodeId] },
        { [nodeId]: makeNodeData(nodeId, NodeFamily.IMPACT) },
      )
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      adapter.ingest(
        [makeOutput({ parameter: 'strobe', normalizedValue: 0.5, isCustomClip: true })],
        arbiter,
      )

      const intent = arbiter.capturedHeph[0][0]
      expect(intent.values.strobe).toBeCloseTo(0.5)
      expect(intent.values.dimmer).toBeUndefined()
    })

    test('P9.5 — pan emite intent KINETIC con canal pan', () => {
      const nodeId = 'fixture-001:kinetic' as NodeId
      const graph  = makeGraphMock(
        { 'fixture-001': [nodeId] },
        { [nodeId]: makeNodeData(nodeId, NodeFamily.KINETIC) },
      )
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      adapter.ingest(
        [makeOutput({ parameter: 'pan', normalizedValue: 0.3, isCustomClip: true })],
        arbiter,
      )

      const intent = arbiter.capturedHeph[0][0]
      expect(intent.values.pan).toBeCloseTo(0.3)
    })

    test('P9.6 — zoom emite intent BEAM con canal zoom', () => {
      const nodeId = 'fixture-001:beam' as NodeId
      const graph  = makeGraphMock(
        { 'fixture-001': [nodeId] },
        { [nodeId]: makeNodeData(nodeId, NodeFamily.BEAM) },
      )
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      adapter.ingest(
        [makeOutput({ parameter: 'zoom', normalizedValue: 0.45, isCustomClip: true })],
        arbiter,
      )

      const intent = arbiter.capturedHeph[0][0]
      expect(intent.values.zoom).toBeCloseTo(0.45)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // P10 — Ignorar overlays isCustomClip === false
  // ─────────────────────────────────────────────────────────────────────

  describe('P10 — Ignorar outputs isCustomClip === false (overlays)', () => {

    test('P10.1 — output con isCustomClip=false NO emite ningun intent', () => {
      const nodeId = 'fixture-001:impact' as NodeId
      const graph  = makeGraphMock(
        { 'fixture-001': [nodeId] },
        { [nodeId]: makeNodeData(nodeId, NodeFamily.IMPACT) },
      )
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      adapter.ingest(
        [makeOutput({ isCustomClip: false, normalizedValue: 0.9 })],
        arbiter,
      )

      // setHephaestusIntents debe haberse llamado con array vacio
      expect(arbiter.capturedHeph).toHaveLength(1)
      expect(arbiter.capturedHeph[0]).toHaveLength(0)
    })

    test('P10.2 — mezcla custom y overlay: solo custom genera intent', () => {
      const impactNodeId = 'fixture-001:impact' as NodeId
      const graph = makeGraphMock(
        { 'fixture-001': [impactNodeId] },
        { [impactNodeId]: makeNodeData(impactNodeId, NodeFamily.IMPACT) },
      )
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      const outputs: HephFixtureOutput[] = [
        makeOutput({ parameter: 'intensity', normalizedValue: 0.6, isCustomClip: false }),
        makeOutput({ parameter: 'intensity', normalizedValue: 0.8, isCustomClip: true  }),
      ]

      adapter.ingest(outputs, arbiter)

      const intents = arbiter.capturedHeph[0]
      // Solo el custom pasa — un unico intent
      expect(intents).toHaveLength(1)
      expect(intents[0].values.dimmer).toBeCloseTo(0.8)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // P11 — Ignorar fixtures no registrados en NodeGraph
  // ─────────────────────────────────────────────────────────────────────

  describe('P11 — Ignorar fixtures sin nodos en NodeGraph', () => {

    test('P11.1 — getDeviceNodes retorna [] → no emite intent ni lanza error', () => {
      // Graph vacio: ninguna fixture registrada
      const graph = makeGraphMock({}, {})
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      expect(() => {
        adapter.ingest(
          [makeOutput({ fixtureId: 'ghost-fixture', isCustomClip: true })],
          arbiter,
        )
      }).not.toThrow()

      expect(arbiter.capturedHeph).toHaveLength(1)
      expect(arbiter.capturedHeph[0]).toHaveLength(0)
    })

    test('P11.2 — fixture no registrada coexiste con registrada — solo la registrada emite', () => {
      const nodeId = 'fixture-001:impact' as NodeId
      const graph  = makeGraphMock(
        { 'fixture-001': [nodeId] },
        { [nodeId]: makeNodeData(nodeId, NodeFamily.IMPACT) },
      )
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      const outputs: HephFixtureOutput[] = [
        makeOutput({ fixtureId: 'fixture-001', parameter: 'intensity', normalizedValue: 0.7, isCustomClip: true }),
        makeOutput({ fixtureId: 'ghost-fixture', parameter: 'intensity', normalizedValue: 0.9, isCustomClip: true }),
      ]

      adapter.ingest(outputs, arbiter)

      const intents = arbiter.capturedHeph[0]
      expect(intents).toHaveLength(1)
      expect(intents[0].nodeId).toBe(nodeId)
      expect(intents[0].values.dimmer).toBeCloseTo(0.7)
    })

    test('P11.3 — params engine-internos (globalComp, width, direction) → no emiten intent', () => {
      const nodeId = 'fixture-001:impact' as NodeId
      const graph  = makeGraphMock(
        { 'fixture-001': [nodeId] },
        { [nodeId]: makeNodeData(nodeId, NodeFamily.IMPACT) },
      )
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      const outputs: HephFixtureOutput[] = [
        makeOutput({ parameter: 'globalComp', normalizedValue: 0.8, isCustomClip: true }),
        makeOutput({ parameter: 'width',      normalizedValue: 0.6, isCustomClip: true }),
        makeOutput({ parameter: 'direction',  normalizedValue: 0.4, isCustomClip: true }),
      ]

      adapter.ingest(outputs, arbiter)

      expect(arbiter.capturedHeph[0]).toHaveLength(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // P12 — Limpieza de capa L3+
  // ─────────────────────────────────────────────────────────────────────

  describe('P12 — Limpieza de la capa L3+ (stop/expire)', () => {

    test('P12.1 — clear() inyecta array vacio en setHephaestusIntents', () => {
      const graph   = makeGraphMock({}, {})
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      adapter.clear(arbiter)

      expect(arbiter.capturedHeph).toHaveLength(1)
      expect(arbiter.capturedHeph[0]).toHaveLength(0)
    })

    test('P12.2 — ingest([]) invoca clear() internamente — array vacio en arbiter', () => {
      const graph   = makeGraphMock({}, {})
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      adapter.ingest([], arbiter)

      expect(arbiter.capturedHeph).toHaveLength(1)
      expect(arbiter.capturedHeph[0]).toHaveLength(0)
    })

    test('P12.3 — ingest → clear → ingest: el estado no persiste entre llamadas', () => {
      const nodeId = 'fixture-001:impact' as NodeId
      const graph  = makeGraphMock(
        { 'fixture-001': [nodeId] },
        { [nodeId]: makeNodeData(nodeId, NodeFamily.IMPACT) },
      )
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      // Frame 1: un intent emitido
      adapter.ingest(
        [makeOutput({ parameter: 'intensity', normalizedValue: 0.9, isCustomClip: true })],
        arbiter,
      )
      expect(arbiter.capturedHeph[0]).toHaveLength(1)

      // Frame 2: clear → el arbiter recibe array vacio
      adapter.clear(arbiter)
      expect(arbiter.capturedHeph[1]).toHaveLength(0)

      // Frame 3: nuevo ingest con valor diferente — el pool reutiliza intents
      adapter.ingest(
        [makeOutput({ parameter: 'intensity', normalizedValue: 0.2, isCustomClip: true })],
        arbiter,
      )
      expect(arbiter.capturedHeph[2]).toHaveLength(1)
      expect(arbiter.capturedHeph[2][0].values.dimmer).toBeCloseTo(0.2)
    })

    test('P12.4 — clear() es idempotente (llamadas multiples no lanzan)', () => {
      const graph   = makeGraphMock({}, {})
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      expect(() => {
        adapter.clear(arbiter)
        adapter.clear(arbiter)
        adapter.clear(arbiter)
      }).not.toThrow()

      // Tres llamadas → tres arrays vacios
      expect(arbiter.capturedHeph).toHaveLength(3)
      for (const call of arbiter.capturedHeph) {
        expect(call).toHaveLength(0)
      }
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // Propiedades del pool zero-alloc (comportamiento de la pool)
  // ─────────────────────────────────────────────────────────────────────

  describe('Pool zero-alloc — comportamiento de reutilizacion', () => {

    test('Los intents del pool reciclan valores entre frames sin mezclarlos', () => {
      const nodeId = 'fixture-001:impact' as NodeId
      const graph  = makeGraphMock(
        { 'fixture-001': [nodeId] },
        { [nodeId]: makeNodeData(nodeId, NodeFamily.IMPACT) },
      )
      const arbiter = makeArbiterSpy()
      const adapter = new HephaestusAetherAdapter(graph)

      // Frame A: dimmer = 0.4
      adapter.ingest(
        [makeOutput({ parameter: 'intensity', normalizedValue: 0.4, isCustomClip: true })],
        arbiter,
      )

      // Frame B: dimmer = 0.9 — pool reutiliza el mismo objeto pero los valores son correctos
      adapter.ingest(
        [makeOutput({ parameter: 'intensity', normalizedValue: 0.9, isCustomClip: true })],
        arbiter,
      )

      // El snapshot del frame A no debe verse afectado por el frame B
      expect(arbiter.capturedHeph[0][0].values.dimmer).toBeCloseTo(0.4)
      expect(arbiter.capturedHeph[1][0].values.dimmer).toBeCloseTo(0.9)
    })
  })
})
