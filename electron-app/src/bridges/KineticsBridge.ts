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

import { useMovementStore, type PatternType } from '../stores/movementStore'
import { useProgrammerStore } from '../stores/programmerStore'
import { useSelectionStore } from '../stores/selectionStore'
import { useKineticHydrationStore, nativePatternToUI } from '../stores/kineticHydrationStore'

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

  /** Debounce en ms para agrupar cambios continuos de speed/amplitude */
  private static readonly PATTERN_DEBOUNCE_MS = 30
  /** Debounce en ms para agrupar cambios continuos del target 3D */
  private static readonly SPATIAL_DEBOUNCE_MS = 20
  /** Debounce en ms para agrupar arrastres continuos del XY pad clásico */
  private static readonly CLASSIC_DEBOUNCE_MS = 16

  // ── CLEAN BUS: caché del último setManualPattern enviado al motor ──────
  // Permite detectar si el patrón y los fixtures son los mismos para usar
  // updateKineticScalars (scalars-only, fase continua) en lugar de setManualPattern.
  private _lastPatternSent: string | null = null
  private _lastFixtureKeysSent: string | null = null

  // ── WAVE 4709 T2: SILENT RESET SEMAPHORE ───────────────────────────────
  // Contador de flushes clásicos a suprimir tras un Unlock. handleUnlockKinetics
  // resetea la UI del radar (pan/tilt → defaults) sin querer reescribir L2:
  // bumpea este contador, la subscripción classic decrementa y skipea.
  private _suppressClassicFlushCount: number = 0

  start(): void {
    if (this._started) {
      console.warn('[KineticsBridge] Ya iniciado, ignorando start()')
      return
    }
    this._started = true

    // ── Suscripción 1: pattern + speed + amplitude ──────────────────────
    // WAVE 4712: SOLO se dispara ante GESTOS del operador (cambios en
    // movementStore). La hidratación de la UI tras un cambio de selección
    // se hace en `unsubSelection` poblando `kineticHydrationStore` directamente,
    // SIN tocar movementStore — por tanto este handler no se activa por ese flujo.
    const unsubPattern = useMovementStore.subscribe(
      (s) => ({
        activePattern: s.activePattern,
        patternSpeed: s.patternSpeed,
        patternAmplitude: s.patternAmplitude,
        fanValue: s.fanValue,
        chaosAmount: s.chaosAmount,  // WAVE 4707: chaos como fan spread del motor
      }),
      ({ activePattern, patternSpeed, patternAmplitude, fanValue, chaosAmount }) => {
        const selectedIds = getSelectedIds()
        if (selectedIds.length === 0) return  // sin selección no hay destino para el intent

        // WAVE 4712 — OPTIMISTIC HYDRATION:
        // Reflejar el intent del operador en el hydration store antes del IPC
        // ack. Así el botón/slider que el operador acaba de tocar se actualiza
        // de forma inmediata y se computa el aggregate (mixed/uniforme) sin lag.
        useKineticHydrationStore.getState().applyOperatorIntent(selectedIds, {
          pattern:   activePattern,
          speed:     patternSpeed,
          amplitude: patternAmplitude,
          fan:       chaosAmount * 100,
        })

        // Speed → programmerStore (44Hz pipeline para L2:speed)
        useProgrammerStore.getState().setKineticSpeed(patternSpeed)

        // Pattern + speed + amplitude → AetherKineticEngine (WAVE 4700)
        // WAVE 4707: chaosAmount (0-1) * 100 → fan del motor (S6 fix).
        // El ChaosOrderSlider es el control de dispersión/fan del motor nativo.
        // fanValue (radar gesture spread) sigue siendo el fan del flush clásico.
        this._schedulePatternFlush(activePattern, patternSpeed, patternAmplitude, chaosAmount * 100)
        // cuando cambia el estado activo/inactivo del patrón,
        // re-emitir el classic flush con los nombres de canal correctos
        // (pan/tilt ↔ pan_base/tilt_base) para evitar stale orbit channels.
        const { pan, tilt } = useMovementStore.getState()
        this._scheduleClassicFlush(pan, tilt, fanValue)
      },
      { equalityFn: (a, b) =>
          a.activePattern === b.activePattern &&
          a.patternSpeed === b.patternSpeed &&
          a.patternAmplitude === b.patternAmplitude &&
          a.fanValue === b.fanValue &&
          a.chaosAmount === b.chaosAmount  // WAVE 4707: chaos dispara flush de patrón
      },
    )

    // ── Suscripción 2: classic pan / tilt / fan / chaos (WAVE 4661 PASO 1+3) ─
    // El XY pad clásico escribe pan (0-540°) y tilt (0-270°) en el store.
    // El ChaosOrderSlider escribe chaosAmount (0-1) y chaosSeed (16-bit).
    // fanValue (-100..100): spread lineal adicional desde radar gestures.
    // WAVE 4718: _scheduleFanPhaseFlush eliminada — el fan viaja integrado en
    // _flushPattern como parámetro, y setKineticFanOffsets IPC es no-op.
    // WAVE 4708 T3: chaosAmount/chaosSeed también se propagan al motor IA (L0)
    // vía setGlobalKineticChaos para unificar el caos entre L0 y L2.
    const unsubClassic = useMovementStore.subscribe(
      (s) => ({
        pan: s.pan, tilt: s.tilt, fanValue: s.fanValue,
        chaosAmount: s.chaosAmount, chaosSeed: s.chaosSeed,
      }),
      ({ pan, tilt, fanValue, chaosAmount, chaosSeed }) => {
        // WAVE 4709 T2: si la UI fue reseteada silenciosamente (post-Unlock),
        // consumir el token de supresión y NO escribir a L2. Evita que el
        // "centro 270°/135°" del reset se grabe como nuevo lock manual y
        // bloquee al motor IA (L0) de retomar el control.
        if (this._suppressClassicFlushCount > 0) {
          this._suppressClassicFlushCount--
        } else {
          this._scheduleClassicFlush(pan, tilt, fanValue)

          // WAVE 4712 — OPTIMISTIC HYDRATION (radar drag):
          // El cursor del radar lee panAnchor/tiltAnchor del hydration store.
          // Sin esta proyección, el cursor quedaría congelado durante el drag
          // (la siguiente actualización vendría solo al cambiar selección).
          const selectedIds = getSelectedIds()
          if (selectedIds.length > 0) {
            useKineticHydrationStore.getState().applyOperatorIntent(selectedIds, {
              panAnchor:  pan,
              tiltAnchor: tilt,
              fan:        chaosAmount * 100,
            })
          }
        }
        // WAVE 4708 T3: caos unificado L0 — best-effort, sin debounce (slider ya
        // emite a ~60 Hz máx; el handler IPC es trivial: dos asignaciones).
        void window.lux?.aether?.setGlobalKineticChaos?.({
          amount: chaosAmount,
          seed:   chaosSeed,
        })
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

    // ── Suscripción 5: selección de fixtures (WAVE L2-SUPREMACY) ───────────
    // Cuando el operador cambia la selección sin tocar los campos cinéticos,
    // el motor nativo quedaba apuntando a los fixtures anteriores (scope stale).
    // Fix: invalidar la caché de fixtureKey y re-enviar el estado actual del
    // movementStore para que el motor reciba los nuevos nodeIds de inmediato.
    //
    // WAVE 4707 S1: NO se llama a _scheduleClassicFlush desde aquí.
    // Seleccionar un fixture ≠ Escribir posición sobre él.
    // _flushClassic solo debe ejecutarse ante un gesto explícito del operador
    // sobre el radar (click/drag). Escribir los defaults del store (270°/135°)
    // sobre un fixture recién seleccionado lo snapeaba al centro — freeze de foco.
    // WAVE 4712 — HIDRATACIÓN SILENCIOSA:
    // Cambiar la selección NO emite IPC. En su lugar, el bridge consulta al
    // backend el estado L2 actual de los fixtures seleccionados y lo vierte en
    // `kineticHydrationStore` para que la UI muestre los valores reales (o
    // el sentinel "mixed" cuando difieren). El operador queda libre de
    // recorrer fixtures sin alterar el show.
    const unsubSelection = useSelectionStore.subscribe(
      (s) => s.selectedIds,
      (currentSelectedIds) => {
        // Invalidar caché de patrón — la próxima escritura real será completa.
        this._lastFixtureKeysSent = null
        const ids = Array.from(currentSelectedIds)
        void this._hydrateFromBackend(ids)
      },
      {
        equalityFn: (a, b) => {
          // Set es reference type — comparar contenido explícitamente
          if (a.size !== b.size) return false
          for (const id of a) if (!b.has(id)) return false
          return true
        },
      },
    )

    this._unsubscribers = [unsubPattern, unsubClassic, unsubSpatial, unsubFan, unsubSelection]

    // WAVE 4712: hidratación inicial de la selección que ya estuviera activa
    // al montar el bridge (cold start tras reload). Sin esto la UI mostraría
    // valores fantasma hasta el primer cambio de selección.
    void this._hydrateFromBackend(getSelectedIds())

    console.log('[KineticsBridge] 🧠 Iniciado — Neural Link activo')
  }

  /**
   * WAVE 4712 — HIDRATACIÓN SILENCIOSA:
   * Lee `getKineticNodeStates` del backend para los fixtureIds dados y
   * vuelca el resultado en `kineticHydrationStore`. NO emite IPC de escritura.
   * Convierte unidades del engine (norm [0,1]) a UI (deg / %, etc).
   */
  private async _hydrateFromBackend(fixtureIds: string[]): Promise<void> {
    const hydration = useKineticHydrationStore.getState()
    if (fixtureIds.length === 0) {
      hydration.recomputeAggregate([])
      return
    }
    try {
      const res = await window.lux?.aether?.getKineticNodeStates(fixtureIds)
      if (!res?.success || !res.states) {
        hydration.recomputeAggregate(fixtureIds)
        return
      }
      // Backend devuelve un snapshot por fixtureId en el mismo orden enviado.
      const states = res.states.map((s, i) => ({
        fixtureId: fixtureIds[i],
        snapshot: {
          active:     s.active,
          pattern:    nativePatternToUI(s.pattern) as PatternType,
          speed:      s.speed     * 100,
          amplitude:  s.amplitude * 100,
          fan:        s.fan       * 100,
          panAnchor:  s.panAnchor  * 540,
          tiltAnchor: s.tiltAnchor * 270,
        },
      }))
      hydration.setNodeStates(states, fixtureIds)
    } catch (err) {
      console.error('[KineticsBridge] _hydrateFromBackend error:', err)
    }
  }

  /**
   * WAVE 4709 T2 — RESET RADAR UI sin escribir L2.
   *
   * Vuelca pan/tilt/fanValue/chaos a defaults en movementStore y suprime los
   * flushes clásicos derivados para que el "centro" no se grabe como un nuevo
   * lock manual que bloquee al motor IA (L0). Llamado por handleUnlockKinetics.
   *
   * Bumpea el semáforo en 3 (cubre los hasta 3 disparos posibles de la
   * subscripción classic: pan/tilt, fanValue, chaosAmount/Seed).
   */
  resetRadarSilent(): void {
    // Cancelar primero cualquier flush clásico en cola del último gesto del
    // operador — si llega antes del set(), reescribiría L2 con valores stale.
    if (this._classicFlushTimeout !== null) {
      clearTimeout(this._classicFlushTimeout)
      this._classicFlushTimeout = null
    }
    // Bumpear semáforo ANTES de los set() — cubre los disparos derivados.
    this._suppressClassicFlushCount += 3
    const ms = useMovementStore.getState()
    ms.setPanTilt(270, 135)
    ms.setFanValue(0)
    ms.setChaosAmount(0)

    // WAVE 4712: tras un Unlock, el backend ya limpió las pistas — refresca
    // el hydration store para que la UI (PatternArsenal, faders, radar)
    // refleje el estado neutral inmediato sin esperar a un cambio de selección.
    useKineticHydrationStore.getState().reset()
    void this._hydrateFromBackend(getSelectedIds())
  }

  stop(): void {
    if (this._patternFlushTimeout !== null) clearTimeout(this._patternFlushTimeout)
    if (this._spatialFlushTimeout !== null) clearTimeout(this._spatialFlushTimeout)
    if (this._classicFlushTimeout !== null) clearTimeout(this._classicFlushTimeout)
    this._patternFlushTimeout = null
    this._spatialFlushTimeout = null
    this._classicFlushTimeout = null
    this._lastPatternSent = null
    this._lastFixtureKeysSent = null
    this._suppressClassicFlushCount = 0
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

    // CLEAN BUS: si el patrón y los fixtures son los mismos que el último flush,
    // usar updateKineticScalars (scalars-only, fase NO se reinicia).
    // Solo se hace setManualPattern completo cuando cambia patrón o selección.
    const fixtureKey = fixtureIds.slice().sort().join(',')
    const isStop = enginePattern === 'hold'
    const samePatternAndFixtures =
      !isStop &&
      enginePattern === this._lastPatternSent &&
      fixtureKey === this._lastFixtureKeysSent

    if (samePatternAndFixtures) {
      try {
        // WAVE 4712: pasar fixtureIds para scope per-fixture en multitrack.
        // Sin nodeIds, el engine actualizaría TODAS sus pistas activas (bleed).
        await window.lux?.aether?.updateKineticScalars({
          fixtureIds,
          speed: patternSpeed,
          amplitude: patternAmplitude,
          fan: fanValue,
        })
      } catch (err) {
        console.error('[KineticsBridge] updateKineticScalars error:', err)
      }
      return
    }

    // Patrón nuevo, fixtures cambiaron, o stop — ruta completa.
    // Invalidar caché antes del await para no usar datos stale si falla.
    this._lastPatternSent = isStop ? null : enginePattern
    this._lastFixtureKeysSent = isStop ? null : fixtureKey

    // WAVE 4708 T2 — ANCHOR HYDRATION: leer la posición ACTUAL del radar
    // del movementStore y enviarla normalizada en el mismo payload. El handler
    // IPC inyecta pan_base/tilt_base en _manualOverrides ANTES de activar el
    // motor → el primer tick lee el anchor real, no el fallback 0.5.
    const { pan: anchorPanDeg, tilt: anchorTiltDeg } = useMovementStore.getState()
    const anchorPan  = Math.max(0, Math.min(1, anchorPanDeg  / 540))
    const anchorTilt = Math.max(0, Math.min(1, anchorTiltDeg / 270))

    // WAVE 4700: Incluir fan en el payload — el motor nativo integra el desfase
    console.log('[SONDA L2-FRONT] Enviando patrón:', enginePattern, 'Fixtures:', fixtureIds.length, 'anchor:', { anchorPan, anchorTilt })
    try {
      await window.lux?.aether?.setManualPattern({
        fixtureIds,
        pattern: enginePattern,
        speed: patternSpeed,
        amplitude: patternAmplitude,
        fan: fanValue,  // [-100, 100] — el handler IPC normaliza a [0, 1]
        anchorPan,      // [0, 1] — WAVE 4708 T2
        anchorTilt,     // [0, 1] — WAVE 4708 T2
      })
    } catch (err) {
      // Si el setManualPattern falla, invalidar caché para forzar reintento completo
      this._lastPatternSent = null
      this._lastFixtureKeysSent = null
      console.error('[KineticsBridge] setManualPattern error:', err)
    }
  }

  // 🪦 WAVE 4718: _scheduleFanPhaseFlush / _flushFanPhase eliminados.
  // El fan viaja integrado en _flushPattern como parámetro `fan`.
  // window.lux.aether.setKineticFanOffsets IPC es no-op en backend — tráfico fantasma.

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
