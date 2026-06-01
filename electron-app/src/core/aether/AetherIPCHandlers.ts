/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ AETHER IPC HANDLERS — WAVE 4529: THE PLUMBING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Handlers IPC para los overrides manuales L2 del NodeArbiter.
 * Recibe payloads del ProgrammerAetherBridge (frontend) y los escribe
 * directamente en el NodeArbiter sin transformación alguna.
 *
 * Los valores que llegan YA están normalizados (0-1). La normalización
 * ocurre en el programmerStore del frontend.
 *
 * Canales IPC:
 *   lux:aether:setManualOverrides    — Batch de nodeId+channels
 *   lux:aether:clearManualOverrides  — Array de nodeIds a limpiar
 *   lux:aether:clearAllManualOverrides — Reset global L2
 *
 * @module core/aether/AetherIPCHandlers
 * @version WAVE 4652
 */

import { ipcMain } from 'electron'
import { getTitanOrchestrator } from '../orchestrator/TitanOrchestrator'
// 🚦 WAVE 4704: masterArbiter eliminado. IK solver nativo directo.
import { buildProfile, solveGroupWithFan, setIKDebug } from '../../engine/movement/InverseKinematicsEngine'
import type { SpatialFanMode } from '../../engine/movement/InverseKinematicsEngine'
import type { InstallationOrientation } from '../stage/ShowFileV2'
// WAVE 4659: V3 — vibeMovementManager para propagar patrones manuales al pipeline Aether
import { vibeMovementManager } from '../../engine/movement/VibeMovementManager'
// ⚡ WAVE 4700: Motor cinético nativo L2 — sustituye masterArbiter + VMM para patrones manuales
import { aetherKineticEngine } from './AetherKineticEngine'
import type { NativeKineticPattern } from './AetherKineticEngine'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Payload que viaja por IPC desde el ProgrammerAetherBridge */
export interface ManualOverridePayload {
  /** NodeId en formato Aether: "<fixtureId>:<familyLabel>" */
  nodeId: string
  /** Valores normalizados 0-1 por canal */
  channels: Record<string, number>
}

// ─────────────────────────────────────────────────────────────────────────────
// CALIBRATION STATE — Global tracker para fixtures en modo calibración
// ─────────────────────────────────────────────────────────────────────────────
const _calibrationModeFixtures = new Set<string>()

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registra los handlers IPC del Aether Programmer.
 * Llamar desde main.ts durante la inicialización, DESPUÉS de que
 * el TitanOrchestrator esté disponible.
 */
export function registerAetherIPCHandlers(): void {

  /**
   * Set manual overrides — batch de payloads.
   * El bridge envía máximo 1 batch por tick de 44Hz.
   * Cada payload escribe directamente en L2 del NodeArbiter.
   */
  ipcMain.handle(
    'lux:aether:setManualOverrides',
    (_event, payloads: ManualOverridePayload[]) => {
      if (!Array.isArray(payloads) || payloads.length === 0) {
        return { success: false, error: 'Empty or invalid payloads' }
      }

      try {
        // 🔬 WAVE 4681: Log de supervivencia — confirma que el canal IPC llega al backend.
        console.log('[Aether IPC] 📥 Recibidos overrides manuales:', payloads.length)
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        for (const { nodeId, channels } of payloads) {
          if (typeof nodeId === 'string' && nodeId.length > 0 && channels && typeof channels === 'object') {
            arbiter.setManualOverride(nodeId, channels)
          }
        }
        // 🔬 WAVE 4735.6 DIAG: confirmar que _manualOverrides tiene las entradas
        const manualCount = arbiter.getManualOverrideNodeIds().length
        console.log(`[Aether IPC] 📥 Overrides aplicados. Total L2 nodes: ${manualCount}`)
        return { success: true }
      } catch (err) {
        console.error('[AetherIPC] setManualOverrides error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * Clear manual overrides para un array de nodeIds.
   * El bridge lo llama cuando un fixture pierde todos sus overrides
   * activos en el store (release por familia o release individual).
   */
  ipcMain.handle(
    'lux:aether:clearManualOverrides',
    (_event, nodeIds: string[]) => {
      if (!Array.isArray(nodeIds)) {
        return { success: false, error: 'nodeIds must be an array' }
      }

      try {
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        for (const nodeId of nodeIds) {
          if (typeof nodeId === 'string') {
            arbiter.clearManualOverride(nodeId)
          }
        }
        return { success: true }
      } catch (err) {
        console.error('[AetherIPC] clearManualOverrides error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * Clear ALL manual overrides — UNLOCK ALL global.
   * El L2 del NodeArbiter queda completamente vacío.
   * L0/L1/L3/LP fluyen sin impedimento.
   */
  ipcMain.handle(
    'lux:aether:clearAllManualOverrides',
    () => {
      try {
        getTitanOrchestrator().getAetherArbiter().clearAllManualOverrides()
        return { success: true }
      } catch (err) {
        console.error('[AetherIPC] clearAllManualOverrides error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * WAVE 4708 T3 — CAOS UNIFICADO:
   * Propaga la posición del slider ChaosOrderSlider al motor IA (L0).
   * El KineticAdapter lo usa como desfase de fase determinista por nodo,
   * unificando el comportamiento del caos entre patrones manuales y IA.
   * Payload: { amount: 0..1, seed: uint16 }
   */
  ipcMain.handle(
    'lux:aether:setGlobalKineticChaos',
    (_event, { amount, seed }: { amount: number; seed: number }) => {
      try {
        vibeMovementManager.setGlobalChaos(
          typeof amount === 'number' && Number.isFinite(amount) ? amount : 0,
          typeof seed === 'number' && Number.isFinite(seed) ? seed : 0,
        )
        return { success: true }
      } catch (err) {
        console.error('[AetherIPC] setGlobalKineticChaos error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * WAVE L2-SUPREMACY: Limpia todas las entradas del motor cinético nativo
   * (_motorKineticOverrides) del NodeArbiter. Los nodos dejan de tener
   * autoridad L2-MOTOR sobre pan/tilt — L0 retoma el control inmediatamente.
   * Útil como safety net al hacer Unlock cuando el motor fue detenido
   * sin arbiter (stop() sin argumento) y quedan overrides huérfanos.
   */
  ipcMain.handle(
    'lux:aether:clearAllMotorKineticOverrides',
    () => {
      try {
        getTitanOrchestrator().getAetherArbiter().clearAllMotorKineticOverrides()
        return { success: true }
      } catch (err) {
        console.error('[AetherIPC] clearAllMotorKineticOverrides error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * WAVE 4709 T1 — EXORCISMO POR LISTA:
   * Limpia entradas del Dual-Map del motor cinético por nodeId. Usado por
   * KineticsBridge cuando un fixture cae fuera de la selección activa
   * (orphan diffing) para evitar movers congelados en la última coordenada
   * L2 que el engine les calculó antes del despido.
   */
  ipcMain.handle(
    'lux:aether:clearMotorKineticOverrides',
    (_event, nodeIds: string[]) => {
      if (!Array.isArray(nodeIds)) {
        return { success: false, error: 'nodeIds must be an array' }
      }
      try {
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        for (const nodeId of nodeIds) {
          if (typeof nodeId === 'string') {
            arbiter.clearMotorKineticOverride(nodeId)
          }
        }
        return { success: true }
      } catch (err) {
        console.error('[AetherIPC] clearMotorKineticOverrides error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  // ── Inhibit Limit (WAVE 4531) ──────────────────────────────────────────

  /**
   * Set inhibit limits para un array de nodeIds.
   * El limit es un cap 0-1 sobre el canal `dimmer` del nodo, aplicado
   * post-arbitraje en el NodeArbiter (no en el bridge ni en el store).
   *
   * Payload: { nodeIds: string[], limit: number }
   */
  ipcMain.handle(
    'lux:aether:setInhibitLimit',
    (_event, { nodeIds, limit }: { nodeIds: string[], limit: number }) => {
      if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        return { success: false, error: 'nodeIds must be a non-empty array' }
      }
      if (typeof limit !== 'number') {
        return { success: false, error: 'limit must be a number' }
      }

      try {
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        for (const nodeId of nodeIds) {
          if (typeof nodeId === 'string' && nodeId.length > 0) {
            arbiter.setInhibitLimit(nodeId, limit)
          }
        }
        return { success: true }
      } catch (err) {
        console.error('[AetherIPC] setInhibitLimit error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * Clear inhibit limits para un array de nodeIds.
   * El canal `dimmer` vuelve a fluir sin cap.
   */
  ipcMain.handle(
    'lux:aether:clearInhibitLimit',
    (_event, nodeIds: string[]) => {
      if (!Array.isArray(nodeIds)) {
        return { success: false, error: 'nodeIds must be an array' }
      }

      try {
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        for (const nodeId of nodeIds) {
          if (typeof nodeId === 'string') {
            arbiter.clearInhibitLimit(nodeId)
          }
        }
        return { success: true }
      } catch (err) {
        console.error('[AetherIPC] clearInhibitLimit error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  // ── G1/G2: Blackout + GrandMaster globales (WAVE 4702) ─────────────────────
  // Atacan NodeArbiter (pipeline Aether). masterArbiter extinto — WAVE 4702.

  /**
   * G1: Set blackout global.
   * Escribe en NodeArbiter L4.
   * Payload: active boolean
   * Devuelve: { success, blackoutActive }
   */
  ipcMain.handle(
    'lux:aether:setBlackout',
    (_event, { active }: { active: boolean }) => {
      try {
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        arbiter.setBlackout(active)
        return { success: true, blackoutActive: active }
      } catch (err) {
        console.error('[AetherIPC] setBlackout error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * G1b: Set output gate global (ARM/LIVE) para pipeline Aether.
   * Payload: enabled boolean
   */
  ipcMain.handle(
    'lux:aether:setOutputEnabled',
    (_event, { enabled }: { enabled: boolean }) => {
      try {
        const orchestrator = getTitanOrchestrator()
        orchestrator.setOutputEnabled(!!enabled)
        return { success: true, outputEnabled: orchestrator.isOutputEnabled() }
      } catch (err) {
        console.error('[AetherIPC] setOutputEnabled error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * G1c: Read control gate state para hidratación de CommandDeck.
   */
  ipcMain.handle(
    'lux:aether:getControlState',
    () => {
      try {
        const orchestrator = getTitanOrchestrator()
        const arbiter = orchestrator.getAetherArbiter()
        return {
          success: true,
          outputEnabled: orchestrator.isOutputEnabled(),
          blackoutActive: arbiter.isBlackoutActive(),
          grandMaster: arbiter.getGrandMaster(),
          grandMasterSpeed: vibeMovementManager.getGlobalSpeedMultiplier(),
        }
      } catch (err) {
        console.error('[AetherIPC] getControlState error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * G2: Set grand master dimmer global (0-1).
   * Escribe en NodeArbiter L4.
   * Payload: value (0-1)
   */
  ipcMain.handle(
    'lux:aether:setGrandMaster',
    (_event, { value }: { value: number }) => {
      try {
        const clamped = value < 0 ? 0 : value > 1 ? 1 : value
        getTitanOrchestrator().getAetherArbiter().setGrandMaster(clamped)
        return { success: true, grandMaster: clamped }
      } catch (err) {
        console.error('[AetherIPC] setGrandMaster error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * G3: Set grand master speed (0.1-2.0) — escala velocidad AI global.
   * Controla VMM nativo del pipeline Aether.
   * Payload: value (0.1-2.0)
   */
  ipcMain.handle(
    'lux:aether:setGrandMasterSpeed',
    (_event, { value }: { value: number }) => {
      try {
        const clamped = value < 0.1 ? 0.1 : value > 2.0 ? 2.0 : value
        // Aether kinetic flow consumes VMM in hot-path. This is the canonical speed control.
        vibeMovementManager.setGlobalSpeedMultiplier(clamped)
        // 🔥 WAVE 4731 PASO 3: GM también escala L2 (AetherKineticEngine).
        aetherKineticEngine.setGrandMasterSpeed(clamped)
        return { success: true, grandMasterSpeed: vibeMovementManager.getGlobalSpeedMultiplier() }
      } catch (err) {
        console.error('[AetherIPC] setGrandMasterSpeed error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  // ── E11/E12: Kinetic pattern engine + IK spatial solver ─────────────────────
  // WAVE 4700: El motor cinético nativo (AetherKineticEngine) reemplaza a
  // masterArbiter.setPattern() + vibeMovementManager en el flujo de patrones
  // manuales. El engine acumula fase propia, calcula la posición con fan offset
  // determinista, y escribe pan_base/tilt_base en NodeArbiter L2 directamente.
  //
  // El IPC lux:aether:setKineticFanOffsets ya NO es necesario como canal
  // separado — el fan se integra en setManualPattern como parámetro `fan`.
  // El canal legacy queda como no-op para compatibilidad de llamadas antiguas
  // (KineticsBridge.ts lo sigue invocando en WAVE 4717.2).

  /**
   * E11: Set manual kinetic pattern para fixtures.
   * Ruta: lux:aether:setManualPattern (Aether IPC)
   * Engine: aetherKineticEngine — MOTOR NATIVO L2 (WAVE 4700).
   *
  * Payload: { fixtureIds, pattern, speed (0-100), amplitude (0-100), fan? (-100..100) }
   *
   * El motor escribe pan_base/tilt_base por fixture en cada tick de 44Hz.
   * El VMM se desactiva (setManualPattern(null)) para evitar doble oscilación:
   * el L0 queda en home (0.5) y el orbit math del Arbiter pasa pan_base sin suma.
   */
  ipcMain.handle(
    'lux:aether:setManualPattern',
    (_event, { fixtureIds, pattern, speed, amplitude, fan, anchorPan, anchorTilt }: {
      fixtureIds: string[]
      pattern: string | null
      speed: number
      amplitude: number
      fan?: number
      // WAVE 4708 T2: ancla del radar inyectada atomicamente con el pattern.
      // Si llega, el handler escribe pan_base/tilt_base en _manualOverrides
      // antes de activar el motor — elimina la ventana de carrera con _flushClassic.
      anchorPan?: number
      anchorTilt?: number
    }) => {
      console.log('[SONDA L2-IPC] Payload recibido:', { fixtureIds: fixtureIds?.length, pattern, speed, amplitude, fan, anchorPan, anchorTilt })
      if (!Array.isArray(fixtureIds) || fixtureIds.length === 0) {
        return { success: false, error: 'fixtureIds must be a non-empty array' }
      }

      try {
        const arbiter = getTitanOrchestrator().getAetherArbiter()

        // WAVE 4712 MULTITRACK: pattern: null|'hold'|'static' ahora elimina
        // SOLO las pistas de los fixtureIds dados. El resto del Map sigue
        // ejecutándose intacto (otros focos no se ven afectados).
        if (pattern === null || pattern === 'static' || pattern === 'hold') {
          const removeNodeIds = fixtureIds.map(id => `${id}:kinetic`)
          aetherKineticEngine.removeNodes(removeNodeIds, arbiter)
          // [WAVE 4937.1] EXPLICIT ARBITER CACHE PURGE ON UNLOCK
          // Si el patrón es null y no hay coordenadas de ancla, es un Unlock total.
          // Limpiar _manualOverrides para evitar Ghost Anchors congelados en L2.
          if (pattern === null && anchorPan === undefined && anchorTilt === undefined) {
            for (const id of fixtureIds) {
              arbiter.clearManualOverride(`${id}:kinetic`)
            }
          }
          // VMM: silenciar solo si el motor ya no tiene pistas (paridad legacy).
          if (!aetherKineticEngine.isActive()) {
            vibeMovementManager.setManualPattern(null)
            vibeMovementManager.setManualSpeed(null)
            vibeMovementManager.setManualAmplitude(null)
            vibeMovementManager.setKineticFanOffsets({})
          }
          return { success: true }
        }

        // Normalizar speed/amplitude de rango UI [0–100] a [0, 1]
        const speedNorm     = (speed     ?? 50) / 100
        const amplitudeNorm = (amplitude ?? 50) / 100
        const fanNorm       = (fan       ?? 0)  / 100

        // ⚡ WAVE 4915: Wire-up del slider de Amplitude al Relative Offset Routing.
        // Mapeo: slider [0..100] → ratio [0..2.0] (50 = 1.0 = legacy default).
        // El arbiter aplica clamp interno [0, 2] como red de seguridad.
        arbiter.setRelativeOffsetAmplitude(amplitudeNorm * 2)

        // Construir nodeIds en formato Aether: `${fixtureId}:kinetic`
        const nodeIds = fixtureIds.map(id => `${id}:kinetic`)

        // Mapear nombre de patrón UI → NativeKineticPattern
        const nativePattern = mapToNativePattern(pattern)

        // Silenciar VMM — con L2 supremacy el delta L0 ya no llega al resultado
        // final de pan/tilt, pero silenciar VMM evita el coste de CPU inútil.
        vibeMovementManager.setManualPattern(null)
        vibeMovementManager.setManualSpeed(null)
        vibeMovementManager.setManualAmplitude(null)
        vibeMovementManager.setKineticFanOffsets({})

        // ⚡ WAVE 4916 — IK ANCHOR PRESERVATION:
        // Antes de aceptar el anchor del payload UI (típicamente 0.5/0.5 = centro
        // muerto), por cada fixture comprobamos si tiene un Spatial Target IK
        // activo. Si sí, EL IK GANA: usamos `_motorKineticOverrides[pan/tilt_base]`
        // como anchor. El motor pattern entonces orbita alrededor del target real
        // del IK en lugar de saltar destructivamente al centro de la sala.
        //
        // Prioridad final del anchor por nodo:
        //   1. IK target activo (motor override) → preserva posición espacial.
        //   2. anchorPan/anchorTilt del payload UI → ancla del radar clásico.
        //   3. Sin escritura → engine cae al fallback 0.5 en su tick().
        //
        // WAVE 4708 T2 (legacy): la hidratación atómica anti-race-condition
        // sigue cubierta por las ramas 1 y 2.
        const fallbackPan  = (typeof anchorPan  === 'number' && Number.isFinite(anchorPan))
          ? (anchorPan  < 0 ? 0 : anchorPan  > 1 ? 1 : anchorPan)
          : null
        const fallbackTilt = (typeof anchorTilt === 'number' && Number.isFinite(anchorTilt))
          ? (anchorTilt < 0 ? 0 : anchorTilt > 1 ? 1 : anchorTilt)
          : null

        let radarPreservedCount = 0
        let ikPreservedCount   = 0
        for (const nodeId of nodeIds) {
          // WAVE 4940: DYNAMIC ANCHOR RESOLUTION — Jerarquía (Vivo > IK > Payload > Caché).
          // Reemplaza WAVE 4934 M2 que priorizaba el pan_base residual de la caché
          // del radar, causando el "efecto boomerang" al reactivar un patrón tras mover
          // el fixture: el LFO saltaba al centro del patrón original en lugar de orbitar
          // alrededor de la posición actual del fixture.
          //
          // Nueva prioridad por nodo:
          //   1. manual.pan / manual.tilt   — posición viva actual (Programmer override directo)
          //   2. motor.pan_base / tilt_base — target IK activo (applySpatialTarget)
          //   3. fallbackPan / fallbackTilt  — payload del UI normalizado (anchorPan del radar)
          //   4. manual.pan_base / tilt_base — caché del radar (último recurso)
          //   5. 0.5                         — fallback absoluto neutro
          const manual = arbiter.getManualOverride(nodeId)
          const motor  = arbiter.getMotorKineticOverride(nodeId)

          // Posición viva absoluta (canal directo pan/tilt, sin sufijo _base)
          const livePan  = manual && Number.isFinite(manual['pan'])  ? manual['pan']  : null
          const liveTilt = manual && Number.isFinite(manual['tilt']) ? manual['tilt'] : null

          // Target base del motor IK activo
          const ikPan  = motor && Number.isFinite(motor['pan_base'])  ? motor['pan_base']  : null
          const ikTilt = motor && Number.isFinite(motor['tilt_base']) ? motor['tilt_base'] : null

          // Caché del radar (activo tóxico — sólo como última red de seguridad)
          const cachePan  = manual && Number.isFinite(manual['pan_base'])  ? manual['pan_base']  : null
          const cacheTilt = manual && Number.isFinite(manual['tilt_base']) ? manual['tilt_base'] : null

          const resolvedAnchorPan  = livePan  ?? ikPan  ?? fallbackPan  ?? cachePan  ?? 0.5
          const resolvedAnchorTilt = liveTilt ?? ikTilt ?? fallbackTilt ?? cacheTilt ?? 0.5

          // Purga del "Activo Tóxico": sobrescribimos la caché con la verdad actual
          // para que un reactivar posterior siga viendo la posición correcta.
          const prev = manual ?? {}
          arbiter.setManualOverride(nodeId, { ...prev, pan_base: resolvedAnchorPan, tilt_base: resolvedAnchorTilt })

          if (livePan !== null)      radarPreservedCount++   // "vivo" cuenta como radar-preserved en logs
          else if (ikPan !== null)   ikPreservedCount++
        }
        if (radarPreservedCount > 0 || ikPreservedCount > 0) {
          console.log(
            `[AetherIPC ⚡ WAVE-4934] setManualPattern anchor: ` +
            `radar=${radarPreservedCount} ik=${ikPreservedCount} ` +
            `fallback=${nodeIds.length - radarPreservedCount - ikPreservedCount} ` +
            `total=${nodeIds.length} (pattern=${pattern})`,
          )
        }

        // Activar motor nativo con la configuración completa.
        // WAVE 4710: Programmer Paradigm — la selección NO dicta el ciclo de vida en L2.
        // Fixtures que salen del scope del engine quedan congelados vía L2-MOTOR
        // hasta un Unlock explícito. NO se limpian overrides aquí.
        aetherKineticEngine.setManualKinetics(nodeIds, nativePattern, speedNorm, amplitudeNorm, fanNorm, arbiter)

        return { success: true, pattern: nativePattern }
      } catch (err) {
        console.error('[AetherIPC] setManualPattern error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * E11b: Actualizar escalares (speed/amplitude/fan) sin reiniciar la fase.
   * Ruta: lux:aether:updateKineticScalars (Aether IPC) — NUEVO WAVE 4700.
   * Para cambios en tiempo real de los sliders de UI sin glitch de fase.
   * Payload: { speed (0-100), amplitude (0-100), fan (-100..100) }
   */
  ipcMain.handle(
    'lux:aether:updateKineticScalars',
    (_event, payload: {
      fixtureIds?: string[]  // WAVE 4712: opcional; si falta o vacío aplica a TODOS los nodos activos
      speed: number
      amplitude: number
      fan: number
    }) => {
      try {
        const speed     = (payload?.speed     ?? 50) / 100
        const amplitude = (payload?.amplitude ?? 50) / 100
        const fan       = (payload?.fan       ?? 0)  / 100

        // ⚡ WAVE 4915: live update del Relative Offset Amplitude (sin reiniciar fase).
        // Mismo mapeo que setManualPattern: [0..100] → [0..2.0].
        const arbiterForAmp = getTitanOrchestrator().getAetherArbiter()
        arbiterForAmp.setRelativeOffsetAmplitude(amplitude * 2)

        let nodeIds: string[]
        if (Array.isArray(payload?.fixtureIds) && payload.fixtureIds.length > 0) {
          nodeIds = payload.fixtureIds.map(id => `${id}:kinetic`)
        } else {
          // Compat: sin nodeIds, aplica a todos los nodos activos del motor.
          nodeIds = aetherKineticEngine.getState().nodeIds
        }
        aetherKineticEngine.updateScalars(nodeIds, speed, amplitude, fan)
        return { success: true }
      } catch (err) {
        console.error('[AetherIPC] updateKineticScalars error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * WAVE 4712 — HIDRATACIÓN SILENCIOSA:
   * Snapshot per-node del estado L2-MOTOR (patrón, scalars, anchor pan/tilt).
   * Llamado por KineticsBridge al cambiar la selección para poblar la UI
   * sin emitir un solo IPC de escritura. La UI muestra estado mixto si los
   * snapshots difieren entre sí para alguna propiedad.
   *
   * Payload: fixtureIds: string[]
   * Return:  states: KineticNodeStateSnapshot[]  (uno por fixture, orden preservado)
   */
  ipcMain.handle(
    'lux:aether:getKineticNodeStates',
    (_event, fixtureIds: string[]) => {
      if (!Array.isArray(fixtureIds)) {
        return { success: false, error: 'fixtureIds must be an array' }
      }
      try {
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        const states  = fixtureIds.map(id =>
          aetherKineticEngine.getNodeState(`${id}:kinetic`, arbiter)
        )
        return { success: true, states }
      } catch (err) {
        console.error('[AetherIPC] getKineticNodeStates error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * E11d WAVE 4701: Snapshot de estado manual del motor cinético nativo.
   * Se usa para hidratar UI (pattern/speed/amplitude/fan) al cambiar selección.
   */
  ipcMain.handle('lux:aether:getManualKineticState', () => {
    try {
      return { success: true, ...aetherKineticEngine.getState() }
    } catch (err) {
      console.error('[AetherIPC] getManualKineticState error:', err)
      return { success: false, error: String(err) }
    }
  })

  /**
   * E11c: Canal legacy para compatibilidad con WAVE 4717.2.
   * El fan ahora se pasa directamente en setManualPattern como parámetro `fan`.
   * Este handler queda como no-op (el motor nativo ignora el mapa de offsets VMM).
   */
  ipcMain.handle(
    'lux:aether:setKineticFanOffsets',
    (_event, _offsets: Record<string, number>) => {
      // No-op: los fan offsets se calculan nativamente en AetherKineticEngine.tick().
      // El canal IPC se mantiene para no romper llamadas desde KineticsBridge legacy.
      return { success: true }
    }
  )

  /**
   * E12: Apply spatial target (IK solve) para fixtures.
   * Ruta: lux:aether:applySpatialTarget (Aether IPC)
   * Engine: InverseKinematicsEngine.solveGroupWithFan() — WAVE 4704 (masterArbiter eliminado)
   * Payload: { target: {x,y,z}, fixtureIds, fanMode?, fanAmplitude?, fixturePositions? }
   *
   * WAVE 4884 Fase 2B: fixturePositions es un mapa id→Position3D enviado por el frontend
   * (KineticsBridge) con las coordenadas reales del stageStore. Se usa con prioridad sobre
   * f.position del Orchestrator para evitar la amnesia espacial (posiciones {0,0,0} cuando
   * isPlaced:true no ha sido sincronizado).
   */
  ipcMain.handle(
    'lux:aether:applySpatialTarget',
    (_event, { target, fixtureIds, fanMode, fanAmplitude, fixturePositions, fixtureIKProfiles }: {
      target: { x: number; y: number; z: number }
      fixtureIds: string[]
      fanMode?: 'converge' | 'line' | 'circle'
      fanAmplitude?: number
      fixturePositions?: Record<string, { x: number; y: number; z: number }>
      fixtureIKProfiles?: Record<string, {
        orientation?: string
        rotation?: { pitch: number; yaw: number; roll: number }
        calibration?: {
          panOffset: number
          tiltOffset: number
          panInvert: boolean
          tiltInvert: boolean
        }
        panRangeDeg?: number
        tiltRangeDeg?: number
        isPlaced?: boolean
      }>
    }) => {
      if (!Array.isArray(fixtureIds) || fixtureIds.length === 0) {
        return { success: false, error: 'fixtureIds must be a non-empty array' }
      }

      try {
        const orchestrator = getTitanOrchestrator()
        const arbiter = orchestrator.getAetherArbiter()
        const allFixtures: any[] = (orchestrator as any).fixtures ?? []

        const profiles = []
        const validIds: string[] = []
        // ── WAVE 4881 Fase 2: anti-flip ──
        // Construir mapa fixtureId → currentPanDMX leyendo el override L2 vivo
        // del arbiter (pan_base 0..1) y escalándolo a DMX. Sin esto el solver
        // no puede aplicar shortest-path y los cruces de hemisferio giran 540°.
        const currentPanDMXMap = new Map<string, number>()

        for (const id of fixtureIds) {
          const f = allFixtures.find((x: any) => x.id === id)
          const stageIK = fixtureIKProfiles?.[id]
          if (stageIK?.isPlaced === false) continue
          // WAVE 4884 Fase 2B: la posición real llega en el payload (fixturePositions).
          // Si no está en el payload, fallback a f.position del Orchestrator.
          // Si ninguno tiene posición válida, se salta el fixture.
          const resolvedPosition = fixturePositions?.[id] ?? f?.position
          if (!resolvedPosition) continue
          const cal = stageIK?.calibration ?? f?.calibration
          const physics = f?.physics
          const orientationRaw = stageIK?.orientation ?? f?.orientation ?? f?.installationType
          const installation = (
            orientationRaw === 'ceiling' ||
            orientationRaw === 'floor' ||
            orientationRaw === 'totem' ||
            orientationRaw === 'truss-front' ||
            orientationRaw === 'truss-back' ||
            orientationRaw === 'wall-left' ||
            orientationRaw === 'wall-right'
          )
            ? orientationRaw
            : 'ceiling'
          // WAVE 4910: REVERT WAVE 4905 — panInvert debe ser false.
          //
          // WAVE 4905 asumió que la fórmula del visualizador era:
          //   panAngle = -(physicalPan - 0.5) * range  (con negativo)
          // y concluyó que panInvert=true convergía. Ese análisis era incorrecto.
          //
          // El código real del visualizador (HyperionMovingHead3D.tsx L242) es:
          //   panAngle = (smoothPan - 0.5) * PAN_RANGE  (SIN negativo)
          //
          // Con la fórmula real:
          //   panInvert=false: panDMX=161 → livePan=0.63 → panAngle=+35° → CONVERGE ✓
          //   panInvert=true:  panDMX=94  → livePan=0.37 → panAngle=-35° → DIVERGE ✗
          //
          // El showfile tiene panInvert:false (configurado por el usuario). Respetamos eso.
          // ── WAVE 4881 Fase 2: rango mecánico real ──
          // Leer panRange/tiltRange en cascada para evitar el fallback ciego
          // a 540/270. Orden: root-level legacy → capabilities → physics.
          const panRangeDeg: number | undefined =
            stageIK?.panRangeDeg ?? f?.panRangeDeg ?? f?.capabilities?.panRange ?? physics?.panRange
          const tiltRangeDeg: number | undefined =
            stageIK?.tiltRangeDeg ?? f?.tiltRangeDeg ?? f?.capabilities?.tiltRange ?? physics?.tiltRange
          if (panRangeDeg === undefined || tiltRangeDeg === undefined) {
            console.warn(
              `[AetherIPC applySpatialTarget] fixture=${id} sin panRange/tiltRange explícitos; ` +
              `IK caerá a defaults industria 540°/270°. Recomendado: declarar capabilities.panRange/tiltRange.`,
            )
          }
          const profile = buildProfile(
            id,
            resolvedPosition,
            stageIK?.rotation ?? f?.rotation,
            installation as InstallationOrientation,
            {
              panOffset:  cal?.panOffset  ?? 0,
              tiltOffset: cal?.tiltOffset ?? 0,
              panInvert:  false,  // WAVE 4910: visualizador usa (pan-0.5)*range (sin negativo)
              tiltInvert: false,  // siempre false (WAVE 4898 frame correcto)
            },
            panRangeDeg,
            tiltRangeDeg,
            physics?.tiltLimits,
          )
          profiles.push(profile)
          validIds.push(id)

          // ── currentPanDMX desde L2: pan_base está en 0..1, DMX en 0..255 ──
          const l2 = arbiter.getManualOverride(`${id}:kinetic`)
          const panBase = l2 && Number.isFinite(l2['pan_base']) ? l2['pan_base'] : undefined
          if (panBase !== undefined) {
            const clamped = panBase < 0 ? 0 : panBase > 1 ? 1 : panBase
            currentPanDMXMap.set(id, clamped * 255)
          }
        }

        if (profiles.length === 0) return { success: true, results: {} }

        // ⚡ WAVE 4915: Pre-computar Spatial Distance Scale por fixture (§3.2 del blueprint).
        // Mantiene el arco visual del patrón VMM aproximadamente constante entre fixtures
        // cercanos y lejanos al target. Formula lineal simple: scale = d_ref / distance,
        // recortado a [0.25, 2.0] por el setter del arbiter.
        const D_REF = 8.0  // metros — distancia "de diseño" (blueprint §3.2)
        for (let i = 0; i < profiles.length; i++) {
          const id = validIds[i]
          const fxPos = profiles[i].position
          if (!fxPos) continue
          const dx = fxPos.x - target.x
          const dy = fxPos.y - target.y
          const dz = fxPos.z - target.z
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (!Number.isFinite(distance) || distance < 1e-6) {
            // Fixture prácticamente encima del target — máximo arco órbital.
            arbiter.setSpatialDistanceScale(`${id}:kinetic`, 2.0)
            continue
          }
          const scale = D_REF / distance
          arbiter.setSpatialDistanceScale(`${id}:kinetic`, scale)
        }

        const results = solveGroupWithFan(
          profiles,
          target,
          (fanMode ?? 'converge') as SpatialFanMode,
          fanAmplitude ?? 0,
          currentPanDMXMap.size > 0 ? currentPanDMXMap : null,
        )

        const serialized: Record<string, unknown> = {}
        for (const id of validIds) {
          const ikResult = results.get(id)
          if (!ikResult) continue

          // WAVE 4885 Fase 2: guard anti-NaN.
          // El IK puede producir NaN si resolvedPosition llegó malformado (x/y/z no-finitos).
          // Un NaN en _motorKineticOverrides envenenaría el árbitro para ese fixture.
          const panNorm  = ikResult.pan  / 255
          const tiltNorm = ikResult.tilt / 255
          if (!Number.isFinite(panNorm) || !Number.isFinite(tiltNorm)) {
            console.error(
              `[AetherIPC applySpatialTarget] NaN en output IK fixture=${id}` +
              ` pan=${ikResult.pan} tilt=${ikResult.tilt} — fixture ignorado.`,
            )
            continue
          }

          // WAVE 4885 Fase 2: setMotorKineticOverride en lugar de setManualOverride.
          // setManualOverride escribe en _manualOverrides donde pan_base/tilt_base son
          // el anchor del radar clásico y NO se traducen a pan/tilt (ver NodeArbiter.ts:532).
          // setMotorKineticOverride escribe en _motorKineticOverrides — bloque L2-MOTOR
          // que aplica DESPUÉS del Grand Master con supremacía absoluta sobre pan/tilt.
          arbiter.setMotorKineticOverride(`${id}:kinetic`, {
            pan_base:  panNorm,
            tilt_base: tiltNorm,
          })
          serialized[id] = ikResult
        }

        return { success: true, results: serialized }
      } catch (err) {
        console.error('[AetherIPC] applySpatialTarget error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * E12: Release spatial target — devuelve fixtures al control AI.
   * Ruta: lux:aether:releaseSpatialTarget (Aether IPC)
   * Engine: NodeArbiter.clearManualOverride — WAVE 4704 (masterArbiter eliminado)
   */
  ipcMain.handle(
    'lux:aether:releaseSpatialTarget',
    (_event, { fixtureIds }: { fixtureIds: string[] }) => {
      if (!Array.isArray(fixtureIds)) {
        return { success: false, error: 'fixtureIds must be an array' }
      }

      try {
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        for (const id of fixtureIds) {
          arbiter.clearManualOverride(`${id}:kinetic`)
          // ⚡ WAVE 4915: limpiar la distance scale junto con el override.
          arbiter.clearSpatialDistanceScale(`${id}:kinetic`)
        }
        // Si el caller libera todos los fixtures (release global), limpiar la tabla entera
        // como red de seguridad ante leaks de scales huérfanas.
        if (fixtureIds.length === 0) {
          arbiter.clearAllSpatialDistanceScales()
        }
        return { success: true }
      } catch (err) {
        console.error('[AetherIPC] releaseSpatialTarget error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  // ── F1: FIXTURE SYNC — Canal canónico → TitanOrchestrator (WAVE 4702) ───────
  /**
   * F1: Sync fixtures desde stageStore al NodeGraph de Aether.
   * Reemplaza lux:arbiter:setFixtures como canal canónico.
   * Llama a TitanOrchestrator.setFixtures() que internamente:
   *   - Actualiza HAL
   *   - Llama _syncFixturesToAether (NodeGraph full-resync)
   * Devuelve: { success, fixtureCount, liquidLayout }
   */
  ipcMain.handle(
    'lux:aether:setFixtures',
    (_event, { fixtures, stageBounds }: { fixtures: any[] | Record<string, any>; stageBounds?: any }) => {
      try {
        // WAVE TYPECAST: El store puede serializar fixtures como Record<id, Fixture>
        // en lugar de Array. Normalizamos aquí antes de tocar el Orchestrator.
        const fixtureArray: any[] = Array.isArray(fixtures)
          ? fixtures
          : Object.values(fixtures as Record<string, any>)
        const orchestrator = getTitanOrchestrator()
        const liquidLayout = orchestrator.setFixtures(fixtureArray, stageBounds)
        return { success: true, fixtureCount: fixtureArray.length, liquidLayout }
      } catch (err) {
        console.error('[AetherIPC] setFixtures error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  // ── G1: TUNGSTEN GOLDEN NUKE (WAVE 4699.2) ───────────────────────────────

  /**
   * G1: Dispara un override L2 sobre los nodos flash del Tungsten.
   *
   * Payload:
   *   target  — 'all' | 'petal-l' | 'petal-c' | 'petal-r' | 'spin'
   *   release — true = clearManualOverride (Note Off / fader a 0)
   *   value   — [0,1] intensidad (solo para 'spin': valor bipolar norm 0–1)
   *
   * Color dorado puro = #FFD700 → r=1.0, g=0.843, b=0.0
   * Zona flash es aditiva (WAVE 4696) → "quema" sobre la luz actual.
   */
  ipcMain.handle(
    'lux:aether:fireTungstenNuke',
    (_event, { target, release, value }: { target: string; release?: boolean; value?: number }) => {
      try {
        const orchestrator = getTitanOrchestrator()
        const arbiter      = orchestrator.getAetherArbiter()
        const tungstenList = orchestrator.getTungstenNodeIds()

        if (tungstenList.length === 0) {
          return { success: false, error: 'No Tungsten fixture registered in NodeGraph' }
        }

        for (const t of tungstenList) {
          if (target === 'spin') {
            // Bipolar spin: value 0–1 (0=full-left, 0.5=stop, 1=full-right)
            const norm = typeof value === 'number' ? Math.max(0, Math.min(1, value)) : 0.5
            if (release) {
              arbiter.setManualOverride(t.kinetic, { rotation: 0.5 })
            } else {
              arbiter.setManualOverride(t.kinetic, { rotation: norm })
            }
          } else if (target === 'all') {
            // WAVE 4828: The Software Cable Merge
            // Dispara simultaneamente los 4 nodos del Punio Dorado (Master + 3 Petalos)
            const goldNodes = [
              { nodeId: t.goldenMaster, family: 'golden-master', needsStrobe: true },
              { nodeId: t.petalL,       family: 'petal-l',      needsStrobe: false },
              { nodeId: t.petalC,       family: 'petal-c',      needsStrobe: false },
              { nodeId: t.petalR,       family: 'petal-r',      needsStrobe: false },
            ]
            if (release) {
              for (const node of goldNodes) {
                arbiter.clearManualOverride(node.nodeId)
              }
            } else {
              const intensity = typeof value === 'number' ? value : 1.0
              for (const node of goldNodes) {
                const overridePayload: Record<string, number> = { dimmer: intensity }
                if (node.needsStrobe) overridePayload['strobe'] = 1.0
                arbiter.setManualOverride(node.nodeId, overridePayload)
              }
            }
          } else if (target === 'gold') {
            // WAVE 4828: The Software Cable Merge
            // Simultaneo Master + Petalos
            const goldNodes = [
              { nodeId: t.goldenMaster, family: 'golden-master', needsStrobe: true },
              { nodeId: t.petalL,       family: 'petal-l',      needsStrobe: false },
              { nodeId: t.petalC,       family: 'petal-c',      needsStrobe: false },
              { nodeId: t.petalR,       family: 'petal-r',      needsStrobe: false },
            ]
            if (release) {
              for (const node of goldNodes) {
                arbiter.clearManualOverride(node.nodeId)
              }
              // 🔥 WAVE 4835 — DMX BYPASS: Desactivar inyección directa
              // Hay potencial que el deviceId sea extráible del nodeId, pero por ahora
              // asumimos que `t.goldenMaster` contiene "deviceId:golden-master"
              const deviceId = t.goldenMaster.split(':')[0]
              orchestrator.clearGoldenNukeLock(deviceId)
            } else {
              const intensity = typeof value === 'number' ? Math.max(0, Math.min(1, value)) : 1.0
              for (const node of goldNodes) {
                const overridePayload: Record<string, number> = { dimmer: intensity }
                if (node.needsStrobe) overridePayload['strobe'] = 1.0
                arbiter.setManualOverride(node.nodeId, overridePayload)
              }
              // 🔥 WAVE 4835 — DMX BYPASS: Activar inyección directa
              // Clava 255 en los canales CH2-6 del Tungsteno mientras está pulsado
              const deviceId = t.goldenMaster.split(':')[0]
              orchestrator.setGoldenNukeLock(deviceId)
            }
          } else if (target === 'petal-l' || target === 'petal-c' || target === 'petal-r') {
            const nodeId = target === 'petal-l' ? t.petalL
                         : target === 'petal-c' ? t.petalC
                         : t.petalR
            if (release) {
              arbiter.clearManualOverride(nodeId)
            } else {
              const intensity = typeof value === 'number' ? value : 1.0
              arbiter.setManualOverride(nodeId, { dimmer: intensity })
            }
          } else {
            return { success: false, error: `Unknown target: ${target}` }
          }
        }

        return { success: true }
      } catch (err) {
        console.error('[AetherIPC] fireTungstenNuke error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  // ── R1: L2 State Reader (WAVE 4653) ─────────────────────────────────────

  /**
   * R1: Devuelve los overrides manuales L2 activos para los nodeIds pedidos.
   *
   * La UI lo llama al seleccionar fixtures para hidratar los sliders con el
   * estado real del arbiter en lugar de usar defaults engañosos.
   *
   * Payload: { nodeIds: string[] }
   * Retorno: { success, overrides: { [nodeId]: Record<string,number> | null } }
   */
  ipcMain.handle(
    'lux:aether:getL2State',
    (_event, { nodeIds }: { nodeIds: string[] }) => {
      if (!Array.isArray(nodeIds)) {
        return { success: false, error: 'nodeIds must be an array' }
      }
      try {
        const overrides = getTitanOrchestrator()
          .getAetherArbiter()
          .getManualOverridesForNodes(nodeIds)
        return { success: true, overrides }
      } catch (err) {
        console.error('[AetherIPC] getL2State error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * WAVE 4893: Toggle telemetría temporal del IK engine.
   * Uso desde DevTools del renderer: await window.luxDebug.ikDebug(true)
   * Activa console.log('[IK] {...}') por cada solve() en el proceso main.
   */
  ipcMain.handle(
    'lux:ik:setDebug',
    (_event, { enabled }: { enabled: boolean }) => {
      setIKDebug(!!enabled)
      return { success: true, enabled: !!enabled }
    },
  )

  // ── CALIBRATION MODE HANDLERS (NEW) ──────────────────────────────────────────

  /**
   * WAVE 4918: Enter calibration mode para un fixture.
   * Marca el fixture como "en calibración", permitiendo acceso directo a canales.
   * Payload: { fixtureId: string }
   * Return: { success: boolean, error?: string }
   */
  ipcMain.handle(
    'lux:arbiter:enterCalibrationMode',
    (_event, { fixtureId }: { fixtureId: string }) => {
      try {
        if (typeof fixtureId !== 'string' || fixtureId.length === 0) {
          return { success: false, error: 'Invalid fixtureId' }
        }
        _calibrationModeFixtures.add(fixtureId)
        console.log(`[CalibrationIPC] 📋 Entrada: ${fixtureId}`)
        return { success: true }
      } catch (err) {
        console.error('[CalibrationIPC] enterCalibrationMode error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * WAVE 4918: Exit calibration mode para un fixture.
   * Quita el fixture del set de calibración.
   * Payload: { fixtureId: string }
   * Return: { success: boolean, error?: string }
   */
  ipcMain.handle(
    'lux:arbiter:exitCalibrationMode',
    (_event, { fixtureId }: { fixtureId: string }) => {
      try {
        if (typeof fixtureId !== 'string' || fixtureId.length === 0) {
          return { success: false, error: 'Invalid fixtureId' }
        }
        _calibrationModeFixtures.delete(fixtureId)
        // 🎯 WAVE 4949: Red de seguridad backend — limpiar overrides manuales
        // del fixture al salir de calibración para evitar fugas persistentes.
        try {
          const arbiter = getTitanOrchestrator().getAetherArbiter()
          arbiter.clearManualOverride(`${fixtureId}:color`)
          arbiter.clearManualOverride(`${fixtureId}:impact`)
          arbiter.clearManualOverride(`${fixtureId}:kinetic`)
        } catch (clearErr) {
          console.warn(`[CalibrationIPC] Safety-net clear failed for ${fixtureId}:`, clearErr)
        }
        console.log(`[CalibrationIPC] 📋 Salida: ${fixtureId}`)
        return { success: true }
      } catch (err) {
        console.error('[CalibrationIPC] exitCalibrationMode error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * WAVE 4918: Query si un fixture está en calibración.
   * Payload: { fixtureId: string }
   * Return: { success: boolean, calibrating: boolean, error?: string }
   */
  ipcMain.handle(
    'lux:arbiter:isCalibrating',
    (_event, { fixtureId }: { fixtureId: string }) => {
      try {
        if (typeof fixtureId !== 'string' || fixtureId.length === 0) {
          return { success: false, error: 'Invalid fixtureId' }
        }
        const calibrating = _calibrationModeFixtures.has(fixtureId)
        return { success: true, calibrating }
      } catch (err) {
        console.error('[CalibrationIPC] isCalibrating error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * WAVE 4918: Get fixture state snapshot para hydración en CalibrationView.
   * Retorna dimmer, pan, tilt, etc. normalizados 0-1 por fixture.
   * Payload: { fixtureIds: string[] }
   * Return: { success: boolean, state: { [fixtureId]: { dimmer?, pan?, tilt?, ... } }, error?: string }
   */
  ipcMain.handle(
    'lux:arbiter:getFixturesState',
    (_event, { fixtureIds }: { fixtureIds: string[] }) => {
      try {
        if (!Array.isArray(fixtureIds) || fixtureIds.length === 0) {
          return { success: false, error: 'fixtureIds must be a non-empty array' }
        }

        const orchestrator = getTitanOrchestrator()
        const fixturesMapping = orchestrator.getFixturesForZoneMapping()

        // Construir estado para cada fixture solicitado
        const stateByFixtureId: Record<string, Record<string, number>> = {}

        for (const fixtureId of fixtureIds) {
          if (typeof fixtureId !== 'string') continue

          const fixtureData = fixturesMapping.find(f => f.id === fixtureId)
          if (!fixtureData) {
            stateByFixtureId[fixtureId] = {}
            continue
          }

          // Estado default: dimmer apagado, pan/tilt centrados
          const state: Record<string, number> = {
            dimmer: 0, // default: off
            pan: 0.5, // default: centered
            tilt: 0.5, // default: centered
          }

          stateByFixtureId[fixtureId] = state
        }

        return { success: true, state: stateByFixtureId }
      } catch (err) {
        console.error('[CalibrationIPC] getFixturesState error:', err)
        return { success: false, error: String(err) }
      }
    }
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WAVE 4700: PATTERN NAME MAPPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WAVE 4713: Las keys del motor están alineadas 1:1 con `PatternArsenal.tsx`.
 * Este mapper se reduce a un pass-through con compat para nombres legacy del
 * masterArbiter / movementStore antiguos. El fallback sigue siendo `'circle'`
 * para evitar que un nombre desconocido silencie el motor.
 */
function mapToNativePattern(pattern: string): NativeKineticPattern {
  const MAP: Record<string, NativeKineticPattern> = {
    // Pass-through directo — keys alineadas con la UI
    'static':    'static',
    'circle':    'circle',
    'eight':     'eight',
    'sweep':     'sweep',
    'darkspin':  'darkspin',
    'bounce':    'bounce',
    'butterfly': 'butterfly',
    'pulse':     'pulse',

    // ── Compat: nombres legacy del masterArbiter / VMM / movementStore ──
    'circle_big':     'circle',
    'figure8':        'eight',
    'figure_8':       'eight',
    'lemniscate':     'eight',     // figure8 horizontal → eight
    'scan_x':         'sweep',
    'square':         'circle',
    'diamond':        'circle',
    'wave_y':         'bounce',    // ola en U → bounce
    'wave':           'bounce',
    'ballyhoo':       'pulse',     // caos pulsante → pulse
    'sway':           'sweep',
    'tornado':        'darkspin',
    'gravity_bounce': 'bounce',
    'heartbeat':      'pulse',
  }
  return MAP[pattern] ?? 'circle'
}
