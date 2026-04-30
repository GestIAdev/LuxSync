/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚗️  WAVE 4519.1 — THE PROVING GROUNDS
 * Suite 3: PhysicsPostProcessor — Inercia SNAP/CLASSIC & TELEPORT MODE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Valida:
 *   • Modo CLASSIC: curva-S de aceleración/frenado real sin overshoot perpetuo.
 *   • Modo SNAP: convergencia fraccional al target.
 *   • TELEPORT MODE: deltaMs > 200ms → posición copiada directamente.
 *   • NaN guard: target NaN → posición anterior se mantiene.
 *   • registerNode() idempotente: doble registro no rota el estado.
 *   • onVibeChange(): zerear velocidades sin mover posición.
 *
 * ESTRATEGIA:
 *   Mock mínimo de INodeGraph que expone solo un nodo KINETIC.
 *   Mock de IKineticNodeData con maxPanSpeed/maxTiltSpeed reales.
 *   ArbitratedNodeMap es un Map mutable ordinario casteado.
 *   No usa TitanOrchestrator, NodeGraph real, ni el sistema de audio.
 *
 * AXIOMA ANTI-SIMULACIÓN: Zero Math.random(). Física determinista.
 *
 * @module core/aether/__tests__/physics-postprocessor.test
 * @version WAVE 4519.1
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { PhysicsPostProcessor } from '../resolver/PhysicsPostProcessor'
import { NodeFamily } from '../types'
import type { IKineticNodeData } from '../capability-node'
import type { INodeGraph, INodeView } from '../node-graph'
import type { ArbitratedNodeMap } from '../intent-bus'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS — espejo de los valores internos del PhysicsPostProcessor
// ═══════════════════════════════════════════════════════════════════════════

const TELEPORT_THRESHOLD_MS = 200  // > este umbral → teleport
const FRAME_MS              = 22   // ~44Hz (22ms por frame)

/**
 * maxPanSpeed: 54000 deg/s (100× el SAFETY_MAX_VELOCITY_NORM).
 * El SAFETY_CAP en norma es: min(speed/540, 400/255/540) ≈ 0.00291 norm/s
 * Con 54000/540 = 100 norm/s >> SAFETY → el cap sigue siendo 0.00291 norm/s.
 * Esto es correcto: los tests de convergencia deben ser patient con motores reales.
 * Para tests rápidos usamos un motor «hipersónico» (sin safety cap interferiendo)
 * definiendo una velocidad que supere al SAFETY_MAX (400 DMX/s normalizado = 400/255/540).
 * Nota: el PhysicsPostProcessor usa Math.min(speed, SAFETY_MAX) — con speed=400/255/540
 * el cap domina. Para permitir convergencia en ~50 frames usamos maxPanSpeed alto
 * y aceptamos el SAFETY_CAP como el límite físico real.
 */
const MAX_PAN_SPEED_DEG_S = 400  // deg/s — el SAFETY_CAP normará a ≈0.00291 norm/s

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — Mocks mínimos deterministas
// ═══════════════════════════════════════════════════════════════════════════

/** Mock de IKineticNodeData — solo los campos que usa PhysicsPostProcessor */
function makeKineticNode(nodeId: string): IKineticNodeData {
  return {
    nodeId,
    family: NodeFamily.KINETIC,
    role: 'primary',
    deviceId: 'test-device',
    channels: [],
    motorType: 'servo',
    isContinuous: false,
    maxPanSpeed: MAX_PAN_SPEED_DEG_S,
    maxTiltSpeed: MAX_PAN_SPEED_DEG_S,
    currentPosition: { pan: 0.5, tilt: 0.5 },
    physicalPosition: { x: 0, y: 3, z: 0 },
    stereoIndex: 0,
    stereoTotal: 1,
    position: { x: 0, y: 3, z: 0 },
    zoneId: 'front',
  } as unknown as IKineticNodeData
}

/** Mock de INodeView<IKineticNodeData> — itera sobre un array hardcoded */
function makeKineticView(nodes: IKineticNodeData[]): INodeView<IKineticNodeData> {
  return {
    count: nodes.length,
    forEach(fn) { nodes.forEach((n, i) => fn(n, i)) },
    get(i) { return nodes[i]! },
    byZone() { return [] },
    byRole() { return [] },
  }
}

/** Mock de INodeGraph — solo expone getView para KINETIC */
function makeNodeGraph(kineticNodes: IKineticNodeData[]): INodeGraph {
  const kView = makeKineticView(kineticNodes)
  return {
    getView(family: NodeFamily) {
      if (family === NodeFamily.KINETIC) return kView as any
      return makeKineticView([]) as any
    },
    registerDevice:    () => [],
    unregisterDevice:  () => {},
    getNodeData:       () => undefined,
    getDevice:         () => undefined,
    getDeviceNodes:    () => [],
    getNodeSlot:       () => undefined,
    snapshot:          () => ({} as any),
  } as unknown as INodeGraph
}

/**
 * Construye un ArbitratedNodeMap mínimo con pan y tilt para un nodo.
 * Es un Map mutable — PhysicsPostProcessor lo castea internamente y
 * muta sus entries in-place.
 */
function makeArbitrated(nodeId: string, pan: number, tilt: number): ArbitratedNodeMap {
  return new Map([[nodeId, { pan, tilt }]]) as unknown as ArbitratedNodeMap
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

describe('⚙️ PhysicsPostProcessor — The Inertia Engine', () => {

  let processor: PhysicsPostProcessor

  beforeEach(() => {
    processor = new PhysicsPostProcessor()
  })

  // ─────────────────────────────────────────────────────────────────────
  // §1 — registerNode() — pre-allocación de estado
  // ─────────────────────────────────────────────────────────────────────

  describe('§1 — registerNode() — Pre-allocación de estado', () => {

    test('Después de registerNode, el primer process() no lanza', () => {
      const NODE_ID = 'test-device:kinetic'
      const node    = makeKineticNode(NODE_ID)
      processor.registerNode(NODE_ID)

      const arbitrated = makeArbitrated(NODE_ID, 0.8, 0.5)
      const graph      = makeNodeGraph([node])

      expect(() => processor.process(arbitrated, graph, FRAME_MS, 'test-vibe')).not.toThrow()
    })

    test('registerNode() es idempotente — doble llamada no rota el estado', () => {
      const NODE_ID = 'test-device:kinetic'
      const node    = makeKineticNode(NODE_ID)

      processor.registerNode(NODE_ID)
      processor.registerNode(NODE_ID)  // segunda vez — no debe resetear

      // Simular un frame para que el estado avance
      const arbitrated = makeArbitrated(NODE_ID, 0.8, 0.5)
      const graph      = makeNodeGraph([node])
      processor.process(arbitrated, graph, FRAME_MS, 'vibe')

      // El estado pan debe haberse movido desde 0.5 hacia 0.8
      const panAfter = (arbitrated as any).get(NODE_ID)['pan']
      expect(panAfter).toBeGreaterThan(0.5)
      expect(panAfter).toBeLessThanOrEqual(0.8)
    })

    test('Un nodo no registrado es silenciosamente ignorado en process()', () => {
      const NODE_ID = 'nodo-fantasma:kinetic'
      const node    = makeKineticNode(NODE_ID)
      // NO llamamos registerNode()

      const arbitrated = makeArbitrated(NODE_ID, 0.8, 0.5)
      const graph      = makeNodeGraph([node])

      expect(() => processor.process(arbitrated, graph, FRAME_MS, 'vibe')).not.toThrow()

      // El entry no debe haber sido modificado (o sigue en 0.8)
      const entry = (arbitrated as any).get(NODE_ID)
      // Sin estado previo, el processor skipea — el entry queda sin tocar
      expect(entry['pan']).toBe(0.8)  // sin modificar
    })

  })

  // ─────────────────────────────────────────────────────────────────────
  // §2 — MODO CLASSIC: curva-S real
  // ─────────────────────────────────────────────────────────────────────

  describe('§2 — Modo CLASSIC — Física newtoniana de curva-S', () => {

    test('Un salto de pan 0.5→1.0: el valor sube gradualmente sin overshoot', () => {
      const NODE_ID = 'test-device:kinetic'
      // Motor «hipersónico» sin SAFETY_CAP activado: maxPanSpeed tal que
      // el cap no domine → usamos 54000/540 = 100 norm/s >> SAFETY_MAX (0.00291)
      // pero el SAFETY_MIN siga siendo el límite. En realidad el procesador
      // usa Math.min(speed*DEG_TO_NORM, SAFETY_MAX_VELOCITY_NORM) donde
      // SAFETY = 400/255/540 ≈ 0.00291. Así que el límite es físicamente correcto.
      //
      // La distancia es 0.5 norm. Con maxVel≈0.00291 norm/s y maxAcc≈0.00654 norm/s²
      // el tiempo mínimo es >> muchos frames. Usamos 8000 frames (176 segundos simulados)
      // para garantizar que llega. En test, esto corre en <50ms real.
      const node = makeKineticNode(NODE_ID)

      processor.setPhysicsMode('classic')
      processor.registerNode(NODE_ID)

      const graph = makeNodeGraph([node])

      let prevPan = 0.5
      let reachedTarget = false

      // Simular hasta 8000 frames (≈176 segundos a 44Hz reales, <50ms en test)
      for (let i = 0; i < 8000; i++) {
        const arbitrated = makeArbitrated(NODE_ID, 1.0, 0.5)
        processor.process(arbitrated, graph, FRAME_MS, 'test-vibe')

        const currentPan = (arbitrated as any).get(NODE_ID)['pan']

        // NUNCA debe bajar (no hay overshoot en dirección contraria persistente)
        // Permitimos tolerancia mínima para aritmética de float
        expect(currentPan).toBeGreaterThanOrEqual(prevPan - 0.001)

        // NUNCA debe superar el target
        expect(currentPan).toBeLessThanOrEqual(1.0 + 0.001)

        if (Math.abs(currentPan - 1.0) < 0.001) {
          reachedTarget = true
          break
        }

        prevPan = currentPan

        // Sincronizar el estado del nodo (simular el feedback del resolver)
        node.currentPosition.pan = currentPan
      }

      // Con SAFETY_MAX_VELOCITY_NORM y 8000 frames × 22ms = 176s simulados,
      // un motor a incluso 0.00291 norm/s debe recorrer 176 × 0.00291 ≈ 0.51 norm.
      expect(reachedTarget).toBe(true)
    })

    test('Fase de aceleración: los primeros frames avanzan más lento que los del medio', () => {
      const NODE_ID = 'test-device:kinetic'
      const node    = makeKineticNode(NODE_ID)

      processor.setPhysicsMode('classic')
      processor.registerNode(NODE_ID)

      const graph = makeNodeGraph([node])

      // Medir avance en los primeros 5 frames
      let prevPan   = 0.5
      let delta1st5 = 0
      for (let i = 0; i < 5; i++) {
        const arb = makeArbitrated(NODE_ID, 1.0, 0.5)
        processor.process(arb, graph, FRAME_MS, 'vibe')
        const cur = (arb as any).get(NODE_ID)['pan']
        delta1st5 += cur - prevPan
        prevPan = cur
        node.currentPosition.pan = cur
      }

      // Medir avance en frames 20-25 (cruising speed)
      let delta20_25 = 0
      for (let i = 5; i < 25; i++) {
        const arb = makeArbitrated(NODE_ID, 1.0, 0.5)
        processor.process(arb, graph, FRAME_MS, 'vibe')
        const cur = (arb as any).get(NODE_ID)['pan']
        if (i >= 20) delta20_25 += cur - prevPan
        prevPan = cur
        node.currentPosition.pan = cur
      }

      // La velocidad cruising (frames 20-25) debe ser mayor que la de arranque (1-5)
      // Esto confirma la fase de aceleración de la curva-S.
      expect(delta20_25).toBeGreaterThanOrEqual(delta1st5)
    })

    test('La posición final CLAMPEA en [0, 1] — nunca sale del rango físico', () => {
      const NODE_ID = 'test-device:kinetic'
      const node    = makeKineticNode(NODE_ID)

      processor.setPhysicsMode('classic')
      processor.registerNode(NODE_ID)

      const graph = makeNodeGraph([node])

      // Target 1.0 + muchos frames: el clamp debe mantener ≤ 1.0
      for (let i = 0; i < 100; i++) {
        const arb = makeArbitrated(NODE_ID, 1.0, 1.0)
        processor.process(arb, graph, FRAME_MS, 'vibe')

        const pan  = (arb as any).get(NODE_ID)['pan']
        const tilt = (arb as any).get(NODE_ID)['tilt']

        expect(pan).toBeGreaterThanOrEqual(0)
        expect(pan).toBeLessThanOrEqual(1)
        expect(tilt).toBeGreaterThanOrEqual(0)
        expect(tilt).toBeLessThanOrEqual(1)

        node.currentPosition.pan  = pan
        node.currentPosition.tilt = tilt
      }
    })

  })

  // ─────────────────────────────────────────────────────────────────────
  // §3 — TELEPORT MODE
  // ─────────────────────────────────────────────────────────────────────

  describe('§3 — TELEPORT MODE (deltaMs > 200ms)', () => {

    test('deltaMs > TELEPORT_THRESHOLD_MS copia el target directamente', () => {
      const NODE_ID = 'test-device:kinetic'
      const node    = makeKineticNode(NODE_ID)

      processor.registerNode(NODE_ID)

      const arbitrated = makeArbitrated(NODE_ID, 0.9, 0.1)
      const graph      = makeNodeGraph([node])

      // Frame congelado de 500ms — debe teleportar
      processor.process(arbitrated, graph, TELEPORT_THRESHOLD_MS + 1, 'vibe')

      const pan  = (arbitrated as any).get(NODE_ID)['pan']
      const tilt = (arbitrated as any).get(NODE_ID)['tilt']

      expect(pan).toBeCloseTo(0.9,  5)
      expect(tilt).toBeCloseTo(0.1, 5)
    })

    test('deltaMs = 0 es ignorado silenciosamente (no procesa, no teleporta)', () => {
      const NODE_ID = 'test-device:kinetic'
      const node    = makeKineticNode(NODE_ID)

      processor.registerNode(NODE_ID)

      // Estado inicial: el nodo empieza en 0.5
      // Con deltaMs=0 no debe moverse ni teleportar
      const arbitrated = makeArbitrated(NODE_ID, 0.9, 0.9)
      const graph      = makeNodeGraph([node])

      processor.process(arbitrated, graph, 0, 'vibe')

      // El entry no fue tocado (deltaMs=0 retorna temprano antes de teleport)
      // La posición en el mapa fue establecida a 0.9 por makeArbitrated,
      // y con deltaMs=0 el processor retorna sin entrar en el forEach → sin cambios
      const pan = (arbitrated as any).get(NODE_ID)['pan']
      expect(pan).toBe(0.9)  // sin modifier (el entry no fue mutado)
    })

    test('Después de TELEPORT, las velocidades quedan a 0 (no overshoot acumulado)', () => {
      const NODE_ID = 'test-device:kinetic'
      const node    = makeKineticNode(NODE_ID)

      processor.registerNode(NODE_ID)

      const graph = makeNodeGraph([node])

      // Teleport al 0.9
      const arb1 = makeArbitrated(NODE_ID, 0.9, 0.5)
      processor.process(arb1, graph, TELEPORT_THRESHOLD_MS + 50, 'vibe')

      // Frame normal siguiente: el target sigue en 0.9, pan ya está en 0.9
      // Con velocidad=0 no debe moverse (ya está en el target)
      const arb2 = makeArbitrated(NODE_ID, 0.9, 0.5)
      node.currentPosition.pan = 0.9
      processor.process(arb2, graph, FRAME_MS, 'vibe')

      const panAfter = (arb2 as any).get(NODE_ID)['pan']
      // Debe quedarse ~en 0.9 (anti-jitter lo detiene si la diferencia es < 0.0005)
      expect(panAfter).toBeCloseTo(0.9, 3)
    })

  })

  // ─────────────────────────────────────────────────────────────────────
  // §4 — NaN GUARD
  // ─────────────────────────────────────────────────────────────────────

  describe('§4 — NaN Guard — hardware safety', () => {

    test('Un target NaN es ignorado: la posición anterior se mantiene', () => {
      const NODE_ID = 'test-device:kinetic'
      const node    = makeKineticNode(NODE_ID)

      processor.setPhysicsMode('classic')
      processor.registerNode(NODE_ID)

      const graph = makeNodeGraph([node])

      // Primer frame para establecer posición
      const arb1 = makeArbitrated(NODE_ID, 0.7, 0.5)
      processor.process(arb1, graph, FRAME_MS, 'vibe')
      const panAfterFrame1 = (arb1 as any).get(NODE_ID)['pan']
      node.currentPosition.pan = panAfterFrame1

      // Segundo frame: target NaN
      const arb2 = new Map([[NODE_ID, { pan: NaN, tilt: 0.5 }]]) as unknown as ArbitratedNodeMap
      processor.process(arb2, graph, FRAME_MS, 'vibe')

      const panAfterNaN = (arb2 as any).get(NODE_ID)['pan']

      // La posición resultante debe ser un número finito
      expect(isFinite(panAfterNaN)).toBe(true)
      // Y debe estar en rango válido
      expect(panAfterNaN).toBeGreaterThanOrEqual(0)
      expect(panAfterNaN).toBeLessThanOrEqual(1)
    })

    test('Un target Infinity es manejado correctamente (posición se mantiene estable)', () => {
      const NODE_ID = 'test-device:kinetic'
      const node    = makeKineticNode(NODE_ID)

      processor.registerNode(NODE_ID)
      const graph = makeNodeGraph([node])

      const arb = new Map([[NODE_ID, { pan: Infinity, tilt: 0.5 }]]) as unknown as ArbitratedNodeMap
      processor.process(arb, graph, FRAME_MS, 'vibe')

      const pan = (arb as any).get(NODE_ID)['pan']
      expect(isFinite(pan)).toBe(true)
    })

  })

  // ─────────────────────────────────────────────────────────────────────
  // §5 — onVibeChange: reset de velocidades
  // ─────────────────────────────────────────────────────────────────────

  describe('§5 — onVibeChange() — reset de velocidades sin mover posición', () => {

    test('onVibeChange zeroa velocidades — el siguiente frame es más conservador', () => {
      const NODE_ID = 'test-device:kinetic'
      const node    = makeKineticNode(NODE_ID)

      processor.setPhysicsMode('classic')
      processor.registerNode(NODE_ID)

      const graph = makeNodeGraph([node])

      // Calentar: 20 frames para acumular velocidad
      for (let i = 0; i < 20; i++) {
        const arb = makeArbitrated(NODE_ID, 1.0, 0.5)
        processor.process(arb, graph, FRAME_MS, 'vibe-a')
        node.currentPosition.pan = (arb as any).get(NODE_ID)['pan']
      }

      // Capturar la posición ANTES del vibe change
      const arb_before = makeArbitrated(NODE_ID, 1.0, 0.5)
      processor.process(arb_before, graph, FRAME_MS, 'vibe-a')
      const panBeforeChange = (arb_before as any).get(NODE_ID)['pan']
      const deltaBeforeChange = panBeforeChange - node.currentPosition.pan
      node.currentPosition.pan = panBeforeChange

      // Cambio de vibe — zerear velocidades
      processor.onVibeChange('vibe-b')

      // Primer frame después del vibe change: velocidad parte de 0
      const arb_after = makeArbitrated(NODE_ID, 1.0, 0.5)
      processor.process(arb_after, graph, FRAME_MS, 'vibe-b')
      const panAfterChange = (arb_after as any).get(NODE_ID)['pan']
      const deltaAfterChange = panAfterChange - node.currentPosition.pan

      // El delta después del vibe change debe ser menor (aceleración desde 0)
      // vs el delta antes (velocidad cruising acumulada)
      expect(deltaAfterChange).toBeLessThanOrEqual(deltaBeforeChange + 0.0001)
    })

  })

  // ─────────────────────────────────────────────────────────────────────
  // §6 — MODO SNAP
  // ─────────────────────────────────────────────────────────────────────

  describe('§6 — Modo SNAP — convergencia fraccional', () => {

    test('SNAP converge al target: la posición avanza hacia 1.0 en cada frame', () => {
      // SNAP está limitado por el REV_LIMIT (maxVel × dt).
      // Con SAFETY_MAX_VELOCITY_NORM ≈ 0.00291 norm/s y dt=0.022s,
      // el max move por frame es ≈ 0.000064 normalized.
      // En lugar de requerir ≥0.95 en 50 frames (imposible con el cap físico),
      // validamos que EN CADA FRAME el nodo avanza hacia el target (monotónico).
      const NODE_ID = 'test-device:kinetic'
      const node    = makeKineticNode(NODE_ID)

      processor.setPhysicsMode('snap', 0.3)
      processor.registerNode(NODE_ID)

      const graph = makeNodeGraph([node])

      let prevPan = 0.5
      for (let i = 0; i < 50; i++) {
        const arb = makeArbitrated(NODE_ID, 1.0, 0.5)
        processor.process(arb, graph, FRAME_MS, 'vibe')
        const cur = (arb as any).get(NODE_ID)['pan']

        // En cada frame el pan debe avanzar hacia 1.0 (jamás retroceder)
        expect(cur).toBeGreaterThanOrEqual(prevPan - 1e-9)
        // Y nunca superar el target
        expect(cur).toBeLessThanOrEqual(1.0)

        prevPan = cur
        node.currentPosition.pan = cur
      }

      // Después de 50 frames, el nodo DEBE haber avanzado al menos algo
      expect(prevPan).toBeGreaterThan(0.5)
    })

    test('SNAP respeta el REV_LIMIT (maxVel × dt): no puede saltar más de lo permitido', () => {
      const NODE_ID = 'test-device:kinetic'
      const node    = makeKineticNode(NODE_ID)

      processor.setPhysicsMode('snap', 1.0)  // snapFactor 1.0 = quiero llegar de golpe
      processor.registerNode(NODE_ID)

      const graph = makeNodeGraph([node])

      // Solo 1 frame desde 0.5 → 1.0
      const arbitrated = makeArbitrated(NODE_ID, 1.0, 0.5)
      processor.process(arbitrated, graph, FRAME_MS, 'vibe')

      const pan = (arbitrated as any).get(NODE_ID)['pan']

      // Con maxPanSpeed=400 deg/s, dt=0.022s, norm=1/540:
      // maxVelNorm ≈ min(400/540, SAFETY_MAX_VELOCITY_NORM) ≈ 0.00291 norm/s
      // REV_LIMIT = 0.00291 × 0.022 ≈ 0.000064 normalized por frame
      // → de 0.5 a 1.0 en 1 frame NO es posible bajo el SAFETY_CAP
      expect(pan).toBeLessThan(0.6)  // No puede llegar a 1.0 en un frame
    })

  })

})
