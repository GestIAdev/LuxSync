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
 *   D) FORGE COLOR-BRIDGE (WAVE 8408-B):
 *      - {r,g,b,w} abstractos (ColorAdapter L1) → red/green/blue/white físicos.
 *      - Dual-alias: el nombre físico gana sobre el alias en el mismo frame.
 *      - El virtualDim (brightness) sigue escalando los alias traducidos.
 *      - Solo nodos COLOR forjados — IMPACT/KINETIC no traducen.
 *
 *   E) NODE-LEVEL VIRTUAL DIMMER CAP (WAVE 8411-B):
 *      - maxVirtualDim clampea virtualDim → escalado proporcional, hue intacto.
 *      - Gobierna L0 (airIntensity) y L2 (brightness inyectada) por igual.
 *      - Nodos con dimmer físico: cap inerte (passthrough 1.0).
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
import type { ICapabilityNode, IColorNodeData } from '../capability-node'
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

function makeView<T extends ICapabilityNode>(nodes: T[]): INodeView<T> {
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
      family === NodeFamily.COLOR ? (colorView as INodeView<ICapabilityNode>) : (empty as INodeView<ICapabilityNode>),
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

  // ════════════════════════════════════════════════════════════════════
  // D — WAVE 8408-B: FORGE COLOR-BRIDGE (alias abstracto → canal físico)
  //     El ColorAdapter L1 emite {r,g,b,w}; el inputMap solo conoce los
  //     nombres físicos. El puente los traduce antes del filtro, dentro
  //     de _accumulateForgeNodeValues.
  // ════════════════════════════════════════════════════════════════════

  describe('D — WAVE 8408-B: Forge Color-Bridge', () => {

    test('D1 — {r,g,b} abstractos aterrizan en canales físicos red/green/blue', () => {
      const node   = makeOrphanRgbwNode()
      const device = makeDevice()
      const resolver = new NodeResolver(makeGraph([node], device))
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', makeBeamForgeGraph())

      // Esto es lo que emitía el ColorAdapter L1 y moría en el inputMap.
      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { r: 1, g: 0, b: 0, brightness: 1 }),
      )
      const ch = packets[0]!.channels
      expect(ch[11]).toBe(255)   // red   ← 'r' puenteado
      expect(ch[12]).toBe(0)     // green ← 'g' = 0
      expect(ch[13]).toBe(0)     // blue  ← 'b' = 0
      expect(ch[14]).toBe(0)
    })

    test('D2 — alias w→white + virtualDim: brightness=0.5 escala los alias', () => {
      const node   = makeOrphanRgbwNode()
      const device = makeDevice()
      const resolver = new NodeResolver(makeGraph([node], device))
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', makeBeamForgeGraph())

      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { r: 1, g: 1, b: 1, w: 1, brightness: 0.5 }),
      )
      const ch = packets[0]!.channels
      for (const off of [11, 12, 13, 14]) {
        expect(ch[off]).toBe(128)   // round(255 × 1 × 0.5)
      }
    })

    test('D3 — dual-alias: el canal físico gana sobre el alias', () => {
      // SeleneAetherAdapter (L3) emite r/g/b Y red/green/blue en el mismo
      // frame. Determinismo: el nombre físico (el del wire) siempre manda.
      const node   = makeOrphanRgbwNode()
      const device = makeDevice()
      const resolver = new NodeResolver(makeGraph([node], device))
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', makeBeamForgeGraph())

      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { r: 1, red: 0.25, brightness: 1 }),
      )
      expect(packets[0]!.channels[11]).toBe(64)   // round(0.25 × 255)
    })

    test('D4 — fail-closed intacto: brightness=0 apaga los alias puenteados', () => {
      const node   = makeOrphanRgbwNode()
      const device = makeDevice()
      const resolver = new NodeResolver(makeGraph([node], device))
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', makeBeamForgeGraph())

      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { r: 1, g: 1, b: 1, w: 1, brightness: 0 }),
      )
      for (const off of [11, 12, 13, 14]) {
        expect(packets[0]!.channels[off]).toBe(0)
      }
    })

    test('D5 — nodo no-COLOR no traduce alias (gating por familia)', () => {
      // Un IMPACT con canal dimmer: recibir {r:1} no debe inventar 'red'.
      const impactNode = {
        nodeId:   'dev-01:wash-impact',
        family:   NodeFamily.IMPACT,
        deviceId: 'dev-01',
        zoneId:   'ambient',
        channels: [{ type: 'dimmer', dmxOffset: 7, defaultValue: 0 }],
      } as unknown as IColorNodeData
      const device = makeDevice()
      const impactGraph: CompiledForgeGraph = {
        ...makeBeamForgeGraph(),
        inputMap: new Map([['wash-impact:dimmer', 0]]),
        outputs:  [{ wireIndex: 0, dmxOffset: 7, defaultDmxValue: 0, is16bit: false }],
      }
      const resolver = new NodeResolver(makeGraph([impactNode], device))
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', impactGraph)

      const packets = resolver.resolve(
        makeArbitrated(impactNode.nodeId, { dimmer: 0.5, r: 1 }),
      )
      const ch = packets[0]!.channels
      expect(ch[7]).toBe(128)    // dimmer passthrough intacto
      expect(ch[11]).toBe(0)     // 'r' NO traducido — ningún wire escrito
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // E — WAVE 8411-B: NODE-LEVEL VIRTUAL DIMMER CAP (maxVirtualDim)
  //     Techo nativo de celda que clampea virtualDim en nodos huérfanos
  //     de dimmer físico. Un escalar único → escalado proporcional →
  //     hue preservado (a diferencia de clampMax per-canal).
  // ═══════════════════════════════════════════════════════════════════════

  describe('E — WAVE 8411-B: maxVirtualDim (cap del dimmer virtual)', () => {

    const nodeWithCap = (cap: number): IColorNodeData =>
      ({ ...makeOrphanRgbwNode(), maxVirtualDim: cap }) as IColorNodeData

    test('E1 — cap 0.4: R:255,G:100 → R:102,G:40 (escalado proporcional, hue intacto)', () => {
      const node   = nodeWithCap(0.4)
      const device = makeDevice()
      const resolver = new NodeResolver(makeGraph([node], device))
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', makeBeamForgeGraph())

      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { r: 1, g: 100 / 255, b: 0, brightness: 1 }),
      )
      const ch = packets[0]!.channels
      expect(ch[11]).toBe(102)  // round(255 × 1.0 × 0.4)
      expect(ch[12]).toBe(40)   // round(255 × 0.392 × 0.4) — ratio 2.55 preservado
      expect(ch[13]).toBe(0)
      expect(ch[14]).toBe(0)
    })

    test('E2 — el cap no infla: brightness=0.3 con cap=0.4 → usa 0.3', () => {
      const node   = nodeWithCap(0.4)
      const device = makeDevice()
      const resolver = new NodeResolver(makeGraph([node], device))
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', makeBeamForgeGraph())

      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { r: 1, g: 0, b: 0, brightness: 0.3 }),
      )
      expect(packets[0]!.channels[11]).toBe(77)  // round(255 × 0.3) — airIntensity intacta
    })

    test('E3 — cap 0.392 ≈ techo DMX 100 (caso Tungsten lente colimadora)', () => {
      const node   = nodeWithCap(0.392)
      const device = makeDevice()
      const resolver = new NodeResolver(makeGraph([node], device))
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', makeBeamForgeGraph())

      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { r: 1, g: 1, b: 1, w: 1, brightness: 1 }),
      )
      for (const off of [11, 12, 13, 14]) {
        expect(packets[0]!.channels[off]).toBe(100)  // round(255 × 0.392)
      }
    })

    test('E4 — nodo CON dimmer físico: cap inerte (el canal real gobierna)', () => {
      const node   = { ...makeDimmerColorNode(), maxVirtualDim: 0.4 } as IColorNodeData
      const device = makeDevice()
      const washGraph: CompiledForgeGraph = {
        ...makeBeamForgeGraph(),
        inputMap: new Map([
          ['wash-color:dimmer', 0],
          ['wash-color:red',    1],
        ]),
        outputs: [
          { wireIndex: 0, dmxOffset: 4, defaultDmxValue: 0, is16bit: false },
          { wireIndex: 1, dmxOffset: 5, defaultDmxValue: 0, is16bit: false },
        ],
      }
      const resolver = new NodeResolver(makeGraph([node], device))
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', washGraph)

      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { r: 1, g: 0, b: 0, dimmer: 1 }),
      )
      const ch = packets[0]!.channels
      expect(ch[5]).toBe(255)   // red a pleno — cap no aplica (hay dimmer real)
      expect(ch[4]).toBe(255)   // dimmer físico intacto
    })

    test('E5 — cap 1.0 es no-op (paridad con comportamiento legacy)', () => {
      const node   = nodeWithCap(1.0)
      const device = makeDevice()
      const resolver = new NodeResolver(makeGraph([node], device))
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', makeBeamForgeGraph())

      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { r: 1, g: 0, b: 0, brightness: 1 }),
      )
      expect(packets[0]!.channels[11]).toBe(255)
    })
  })

  describe('F — WAVE 8411-E: minVirtualDim (floor remap del dimmer virtual)', () => {

    const nodeWithRange = (cap: number, floor: number): IColorNodeData =>
      ({ ...makeOrphanRgbwNode(), maxVirtualDim: cap, minVirtualDim: floor }) as IColorNodeData

    const rig = (node: IColorNodeData) => {
      const device = makeDevice()
      const resolver = new NodeResolver(makeGraph([node], device))
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', makeBeamForgeGraph())
      return resolver
    }

    test('F1 — remap [floor,cap]: brightness 1→cap, 0.6→punto medio de banda', () => {
      const resolver = rig(nodeWithRange(0.4, 0.2))

      // vd'=0.2 + 1.0×(0.4−0.2) = 0.4 → el techo sigue mandando
      let ch = resolver.resolve(
        makeArbitrated('dev-01:beam-color', { r: 1, g: 0, b: 0, brightness: 1 }),
      )[0]!.channels
      expect(ch[11]).toBe(102)  // round(255 × 0.4)

      // vd'=0.2 + 0.6×0.2 = 0.32 → input 60% → 60% del rango visible
      ch = resolver.resolve(
        makeArbitrated('dev-01:beam-color', { r: 1, g: 0, b: 0, brightness: 0.6 }),
      )[0]!.channels
      expect(ch[11]).toBe(82)   // round(255 × 0.32)
    })

    test('F2 — hue preservado bajo remap (escalar único ×RGBW)', () => {
      const resolver = rig(nodeWithRange(0.4, 0.2))
      const ch = resolver.resolve(
        makeArbitrated('dev-01:beam-color', { r: 1, g: 100 / 255, b: 0, w: 0.5, brightness: 1 }),
      )[0]!.channels
      expect(ch[11]).toBe(102)  // 255 × 0.4
      expect(ch[12]).toBe(40)   // 100 × 0.4 — ratio intacto
      expect(ch[14]).toBe(51)   // 128 × 0.4 ≈ 51
    })

    test('F3 — blackout absoluto: brightness=0 → 0 pese al floor', () => {
      const resolver = rig(nodeWithRange(0.392, 0.31))
      const ch = resolver.resolve(
        makeArbitrated('dev-01:beam-color', { r: 1, g: 1, b: 1, w: 1, brightness: 0 }),
      )[0]!.channels
      for (const off of [11, 12, 13, 14]) {
        expect(ch[off]).toBe(0)
      }
    })

    test('F4 — floor sin cap: (0,1] → [floor, 1]', () => {
      const node = { ...makeOrphanRgbwNode(), minVirtualDim: 0.3 } as IColorNodeData
      const resolver = rig(node)

      // vd=1 → vd'=0.3 + 1×0.7 = 1.0 → pleno
      let ch = resolver.resolve(
        makeArbitrated('dev-01:beam-color', { r: 1, g: 0, b: 0, brightness: 1 }),
      )[0]!.channels
      expect(ch[11]).toBe(255)

      // vd=0.2 → vd'=0.3 + 0.2×0.7 = 0.44 → round(112.2)
      ch = resolver.resolve(
        makeArbitrated('dev-01:beam-color', { r: 1, g: 0, b: 0, brightness: 0.2 }),
      )[0]!.channels
      expect(ch[11]).toBe(112)
    })

    test('F5 — floor > cap: floor se clampea al cap (salida constante al techo)', () => {
      const resolver = rig(nodeWithRange(0.4, 0.8))
      const ch = resolver.resolve(
        makeArbitrated('dev-01:beam-color', { r: 1, g: 0, b: 0, brightness: 0.6 }),
      )[0]!.channels
      expect(ch[11]).toBe(102)  // f=0.4, vd'=0.4 + 0.6×0 = 0.4
    })

    test('F6 — nodo CON dimmer físico: floor inerte (paridad con E4)', () => {
      const node   = { ...makeDimmerColorNode(), maxVirtualDim: 0.4, minVirtualDim: 0.2 } as IColorNodeData
      const device = makeDevice()
      const washGraph: CompiledForgeGraph = {
        ...makeBeamForgeGraph(),
        inputMap: new Map([
          ['wash-color:dimmer', 0],
          ['wash-color:red',    1],
        ]),
        outputs: [
          { wireIndex: 0, dmxOffset: 4, defaultDmxValue: 0, is16bit: false },
          { wireIndex: 1, dmxOffset: 5, defaultDmxValue: 0, is16bit: false },
        ],
      }
      const resolver = new NodeResolver(makeGraph([node], device))
      resolver.registerUniverse(UNIVERSE)
      resolver.registerDevice(device.deviceId)
      resolver.registerForgeGraph('dev-01', washGraph)

      const packets = resolver.resolve(
        makeArbitrated(node.nodeId, { r: 1, g: 0, b: 0, dimmer: 1 }),
      )
      expect(packets[0]!.channels[5]).toBe(255)
      expect(packets[0]!.channels[4]).toBe(255)
    })
  })
})
