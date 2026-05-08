/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏛️ KINETICS BRIDGE — WAVE 4661: THE CATHEDRAL LINK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Singleton que conecta el movementStore con las capas de control cinemático:
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ movementStore.pan / tilt / fanValue  (RadarMode=classic)                │
 * │   → window.lux.aether.setManualOverrides() L2 KINETIC per fixture       │
 * │       con fan offset por índice (V1 + V3 WAVE 4661)                    │
 * │                                                                         │
 * │ movementStore.activePattern / patternSpeed / patternAmplitude           │
 * │   → window.lux.aether.setManualPattern()  (Aether IPC E11)             │
 * │   → vibeMovementManager.setManualSpeed/Amplitude()  (V2 WAVE 4661)     │
 * │                                                                         │
 * │ movementStore.spatialTarget (RadarMode=spatial)                         │
 * │   → window.lux.aether.applySpatialTarget()  (IK resolver E12)          │
 * │                                                                         │
 * │ Respuesta IPC con locked=true / success=false                           │
 * │   → movementStore.setLockedFixtures()  (feedback visual en UI)         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * DISEÑO: Suscripciones Zustand selectivas — no polling, no timers.
 * El bridge solo se activa ante CAMBIOS reales de estado.
 *
 * @module bridges/KineticsBridge
 * @version WAVE 4661
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

/**
 * WAVE 4661 PASO 3 — Hash FNV-1a normalizado.
 * Retorna un offset determinista en [-1, 1] por (fixtureId, seed).
 * PROHIBIDO Math.random() — la distribución es regenerable con RESEED.
 */
function fnv1aOffset(fixtureId: string, seed: number): number {
  const s = fixtureId + ':' + (seed & 0xFFFF)
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  // uint16 → [-1, 1] con buena distribución
  return ((h & 0xFFFF) / 0x7FFF) - 1
}

/** Retorna true si el PatternType activo implica movimiento oscilatorio */
function isActivePattern(p: string): boolean {
  return p !== 'none' && p !== 'static' && p !== 'hold'
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
  private _classicFlushTimeout: ReturnType<typeof setTimeout> | null = null

  /** Debounce en ms para agrupar cambios continuos de speed/amplitude */
  private static readonly PATTERN_DEBOUNCE_MS = 30
  /** Debounce en ms para agrupar cambios continuos del target 3D */
  private static readonly SPATIAL_DEBOUNCE_MS = 20
  /** Debounce en ms para agrupar arrastres continuos del XY pad clásico */
  private static readonly CLASSIC_DEBOUNCE_MS = 16

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
        // PASO 1: cuando cambia el estado activo/inactivo del patrón,
        // re-emitir el classic flush con los nombres de canal correctos
        // (pan/tilt ↔ pan_base/tilt_base) para evitar stale orbit channels.
        const { pan, tilt, fanValue } = useMovementStore.getState()
        this._scheduleClassicFlush(pan, tilt, fanValue)
      },
      { equalityFn: (a, b) =>
          a.activePattern === b.activePattern &&
          a.patternSpeed === b.patternSpeed &&
          a.patternAmplitude === b.patternAmplitude
      },
    )

    // ── Suscripción 2: classic pan / tilt / fan / chaos (WAVE 4661 PASO 1+3) ─
    // El XY pad clásico escribe pan (0-540°) y tilt (0-270°) en el store.
    // El ChaosOrderSlider escribe chaosAmount (0-1) y chaosSeed (16-bit).
    // fanValue (-100..100): spread lineal adicional desde radar gestures.
    const unsubClassic = useMovementStore.subscribe(
      (s) => ({
        pan: s.pan, tilt: s.tilt, fanValue: s.fanValue,
        chaosAmount: s.chaosAmount, chaosSeed: s.chaosSeed,
      }),
      ({ pan, tilt, fanValue }) => {
        this._scheduleClassicFlush(pan, tilt, fanValue)
      },
      { equalityFn: (a, b) =>
          a.pan === b.pan && a.tilt === b.tilt && a.fanValue === b.fanValue &&
          a.chaosAmount === b.chaosAmount && a.chaosSeed === b.chaosSeed
      },
    )

    // ── Suscripción 3: spatial target ───────────────────────────────────
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

    // ── Suscripción 4: spatial fan mode / amplitude (re-enviar spatial si activo) ─
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

    this._unsubscribers = [unsubPattern, unsubClassic, unsubSpatial, unsubFan]
    console.log('[KineticsBridge] 🧠 Iniciado — Neural Link activo')
  }

  stop(): void {
    if (this._patternFlushTimeout !== null) clearTimeout(this._patternFlushTimeout)
    if (this._spatialFlushTimeout !== null) clearTimeout(this._spatialFlushTimeout)
    if (this._classicFlushTimeout !== null) clearTimeout(this._classicFlushTimeout)
    for (const unsub of this._unsubscribers) unsub()
    this._unsubscribers = []
    this._started = false
    console.log('[KineticsBridge] 🛑 Detenido')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE FLUSH METHODS
  // ─────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // CLASSIC PAN/TILT/FAN FLUSH (WAVE 4661 V1+V3)
  // ─────────────────────────────────────────────────────────────────────────

  private _scheduleClassicFlush(
    pan: number,
    tilt: number,
    fanValue: number,
  ): void {
    if (this._classicFlushTimeout !== null) clearTimeout(this._classicFlushTimeout)
    this._classicFlushTimeout = setTimeout(
      () => this._flushClassic(pan, tilt, fanValue),
      KineticsBridgeClass.CLASSIC_DEBOUNCE_MS,
    )
  }

  /**
   * WAVE 4661 PASO 1+3 — Escribe overrides L2 de pan/tilt por fixture seleccionado.
   *
   * Canal orbit vs absoluto:
   *   - Sin patrón activo: escribe `pan`/`tilt` (absoluto, LTP normal)
   *   - Con patrón activo: escribe `pan_base`/`tilt_base` (NodeArbiter suma
   *     la desviación del LFO sobre este punto → el cuadrado/círculo gira
   *     alrededor del punto exacto del radar)
   *
   * Fan spread (dos fuentes aditivas):
   *   1. fanValue (-100..100): spread lineal simétrico ±0.25 norm (de radar gesture)
   *   2. chaosAmount (0-1): spread caótico FNV-1a ±0.35 norm (de ChaosOrderSlider)
   *      chaosAmount=0 → sin spread caótico
   *      chaosAmount=1 → full spread con distribución hash determinista
   */
  private async _flushClassic(
    pan: number,
    tilt: number,
    fanValue: number,
  ): Promise<void> {
    const fixtureIds = getSelectedIds()
    if (fixtureIds.length === 0) return

    const panNorm  = Math.max(0, Math.min(1, pan  / 540))
    const tiltNorm = Math.max(0, Math.min(1, tilt / 270))
    const n        = fixtureIds.length

    // PASO 1: canal de escritura depende de si hay patrón activo.
    const { activePattern, chaosAmount, chaosSeed } = useMovementStore.getState()
    const hasPattern  = isActivePattern(activePattern)
    const panChannel  = hasPattern ? 'pan_base'  : 'pan'
    const tiltChannel = hasPattern ? 'tilt_base' : 'tilt'

    // PASO 3: fan spread = lineal (fanValue) + caótico (chaosAmount).
    // fanValue=100 → ±0.25 norm • chaosAmount=1 → ±0.35 norm (hash FNV-1a).
    const linearFanRange = (fanValue / 100) * 0.25
    const chaosSpread    = chaosAmount * 0.35

    const payloads = fixtureIds.map((id, i) => {
      const t           = n > 1 ? i / (n - 1) : 0.5       // 0..1 dentro de la selección
      const linearPart  = linearFanRange * (t * 2 - 1)     // simétrico [-range, +range]
      const chaosPart   = chaosSpread    * fnv1aOffset(id, chaosSeed)  // hash determinista
      const fanOffset   = linearPart + chaosPart
      const panFinal    = Math.max(0, Math.min(1, panNorm + fanOffset))

      return {
        nodeId:   `${id}:kinetic`,
        channels: { [panChannel]: panFinal, [tiltChannel]: tiltNorm },
      }
    })

    try {
      await window.lux?.aether?.setManualOverrides(payloads)
    } catch (err) {
      console.error('[KineticsBridge] setManualOverrides (classic) error:', err)
    }
  }

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

    // WAVE 4661 V2: propagar speed/amplitude al VMM directamente desde el
    // bridge para no depender de que el backend IPC lo haga.
    // El backend también lo hace vía vibeMovementManager (WAVE 4659 V3),
    // pero este path garantiza que el renderer siempre actúa antes del frame.
    // (El VMM es un singleton main-process; el bridge es renderer — esta
    //  llamada va al IPC que ya lo propaga en AetherIPCHandlers)

    // WAVE 4651: ruta 100% Aether — sin tocar window.lux.arbiter
    try {
      await window.lux?.aether?.setManualPattern({
        fixtureIds,
        pattern: enginePattern,
        speed: patternSpeed,
        amplitude: patternAmplitude,
      })
    } catch (err) {
      console.error('[KineticsBridge] setManualPattern error:', err)
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
