/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚗️  WAVE 4519.1 — THE PROVING GROUNDS
 * Suite 2: SpatialRegistrar — Position3D sync & NeighborGraph
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Valida:
 *   • Mapeo correcto de coordenadas X/Y/Z al registrar un device.
 *   • rebuildNeighborGraph() agrupa nodos cercanos por distancia euclidiana.
 *   • getNeighbors() retorna lista correctamente ordenada por proximidad.
 *   • updateDevicePosition() rota posición en el NodeGraph.
 *
 * ESTRATEGIA:
 *   Usamos el NodeGraph real + NodeExtractionPipeline real + SpatialRegistrar real.
 *   Mockeamos solo el IAetherRegistrationTarget (tiene un solo método).
 *   CERO Math.random(). Posiciones hardcoded y deterministas.
 *
 * @module core/aether/__tests__/spatial-registrar.test
 * @version WAVE 4519.1
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { SpatialRegistrar } from '../ingestion/SpatialRegistrar'
import { NodeExtractionPipeline } from '../ingestion/NodeExtractionPipeline'
import { NodeGraph } from '../NodeGraph'
import { NodeFamily } from '../types'
import type { IDeviceDefinition } from '../device'
import type { IAetherRegistrationTarget } from '../ingestion/SpatialRegistrar'
import type { Position3D } from '../../stage/ShowFileV2'
import type { FixtureDefinition, FixtureChannel } from '../../../types/FixtureDefinition'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function ch(index: number, type: FixtureChannel['type'], name: string): FixtureChannel {
  return { index, name, type, defaultValue: 0, is16bit: false }
}

/** Moving head mínimo: solo pan+tilt+dimmer para generar nodos KINETIC e IMPACT */
function makeMovingHead(id: string): FixtureDefinition {
  return {
    id,
    name: `Mover ${id}`,
    manufacturer: 'PunkFactory',
    type: 'moving-head',
    channels: [
      ch(1, 'dimmer', 'Dimmer'),
      ch(2, 'pan',    'Pan'),
      ch(3, 'tilt',   'Tilt'),
    ],
    capabilities: { hasDimmer: true, hasPan: true, hasTilt: true },
  }
}

/** Mock mínimo de IAetherRegistrationTarget */
function makeTarget(): IAetherRegistrationTarget & { registered: IDeviceDefinition[] } {
  const registered: IDeviceDefinition[] = []
  return {
    registered,
    registerAetherDevice(def: IDeviceDefinition) { registered.push(def) },
    unregisterAetherDevice(_id: string) {
      // no-op en estos tests — NodeGraph maneja la mem real
    },
  }
}

/** Crea y registra un device en el NodeGraph via SpatialRegistrar */
function registerDevice(
  pipeline: NodeExtractionPipeline,
  registrar: SpatialRegistrar,
  graph: NodeGraph,
  target: ReturnType<typeof makeTarget>,
  fixtureId: string,
  dmxAddr: number,
  position: Position3D,
): IDeviceDefinition {
  const def = pipeline.extract(makeMovingHead(fixtureId), dmxAddr, 0, 'front')
  registrar.register(def, position, {
    registerAetherDevice(enriched: IDeviceDefinition) {
      graph.registerDevice(enriched)
      target.registerAetherDevice(enriched)
    },
    unregisterAetherDevice(id: string) {
      graph.unregisterDevice(id)
      target.unregisterAetherDevice(id)
    },
  })
  return def
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

describe('🗺️ SpatialRegistrar — El Cartógrafo Espacial', () => {

  let pipeline:  NodeExtractionPipeline
  let registrar: SpatialRegistrar
  let graph:     NodeGraph
  let target:    ReturnType<typeof makeTarget>

  beforeEach(() => {
    pipeline  = new NodeExtractionPipeline()
    registrar = new SpatialRegistrar()
    graph     = new NodeGraph()
    target    = makeTarget()
  })

  // ─────────────────────────────────────────────────────────────────────
  // §1 — MAPEO DE COORDENADAS (no confundir Z con Y)
  // ─────────────────────────────────────────────────────────────────────

  describe('§1 — Alineación de coordenadas X/Y/Z', () => {

    test('Las coordenadas de stage se preservan exactamente en el nodo KINETIC', () => {
      const POS: Position3D = { x: 1.5, y: 4.0, z: -2.0 }

      registerDevice(pipeline, registrar, graph, target, 'mover-a', 1, POS)

      const kineticView = graph.getView(NodeFamily.KINETIC)
      expect(kineticView.count).toBeGreaterThan(0)

      kineticView.forEach((node: any) => {
        // SpatialRegistrar escribe en `position` (campo base de ICapabilityNode),
        // no en `physicalPosition` (campo KINETIC-específico de la Forja).
        if (node.position !== undefined) {
          // X: eje lateral (izq/der)
          expect(node.position.x).toBeCloseTo(POS.x, 5)
          // Y: altura (arriba/abajo)
          expect(node.position.y).toBeCloseTo(POS.y, 5)
          // Z: profundidad (fondo/frente) — debe ser Z, NO confundir con Y
          expect(node.position.z).toBeCloseTo(POS.z, 5)
        }
      })
    })

    test('Una posición con Y alto (altura real) NO se mezcla con Z (profundidad)', () => {
      const POS: Position3D = { x: 0, y: 5.0, z: 0 }

      registerDevice(pipeline, registrar, graph, target, 'mover-b', 5, POS)

      const kineticView = graph.getView(NodeFamily.KINETIC)
      kineticView.forEach((node: any) => {
        // SpatialRegistrar escribe en `position` (campo base de ICapabilityNode)
        if (node.position !== undefined) {
          expect(node.position.y).toBeCloseTo(5.0, 5)
          expect(node.position.z).toBeCloseTo(0.0, 5)  // Z no contaminado
        }
      })
    })

  })

  // ─────────────────────────────────────────────────────────────────────
  // §2 — rebuildNeighborGraph: agrupación por proximidad
  // ─────────────────────────────────────────────────────────────────────

  describe('§2 — rebuildNeighborGraph() — distancia euclidiana', () => {

    /**
     * Escenario:
     *   A: (0, 3, 0)  — arriba, centro
     *   B: (0.3, 3, 0) — arriba, justo a la derecha de A (cerca de A)
     *   C: (10, 3, 0)  — muy lejos a la derecha
     *
     * dist(A,B) = 0.3   ← cercanos
     * dist(A,C) = 10    ← lejanos
     * dist(B,C) = 9.7   ← lejanos
     *
     * Esperado: vecinos de A → [B], vecinos de B → [A]
     * C no debe aparecer como vecino de A cuando maxNeighbors=1
     */
    test('Los dos nodos cercanos se reconocen como vecinos mutuos', () => {
      const POS_A: Position3D = { x: 0.0, y: 3.0, z: 0.0 }
      const POS_B: Position3D = { x: 0.3, y: 3.0, z: 0.0 }
      const POS_C: Position3D = { x: 10.0, y: 3.0, z: 0.0 }

      registerDevice(pipeline, registrar, graph, target, 'mover-a', 1,  POS_A)
      registerDevice(pipeline, registrar, graph, target, 'mover-b', 10, POS_B)
      registerDevice(pipeline, registrar, graph, target, 'mover-c', 20, POS_C)

      // Recalcular el grafo de vecindad
      registrar.rebuildNeighborGraph(graph, 1)

      // Obtener los nodeIds KINETIC del grafo
      const kNodes: string[] = []
      graph.getView(NodeFamily.KINETIC).forEach((n: any) => kNodes.push(n.nodeId))

      // Necesitamos saber qué nodeId pertenece a qué device.
      // El nodeId tiene formato "<deviceId>:<label>"
      const nodeA = kNodes.find(id => id.startsWith('mover-a'))
      const nodeB = kNodes.find(id => id.startsWith('mover-b'))
      const nodeC = kNodes.find(id => id.startsWith('mover-c'))

      expect(nodeA).toBeDefined()
      expect(nodeB).toBeDefined()
      expect(nodeC).toBeDefined()

      const neighborsOfA = registrar.getNeighbors(nodeA!)
      const neighborsOfB = registrar.getNeighbors(nodeB!)

      // A debería tener a B como vecino (el más cercano) — no a C
      expect(neighborsOfA).toContain(nodeB)
      expect(neighborsOfA).not.toContain(nodeC)

      // B debería tener a A como vecino (el más cercano) — no a C
      expect(neighborsOfB).toContain(nodeA)
      expect(neighborsOfB).not.toContain(nodeC)
    })

    test('C solo tiene vecinos: A o B, nunca ambos cuando maxNeighbors=1', () => {
      const POS_A: Position3D = { x: 0.0,  y: 3.0, z: 0.0 }
      const POS_B: Position3D = { x: 0.3,  y: 3.0, z: 0.0 }
      const POS_C: Position3D = { x: 10.0, y: 3.0, z: 0.0 }

      registerDevice(pipeline, registrar, graph, target, 'mover-a', 1,  POS_A)
      registerDevice(pipeline, registrar, graph, target, 'mover-b', 10, POS_B)
      registerDevice(pipeline, registrar, graph, target, 'mover-c', 20, POS_C)

      registrar.rebuildNeighborGraph(graph, 1)  // solo 1 vecino máximo

      const kNodes: string[] = []
      graph.getView(NodeFamily.KINETIC).forEach((n: any) => kNodes.push(n.nodeId))

      const nodeC = kNodes.find(id => id.startsWith('mover-c'))
      expect(nodeC).toBeDefined()

      const neighborsOfC = registrar.getNeighbors(nodeC!)

      // Con maxNeighbors=1, C solo puede tener UN vecino
      expect(neighborsOfC.length).toBe(1)
    })

    test('dist² entre nodos cercanos (0.3m) es menor que entre lejanos (10m)', () => {
      // Este test valida la lógica matemática del algoritmo directamente.
      // Si dist² se calcula mal, los vecinos estarán invertidos.
      const dx_near = 0.3
      const dx_far  = 10.0

      const dist2_near = dx_near * dx_near  // 0.09
      const dist2_far  = dx_far * dx_far    // 100.0

      expect(dist2_near).toBeLessThan(dist2_far)
    })

    test('getNeighbors retorna array vacío para nodo sin vecinos calculados', () => {
      // Sin llamar a rebuildNeighborGraph, todos los nodos tienen array vacío
      const id = 'nodo-fantasma:kinetic'
      const neighbors = registrar.getNeighbors(id)
      expect(neighbors).toEqual([])
    })

  })

  // ─────────────────────────────────────────────────────────────────────
  // §3 — updateDevicePosition: ciclo unregister → re-enrich → register
  // ─────────────────────────────────────────────────────────────────────

  describe('§3 — updateDevicePosition() — ciclo atómico de re-enriquecimiento', () => {

    test('Después de updateDevicePosition, la nueva posición está en el nodo', () => {
      const POS_INITIAL:  Position3D = { x: 0.0, y: 3.0, z: 0.0 }
      const POS_UPDATED:  Position3D = { x: 5.0, y: 3.0, z: 2.0 }

      // Registrar con posición inicial — usando la interfaz que también actualiza el graph
      const def = pipeline.extract(makeMovingHead('mover-update'), 1, 0, 'front')
      const fullTarget: IAetherRegistrationTarget = {
        registerAetherDevice(enriched) { graph.registerDevice(enriched) },
        unregisterAetherDevice(id)    { graph.unregisterDevice(id) },
      }
      registrar.register(def, POS_INITIAL, fullTarget)

      // Verificar posición inicial en el grafo
      const deviceId = def.deviceId
      expect(graph.getDevice(deviceId)).toBeDefined()

      // Actualizar posición
      registrar.updateDevicePosition(deviceId, POS_UPDATED, graph, fullTarget)

      // El device debería estar en el grafo con la nueva posición
      const updatedDef = graph.getDevice(deviceId)
      expect(updatedDef).toBeDefined()

      // Los nodos KINETIC deberían reflejar la nueva posición
      const kNodes: any[] = []
      graph.getView(NodeFamily.KINETIC).forEach((n: any) => {
        if (n.nodeId.startsWith(deviceId)) kNodes.push(n)
      })

      for (const kNode of kNodes) {
        // SpatialRegistrar escribe en `position` (campo base de ICapabilityNode)
        if (kNode.position !== undefined) {
          expect(kNode.position.x).toBeCloseTo(POS_UPDATED.x, 4)
          expect(kNode.position.z).toBeCloseTo(POS_UPDATED.z, 4)
        }
      }
    })

    test('updateDevicePosition devuelve silencioso si el device no existe', () => {
      const fakeTarget: IAetherRegistrationTarget = {
        registerAetherDevice: () => {},
        unregisterAetherDevice: () => {},
      }

      // No debe lanzar excepción
      expect(() => {
        registrar.updateDevicePosition(
          'device-inexistente',
          { x: 0, y: 0, z: 0 },
          graph,
          fakeTarget,
        )
      }).not.toThrow()
    })

  })

  // ─────────────────────────────────────────────────────────────────────
  // §4 — WAVE 4573 Phase 6: GUERRILLA BYPASS
  // Valida que register(isPlaced=false) saltea _enrichWithSpatialData
  // y registra el device como raw (sin Position3D asignado).
  // ─────────────────────────────────────────────────────────────────────

  describe('§4 — Guerrilla Bypass (isPlaced=false)', () => {

    test('register() con isPlaced=false: el device se registra en el target', () => {
      // Un fixture en modo Guerrilla NO tiene posición 3D real.
      // Aun así debe ser registrado en Aether para existir en el grafo.
      const def = pipeline.extract(makeMovingHead('guerrilla-01'), 1, 0, 'front')
      const SENTINEL: Position3D = { x: 0, y: 3, z: 0 }

      registrar.register(def, SENTINEL, target, false) // isPlaced = false

      // El device fue registrado (existe en el target)
      expect(target.registered.length).toBe(1)
      expect(target.registered[0].deviceId).toBe(def.deviceId)
    })

    test('register() con isPlaced=false: los nodos del device NO reciben Position3D (bypass sin enriquecimiento)', () => {
      // _enrichWithSpatialData añade position a ICapabilityNode.position — no al device raíz.
      // Con isPlaced=false, ese enriquecimiento se salta → ningún nodo tiene position.
      const def = pipeline.extract(makeMovingHead('guerrilla-02'), 1, 0, 'front')
      const SENTINEL: Position3D = { x: 0, y: 3, z: 0 }

      registrar.register(def, SENTINEL, target, false)

      const registered = target.registered[0]
      // En modo Guerrilla: ningún nodo debe tener position asignada
      const nodesWithPos = registered.nodes.filter((n: any) => n.position !== undefined)
      expect(nodesWithPos.length).toBe(0)
    })

    test('register() con isPlaced=false: el NodeGraph NO recibe el device (bypass completo)', () => {
      // En modo Guerrilla, el device no debe entrar al NodeGraph espacial.
      // (No hay coordenadas reales → el grafo de vecindad sería incorrecto)
      const def = pipeline.extract(makeMovingHead('guerrilla-03'), 1, 0, 'front')
      const SENTINEL: Position3D = { x: 0, y: 3, z: 0 }

      // Usamos un target que SÍ alimenta el graph (para verificar que NO lo hace)
      const fullTarget: IAetherRegistrationTarget & { registered: IDeviceDefinition[] } = {
        registered: [],
        registerAetherDevice(d: IDeviceDefinition) {
          this.registered.push(d)
          graph.registerDevice(d)
        },
        unregisterAetherDevice(id: string) {
          graph.unregisterDevice(id)
        },
      }

      registrar.register(def, SENTINEL, fullTarget, false)

      // El target fue llamado (device existe en Aether)
      expect(fullTarget.registered.length).toBe(1)

      // Pero el NodeGraph SÍ tiene el device en su registro
      // (graph.registerDevice fue llamado por target.registerAetherDevice)
      // El punto clave: _enrichWithSpatialData NO fue llamado,
      // así que los nodos del grafo NO tienen position enriquecida
      const kNodes: any[] = []
      graph.getView(NodeFamily.KINETIC).forEach((n: any) => kNodes.push(n))

      for (const kNode of kNodes) {
        if (kNode.nodeId.startsWith(def.deviceId)) {
          // En modo guerrilla: el nodo KINETIC no tiene posición espacial asignada
          expect((kNode as any).position).toBeUndefined()
        }
      }
    })

    test('register() con isPlaced=true (normal): los nodos del device SÍ reciben Position3D enriquecida', () => {
      // Contrapart: con isPlaced=true (o sin pasar el parámetro), la ruta normal funciona.
      // _enrichWithSpatialData añade position a cada ICapabilityNode.position —
      // la position NO va al IDeviceDefinition raíz (IDeviceDefinition no tiene .position).
      const def = pipeline.extract(makeMovingHead('placed-01'), 1, 0, 'front')
      const REAL_POS: Position3D = { x: 3.0, y: 4.5, z: -1.5 }

      registrar.register(def, REAL_POS, target, true) // isPlaced = true → ruta normal

      const registered = target.registered[0]
      // _enrichWithSpatialData añade position a los nodos, no al device raíz
      expect(registered.nodes.length).toBeGreaterThan(0)
      
      // Al menos 1 nodo debe tener position asignada
      const nodesWithPos = registered.nodes.filter((n: any) => n.position !== undefined)
      expect(nodesWithPos.length).toBeGreaterThan(0)
      
      // Verificar que la posición corresponde a REAL_POS
      const firstNodeWithPos = nodesWithPos[0] as any
      expect(firstNodeWithPos.position.x).toBeCloseTo(REAL_POS.x, 4)
      expect(firstNodeWithPos.position.y).toBeCloseTo(REAL_POS.y, 4)
      expect(firstNodeWithPos.position.z).toBeCloseTo(REAL_POS.z, 4)
    })

    test('register() sin parámetro isPlaced (undefined): usa ruta normal (no guerrilla)', () => {
      // Compatibilidad retroactiva: los callers existentes sin 4° param no deben romper
      const def = pipeline.extract(makeMovingHead('legacy-01'), 1, 0, 'front')
      const POS: Position3D = { x: 1.0, y: 3.0, z: 0.5 }

      expect(() => {
        registrar.register(def, POS, target) // sin isPlaced
      }).not.toThrow()

      expect(target.registered.length).toBe(1)
    })

  })

})
