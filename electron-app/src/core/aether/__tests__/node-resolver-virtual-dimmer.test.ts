/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊  WAVE 8269 — VIRTUAL DIMMER & FORGE GOVERNOR TESTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cubre la auditoría del caso "RGBW huérfano" (ej. beam-color del
 * American Pro Tungsten: canales 12-15, zona `air`, sin dimmer físico):
 *
 *   A) PATH CLÁSICO (_writeNode → _translateColor):
 *      - 'brightness' escala r/g/b → RGBW resultante (incl. white).
 *      - Sin 'brightness' → multiplicador 1.0 (documentado: el adapter
 *        L0 ahora lo emite SIEMPRE, fail-closed).
 *
 *   B) PATH FORGE (_accumulateForgeNodeValues → _writeForgeDevice):
 *      - 'brightness' escala los canales de mezcla electrónica cuando
 *        el nodo no tiene dimmer físico.
 *      - Nodo CON dimmer: 'brightness' no escala color (el dimmer físico gobierna).
 *      - Los gobernadores SÍ se aplican en la ruta Forge (WAVE 8269).
 *
 *   C) SOFT BLACKOUT MASK:
 *      - Nodo sin dimmer físico: los canales RGBW se zeran (son su dimmer virtual).
 *      - Nodo con dimmer: solo el dimmer se zera (color preservado para el return).
 *
 * AXIOMA ANTI-SIMULACIÓN: Sin Math.random(). Entradas deterministas.
 *
 * @module core/aether/__tests__/node-resolver-virtual-dimmer.test
 * @version WAVE 8269
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { NodeResolver } from '../resolver/NodeResolver'
import { NodeFamily } from '../types'
import type { INodeGraph, INodeView } from '../node-graph'
import type { IColorNodeData } from '../capability-node'
import type { IDeviceDefinition } from '../device'
import type { ArbitratedNodeMap } from '../intent-bus'
import type { CompiledForgeGraph } from '../../forge/compiler/types'

// ═══════════════════════════════════════════════════════════════════════════
// FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

const UNIVERSE = 0
const DMX_ADDR = 1

/** Nodo COLOR RGBW huérfano — sin dimmer físico (topology del beam del Tungsten). */
function makeOrphanRgbwNode(deviceId = 'dev-01', nodeId = 'dev-01:beam-color'): IColorNodeData {
  return {
    nodeId,
    family:   NodeFamily.COLOR,
    role:     'primary',
    deviceId,
    zoneId:   'air',
    channels: [
      { type: 'red',   dmxOffset: 11, defaultValue: 0 },
      { type: 'green', dmxOffset: 12, defaultValue: 0 },
      { type: 'blue',  dmxOffset: 13, defaultValue: 0 },
      { type: 'white', dmxOffset: 14, defaultValue: 0 },
    ],
    constraints: { maxValue: 255, transferCurve: { type: 'linear' } },
    mixingType:  'rgbw',
    currentColor: { r: 0, g: 0, b: 0 },
    position:    { x: 0, y: 2, z: 0 },
  } as unknown as IColorNodeData
}

/** Nodo COLOR RGB con dimmer físico propio. */
function makeDimmerColorNode(deviceId = 'dev-01', nodeId = 'dev-01:wash-color'): IColorNodeData {
  return {
    nodeId,
    family:   NodeFamily.COLOR,
    role:     'primary',
    deviceId,
    zoneId:   'floor',
    channels: [
      { type: 'dimmer', dmxOffset: 4, defaultValue: 0 },
      { type: 'red',    dmxOffset: 5, defaultValue: 0 },
      { type: 'green',  dmxOffset: 6, defaultValue: 0 },
      { type: 'blue',   dmxOffset: 7, defaultValue: 0 },
    ],
    constraints: { maxValue: 255, transferCurve: { type: 'linear' } },
    mixingType:  'rgb',
    currentColor: { r: 0, g: 0, b: 0 },
    position:    { x: 0, y: 2, z: 0 },
  } as unknown as IColorNodeData
}

function makeDevice(governors?: IDeviceDefinition['dmxGovernors']): IDeviceDefinition {
  return {
    deviceId:     'dev-01',
    name:         'American Pro Tungsten (test)',
    type:         'american_pro_tungsten',
    dmxAddress:   DMX_ADDR,
    universe:     UNIVERSE,
    channelCount: 20,
    nodes:        [],
    ...(governors ? { dmxGovernors: governors } : {}),
  } as unknown as IDeviceDefinition
}

function makeView<T>(nodes: T[]): INodeView<T> {
  return {
    get count(): number { return nodes.length },
    forEach(fn: (node: T, index: number) => void): void { nodes.forEach((n, i) => fn(n, i)) },
    get(i: number): T { return nodes[i] },
    byZone(): T[] { return [...nodes] },
    byRole(): T[] { return [...nodes] },
  } as INodeView<T>
}

/** INodeGraph mock: devuelve los nodos dados y views por familia. */
function makeGraph(nodes: IColorNodeData[], device: IDeviceDefinition): INodeGraph {
  const byId = new Map(nodes.map(n => [n.nodeId, n]))
  const colorNodes = nodes.filter(n => n.family === NodeFamily.COLOR)
  const empty = makeView<never>([])
  const colorView = makeView(colorNodes)

  return {
    getNodeData:     (id: string) => byId.get(id),
    getDevice:       (id: string) => id === device.deviceId ? device : undefined,
    getDeviceNodes:  (id: string) =>
      id === device.deviceId ? nodes.map(n => n.nodeId) : [],
    getView: (family: NodeFamily) =>
      family === NodeFamily.COLOR ? (colorView as INodeView<unknown>) : (empty as INodeView<unknown>),
    registerDevice:   () => [],
    unregisterDevice: () => {},
    getNodeSlot:      () => undefined,
    snapshot:         () => ({} as never),
  } as unknown as INodeGraph
}

function makeArbitrated(nodeId: string, values: Record<string, number>): ArbitratedNodeMap {
  return new Map([[nodeId, values]]) as unknown as ArbitratedNodeMap
}

/**
 * Grafo Forge mínimo para el beam RGBW: inputMap cell-scoped
 * `beam-color:{red,green,blue,white}` → wire 0-3 → outputs dmxOffset 11-14.
 * Programa vacío: los inputs pasan directo a los outputs (passthrough).
 */
function makeBeamForgeGraph(): CompiledForgeGraph {
  return {
    fixtureId:       'dev-01',
    wireBuffer:      new Float64Array(8),
    totalWireSlots:  8,
    stateBuffer:     new Float64Array(0),
    totalStateSlots: 0,
    program:         [],
    edgeWiring:      new Uint32Array(0),
    edgeCount:       0,
    inputMap: new Map([
      ['beam-color:red',   0],
      ['beam-color:green', 1],
      ['beam-color:blue',  2],
      ['beam-color:white', 3],
    ]),
    audioInputMap:   new Map(),
    beatInputIndex:   -1,
    bpmInputIndex:    -1,
    energyInputIndex: -1,
    timeInputIndex:   -1,
    outputs: [
      { wireIndex: 0, dmxOffset: 11, defaultDmxValue: 0, is16bit: false },
      { wireIndex: 1, dmxOffset: 12, defaultDmxValue: 0, is16bit: false },
      { wireIndex: 2, dmxOffset: 13, defaultDmxValue: 0, is16bit: false },
      { wireIndex: 3, dmxOffset: 14, defaultDmxValue: 0, is16bit: false },
    ],
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE
// ═══════════════════════════════════════════════════════════════════════════

describe('🌊 NodeResolver — Virtual Dimmer & Forge Governors (WAVE 8269)', () => {

  // ─────────────────────────────────────────────────────────────────────
  // A — Path clásico (_translateColor)
  // ─────────────────────────────────────────────────────────────────────

  describe('A — Path clásico: brightness escala RGBW', () => {

    let node: IColorNodeData
    let device: IDeviceDefinition
    let resolver: NodeResolver

    beforeEach(() => {
      node     = makeOrphanRgbwNode()
      device   = makeDevice()
      resolver = new NodeResolver(makeGraph([node], device))
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
    })

    test('A1 — RGB puro a full + brightness=0.5 → red≈128, resto 0', () => {
      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { r: 1, g: 0, b: 0, brightness: 0.5 }),
      )
      const ch = packets[0]!.channels
      expect(ch[11]).toBe(128)   // round(0.5 × 255) ≈ 128
      expect(ch[12]).toBe(0)
      expect(ch[13]).toBe(0)
      expect(ch[14]).toBe(0)
    })

    test('A2 — brightness=0 apaga el haz (fail-closed con adapter WAVE 8269)', () => {
      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { r: 1, g: 1, b: 1, brightness: 0 }),
      )
      const ch = packets[0]!.channels
      expect(ch[11]).toBe(0)
      expect(ch[12]).toBe(0)
      expect(ch[13]).toBe(0)
      expect(ch[14]).toBe(0)   // white también (derivada del RGB escalado)
    })

    test('A3 — sin key brightness → multiplicador 1.0 (contrato fail-open del resolver)', () => {
      // Documenta el default interno del resolver. Desde WAVE 8269 el adapter
      // L0 emite brightness SIEMPRE, así que en producción este fallback
      // solo aplica si el arbiter nunca recibió el intent (p.ej. L2 directo).
      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { r: 1, g: 0, b: 0 }),
      )
      const ch = packets[0]!.channels
      expect(ch[11]).toBe(255)
    })

    test('A4 — white se escala: RGB blanco + brightness=0.5 → white≈128 (no 255)', () => {
      // En mezcla RGBW, blanco puro (r=g=b) se absorbe al canal white:
      // w = min(r,g,b), r/g/b -= w. Con brightness=0.5, el input escalado
      // es (0.5, 0.5, 0.5) → w=0.5 → white≈128, RGB residual = 0.
      // Si brightness NO escalara (bug original), white saldría a 255.
      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { r: 1, g: 1, b: 1, brightness: 0.5 }),
      )
      const ch = packets[0]!.channels
      expect(ch[11]).toBe(0)
      expect(ch[12]).toBe(0)
      expect(ch[13]).toBe(0)
      expect(ch[14]).toBe(128)   // white deriva del RGB escalado
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // B — Path Forge: virtual dimmer + gobernadores
  // ─────────────────────────────────────────────────────────────────────

  describe('B — Path Forge: virtual dimmer + gobernadores en _writeForgeDevice', () => {

    test('B1 — brightness=0.5 escala los 4 canales RGBW vía virtualDim', () => {
      const node   = makeOrphanRgbwNode()
      const device = makeDevice()
      const graph  = makeGraph([node], device)
      const resolver = new NodeResolver(graph)
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', makeBeamForgeGraph())

      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { red: 1, green: 1, blue: 1, white: 1, brightness: 0.5 }),
      )
      const ch = packets[0]!.channels
      for (const off of [11, 12, 13, 14]) {
        expect(ch[off]).toBe(128)   // round(0.5 × 255)
      }
    })

    test('B2 — brightness=0 apaga el beam en ruta Forge (regresión del show)', () => {
      const node   = makeOrphanRgbwNode()
      const device = makeDevice()
      const graph  = makeGraph([node], device)
      const resolver = new NodeResolver(graph)
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', makeBeamForgeGraph())

      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { red: 1, green: 1, blue: 1, white: 1, brightness: 0 }),
      )
      const ch = packets[0]!.channels
      for (const off of [11, 12, 13, 14]) {
        expect(ch[off]).toBe(0)
      }
    })

    test('B3 — Nodo CON dimmer físico: brightness NO escala el color', () => {
      // wash-color tiene dimmer propio → el contrato dice que brightness
      // no lo toca (el dimmer físico gobierna la intensidad).
      const node = makeDimmerColorNode()
      // Grafo passthrough para wash-color (dimmer@4, red@5, green@6, blue@7)
      const washGraph: CompiledForgeGraph = {
        fixtureId:       'dev-01',
        wireBuffer:      new Float64Array(8),
        totalWireSlots:  8,
        stateBuffer:     new Float64Array(0),
        totalStateSlots: 0,
        program:         [],
        edgeWiring:      new Uint32Array(0),
        edgeCount:       0,
        inputMap: new Map([
          ['wash-color:dimmer', 0],
          ['wash-color:red',    1],
          ['wash-color:green',  2],
          ['wash-color:blue',   3],
        ]),
        audioInputMap:   new Map(),
        beatInputIndex:   -1,
        bpmInputIndex:    -1,
        energyInputIndex: -1,
        timeInputIndex:   -1,
        outputs: [
          { wireIndex: 0, dmxOffset: 4, defaultDmxValue: 0, is16bit: false },
          { wireIndex: 1, dmxOffset: 5, defaultDmxValue: 0, is16bit: false },
          { wireIndex: 2, dmxOffset: 6, defaultDmxValue: 0, is16bit: false },
          { wireIndex: 3, dmxOffset: 7, defaultDmxValue: 0, is16bit: false },
        ],
      }

      const device = makeDevice()
      const graph  = makeGraph([node], device)
      const resolver = new NodeResolver(graph)
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', washGraph)

      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { dimmer: 0.5, red: 1, green: 1, blue: 1, brightness: 0.1 }),
      )
      const ch = packets[0]!.channels
      expect(ch[4]).toBe(128)   // dimmer físico
      expect(ch[5]).toBe(255)   // red NO escalado por brightness (0.1 ignorado)
      expect(ch[6]).toBe(255)
      expect(ch[7]).toBe(255)
    })

    test('B4 — Governor clampMax SÍ se aplica en la ruta Forge (WAVE 8269)', () => {
      const node = makeOrphanRgbwNode()
      const device = makeDevice([
        {
          channelIndex: 11,   // red (0-based dentro del device)
          description: 'beam red cap',
          rules: [{ when: { intentType: 'fallback' }, then: { clampMax: 100 } }],
        },
      ])
      const graph  = makeGraph([node], device)
      const resolver = new NodeResolver(graph)
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', makeBeamForgeGraph())

      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { red: 1, green: 1, blue: 1, white: 1, brightness: 1 }),
      )
      const ch = packets[0]!.channels
      expect(ch[11]).toBe(100)  // clampMax capó el red
      expect(ch[12]).toBe(255)  // resto sin gobernador
      expect(ch[13]).toBe(255)
      expect(ch[14]).toBe(255)
    })

    test('B5 — Governor forceByte con precedencia absoluta en ruta Forge', () => {
      const node = makeOrphanRgbwNode()
      const device = makeDevice([
        {
          channelIndex: 14,   // white
          rules: [{ when: { intentType: 'fallback', min: 0.9 }, then: { forceByte: 0 } }],
        },
      ])
      const graph  = makeGraph([node], device)
      const resolver = new NodeResolver(graph)
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', makeBeamForgeGraph())

      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { red: 1, green: 1, blue: 1, white: 1, brightness: 1 }),
      )
      const ch = packets[0]!.channels
      // white=1.0 ≥ min 0.9 → forceByte 0
      expect(ch[14]).toBe(0)
      expect(ch[11]).toBe(255)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // C — Soft Blackout Mask
  // ─────────────────────────────────────────────────────────────────────

  describe('C — Soft Blackout mask (WAVE 8269)', () => {

    test('C1 — Nodo RGBW huérfano: los 4 canales se zeran en soft blackout', () => {
      const node   = makeOrphanRgbwNode()
      const device = makeDevice()
      const resolver = new NodeResolver(makeGraph([node], device))
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)

      const source = resolver.getUniverseBuffer(UNIVERSE)!
      for (const off of [11, 12, 13, 14]) source[off] = 255

      const out = resolver.getSoftBlackoutUniverseBuffer(UNIVERSE, source)
      for (const off of [11, 12, 13, 14]) {
        expect(out[off]).toBe(0)   // virtual dimmer = sus canales de color
      }
      // El source NO se muta (blackout es una copia)
      expect(source[11]).toBe(255)
    })

    test('C2 — Nodo con dimmer físico: solo el dimmer se zera, color preservado', () => {
      const node   = makeDimmerColorNode()
      const device = makeDevice()
      const resolver = new NodeResolver(makeGraph([node], device))
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)

      const source = resolver.getUniverseBuffer(UNIVERSE)!
      source[4] = 200   // dimmer
      source[5] = 255   // red
      source[6] = 255   // green
      source[7] = 255   // blue

      const out = resolver.getSoftBlackoutUniverseBuffer(UNIVERSE, source)
      expect(out[4]).toBe(0)      // dimmer a 0
      expect(out[5]).toBe(255)    // color preservado (return suave)
      expect(out[6]).toBe(255)
      expect(out[7]).toBe(255)
    })
  })
})
