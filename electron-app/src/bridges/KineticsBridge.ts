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
 * WAVE 4719: Retorna true si alguno de los fixtures seleccionados tiene un
 * override KINETIC activo en Programmer EXCLUIDOS pan/tilt.
 * Pan y tilt NO son motivo de bloqueo — son la BASE de la orbita.
 * Solo bloquea por: speed, targets IK (X/Y/Z) y extras rotation/speed.
 * Esto permite que el Radar y el PatternArsenal coexistan sin auto-bloquearse.
 */
function hasNonPositionKineticManual(fixtureIds: string[]): boolean {
  const overrides = useProgrammerStore.getState().fixtureOverrides
  for (const id of fixtureIds) {
    const ov = overrides.get(id)
    if (!ov) continue
    const hasNonPosition =
      ov.speed !== null ||
      ov.targetX !== null ||
      ov.targetY !== null ||
      ov.targetZ !== null
    const hasKineticExtras = ov.extras.has('rotation') || ov.extras.has('speed')
    if (hasNonPosition || hasKineticExtras) return true
  }
  return false
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

// WAVE 4719: hasProgrammerL2Manual eliminada — era identica a hasProgrammerKineticManual.
// Sustituida por hasNonPositionKineticManual que excluye pan/tilt del bloqueo.
// Ninguna de las dos funciones antiguas debe existir en el bridge.

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
  private _fanPhaseFlushTimeout: ReturnType<typeof setTimeout> | null = null

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
        fanValue: s.fanValue,
      }),
      ({ activePattern, patternSpeed, patternAmplitude, fanValue }) => {
        // Speed → programmerStore (44Hz pipeline para L2:speed)
        if (getSelectedIds().length > 0) {
          useProgrammerStore.getState().setKineticSpeed(patternSpeed)
        }

        // Pattern + speed + amplitude + fan → AetherKineticEngine (WAVE 4700)
        this._schedulePatternFlush(activePattern, patternSpeed, patternAmplitude, fanValue)
        // PASO 1: cuando cambia el estado activo/inactivo del patrón,
        // re-emitir el classic flush con los nombres de canal correctos
        // (pan/tilt ↔ pan_base/tilt_base) para evitar stale orbit channels.
        const { pan, tilt } = useMovementStore.getState()
        this._scheduleClassicFlush(pan, tilt, fanValue)
      },
      { equalityFn: (a, b) =>
          a.activePattern === b.activePattern &&
          a.patternSpeed === b.patternSpeed &&
          a.patternAmplitude === b.patternAmplitude &&
          a.fanValue === b.fanValue
      },
    )

    // ── Suscripción 2: classic pan / tilt / fan / chaos (WAVE 4661 PASO 1+3) ─
    // El XY pad clásico escribe pan (0-540°) y tilt (0-270°) en el store.
    // El ChaosOrderSlider escribe chaosAmount (0-1) y chaosSeed (16-bit).
    // fanValue (-100..100): spread lineal adicional desde radar gestures.
    // WAVE 4717.2: fanValue también dispara _scheduleFanPhaseFlush() que calcula
    // un phase offset en radianes por índice de selección y lo envía al VMM vía IPC.
    const unsubClassic = useMovementStore.subscribe(
      (s) => ({
        pan: s.pan, tilt: s.tilt, fanValue: s.fanValue,
        chaosAmount: s.chaosAmount, chaosSeed: s.chaosSeed,
      }),
      ({ pan, tilt, fanValue }) => {
        this._scheduleClassicFlush(pan, tilt, fanValue)
        // WAVE 4717.2: fan como phase offset — funciona con y sin patrón activo
        this._scheduleFanPhaseFlush(fanValue)
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
  /**
   * WAVE 4719: GUARD SUICIDA ELIMINADO.
   *
   * _flushClassic ya NO aborta si hay pan/tilt en programmerStore.
   * La posicion del Radar ES la base de la orbita — no compite, SUMA.
   *
   * Logica de canal orbit vs absoluto (sin cambios en la math):
   *   - Sin patron activo: escribe 'pan'/'tilt' (absoluto, LTP)
   *   - Con patron activo: escribe 'pan_base'/'tilt_base'
   *     NodeArbiter.ts:322-329 suma la desviacion del LFO sobre esta base:
   *       output.pan = pan_base + (L0.pan - 0.5)
   *     => el patron oscila alrededor del punto exacto del Radar.
   *
   * Fan spread (dos fuentes aditivas, deterministicas):
   *   1. fanValue (-100..100): spread lineal simetrico +/-0.25 norm
   *   2. chaosAmount (0-1): spread caotico FNV-1a +/-0.35 norm
   */
  private async _flushClassic(
    pan: number,
    tilt: number,
    fanValue: number,
  ): Promise<void> {
    const fixtureIds = getSelectedIds()
    if (fixtureIds.length === 0) return
    // WAVE 4719: GUARD ELIMINADO. Pan/tilt no son causa de bloqueo.
    // Solo bloqueamos por overrides que NO sean posicion (speed, IK targets, extras).
    if (hasNonPositionKineticManual(fixtureIds)) return

    const panNorm  = Math.max(0, Math.min(1, pan  / 540))
    const tiltNorm = Math.max(0, Math.min(1, tilt / 270))
    const n        = fixtureIds.length

    const { activePattern, chaosAmount, chaosSeed } = useMovementStore.getState()
    const hasPattern  = isActivePattern(activePattern)
    // Con patron activo: canal orbit (NodeArbiter suma delta L0 sobre esta base).
    // Sin patron activo: canal absoluto LTP.
    const panChannel  = hasPattern ? 'pan_base'  : 'pan'
    const tiltChannel = hasPattern ? 'tilt_base' : 'tilt'

    const linearFanRange = (fanValue / 100) * 0.25
    const chaosSpread    = chaosAmount * 0.35

    const payloads = fixtureIds.map((id, i) => {
      const t           = n > 1 ? i / (n - 1) : 0.5
      const linearPart  = linearFanRange * (t * 2 - 1)
      const chaosPart   = chaosSpread    * fnv1aOffset(id, chaosSeed)
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
    fanValue: number,
  ): void {
    if (this._patternFlushTimeout !== null) clearTimeout(this._patternFlushTimeout)
    this._patternFlushTimeout = setTimeout(
      () => this._flushPattern(activePattern, patternSpeed, patternAmplitude, fanValue),
      KineticsBridgeClass.PATTERN_DEBOUNCE_MS,
    )
  }

  private async _flushPattern(
    activePattern: string,
    patternSpeed: number,
    patternAmplitude: number,
    fanValue: number,
  ): Promise<void> {
    const fixtureIds = getSelectedIds()
    if (fixtureIds.length === 0) return
    // WAVE 4719: GUARD SUICIDA ELIMINADO.
    // El patron y la posicion base son ortogonales — el operador DEBE poder
    // activar un patron mientras tiene una posicion base del Radar.
    // hasNonPositionKineticManual solo bloquea por speed/IK/extras, nunca por pan/tilt.

    const enginePattern = toEnginePattern(activePattern)

    // WAVE 4700: Incluir fan en el payload — el motor nativo integra el desfase
    try {
      await window.lux?.aether?.setManualPattern({
        fixtureIds,
        pattern: enginePattern,
        speed: patternSpeed,
        amplitude: patternAmplitude,
        fan: fanValue,  // [-100, 100] — el handler IPC normaliza a [0, 1]
      })
    } catch (err) {
      console.error('[KineticsBridge] setManualPattern error:', err)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FAN PHASE FLUSH — WAVE 4717.2
  // El fan distribute opera como un desfase de FASE (oscilador temporal).
  // fanValue=0   → todos en fase (sin offset). fanValue=±100 → ±2π spread total.
  // El offset se calcula por índice de selección (orden del usuario, determinista)
  // y se envía al VMM vía IPC → KineticAdapter lo lee en el hot-path (O(1)).
  // Funciona independientemente de si hay patrón activo o modo AI.
  // ─────────────────────────────────────────────────────────────────────────

  private _scheduleFanPhaseFlush(fanValue: number): void {
    if (this._fanPhaseFlushTimeout !== null) clearTimeout(this._fanPhaseFlushTimeout)
    this._fanPhaseFlushTimeout = setTimeout(
      () => this._flushFanPhase(fanValue),
      KineticsBridgeClass.CLASSIC_DEBOUNCE_MS,
    )
  }

  /**
   * WAVE 4717.2: Fan Distribute como phase offset en el oscilador del VMM.
   *
   * Matemática determinista por índice de selección:
   *   t = i / (N-1)  →  0..1 uniforme (i = índice en activeFixtureIds)
   *   phaseOffset = fanSpread * t * 2π  →  0..fanSpread*2π rad
   *
   * fanValue=0    → todos con offset=0 (en fase, Borg mode).
   * fanValue=100  → fixture 0: 0 rad, fixture N-1: 2π rad (un ciclo completo).
   * fanValue=-100 → fixture 0: 0 rad, fixture N-1: -2π rad (spread invertido).
   *
   * El Record se envía al VMM main-process vía IPC. El KineticAdapter lo lee
   * en process() sumándolo al phaseOffset L/R antes de generateIntent().
   */
  private async _flushFanPhase(fanValue: number): Promise<void> {
    const fixtureIds = getSelectedIds()
    const n = fixtureIds.length
    if (n === 0) return

    // fanValue (-100..100) → fanSpread (-1..1): fracción de 2π de spread total
    const fanSpread = fanValue / 100
    const TWO_PI = 2 * Math.PI

    // Construir el record de offsets — sin crear arrays intermedios
    const offsets: Record<string, number> = {}
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0  // 0..1 uniforme
      offsets[`${fixtureIds[i]}:kinetic`] = fanSpread * t * TWO_PI
    }

    try {
      await window.lux?.aether?.setKineticFanOffsets(offsets)
    } catch (err) {
      console.error('[KineticsBridge] setKineticFanOffsets error:', err)
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
    // WAVE 4719: spatial tampoco bloquea por posicion — solo por overrides no-posicion.
    if (hasNonPositionKineticManual(fixtureIds)) return
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
