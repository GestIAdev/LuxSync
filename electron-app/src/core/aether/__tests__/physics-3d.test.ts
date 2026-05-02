/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚙️  WAVE 4523.6 — THE KINETIC TEST BENCH
 * Suite 2: PhysicsPostProcessor — Inercia Espacial 3D
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Valida:
 *   • EARLY-EXIT SPATIAL: mapa con targetX/Y/Z → inercia 3D aplicada,
 *     sin tocar el flujo pan/tilt legacy.
 *   • INERCIA MÉTRICA: salto brusco targetX clampeado a SAFETY_MAX_3D_VEL_MS.
 *   • SEPARACIÓN DE FLUJOS: nodo pan/tilt puro no activa la ruta 3D.
 *   • TELEPORT: deltaMs > 200ms salta sin inercia también en 3D.
 *
 * AXIOMA ANTI-SIMULACIÓN:
 *   Física determinista. Sin Math.random(). Todas las entradas son valores
 *   fijos y la salida es calculable a mano.
 *
 * CONSTANTES ESPEJO (del PhysicsPostProcessor):
 *   SAFETY_MAX_3D_VEL_MS  = 5.0 m/s
 *   SAFETY_MAX_3D_ACC_MS2 = 20.0 m/s²
 *   DEG_PER_SEC_TO_METERS_PER_SEC = 4.0 / 270
 *   DEFAULT_3D_Y = 1.5
 *   DEFAULT_3D_Z = 2.0
 *   TELEPORT_THRESHOLD_MS = 200
 *
 * @module core/aether/__tests__/physics-3d.test
 * @version WAVE 4523.6
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { PhysicsPostProcessor } from '../resolver/PhysicsPostProcessor'
import { NodeFamily } from '../types'
import type { IKineticNodeData } from '../capability-node'
import type { INodeView, INodeGraph } from '../node-graph'
import type { ArbitratedNodeMap } from '../intent-bus'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES ESPEJO — exactas del PhysicsPostProcessor
// ═══════════════════════════════════════════════════════════════════════════

const TELEPORT_THRESHOLD_MS        = 200
const FRAME_MS                     = 22       // ~44Hz
const SAFETY_MAX_3D_VEL_MS         = 5.0      // m/s
const DEG_PER_SEC_TO_METERS_PER_SEC = 4.0 / 270

// maxPanSpeed que excede el SAFETY_MAX para que el cap sea el límite determinante
// Con 270 deg/s → vel = 270 × (4/270) = 4.0 m/s < SAFETY_MAX_3D_VEL (5.0) → no recorta
// Para que el safety cap determine: usamos 500 deg/s → 500 × (4/270) ≈ 7.4 > 5.0 m/s
const MAX_PAN_SPEED_FAST = 500  // deg/s — pasa el safety cap a 5.0 m/s

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — Mocks mínimos deterministas
// ═══════════════════════════════════════════════════════════════════════════

function makeKineticNode(overrides: {
  nodeId?: string
  isContinuous?: boolean
  maxPanSpeed?: number
  physicalPosition?: { x: number; y: number; z: number }
} = {}): IKineticNodeData {
  return {
    nodeId:          overrides.nodeId ?? 'node-01',
    family:          NodeFamily.KINETIC,
    role:            'primary',
    deviceId:        'dev-01',
    channels:        [],
    motorType:       'servo',
    isContinuous:    overrides.isContinuous ?? false,
    maxPanSpeed:     overrides.maxPanSpeed ?? MAX_PAN_SPEED_FAST,
    maxTiltSpeed:    overrides.maxPanSpeed ?? MAX_PAN_SPEED_FAST,
    currentPosition: { pan: 0.5, tilt: 0.5 },
    physicalPosition: overrides.physicalPosition ?? { x: 0, y: 3, z: 0 },
    stereoIndex:     0,
    stereoTotal:     1,
    zoneId:          'front',
    constraints:     { maxValue: 255 },
  } as unknown as IKineticNodeData
}

function makeKineticView(nodes: IKineticNodeData[]): INodeView<IKineticNodeData> {
  return {
    count:   nodes.length,
    forEach: (fn) => { nodes.forEach((n, i) => fn(n, i)) },
    get:     (i)  => nodes[i]!,
    byZone:  ()   => [],
    byRole:  ()   => [],
  }
}

function makeNodeGraph(kineticNodes: IKineticNodeData[]): INodeGraph {
  const kView = makeKineticView(kineticNodes)
  return {
    getView(family: NodeFamily) {
      if (family === NodeFamily.KINETIC) return kView as any
      return makeKineticView([]) as any
    },
    registerDevice:   () => [],
    unregisterDevice: () => {},
    getNodeData:      () => undefined,
    getDevice:        () => undefined,
    getDeviceNodes:   () => [],
    getNodeSlot:      () => undefined,
    snapshot:         () => ({} as any),
  } as unknown as INodeGraph
}

/**
 * Construye un ArbitratedNodeMap con canales espaciales.
 */
function makeArbitratedSpatial(
  nodeId: string,
  targetX: number,
  targetY: number,
  targetZ: number,
): ArbitratedNodeMap {
  return new Map([[nodeId, { targetX, targetY, targetZ }]]) as unknown as ArbitratedNodeMap
}

/**
 * Construye un ArbitratedNodeMap con canales legacy pan/tilt.
 */
function makeArbitratedLegacy(nodeId: string, pan: number, tilt: number): ArbitratedNodeMap {
  return new Map([[nodeId, { pan, tilt }]]) as unknown as ArbitratedNodeMap
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE
// ═══════════════════════════════════════════════════════════════════════════

describe('PhysicsPostProcessor — Inercia 3D — WAVE 4523.6', () => {

  let processor: PhysicsPostProcessor

  beforeEach(() => {
    processor = new PhysicsPostProcessor()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Early-Exit Spatial
  // ─────────────────────────────────────────────────────────────────────────

  describe('Test 1 — Early-Exit Spatial', () => {

    test('mapa con targetX/Y/Z: el procesador actualiza canales espaciales', () => {
      const nodeId = 'node-01'
      const node   = makeKineticNode({ nodeId })
      const graph  = makeNodeGraph([node])

      processor.registerNode(nodeId)

      const target = { x: 1.0, y: 2.0, z: 2.5 }
      const arb    = makeArbitratedSpatial(nodeId, target.x, target.y, target.z)

      processor.process(arb, graph, FRAME_MS, 'techno-club')

      // Los canales espaciales deben estar presentes y haber sido procesados
      const entry = (arb as unknown as Map<string, Record<string, number>>).get(nodeId)!
      expect(entry['targetX']).toBeDefined()
      expect(entry['targetY']).toBeDefined()
      expect(entry['targetZ']).toBeDefined()
    })

    test('mapa con targetX/Y/Z NO toca canales pan/tilt (flujo legacy intacto)', () => {
      const nodeId = 'node-01'
      const node   = makeKineticNode({ nodeId })
      const graph  = makeNodeGraph([node])

      processor.registerNode(nodeId)

      // Inyectamos targetX/Y/Z PERO también pan/tilt (como si viniera mezcla).
      // El procesador debe procesar 3D y hacer return antes de tocar pan/tilt.
      const rawEntry: Record<string, number> = {
        targetX: 1.0,
        targetY: 1.5,
        targetZ: 2.0,
        pan:     0.9,   // valor extremo que NUNCA debería ser suavizado en esta ruta
        tilt:    0.1,
      }
      const arb = new Map([[nodeId, rawEntry]]) as unknown as ArbitratedNodeMap

      processor.process(arb, graph, FRAME_MS, 'techno-club')

      const entry = (arb as unknown as Map<string, Record<string, number>>).get(nodeId)!
      // pan/tilt NO deben ser modificados por el procesador en el flujo 3D
      expect(entry['pan']).toBe(0.9)
      expect(entry['tilt']).toBe(0.1)
    })

    test('mapa sin targetX (solo pan/tilt) usa flujo legacy, sin tocar 3D', () => {
      const nodeId = 'node-01'
      const node   = makeKineticNode({ nodeId })
      const graph  = makeNodeGraph([node])

      processor.registerNode(nodeId)

      const arb = makeArbitratedLegacy(nodeId, 0.7, 0.3)

      processor.process(arb, graph, FRAME_MS, 'techno-club')

      const entry = (arb as unknown as Map<string, Record<string, number>>).get(nodeId)!
      // Flujo legacy: pan/tilt deben existir (procesados por inercia clásica)
      expect(entry['pan']).toBeDefined()
      expect(entry['tilt']).toBeDefined()
      // Canales 3D deben estar ausentes (no los inyectamos, no deben aparecer)
      expect(entry['targetX']).toBeUndefined()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Inercia Métrica — salto brusco limitado por SAFETY_MAX_3D_VEL_MS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Test 2 — Inercia Métrica', () => {

    test('salto brusco targetX de -2.0 a +2.0: primer frame clampeado por safety vel', () => {
      // El procesador inicia en DEFAULT_3D_X = 0.0
      // Pedimos un salto a +2.0 metros en un solo frame de 22ms.
      //
      // SAFETY_MAX_3D_VEL_MS = 5.0 m/s
      // Con maxPanSpeed=500 → vel = 500 × (4/270) ≈ 7.4 m/s > SAFETY → cap a 5.0 m/s
      //
      // distancia máxima en 22ms:
      //   maxMove = maxVel × dt = 5.0 × 0.022 = 0.11 m
      //
      // En modo CLASSIC, la posición inicial es 0.0 y el target es +2.0
      // Distancia = 2.0 m >> 0.11 m. El procesador debe moverse MENOS que 2.0 m.
      //
      // (En modo CLASSIC la aceleración también condiciona el movimiento;
      //  pero el punto es que la salida es ESTRICTAMENTE menor que 2.0.)

      const nodeId = 'node-01'
      const node   = makeKineticNode({ nodeId, maxPanSpeed: MAX_PAN_SPEED_FAST })
      const graph  = makeNodeGraph([node])

      processor.registerNode(nodeId)
      processor.setPhysicsMode('classic')

      // Target: +2.0 metros en X
      const arb = makeArbitratedSpatial(nodeId, 2.0, 1.5, 2.0)
      processor.process(arb, graph, FRAME_MS, 'techno-club')

      const entry = (arb as unknown as Map<string, Record<string, number>>).get(nodeId)!
      const outX  = entry['targetX']!

      // La posición de salida debe estar entre el centro (0.0) y el target (2.0)
      // pero mucho más cerca del centro (inercia activa).
      expect(outX).toBeGreaterThan(0.0)      // ha habido movimiento
      expect(outX).toBeLessThan(2.0)         // no ha llegado al target en un frame
    })

    test('velocidad de movimiento primer frame ≤ SAFETY_MAX_3D_VEL_MS × deltaMs', () => {
      // Cuantifica exactamente el límite: posición inicial = 0.0,
      // máximo desplazamiento = SAFETY_MAX_3D_VEL_MS × (FRAME_MS / 1000)

      const nodeId    = 'node-01'
      const node      = makeKineticNode({ nodeId, maxPanSpeed: MAX_PAN_SPEED_FAST })
      const graph     = makeNodeGraph([node])
      const dtSec     = FRAME_MS / 1000
      const maxMovePer1Frame = SAFETY_MAX_3D_VEL_MS * dtSec   // 5.0 × 0.022 = 0.110 m

      processor.registerNode(nodeId)
      processor.setPhysicsMode('classic')

      // Salto extremo: de 0 a +4.0 m
      const arb = makeArbitratedSpatial(nodeId, 4.0, 1.5, 2.0)
      processor.process(arb, graph, FRAME_MS, 'techno-club')

      const entry  = (arb as unknown as Map<string, Record<string, number>>).get(nodeId)!
      const outX   = entry['targetX']!
      const deltaX = Math.abs(outX - 0.0)   // distancia recorrida desde posición inicial

      // El delta de posición no puede superar lo dictado por la velocidad máxima
      expect(deltaX).toBeLessThanOrEqual(maxMovePer1Frame + 0.001)  // +1mm tolerancia float
    })

    test('en modo SNAP: convergencia fraccional respeta safety vel', () => {
      const nodeId = 'node-01'
      const node   = makeKineticNode({ nodeId, maxPanSpeed: MAX_PAN_SPEED_FAST })
      const graph  = makeNodeGraph([node])
      const dtSec  = FRAME_MS / 1000
      const maxMovePer1Frame = SAFETY_MAX_3D_VEL_MS * dtSec

      processor.registerNode(nodeId)
      processor.setPhysicsMode('snap', 0.5)

      // Salto a +3.0 m, posición inicial = 0.0
      const arb = makeArbitratedSpatial(nodeId, 3.0, 1.5, 2.0)
      processor.process(arb, graph, FRAME_MS, 'techno-club')

      const entry  = (arb as unknown as Map<string, Record<string, number>>).get(nodeId)!
      const outX   = entry['targetX']!
      const deltaX = Math.abs(outX - 0.0)

      expect(deltaX).toBeLessThanOrEqual(maxMovePer1Frame + 0.001)
    })

    test('TELEPORT MODE (deltaMs > 200): salta directamente al target 3D', () => {
      const nodeId = 'node-01'
      const node   = makeKineticNode({ nodeId })
      const graph  = makeNodeGraph([node])

      processor.registerNode(nodeId)

      const targetX = 3.5
      const arb = makeArbitratedSpatial(nodeId, targetX, 1.5, 2.0)

      processor.process(arb, graph, TELEPORT_THRESHOLD_MS + 1, 'techno-club')

      // En TELEPORT el estado interno salta al target directamente.
      // El siguiente frame con delta normal debe arrancar desde el nuevo estado.
      // Verificamos que un frame normal posterior produce un valor muy cercano al target.
      const arb2 = makeArbitratedSpatial(nodeId, targetX, 1.5, 2.0)
      processor.process(arb2, graph, FRAME_MS, 'techno-club')

      const entry = (arb2 as unknown as Map<string, Record<string, number>>).get(nodeId)!
      // Después de teleport, el estado interno ya está en targetX.
      // Con delta=0 entre estado y target, el procesador no debe moverse mucho.
      expect(Math.abs(entry['targetX']! - targetX)).toBeLessThan(0.05)
    })

    test('múltiples frames convergen hacia el target', () => {
      // Verifica convergencia monotónica: después de N frames, outX se acerca al target
      const nodeId  = 'node-01'
      const node    = makeKineticNode({ nodeId, maxPanSpeed: MAX_PAN_SPEED_FAST })
      const graph   = makeNodeGraph([node])
      const targetX = 2.0

      processor.registerNode(nodeId)
      processor.setPhysicsMode('classic')

      let prevX = 0.0
      for (let i = 0; i < 10; i++) {
        const arb = makeArbitratedSpatial(nodeId, targetX, 1.5, 2.0)
        processor.process(arb, graph, FRAME_MS, 'techno-club')
        const outX = (arb as unknown as Map<string, Record<string, number>>).get(nodeId)!['targetX']!
        // Cada frame debe acercarse al target (monotonía de convergencia)
        expect(outX).toBeGreaterThanOrEqual(prevX - 0.001)  // tolerancia float
        prevX = outX
      }

      // Después de 10 frames × 22ms = 220ms de física, debe haber avanzado significativamente
      expect(prevX).toBeGreaterThan(0.1)
    })
  })

})
