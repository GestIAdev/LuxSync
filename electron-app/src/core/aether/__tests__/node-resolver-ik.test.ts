/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 WAVE 4523.6 — THE KINETIC TEST BENCH
 * Suite 3: NodeResolver — Flujo IK, Anti-Double-Calibration, Fallback Legacy
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Valida:
 *   • INTERCEPCIÓN IK: targetX/Y/Z → solve() llamado con perfil correcto,
 *     valores pan/tilt DMX escritos en el buffer de universo.
 *   • ANTI-DOUBLE-CALIBRATION: cuando la ruta IK procesa pan/tilt,
 *     _applyCalibration() legacy NO se aplica adicional sobre el resultado.
 *   • FALLBACK LEGACY: nodo KINETIC sin targetX → flujo pan/tilt normalized.
 *
 * ESTRATEGIA:
 *   El IKEngine se mockea con vi.mock() para retornar un IKResult determinista.
 *   El NodeGraph proporciona un device real con calibración (invertPan=true)
 *   y un nodo KINETIC con canales pan/tilt mapeados.
 *   Verificamos que el DMX escrito en el buffer no aplica la inversión dos veces.
 *
 * AXIOMA ANTI-SIMULACIÓN: Sin Math.random(). Todas las entradas son valores
 *   fijos y verificables a mano.
 *
 * @module core/aether/__tests__/node-resolver-ik.test
 * @version WAVE 4523.6
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { NodeResolver } from '../resolver/NodeResolver'
import { NodeFamily } from '../types'
import type { INodeGraph } from '../node-graph'
import type { IKineticNodeData } from '../capability-node'
import type { IDeviceDefinition } from '../device'
import type { ArbitratedNodeMap } from '../intent-bus'

// ═══════════════════════════════════════════════════════════════════════════
// MOCK — InverseKinematicsEngine
// vi.hoisted() garantiza que las variables estén disponibles cuando vi.mock()
// ejecuta el factory (que es hoisted al top del módulo por Vitest).
// ═══════════════════════════════════════════════════════════════════════════

const { mockSolve, mockBuildProfile } = vi.hoisted(() => {
  const MOCK_IK_PAN_DMX  = 160
  const MOCK_IK_TILT_DMX = 90

  const mockSolve = vi.fn().mockReturnValue({
    pan:             MOCK_IK_PAN_DMX,
    tilt:            MOCK_IK_TILT_DMX,
    reachable:       true,
    antiFlipApplied: false,
  })

  const mockBuildProfile = vi.fn().mockReturnValue({
    id: 'dev-01',
    position: { x: 0, y: 3, z: 0 },
    orientation: {
      installation: 'ceiling',
      rotation: { pitch: 0, yaw: 0, roll: 0 },
    },
    limits: {
      panRangeDeg:  540,
      tiltRangeDeg: 270,
    },
    calibration: {
      panOffset:  0,
      tiltOffset: 0,
      panInvert:  false,
      tiltInvert: false,
    },
  })

  return { mockSolve, mockBuildProfile }
})

// El resultado IK mock — espejo de los valores dentro de vi.hoisted()
const MOCK_IK_PAN_DMX  = 160
const MOCK_IK_TILT_DMX = 90

vi.mock('../../../engine/movement/InverseKinematicsEngine', () => ({
  solve:        mockSolve,
  buildProfile: mockBuildProfile,
}))

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — Builders de mocks deterministas
// ═══════════════════════════════════════════════════════════════════════════

const UNIVERSE   = 1
const DMX_ADDR   = 1
const PAN_OFFSET = 0    // byte 0 del device → buffer index 0
const TILT_OFFSET = 1   // byte 1 del device → buffer index 1

/**
 * Construye un IKineticNodeData de prueba con canales pan/tilt
 * y los campos IK opcionales vacíos (aplica el DEFAULT_IK_ORIENTATION).
 */
function makeKineticNode(overrides: {
  isContinuous?: boolean
  ikOrientation?: any
  ikLimits?: any
  ikCalibration?: any
} = {}): IKineticNodeData {
  return {
    nodeId:          'node-01',
    family:          NodeFamily.KINETIC,
    role:            'primary',
    deviceId:        'dev-01',
    motorType:       'servo',
    isContinuous:    overrides.isContinuous ?? false,
    maxPanSpeed:     270,
    maxTiltSpeed:    270,
    currentPosition: { pan: 0.5, tilt: 0.5 },
    physicalPosition: { x: 0, y: 3, z: 0 },
    stereoIndex:     0,
    stereoTotal:     1,
    zoneId:          'front',
    constraints: {
      maxValue:      255,
      transferCurve: { type: 'linear' },
    },
    channels: [
      { type: 'pan',  dmxOffset: PAN_OFFSET,  defaultValue: 128, is16bit: false },
      { type: 'tilt', dmxOffset: TILT_OFFSET, defaultValue: 128, is16bit: false },
    ],
    ikOrientation: overrides.ikOrientation,
    ikLimits:      overrides.ikLimits,
    ikCalibration: overrides.ikCalibration,
  } as unknown as IKineticNodeData
}

/**
 * Device con calibración invertPan=true para el test anti-double-calibration.
 */
function makeDevice(calibration?: {
  invertPan?:   boolean
  invertTilt?:  boolean
  panOffset?:   number
}): IDeviceDefinition {
  return {
    deviceId:     'dev-01',
    name:         'Test Moving Head',
    type:         'moving_head',
    dmxAddress:   DMX_ADDR,
    universe:     UNIVERSE,
    channelCount: 16,
    nodes:        [],
    calibration:  calibration,
  } as unknown as IDeviceDefinition
}

/**
 * Mock de INodeGraph con un único nodo KINETIC.
 */
function makeNodeGraph(node: IKineticNodeData, device: IDeviceDefinition): INodeGraph {
  return {
    getNodeData: (nodeId: string) => nodeId === node.nodeId ? node : undefined,
    getDevice:   (deviceId: string) => deviceId === device.deviceId ? device : undefined,
    getView:     () => ({ count: 0, forEach: () => {}, get: () => undefined, byZone: () => [], byRole: () => [] }) as any,
    getDeviceNodes: () => [],
    registerDevice:   () => [],
    unregisterDevice: () => {},
    getNodeSlot:   () => undefined,
    snapshot:      () => ({} as any),
  } as unknown as INodeGraph
}

/**
 * ArbitratedNodeMap con canales espaciales (flujo IK).
 */
function makeArbitratedIK(tx = 1.0, ty = 1.5, tz = 2.0): ArbitratedNodeMap {
  return new Map([['node-01', { targetX: tx, targetY: ty, targetZ: tz }]]) as unknown as ArbitratedNodeMap
}

/**
 * ArbitratedNodeMap con canales legacy pan/tilt (flujo falback).
 */
function makeArbitratedLegacy(pan = 0.5, tilt = 0.5): ArbitratedNodeMap {
  return new Map([['node-01', { pan, tilt }]]) as unknown as ArbitratedNodeMap
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE
// ═══════════════════════════════════════════════════════════════════════════

describe('NodeResolver — Flujo IK — WAVE 4523.6', () => {

  let resolver:      NodeResolver
  let kineticNode:   IKineticNodeData
  let device:        IDeviceDefinition
  let graph:         INodeGraph

  beforeEach(() => {
    // Reset del mock solve para poder verificar llamadas frescas por test
    mockSolve.mockClear()
    mockBuildProfile.mockClear()

    kineticNode = makeKineticNode()
    device      = makeDevice()    // sin calibración para el test base
    graph       = makeNodeGraph(kineticNode, device)
    resolver    = new NodeResolver(graph)
    resolver.registerUniverse(UNIVERSE)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Intercepción IK
  // ─────────────────────────────────────────────────────────────────────────

  describe('Test 1 — Intercepción IK', () => {

    test('targetX/Y/Z → solve() llamado exactamente una vez', () => {
      const arb = makeArbitratedIK(1.0, 1.5, 2.0)
      resolver.resolve(arb)

      expect(mockSolve).toHaveBeenCalledTimes(1)
    })

    test('solve() recibe el target correcto {x, y, z}', () => {
      const tx = 1.5, ty = 2.0, tz = 1.8
      const arb = makeArbitratedIK(tx, ty, tz)
      resolver.resolve(arb)

      // Segundo argumento de solve() debe ser { x: tx, y: ty, z: tz }
      const callArgs = mockSolve.mock.calls[0]!
      const target   = callArgs[1] as { x: number; y: number; z: number }
      expect(target.x).toBeCloseTo(tx, 10)
      expect(target.y).toBeCloseTo(ty, 10)
      expect(target.z).toBeCloseTo(tz, 10)
    })

    test('pan DMX del mock IK escrito en buffer de universo', () => {
      const arb = makeArbitratedIK()
      const packets = resolver.resolve(arb)

      // Debe devolver exactamente un packet (el universo registrado)
      expect(packets).toHaveLength(1)
      const channels = packets[0]!.channels

      // El canal pan está en dmxOffset=0, y dmxAddress=1 → buffer[0]
      expect(channels[PAN_OFFSET]).toBe(MOCK_IK_PAN_DMX)
    })

    test('tilt DMX del mock IK escrito en buffer de universo', () => {
      const arb     = makeArbitratedIK()
      const packets = resolver.resolve(arb)
      const channels = packets[0]!.channels

      expect(channels[TILT_OFFSET]).toBe(MOCK_IK_TILT_DMX)
    })

    test('buildProfile() llamado lazy: segunda resolve() no llama buildProfile() de nuevo', () => {
      const arb1 = makeArbitratedIK()
      const arb2 = makeArbitratedIK(1.5, 1.5, 2.0)

      resolver.resolve(arb1)
      resolver.resolve(arb2)

      // buildProfile solo debe llamarse UNA vez (cache hit en segunda llamada)
      expect(mockBuildProfile).toHaveBeenCalledTimes(1)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Anti-Double-Calibration
  // ─────────────────────────────────────────────────────────────────────────

  describe('Test 2 — Anti-Double-Calibration', () => {

    test('ruta IK con invertPan=true en device: el valor DMX NO se invierte (IKEngine ya calibra)', () => {
      // El device tiene invertPan=true. En el flujo legacy, el resolver
      // aplicaría 255 - pan. En el flujo IK, el IKEngine ya integra la
      // calibración → el resolver debe escribir el valor IK sin tocar los
      // bits de inversión del device.calibration.
      //
      // MOCK_IK_PAN_DMX = 160.  Con doble inversión: 255-160 = 95.
      // Con cero inversión adicional: 160 (correcto).

      const deviceWithInvert = makeDevice({ invertPan: true })
      const graph2    = makeNodeGraph(kineticNode, deviceWithInvert)
      const resolver2 = new NodeResolver(graph2)
      resolver2.registerUniverse(UNIVERSE)

      const arb = makeArbitratedIK()
      const packets = resolver2.resolve(arb)

      // Si hubiera doble calibración, el valor sería 255-160=95.
      // La implementación correcta escribe 160 directamente.
      expect(packets[0]!.channels[PAN_OFFSET]).toBe(MOCK_IK_PAN_DMX)
      expect(packets[0]!.channels[PAN_OFFSET]).not.toBe(255 - MOCK_IK_PAN_DMX)
    })

    test('ruta IK con panOffset en device: el offset DMX NO se suma (IKEngine ya calibra)', () => {
      // panOffset=20 en el device. En flujo legacy: dmx + 20 = 160 + 20 = 180.
      // En flujo IK: el valor sale directamente del engine → 160.

      const deviceWithOffset = makeDevice({ panOffset: 20 })
      const graph2    = makeNodeGraph(kineticNode, deviceWithOffset)
      const resolver2 = new NodeResolver(graph2)
      resolver2.registerUniverse(UNIVERSE)

      const arb = makeArbitratedIK()
      const packets = resolver2.resolve(arb)

      expect(packets[0]!.channels[PAN_OFFSET]).toBe(MOCK_IK_PAN_DMX)
      expect(packets[0]!.channels[PAN_OFFSET]).not.toBe(MOCK_IK_PAN_DMX + 20)
    })

    test('ruta IK con invertTilt=true: tilt DMX no se invierte dos veces', () => {
      const deviceWithTiltInvert = makeDevice({ invertTilt: true })
      const graph2    = makeNodeGraph(kineticNode, deviceWithTiltInvert)
      const resolver2 = new NodeResolver(graph2)
      resolver2.registerUniverse(UNIVERSE)

      const arb = makeArbitratedIK()
      const packets = resolver2.resolve(arb)

      expect(packets[0]!.channels[TILT_OFFSET]).toBe(MOCK_IK_TILT_DMX)
      expect(packets[0]!.channels[TILT_OFFSET]).not.toBe(255 - MOCK_IK_TILT_DMX)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Fallback Legacy
  // ─────────────────────────────────────────────────────────────────────────

  describe('Test 3 — Fallback Legacy', () => {

    test('nodo KINETIC sin targetX: NO llama solve()', () => {
      // El nodo solo tiene pan/tilt en el mapa arbitrado → flujo legacy
      const arb = makeArbitratedLegacy(0.7, 0.4)
      resolver.resolve(arb)

      expect(mockSolve).not.toHaveBeenCalled()
    })

    test('nodo KINETIC isContinuous=true con targetX: NO llama solve() (fan ignora IK)', () => {
      // Aunque el adapter emite rotation+speed (no targetX), este test verifica
      // que incluso si targetX llegara al resolver, un nodo continuo lo ignora.
      const contNode  = makeKineticNode({ isContinuous: true })
      const graph2    = makeNodeGraph(contNode, device)
      const resolver2 = new NodeResolver(graph2)
      resolver2.registerUniverse(UNIVERSE)

      // Inyectamos targetX artificialmente (no debería pasar en producción
      // pero el resolver debe ignorarlo para nodos continuos)
      const arb = new Map([['node-01', { targetX: 1.0, targetY: 1.5, targetZ: 2.0 }]]) as unknown as ArbitratedNodeMap

      resolver2.resolve(arb)
      expect(mockSolve).not.toHaveBeenCalled()
    })

    test('flujo legacy: pan normalizado 1.0 → DMX 255 en buffer', () => {
      // Con pan=1.0 normalizado, sin TransferCurve, sin calibración:
      // dmxValue = round(1.0 × 255) = 255

      const arb = makeArbitratedLegacy(1.0, 0.5)
      const packets = resolver.resolve(arb)

      expect(packets[0]!.channels[PAN_OFFSET]).toBe(255)
    })

    test('flujo legacy: tilt normalizado 0.0 → DMX 0 en buffer', () => {
      const arb = makeArbitratedLegacy(0.5, 0.0)
      const packets = resolver.resolve(arb)

      expect(packets[0]!.channels[TILT_OFFSET]).toBe(0)
    })

    test('flujo legacy: pan=0.5 → DMX 128 (centro mecánico)', () => {
      // pan=0.5 normalizado → 0.5 × 255 ≈ 128 (round)
      const arb = makeArbitratedLegacy(0.5, 0.5)
      const packets = resolver.resolve(arb)

      expect(packets[0]!.channels[PAN_OFFSET]).toBe(128)
    })

    test('flujo legacy con invertPan=true: DMX se invierte (calibración aplica aquí)', () => {
      // En el flujo LEGACY (no IK), _applyCalibration SÍ debe aplicarse.
      // pan=1.0 → dmx=255 → con invertPan: 255-255=0

      const deviceWithInvert = makeDevice({ invertPan: true })
      const graph2    = makeNodeGraph(kineticNode, deviceWithInvert)
      const resolver2 = new NodeResolver(graph2)
      resolver2.registerUniverse(UNIVERSE)

      const arb = makeArbitratedLegacy(1.0, 0.5)
      const packets = resolver2.resolve(arb)

      expect(packets[0]!.channels[PAN_OFFSET]).toBe(0)   // 255 - 255 = 0
    })
  })

})
