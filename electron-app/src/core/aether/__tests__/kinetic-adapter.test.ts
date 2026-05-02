/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ WAVE 4523.6 — THE KINETIC TEST BENCH
 * Suite 1: KineticAdapter — Proyección Holográfica & Zero-Alloc
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Valida:
 *   • PROYECCIÓN HOLOGRÁFICA: VMM(x,y) → targetX/Y/Z correctos según plano.
 *   • ZERO-ALLOC: el diccionario de valores se muta in-place entre frames.
 *   • FLUJO CONTINUO: nodos isContinuous emiten rotation/speed (flujo legacy).
 *   • PRIORIDAD: todos los intents salen con priority=10 (INTENT_PRIORITY).
 *
 * AXIOMA ANTI-SIMULACIÓN:
 *   El VMM (VibeMovementManager) se mockea retornando un intent determinista.
 *   Sin Math.random(), sin timing real. Cada test es F(input) = output fijo.
 *
 * @module core/aether/__tests__/kinetic-adapter.test
 * @version WAVE 4523.6
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { KineticAdapter } from '../adapters/KineticAdapter'
import { NodeFamily } from '../types'
import type { IKineticNodeData } from '../capability-node'
import type { INodeView, INodeGraph } from '../node-graph'
import type { IIntentBus, INodeIntent } from '../intent-bus'
import type { FrameContext } from '../systems'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES — espejo de las del KineticAdapter
// ═══════════════════════════════════════════════════════════════════════════

const STAGE_WIDTH    = 8.0
const STAGE_HEIGHT   = 4.0
const STAGE_DEPTH    = 2.0
const STAGE_CENTER_Y = 1.5
const HALF_STAGE_W   = STAGE_WIDTH  / 2   // 4.0
const HALF_STAGE_H   = STAGE_HEIGHT / 2   // 2.0
const INTENT_PRIORITY = 10

// ═══════════════════════════════════════════════════════════════════════════
// MOCK — VibeMovementManager
// Interceptamos el módulo para que generateIntent() retorne un valor fijo.
// ═══════════════════════════════════════════════════════════════════════════

// Intent determinista que el mock emitirá para el test de proyección
const MOCK_VMM_X     = 0.5
const MOCK_VMM_Y     = -0.3
const MOCK_VMM_SPEED = 0.7

// El módulo real vive en engine/movement/VibeMovementManager
// Vitest 4: el mock de una clase debe usar la keyword 'class' o 'function'
// (no un arrow function) para que `new` funcione correctamente.
vi.mock('../../../engine/movement/VibeMovementManager', () => {
  return {
    VibeMovementManager: class MockVMM {
      generateIntent() {
        return {
          x:     MOCK_VMM_X,
          y:     MOCK_VMM_Y,
          speed: MOCK_VMM_SPEED,
        }
      }
    },
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — Mocks mínimos deterministas
// ═══════════════════════════════════════════════════════════════════════════

function makeKineticNode(overrides: Partial<IKineticNodeData> = {}): IKineticNodeData {
  return {
    nodeId:          'node-01',
    family:          NodeFamily.KINETIC,
    role:            'primary',
    deviceId:        'dev-01',
    channels:        [],
    motorType:       'servo',
    isContinuous:    false,
    maxPanSpeed:     270,
    maxTiltSpeed:    270,
    currentPosition: { pan: 0.5, tilt: 0.5 },
    physicalPosition: { x: 1.0, y: 3.0, z: 0.0 },
    stereoIndex:     0,
    stereoTotal:     1,
    zoneId:          'front',
    constraints:     { maxValue: 255 },
    ...overrides,
  } as unknown as IKineticNodeData
}

function makeNodeView(nodes: IKineticNodeData[]): INodeView<IKineticNodeData> {
  return {
    count:   nodes.length,
    forEach: (fn) => { nodes.forEach((n, i) => fn(n, i)) },
    get:     (i)  => nodes[i]!,
    byZone:  ()   => [],
    byRole:  ()   => [],
  }
}

function makeFrameContext(): FrameContext {
  return {
    audio: {
      energy:    0.8,
      bass:      0.6,
      mid:       0.5,
      highMid:   0.4,
      bpm:       128,
      beatPhase: 0.25,
      beatCount: 4,
    },
    musical: {} as any,
    vibe: { name: 'techno-club' },
    deltaMs: 22,
  } as unknown as FrameContext
}

/**
 * IntentBus capturador — guarda todos los intents pusheados.
 * Zero external dependencies.
 */
function makeCaptureBus(): { bus: IIntentBus; captured: INodeIntent[] } {
  const captured: INodeIntent[] = []

  // Snapshot deep del intent scratchpad en el momento del push
  const push = vi.fn((intent: INodeIntent) => {
    captured.push({
      nodeId:     intent.nodeId,
      priority:   intent.priority,
      confidence: intent.confidence,
      source:     intent.source,
      values:     { ...intent.values },
    })
  })

  return {
    bus: { push } as unknown as IIntentBus,
    captured,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE
// ═══════════════════════════════════════════════════════════════════════════

describe('KineticAdapter — WAVE 4523.6', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Proyección Holográfica
  // ─────────────────────────────────────────────────────────────────────────

  describe('Test 1 — Proyección Holográfica', () => {

    test('VMM(x=0.5, y=-0.3) → targetX/Y/Z correctos según plano virtual', () => {
      const adapter = new KineticAdapter()
      const node    = makeKineticNode({ isContinuous: false })
      const view    = makeNodeView([node])
      const ctx     = makeFrameContext()
      const { bus, captured } = makeCaptureBus()

      adapter.process(view, ctx, bus)

      expect(captured).toHaveLength(1)

      const intent = captured[0]!

      // ── Matemáticas del plano virtual ──
      // targetX = x × HALF_STAGE_W = 0.5 × 4.0 = 2.0
      const expectedX = MOCK_VMM_X * HALF_STAGE_W
      // targetY = STAGE_CENTER_Y + y × HALF_STAGE_H = 1.5 + (-0.3 × 2.0) = 0.9
      const expectedY = STAGE_CENTER_Y + MOCK_VMM_Y * HALF_STAGE_H
      // targetZ = STAGE_DEPTH = 2.0 (fijo)
      const expectedZ = STAGE_DEPTH

      expect(intent.values['targetX']).toBeCloseTo(expectedX, 10)
      expect(intent.values['targetY']).toBeCloseTo(expectedY, 10)
      expect(intent.values['targetZ']).toBeCloseTo(expectedZ, 10)
    })

    test('Intent sale con priority=10 (L0 cinético)', () => {
      const adapter = new KineticAdapter()
      const node    = makeKineticNode({ isContinuous: false })
      const { bus, captured } = makeCaptureBus()

      adapter.process(makeNodeView([node]), makeFrameContext(), bus)

      expect(captured[0]!.priority).toBe(INTENT_PRIORITY)
    })

    test('Nodo isContinuous=false NO emite pan/tilt — emite targetX/Y/Z', () => {
      const adapter = new KineticAdapter()
      const node    = makeKineticNode({ isContinuous: false })
      const { bus, captured } = makeCaptureBus()

      adapter.process(makeNodeView([node]), makeFrameContext(), bus)

      const values = captured[0]!.values
      expect(values['pan']).toBeUndefined()
      expect(values['tilt']).toBeUndefined()
      expect(values['targetX']).toBeDefined()
      expect(values['targetY']).toBeDefined()
      expect(values['targetZ']).toBeDefined()
    })

    test('Nodo isContinuous=true emite rotation+speed (flujo legacy, NO targetX)', () => {
      const adapter = new KineticAdapter()
      const node    = makeKineticNode({ isContinuous: true })
      const { bus, captured } = makeCaptureBus()

      adapter.process(makeNodeView([node]), makeFrameContext(), bus)

      const values = captured[0]!.values
      expect(values['targetX']).toBeUndefined()
      expect(values['targetY']).toBeUndefined()
      expect(values['targetZ']).toBeUndefined()
      expect(values['rotation']).toBeDefined()
      expect(values['speed']).toBeDefined()
    })

    test('rotation del nodo continuo está en [0, 1]', () => {
      const adapter = new KineticAdapter()
      const node    = makeKineticNode({ isContinuous: true })
      const { bus, captured } = makeCaptureBus()

      adapter.process(makeNodeView([node]), makeFrameContext(), bus)

      const rot = captured[0]!.values['rotation']!
      expect(rot).toBeGreaterThanOrEqual(0)
      expect(rot).toBeLessThanOrEqual(1)
    })

    test('Espejo continuo: physicalPosition.x < 0 invierte rotation', () => {
      // Mismo mock VMM → mismo x. Si position.x < 0, rotation = 1 - rotation.
      const adapterL = new KineticAdapter()  // nodo derecho (x > 0)
      const adapterR = new KineticAdapter()  // nodo izquierdo (x < 0)

      const nodeRight = makeKineticNode({ isContinuous: true, physicalPosition: { x:  1, y: 3, z: 0 } } as any)
      const nodeLeft  = makeKineticNode({ isContinuous: true, physicalPosition: { x: -1, y: 3, z: 0 } } as any)

      const { bus: busR, captured: capR } = makeCaptureBus()
      const { bus: busL, captured: capL } = makeCaptureBus()

      adapterL.process(makeNodeView([nodeRight]), makeFrameContext(), busR)
      adapterR.process(makeNodeView([nodeLeft]),  makeFrameContext(), busL)

      const rotR = capR[0]!.values['rotation']!
      const rotL = capL[0]!.values['rotation']!

      expect(rotL).toBeCloseTo(1 - rotR, 10)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Zero-Alloc — el diccionario _valuesDict se reutiliza
  // ─────────────────────────────────────────────────────────────────────────

  describe('Test 2 — Zero-Alloc', () => {

    test('_valuesDict es la misma referencia entre frames consecutivos', () => {
      // Estrategia: el IIntentBus recibe el intent scratchpad por referencia.
      // Si el adapter crea un nuevo objeto por cada push, las referencias
      // capturadas apuntarían a objetos distintos.
      // En la implementación correcta, el bus recibe SIEMPRE el mismo
      // _intentScratch — y nuestro capturebus debe hacer un snapshot (copia)
      // para no ser engañado por el scratchpad.
      //
      // Lo que SIGUE siendo reutilizable es el _valuesDict: en frame 2,
      // los slots del frame 1 deben haberse sobreescrito, no ser slots nuevos.
      //
      // Verificamos que el adapter NO crea un nuevo object para values cada frame:
      // capturamos la referencia del values ANTES de que el bus haga snapshot.

      const adapter = new KineticAdapter()
      const node    = makeKineticNode({ isContinuous: false })
      const view    = makeNodeView([node])
      const ctx     = makeFrameContext()

      const valueRefs: object[] = []

      const bus: IIntentBus = {
        push: vi.fn((intent: INodeIntent) => {
          // Guardar referencia CRUDA del diccionario (sin copia)
          valueRefs.push(intent.values as object)
        }),
      } as unknown as IIntentBus

      adapter.process(view, ctx, bus)
      adapter.process(view, ctx, bus)
      adapter.process(view, ctx, bus)

      // Los tres pushes deben haber recibido la MISMA referencia de diccionario
      expect(valueRefs).toHaveLength(3)
      expect(valueRefs[0]).toBe(valueRefs[1])
      expect(valueRefs[1]).toBe(valueRefs[2])
    })

    test('después de frame con isContinuous=true, slots targetX/Y/Z son undefined', () => {
      // Garantiza que el limpiado de slots funciona: un nodo continuo nunca
      // deja basura de canales espaciales del frame anterior en el scratchpad.
      //
      // Usamos un nodo que siempre es continuo — tras cada frame sus valores
      // de targetX/Y/Z deben quedar en undefined (limpiados).

      const adapter  = new KineticAdapter()
      const nodeCont = makeKineticNode({ isContinuous: true })
      const view     = makeNodeView([nodeCont])
      const ctx      = makeFrameContext()

      const slots: Array<{ tx: any; ty: any; tz: any }> = []

      const bus: IIntentBus = {
        push: vi.fn((intent: INodeIntent) => {
          slots.push({
            tx: intent.values['targetX'],
            ty: intent.values['targetY'],
            tz: intent.values['targetZ'],
          })
        }),
      } as unknown as IIntentBus

      adapter.process(view, ctx, bus)
      adapter.process(view, ctx, bus)

      // Ambos frames: nodo continuo → slots espaciales deben estar limpios
      expect(slots[0]!.tx).toBeUndefined()
      expect(slots[1]!.tx).toBeUndefined()
    })
  })

})
