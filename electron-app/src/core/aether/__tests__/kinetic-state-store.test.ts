/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧠 WAVE 8271 — KINETIC STATE STORE & HYDRATION — PROVING GROUNDS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Valida la arquitectura anti-amnesia de WAVE 8271 (fix WAVE 8270-RECON):
 *   • KineticStateStore: partición por deviceId, mirrors por referencia.
 *   • NodeArbiter: mirroring de TODOS los mutadores L2 + purgeForDevice con scope.
 *   • AetherKineticEngine: mirror de pistas + restoreNodeConfig + unregisterDevice.
 *   • PhysicsPostProcessor: unregisterNode + getClassicPosition (captura PPP).
 *   • AetherSafetyMiddleware: unregisterKineticNode + unregisterDevice
 *     (universos huérfanos, virtual-only recalculado).
 *
 * @module core/aether/__tests__/kinetic-state-store.test
 * @version WAVE 8271
 */

import { describe, test, expect, beforeEach } from 'vitest'

import { KineticStateStore } from '../KineticStateStore'
import { NodeArbiter } from '../NodeArbiter'
import { AetherKineticEngine } from '../AetherKineticEngine'
import { PhysicsPostProcessor } from '../resolver/PhysicsPostProcessor'
import { AetherSafetyMiddleware } from '../egress/AetherSafetyMiddleware'
import type { NodeId, DeviceId } from '../types'

const dev = (id: string) => id as DeviceId
const nid = (id: string) => id as NodeId

// ═══════════════════════════════════════════════════════════════════════════
// §1 — KineticStateStore puro
// ═══════════════════════════════════════════════════════════════════════════

describe('KineticStateStore — partición por deviceId', () => {

  let store: KineticStateStore
  beforeEach(() => { store = new KineticStateStore() })

  test('mirrorManual indexa por deviceId derivado del nodeId', () => {
    store.mirrorManual(nid('mover-1:kinetic'), { pan_base: 0.7, tilt_base: 0.3 })
    store.mirrorManual(nid('par-2:color'), { red: 1 })

    const bucket = store.getDevice(dev('mover-1'))
    expect(bucket).toBeDefined()
    expect(bucket!.get(nid('mover-1:kinetic'))?.manualChannels?.['pan_base']).toBe(0.7)
    expect(store.getDevice(dev('par-2'))!.get(nid('par-2:color'))?.manualChannels?.['red']).toBe(1)
    expect(store.getDevice(dev('otro'))).toBeUndefined()
  })

  test('mirror comparte referencia — mutaciones in-place quedan frescas', () => {
    const rec: Record<string, number> = { gobo: 0.5 }
    store.mirrorManual(nid('mover-1:kinetic'), rec)
    rec['gobo'] = 0.9
    expect(store.getDevice(dev('mover-1'))!.get(nid('mover-1:kinetic'))!.manualChannels!['gobo']).toBe(0.9)
  })

  test('dropManual invalida solo ese campo, conserva el resto', () => {
    store.mirrorManual(nid('m-1:kinetic'), { pan: 0.5 })
    store.notePattern(nid('m-1:kinetic'), {
      pattern: 'circle', speed: 0.5, amplitude: 0.5, fan: 0, fanIndex: 0, fanTotal: 1, mountOrientation: 'floor',
    })
    store.dropManual(nid('m-1:kinetic'))
    const st = store.getDevice(dev('m-1'))!.get(nid('m-1:kinetic'))!
    expect(st.manualChannels).toBeNull()
    expect(st.pattern).not.toBeNull()
  })

  test('capturePosition guarda lastPan/lastTilt', () => {
    store.capturePosition(nid('m-1:kinetic'), 0.42, 0.77)
    const st = store.getDevice(dev('m-1'))!.get(nid('m-1:kinetic'))!
    expect(st.lastPan).toBeCloseTo(0.42)
    expect(st.lastTilt).toBeCloseTo(0.77)
  })

  test('deleteDevice elimina el bucket completo', () => {
    store.mirrorManual(nid('m-1:kinetic'), { pan: 0.5 })
    store.mirrorManual(nid('m-2:kinetic'), { pan: 0.5 })
    store.deleteDevice(dev('m-1'))
    expect(store.getDevice(dev('m-1'))).toBeUndefined()
    expect(store.hasDevice(dev('m-2'))).toBe(true)
  })

  test('deleteNode colapsa bucket vacío', () => {
    store.mirrorManual(nid('m-1:kinetic'), { pan: 0.5 })
    store.deleteNode(nid('m-1:kinetic'))
    expect(store.hasDevice(dev('m-1'))).toBe(false)
  })

  test('clear() es el wipe total (solo show-load)', () => {
    store.mirrorManual(nid('m-1:kinetic'), { pan: 0.5 })
    store.noteInhibitLimit(nid('m-2:color'), 0.5)
    store.clear()
    expect(store.hasDevice(dev('m-1'))).toBe(false)
    expect(store.hasDevice(dev('m-2'))).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §2 — NodeArbiter: mirroring de mutadores L2
// ═══════════════════════════════════════════════════════════════════════════

describe('NodeArbiter → KineticStateStore — espejado', () => {

  let arbiter: NodeArbiter
  let store: KineticStateStore
  beforeEach(() => {
    arbiter = new NodeArbiter()
    store = new KineticStateStore()
    arbiter.setKineticStateStore(store)
  })

  test('setManualOverride espeja manualChannels (gobos, prism, focus, radar anchor)', () => {
    arbiter.setManualOverride(nid('m-1:kinetic'), { gobo: 0.6, prism: 0.4, focus: 0.8 })
    const st = store.getDevice(dev('m-1'))!.get(nid('m-1:kinetic'))!
    expect(st.manualChannels).not.toBeNull()
    expect(st.manualChannels!['gobo']).toBe(0.6)
    expect(st.manualChannels!['prism']).toBe(0.4)
  })

  test('clearManualOverride borra el espejo (release explícito NO resucita)', () => {
    arbiter.setManualOverride(nid('m-1:kinetic'), { gobo: 0.6 })
    arbiter.clearManualOverride(nid('m-1:kinetic'))
    const st = store.getDevice(dev('m-1'))!.get(nid('m-1:kinetic'))!
    expect(st.manualChannels).toBeNull()
  })

  test('setMotorKineticOverride espeja motorOverride (targetX/Y/Z espacial)', () => {
    arbiter.setMotorKineticOverride(nid('m-1:kinetic'), { targetX: 0.2, targetY: 0.9, targetZ: 0.1 })
    const st = store.getDevice(dev('m-1'))!.get(nid('m-1:kinetic'))!
    expect(st.motorOverride!['targetX']).toBe(0.2)
    expect(st.motorOverride!['targetY']).toBe(0.9)
  })

  test('clearMotorKineticOverride borra el espejo', () => {
    arbiter.setMotorKineticOverride(nid('m-1:kinetic'), { targetX: 0.2 })
    arbiter.clearMotorKineticOverride(nid('m-1:kinetic'))
    expect(store.getDevice(dev('m-1'))!.get(nid('m-1:kinetic'))!.motorOverride).toBeNull()
  })

  test('setInhibitLimit/clearInhibitLimit espejan', () => {
    arbiter.setInhibitLimit(nid('m-1:impact'), 0.42)
    expect(store.getDevice(dev('m-1'))!.get(nid('m-1:impact'))!.inhibitLimit).toBeCloseTo(0.42)
    arbiter.clearInhibitLimit(nid('m-1:impact'))
    expect(store.getDevice(dev('m-1'))!.get(nid('m-1:impact'))!.inhibitLimit).toBeNull()
  })

  test('setSpatialCoupledLock/clearSpatialCoupledLock espejan (radar)', () => {
    arbiter.setSpatialCoupledLock([nid('m-1:kinetic')])
    expect(store.getDevice(dev('m-1'))!.get(nid('m-1:kinetic'))!.spatialCoupled).toBe(true)
    arbiter.clearSpatialCoupledLock(nid('m-1:kinetic'))
    expect(store.getDevice(dev('m-1'))!.get(nid('m-1:kinetic'))!.spatialCoupled).toBe(false)
  })

  test('setSpatialDistanceScale/clearSpatialDistanceScale espejan', () => {
    arbiter.setSpatialDistanceScale(nid('m-1:kinetic'), 1.5)
    expect(store.getDevice(dev('m-1'))!.get(nid('m-1:kinetic'))!.distanceScale).toBeCloseTo(1.5)
    arbiter.clearSpatialDistanceScale(nid('m-1:kinetic'))
    expect(store.getDevice(dev('m-1'))!.get(nid('m-1:kinetic'))!.distanceScale).toBeNull()
  })

  test('setManualPatternLock/clearManualPatternLock espejan', () => {
    arbiter.setManualPatternLock([nid('m-1:kinetic')])
    expect(store.getDevice(dev('m-1'))!.get(nid('m-1:kinetic'))!.patternLock).toBe(true)
    arbiter.clearManualPatternLock(nid('m-1:kinetic'))
    expect(store.getDevice(dev('m-1'))!.get(nid('m-1:kinetic'))!.patternLock).toBe(false)
  })

  test('purgeForShow limpia el store completo (nuclear solo en show-load)', () => {
    arbiter.setManualOverride(nid('m-1:kinetic'), { gobo: 0.6 })
    arbiter.setInhibitLimit(nid('m-2:impact'), 0.5)
    arbiter.purgeForShow()
    expect(store.hasDevice(dev('m-1'))).toBe(false)
    expect(store.hasDevice(dev('m-2'))).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §3 — NodeArbiter.purgeForDevice — scope, no nuclear
// ═══════════════════════════════════════════════════════════════════════════

describe('NodeArbiter.purgeForDevice — purga con scope de device', () => {

  let arbiter: NodeArbiter
  let store: KineticStateStore
  beforeEach(() => {
    arbiter = new NodeArbiter()
    store = new KineticStateStore()
    arbiter.setKineticStateStore(store)
  })

  test('limpia solo los nodeIds del device purgado — el otro sobrevive', () => {
    arbiter.setManualOverride(nid('m-1:kinetic'), { gobo: 0.6 })
    arbiter.setManualOverride(nid('m-2:kinetic'), { gobo: 0.9 })
    arbiter.setMotorKineticOverride(nid('m-1:kinetic'), { targetX: 0.1 })
    arbiter.setMotorKineticOverride(nid('m-2:kinetic'), { targetX: 0.8 })
    arbiter.setInhibitLimit(nid('m-1:impact'), 0.5)
    arbiter.setInhibitLimit(nid('m-2:impact'), 0.7)
    arbiter.setSpatialCoupledLock([nid('m-1:kinetic'), nid('m-2:kinetic')])

    arbiter.purgeForDevice('m-1')

    expect(arbiter.getManualOverride(nid('m-1:kinetic'))).toBeUndefined()
    expect(arbiter.getMotorKineticOverride(nid('m-1:kinetic'))).toBeUndefined()
    expect(arbiter.isSpatialCoupledLocked(nid('m-1:kinetic'))).toBe(false)

    // El superviviente conserva TODO su estado mecánico
    expect(arbiter.getManualOverride(nid('m-2:kinetic'))?.['gobo']).toBe(0.9)
    expect(arbiter.getMotorKineticOverride(nid('m-2:kinetic'))?.['targetX']).toBe(0.8)
    expect(arbiter.isSpatialCoupledLocked(nid('m-2:kinetic'))).toBe(true)
  })

  test('elimina la entrada del store del device purgado', () => {
    arbiter.setManualOverride(nid('m-1:kinetic'), { gobo: 0.6 })
    arbiter.setManualOverride(nid('m-2:kinetic'), { gobo: 0.9 })
    arbiter.purgeForDevice('m-1')
    expect(store.hasDevice(dev('m-1'))).toBe(false)
    expect(store.hasDevice(dev('m-2'))).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §4 — AetherKineticEngine: mirror de pistas + rehidratación
// ═══════════════════════════════════════════════════════════════════════════

describe('AetherKineticEngine → KineticStateStore', () => {

  let engine: AetherKineticEngine
  let arbiter: NodeArbiter
  let store: KineticStateStore
  beforeEach(() => {
    engine = new AetherKineticEngine()
    arbiter = new NodeArbiter()
    store = new KineticStateStore()
    engine.setKineticStateStore(store)
    arbiter.setKineticStateStore(store)
  })

  test('setManualKinetics guarda la pista en el store por deviceId', () => {
    engine.setManualKinetics(['fan-a:kinetic'], 'circle', 0.6, 0.8, 0.3, arbiter)
    const st = store.getDevice(dev('fan-a'))!.get(nid('fan-a:kinetic'))!
    expect(st.pattern).not.toBeNull()
    expect(st.pattern!.pattern).toBe('circle')
    expect(st.pattern!.speed).toBeCloseTo(0.6)
    expect(st.pattern!.amplitude).toBeCloseTo(0.8)
  })

  test('updateScalars muta la cfg viva — el store queda fresco', () => {
    engine.setManualKinetics(['fan-a:kinetic'], 'circle', 0.5, 0.5, 0, arbiter)
    engine.updateScalars(['fan-a:kinetic'], 0.9, 0.2, 0.5)
    const st = store.getDevice(dev('fan-a'))!.get(nid('fan-a:kinetic'))!
    expect(st.pattern!.speed).toBeCloseTo(0.9)
    expect(st.pattern!.amplitude).toBeCloseTo(0.2)
    expect(st.pattern!.fan).toBeCloseTo(0.5)
  })

  test('removeNodes elimina la pista del store (release explícito)', () => {
    engine.setManualKinetics(['fan-a:kinetic'], 'circle', 0.5, 0.5, 0, arbiter)
    engine.removeNodes(['fan-a:kinetic'], arbiter)
    expect(store.getDevice(dev('fan-a'))!.get(nid('fan-a:kinetic'))!.pattern).toBeNull()
  })

  test('restoreNodeConfig reinstala la pista tras repatch', () => {
    engine.setManualKinetics(['fan-a:kinetic'], 'eight', 0.7, 0.4, 0.2, arbiter)
    const saved = store.getDevice(dev('fan-a'))!.get(nid('fan-a:kinetic'))!.pattern!

    // Simula el device reconstruido: nuevo engine limpio + restore desde store
    const engine2 = new AetherKineticEngine()
    engine2.setKineticStateStore(store)
    engine2.restoreNodeConfig('fan-a:kinetic', saved, arbiter)

    expect(engine2.hasNode('fan-a:kinetic')).toBe(true)
    const st = store.getDevice(dev('fan-a'))!.get(nid('fan-a:kinetic'))!
    expect(st.pattern!.pattern).toBe('eight')
    expect(st.pattern!.speed).toBeCloseTo(0.7)
  })

  test('restoreNodeConfig no pisa una pista viva (guard)', () => {
    const e = new AetherKineticEngine()
    e.setKineticStateStore(store)
    e.setManualKinetics(['fan-a:kinetic'], 'circle', 0.5, 0.5, 0, arbiter)
    e.restoreNodeConfig('fan-a:kinetic', {
      pattern: 'butterfly', speed: 1, amplitude: 1, fan: 0, fanIndex: 0, fanTotal: 1, mountOrientation: 'floor',
    }, arbiter)
    // La pista viva gana — sigue siendo 'circle'
    expect(store.getDevice(dev('fan-a'))!.get(nid('fan-a:kinetic'))!.pattern!.pattern).toBe('circle')
  })

  test('unregisterDevice purga pistas y cachés del device', () => {
    engine.setManualKinetics(['fan-a:kinetic'], 'circle', 0.5, 0.5, 0, arbiter)
    engine.setManualKinetics(['fan-b:kinetic'], 'pulse', 0.5, 0.5, 0, arbiter)
    engine.unregisterDevice('fan-a', arbiter)
    expect(engine.hasNode('fan-a:kinetic')).toBe(false)
    expect(engine.hasNode('fan-b:kinetic')).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §5 — PhysicsPostProcessor: unregisterNode + getClassicPosition
// ═══════════════════════════════════════════════════════════════════════════

describe('PhysicsPostProcessor — unregisterNode (leak seal)', () => {

  test('registerNode → getClassicPosition neutro → unregisterNode limpia', () => {
    const ppp = new PhysicsPostProcessor()
    ppp.registerNode(nid('m-1:kinetic'))
    const pos = ppp.getClassicPosition(nid('m-1:kinetic'))
    expect(pos).not.toBeNull()
    expect(pos!.pan).toBeCloseTo(0.5)
    expect(pos!.tilt).toBeCloseTo(0.5)

    ppp.unregisterNode(nid('m-1:kinetic'))
    expect(ppp.getClassicPosition(nid('m-1:kinetic'))).toBeNull()
  })

  test('seedClassicState tras registerNode refleja la posición restaurada', () => {
    const ppp = new PhysicsPostProcessor()
    ppp.registerNode(nid('m-1:kinetic'))
    ppp.seedClassicState(nid('m-1:kinetic'), 0.33, 0.66)
    const pos = ppp.getClassicPosition(nid('m-1:kinetic'))!
    expect(pos.pan).toBeCloseTo(0.33)
    expect(pos.tilt).toBeCloseTo(0.66)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// §6 — AetherSafetyMiddleware: unregisterDevice (universos huérfanos)
// ═══════════════════════════════════════════════════════════════════════════

describe('AetherSafetyMiddleware — unregisterDevice', () => {

  test('universo solo-virtual deja de bloquear tras unregister', () => {
    const safety = new AetherSafetyMiddleware()
    safety.setFrameContext(1000, 'test')
    safety.registerDevice(dev('virt-1'), 0, true)

    // Universo 0 tiene solo device virtual → no debe enviar
    expect(safety.shouldSendUniverse(0)).toBe(false)

    safety.unregisterDevice(dev('virt-1'))
    // Universo vacío → ni virtual ni real → deja de bloquear
    expect(safety.shouldSendUniverse(0)).toBe(true)
  })

  test('universo con device real superviviente sigue enviando', () => {
    const safety = new AetherSafetyMiddleware()
    safety.setFrameContext(1000, 'test')
    safety.registerDevice(dev('virt-1'), 0, true)
    safety.registerDevice(dev('real-1'), 0, false)
    expect(safety.shouldSendUniverse(0)).toBe(true)

    safety.unregisterDevice(dev('virt-1'))
    expect(safety.shouldSendUniverse(0)).toBe(true)
  })

  test('unregisterKineticNode purga el estado cinético del nodo', () => {
    const safety = new AetherSafetyMiddleware()
    safety.setFrameContext(1000, 'test')
    safety.registerKineticNode(nid('m-1:kinetic'))
    // No debe lanzar y queda purgado (verificación indirecta: re-registro limpio)
    safety.unregisterKineticNode(nid('m-1:kinetic'))
    safety.registerKineticNode(nid('m-1:kinetic'))
    expect(() => safety.resetKineticState(nid('m-1:kinetic'))).not.toThrow()
  })

  test('unregisterDevice purga nodeIds explícitos del device', () => {
    const safety = new AetherSafetyMiddleware()
    safety.setFrameContext(1000, 'test')
    safety.registerDevice(dev('m-1'), 0, false)
    safety.registerKineticNode(nid('m-1:kinetic'))
    safety.unregisterDevice(dev('m-1'), [nid('m-1:kinetic')])
    // El device salió de los mapas de universo
    safety.registerDevice(dev('m-2'), 0, true)
    // m-1 ya no cuenta → universo 0 ahora es virtual-only
    expect(safety.shouldSendUniverse(0)).toBe(false)
  })
})
