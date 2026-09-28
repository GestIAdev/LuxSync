/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧠 AETHER MATRIX — KINETIC STATE STORE (WAVE 8271)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Almacén persistente del estado mecánico EXPLÍCITO del operador, particionado
 * por `deviceId`. Resuelve la "deshidratación cinética" documentada en
 * WAVE 8270-RECON: `purgeForShow()` + el swap atómico del NodeGraph destruían
 * el estado L2 (radar anchors, gobos, prismas, rotación continua, targets
 * espaciales) en CADA cambio de patch en caliente.
 *
 * MODELO DE VERDAD:
 *   - Los mapas del NodeArbiter/AetherKineticEngine son la verdad LIVE.
 *   - Este store es un MIRROR por referencia de esos mapas, indexado por
 *     `deviceId` (estable entre repatches — los nodeIds `${deviceId}:${suffix}`
 *     se derivan determinísticamente).
 *   - Mirror-by-reference: el arbiter/engine mutan sus Records in-place; al
 *     compartir la referencia el store refleja siempre el estado más fresco
 *     sin coste de copia y sin escrituras en el hot path.
 *
 * ESCRITORES (gesture/patch time — NUNCA en el frame loop):
 *   - NodeArbiter: setManualOverride/clearManualOverride,
 *     setMotorKineticOverride/clearMotorKineticOverride,
 *     setManualPatternLock/clearManualPatternLock,
 *     setInhibitLimit/clearInhibitLimit, purgeForShow/purgeForDevice.
 *   - AetherKineticEngine: setManualKinetics/updateScalars (via ref),
 *     removeNodes/stop, restoreNodeConfig.
 *   - FixtureHydrationEngine: capturePosition() antes de unregisterDevice.
 *
 * REHIDRATACIÓN:
 *   `FixtureHydrationEngine.registerAetherDevice()` consulta getDevice()
 *   tras registrar los nodos y re-aplica el estado al arbiter/engine/PPP.
 *   La guarda "skip-if-live" evita que el mirror pise estado más reciente.
 *
 * @module core/aether/KineticStateStore
 * @version WAVE 8271
 */

import type { NodeId, DeviceId } from './types'
import type { NativeKineticPattern } from './AetherKineticEngine'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Config de pista del motor L2 — espejo estructural de KineticNodeConfig
 * del AetherKineticEngine (el engine muta estos campos en updateScalars;
 * almacenar la MISMA referencia mantiene el mirror siempre fresco).
 */
export interface StoredPatternConfig {
  pattern: NativeKineticPattern
  speed: number
  amplitude: number
  fan: number
  fanIndex: number
  fanTotal: number
  mountOrientation: string
}

/**
 * Estado cinético almacenado por nodo.
 * `manualChannels`/`motorOverride` son referencias vivas a los Records que
 * el NodeArbiter aloja en `_manualOverrides`/`_motorKineticOverrides` —
 * cualquier mutación in-place del arbiter queda reflejada automáticamente.
 */
export interface NodeKineticState {
  /** Mirror de _manualOverrides[nodeId] — anchor radar, gobos, prism, rotation… */
  manualChannels: Record<string, number> | null
  /** Mirror de _motorKineticOverrides[nodeId] — contiene targetX/Y/Z en modo IK */
  motorOverride: Record<string, number> | null
  /** Config de pista L2 del AetherKineticEngine (referencia viva) */
  pattern: StoredPatternConfig | null
  /** Manual pattern lock activo */
  patternLock: boolean
  /** Nodo en modo Spatial/IK acoplado (protege contra pan/tilt absolutos L0/L2) */
  spatialCoupled: boolean
  /** Escala por distancia fixture→target para los offsets espaciales */
  distanceScale: number | null
  /** Inhibit limit L2.5 (cap de intensidad por nodo) */
  inhibitLimit: number | null
  /** Última posición física capturada al morir el nodo (rehidratación PPP) */
  lastPan: number
  lastTilt: number
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export class KineticStateStore {

  /** deviceId → (nodeId → estado cinético) */
  private readonly _devices = new Map<DeviceId, Map<NodeId, NodeKineticState>>()

  // ── Internals ──────────────────────────────────────────────────────────

  /** deviceId desde un nodeId `${deviceId}:${suffix}` (fallback: el propio id) */
  private _deviceIdOf(nodeId: string): DeviceId {
    const sep = nodeId.indexOf(':')
    return (sep > 0 ? nodeId.slice(0, sep) : nodeId) as DeviceId
  }

  private _nodeState(nodeId: NodeId, deviceId?: DeviceId): NodeKineticState {
    const dev = deviceId ?? this._deviceIdOf(nodeId)
    let bucket = this._devices.get(dev)
    if (!bucket) {
      bucket = new Map()
      this._devices.set(dev, bucket)
    }
    let state = bucket.get(nodeId)
    if (!state) {
      state = {
        manualChannels: null,
        motorOverride: null,
        pattern: null,
        patternLock: false,
        spatialCoupled: false,
        distanceScale: null,
        inhibitLimit: null,
        lastPan: NaN,
        lastTilt: NaN,
      }
      bucket.set(nodeId, state)
    }
    return state
  }

  // ── Mirrors del NodeArbiter (gesture time) ─────────────────────────────

  /** Post-state mirror de `_manualOverrides[nodeId]` — comparte la referencia. */
  mirrorManual(nodeId: NodeId, record: Readonly<Record<string, number>>): void {
    this._nodeState(nodeId).manualChannels = record as Record<string, number>
  }

  /** La entrada del arbiter fue eliminada → el mirror se invalida. */
  dropManual(nodeId: NodeId): void {
    const dev = this._deviceIdOf(nodeId)
    const state = this._devices.get(dev)?.get(nodeId)
    if (state) state.manualChannels = null
  }

  /** Post-state mirror de `_motorKineticOverrides[nodeId]` (contiene targetX/Y/Z en IK). */
  mirrorMotor(nodeId: NodeId, record: Readonly<Record<string, number>>): void {
    this._nodeState(nodeId).motorOverride = record as Record<string, number>
  }

  dropMotor(nodeId: NodeId): void {
    const dev = this._deviceIdOf(nodeId)
    const state = this._devices.get(dev)?.get(nodeId)
    if (state) state.motorOverride = null
  }

  notePatternLock(nodeId: NodeId, locked: boolean): void {
    this._nodeState(nodeId).patternLock = locked
  }

  /** Mirror de `_spatialCoupledLock` — el nodo está en modo Spatial/IK. */
  noteSpatialCoupled(nodeId: NodeId, coupled: boolean): void {
    this._nodeState(nodeId).spatialCoupled = coupled
  }

  /** Mirror de `_spatialDistanceScales` — escala de offsets por distancia al target. */
  noteDistanceScale(nodeId: NodeId, scale: number | null): void {
    this._nodeState(nodeId).distanceScale = scale
  }

  noteInhibitLimit(nodeId: NodeId, limit: number | null): void {
    this._nodeState(nodeId).inhibitLimit = limit
  }

  // ── Mirrors del AetherKineticEngine ────────────────────────────────────

  /** Registra la config de pista (referencia viva — updateScalars la muta in-place). */
  notePattern(nodeId: NodeId, cfg: StoredPatternConfig): void {
    this._nodeState(nodeId).pattern = cfg
  }

  dropPattern(nodeId: NodeId): void {
    const dev = this._deviceIdOf(nodeId)
    const state = this._devices.get(dev)?.get(nodeId)
    if (state) state.pattern = null
  }

  /** engine.stop() — todas las pistas eliminadas. */
  dropAllPatterns(): void {
    for (const bucket of this._devices.values()) {
      for (const state of bucket.values()) {
        state.pattern = null
      }
    }
  }

  /**
   * Espejo de `arbiter.clearAllManualOverrides()`:
   * limpia manualChannels + motorOverride + patternLock en TODOS los devices.
   * Conserva pattern (la pista del engine sigue activa), inhibit y posición.
   */
  dropAllManualAndMotor(): void {
    for (const bucket of this._devices.values()) {
      for (const state of bucket.values()) {
        state.manualChannels = null
        state.motorOverride = null
        state.patternLock = false
      }
    }
  }

  /** Espejo de `arbiter.clearAllMotorKineticOverrides()`. */
  dropAllMotor(): void {
    for (const bucket of this._devices.values()) {
      for (const state of bucket.values()) {
        state.motorOverride = null
      }
    }
  }

  /** Espejo de `arbiter.clearAllManualPatternLocks()`. */
  dropAllPatternLocks(): void {
    for (const bucket of this._devices.values()) {
      for (const state of bucket.values()) {
        state.patternLock = false
      }
    }
  }

  /** Espejo de `arbiter.clearAllInhibitLimits()`. */
  dropAllInhibitLimits(): void {
    for (const bucket of this._devices.values()) {
      for (const state of bucket.values()) {
        state.inhibitLimit = null
      }
    }
  }

  /** Espejo de `arbiter.clearAllSpatialDistanceScales()`. */
  dropAllDistanceScales(): void {
    for (const bucket of this._devices.values()) {
      for (const state of bucket.values()) {
        state.distanceScale = null
      }
    }
  }

  // ── Captura física (patch time, pre-unregister) ────────────────────────

  /** Snapshot de la posición física del nodo justo antes de morir. */
  capturePosition(nodeId: NodeId, pan: number, tilt: number): void {
    const state = this._nodeState(nodeId)
    state.lastPan = pan
    state.lastTilt = tilt
  }

  // ── Lectura para rehidratación ─────────────────────────────────────────

  /** Estado cinético almacenado de un device (undefined si nunca hubo). */
  getDevice(deviceId: DeviceId): ReadonlyMap<NodeId, NodeKineticState> | undefined {
    return this._devices.get(deviceId)
  }

  hasDevice(deviceId: DeviceId): boolean {
    const bucket = this._devices.get(deviceId)
    return bucket !== undefined && bucket.size > 0
  }

  // ── Purga ──────────────────────────────────────────────────────────────

  /** Elimina TODO el estado del device (fixture realmente eliminado del patch). */
  deleteDevice(deviceId: DeviceId): void {
    this._devices.delete(deviceId)
  }

  /** Elimina un nodeId concreto (nodo desaparecido en la nueva definición del device). */
  deleteNode(nodeId: NodeId): void {
    const dev = this._deviceIdOf(nodeId)
    const bucket = this._devices.get(dev)
    if (!bucket) return
    bucket.delete(nodeId)
    if (bucket.size === 0) this._devices.delete(dev)
  }

  /** Wipe total — equivalente a purgeForShow (solo en carga de show). */
  clear(): void {
    this._devices.clear()
  }
}
