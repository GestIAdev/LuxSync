/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏛️ KINETICS BRIDGE — WAVE 4563: THE NEURAL LINK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Singleton que conecta el movementStore con las capas de control cinemático:
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ movementStore.activePattern / patternSpeed / patternAmplitude           │
 * │   → window.lux.arbiter.setManualFixturePattern()  (MasterArbiter L2)   │
 * │                                                                         │
 * │ movementStore.spatialTarget (RadarMode=spatial)                         │
 * │   → window.lux.aether.applySpatialTarget()  (IK resolver E12)          │
 * │                                                                         │
 * │ movementStore.patternSpeed                                              │
 * │   → programmerStore.setKineticSpeed()  (fluye vía ProgrammerAetherBridge│
 * │      44Hz tick → NodeArbiter L2 KINETIC:speed)                         │
 * │                                                                         │
 * │ Respuesta IPC con locked=true / success=false                           │
 * │   → movementStore.setLockedFixtures()  (feedback visual en UI)         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * DISEÑO: Suscripciones Zustand selectivas — no polling, no timers.
 * El bridge solo se activa ante CAMBIOS reales de estado.
 *
 * @module bridges/KineticsBridge
 * @version WAVE 4563
 */

import { useMovementStore } from '../stores/movementStore'
import { useProgrammerStore } from '../stores/programmerStore'
import { useSelectionStore } from '../stores/selectionStore'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Devuelve los fixtureIds actualmente seleccionados */
function getSelectedIds(): string[] {
  return useSelectionStore.getState().getSelectedArray()
}

/**
 * Convierte el PatternType de movementStore al string que espera el backend:
 * 'none' o 'static' → 'hold'  |  pattern real → pass-through
 */
function toEnginePattern(p: string): string {
  return (p === 'none' || p === 'static') ? 'hold' : p
}

// ─────────────────────────────────────────────────────────────────────────────
// BRIDGE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class KineticsBridgeClass {
  private _started = false
  private _unsubscribers: Array<() => void> = []

  // ── debounce handles ───────────────────────────────────────────────────
  private _patternFlushTimeout: ReturnType<typeof setTimeout> | null = null
  private _spatialFlushTimeout: ReturnType<typeof setTimeout> | null = null

  /** Debounce en ms para agrupar cambios continuos de speed/amplitude */
  private static readonly PATTERN_DEBOUNCE_MS = 30
  /** Debounce en ms para agrupar cambios continuos del target 3D */
  private static readonly SPATIAL_DEBOUNCE_MS = 20

  start(): void {
    if (this._started) {
      console.warn('[KineticsBridge] Ya iniciado, ignorando start()')
      return
    }
    this._started = true

    // ── Suscripción 1: pattern + speed + amplitude ──────────────────────
    const unsubPattern = useMovementStore.subscribe(
      (s) => ({
        activePattern: s.activePattern,
        patternSpeed: s.patternSpeed,
        patternAmplitude: s.patternAmplitude,
      }),
      ({ activePattern, patternSpeed, patternAmplitude }) => {
        // Speed → programmerStore (44Hz pipeline para L2:speed)
        if (getSelectedIds().length > 0) {
          useProgrammerStore.getState().setKineticSpeed(patternSpeed)
        }

        // Pattern + speed + amplitude → MasterArbiter Layer 2
        this._schedulePatternFlush(activePattern, patternSpeed, patternAmplitude)
      },
      { equalityFn: (a, b) =>
          a.activePattern === b.activePattern &&
          a.patternSpeed === b.patternSpeed &&
          a.patternAmplitude === b.patternAmplitude
      },
    )

    // ── Suscripción 2: spatial target ───────────────────────────────────
    const unsubSpatial = useMovementStore.subscribe(
      (s) => s.spatialTarget,
      (spatialTarget) => {
        const ids = getSelectedIds()
        if (ids.length === 0) return
        // M1 FIX WAVE 4579: Si TODOS los fixtures están en manual override, el canal
        // spatial compite con el override del programmerStore y gana vía IKEngine.
        // En ese caso, el bridge NO despacha — el ProgrammerAetherBridge maneja el pan/tilt.
        const { manualOverrideFixtureIds, spatialFanMode, spatialFanAmplitude } = useMovementStore.getState()
        if (ids.length > 0 && ids.every(id => manualOverrideFixtureIds.has(id))) return
        this._scheduleSpatialFlush(spatialTarget, ids, spatialFanMode, spatialFanAmplitude)
      },
      { equalityFn: (a, b) =>
          a.x === b.x && a.y === b.y && a.z === b.z
      },
    )

    // ── Suscripción 3: fan mode / amplitude (re-enviar spatial si activo) ─
    const unsubFan = useMovementStore.subscribe(
      (s) => ({ spatialFanMode: s.spatialFanMode, spatialFanAmplitude: s.spatialFanAmplitude }),
      ({ spatialFanMode, spatialFanAmplitude }) => {
        const ids = getSelectedIds()
        if (ids.length === 0) return
        const { manualOverrideFixtureIds, spatialTarget } = useMovementStore.getState()
        if (ids.length > 0 && ids.every(id => manualOverrideFixtureIds.has(id))) return
        this._scheduleSpatialFlush(spatialTarget, ids, spatialFanMode, spatialFanAmplitude)
      },
      { equalityFn: (a, b) =>
          a.spatialFanMode === b.spatialFanMode &&
          a.spatialFanAmplitude === b.spatialFanAmplitude
      },
    )

    this._unsubscribers = [unsubPattern, unsubSpatial, unsubFan]
    console.log('[KineticsBridge] 🧠 Iniciado — Neural Link activo')
  }

  stop(): void {
    if (this._patternFlushTimeout !== null) clearTimeout(this._patternFlushTimeout)
    if (this._spatialFlushTimeout !== null) clearTimeout(this._spatialFlushTimeout)
    for (const unsub of this._unsubscribers) unsub()
    this._unsubscribers = []
    this._started = false
    console.log('[KineticsBridge] 🛑 Detenido')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE FLUSH METHODS
  // ─────────────────────────────────────────────────────────────────────────

  private _schedulePatternFlush(
    activePattern: string,
    patternSpeed: number,
    patternAmplitude: number,
  ): void {
    if (this._patternFlushTimeout !== null) clearTimeout(this._patternFlushTimeout)
    this._patternFlushTimeout = setTimeout(
      () => this._flushPattern(activePattern, patternSpeed, patternAmplitude),
      KineticsBridgeClass.PATTERN_DEBOUNCE_MS,
    )
  }

  private async _flushPattern(
    activePattern: string,
    patternSpeed: number,
    patternAmplitude: number,
  ): Promise<void> {
    const fixtureIds = getSelectedIds()
    if (fixtureIds.length === 0) return

    const enginePattern = toEnginePattern(activePattern)

    try {
      await window.lux?.arbiter?.setManualFixturePattern({
        fixtureIds,
        pattern: enginePattern,
        speed: patternSpeed,
        amplitude: patternAmplitude,
      })
    } catch (err) {
      console.error('[KineticsBridge] setManualFixturePattern error:', err)
    }
  }

  private _scheduleSpatialFlush(
    target: { x: number; y: number; z: number },
    fixtureIds: string[],
    fanMode: string,
    fanAmplitude: number,
  ): void {
    if (this._spatialFlushTimeout !== null) clearTimeout(this._spatialFlushTimeout)
    this._spatialFlushTimeout = setTimeout(
      () => this._flushSpatial(target, fixtureIds, fanMode, fanAmplitude),
      KineticsBridgeClass.SPATIAL_DEBOUNCE_MS,
    )
  }

  private async _flushSpatial(
    target: { x: number; y: number; z: number },
    fixtureIds: string[],
    fanMode: string,
    fanAmplitude: number,
  ): Promise<void> {
    try {
      const result = await window.lux?.aether?.applySpatialTarget({
        target,
        fixtureIds,
        fanMode: fanMode as 'converge' | 'line' | 'circle',
        fanAmplitude,
      })

      // Detectar fixtures que no puedo controlar (motor superior activo)
      if (result?.results) {
        const locked = new Set<string>()
        for (const [id, res] of Object.entries(result.results)) {
          const r = res as { locked?: boolean; success?: boolean }
          if (r.locked === true || r.success === false) {
            locked.add(id)
          }
        }
        useMovementStore.getState().setLockedFixtures(locked)

        // Actualizar reachability en movementStore con los resultados IK
        const reachability: Record<string, import('../engine/movement/InverseKinematicsEngine').IKResult> = {}
        const subTargets: Record<string, import('../engine/movement/InverseKinematicsEngine').Target3D> = {}
        for (const [id, res] of Object.entries(result.results)) {
          const ik = res as import('../engine/movement/InverseKinematicsEngine').IKResult & { subTarget?: import('../engine/movement/InverseKinematicsEngine').Target3D }
          reachability[id] = ik
          if (ik.subTarget) {
            subTargets[id] = ik.subTarget
          }
        }
        useMovementStore.getState().setSpatialReachability(reachability)
        useMovementStore.getState().setSpatialSubTargets(subTargets)
      }
    } catch (err) {
      console.error('[KineticsBridge] applySpatialTarget error:', err)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const KineticsBridge = new KineticsBridgeClass()
