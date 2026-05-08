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
 * @version WAVE 4651
 */

import { ipcMain } from 'electron'
import { getTitanOrchestrator } from '../orchestrator/TitanOrchestrator'
// WAVE 4651: masterArbiter es el delegado temporal para pattern engine e IK solver
// hasta que NodeArbiter implemente KineticEngine e IKResolver propios.
// La RUTA de IPC ya es nativa Aether — el engine cinematico sigue en master.
import { masterArbiter } from '../arbiter'

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
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        for (const { nodeId, channels } of payloads) {
          if (typeof nodeId === 'string' && nodeId.length > 0 && channels && typeof channels === 'object') {
            arbiter.setManualOverride(nodeId, channels)
          }
        }
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

  // ── E11/E12: Kinetic pattern engine + IK spatial solver (WAVE 4651) ─────────
  // El NodeArbiter opera sobre canales abstractos (pan, tilt, speed...).
  // La logica de pattern (timing matematico, anchor, sweep) y la resolucion
  // IK (giroscopio de cables, calibracion, pan range) viven en el ArbitrationDirector.
  // WAVE 4651: la RUTA IPC es 100% Aether. El engine de movimiento fisico
  // permanece en masterArbiter como motor compartido hasta WAVE 4700 (KineticSystem Aether).

  /**
   * E11: Set manual kinetic pattern para fixtures.
   * Ruta: lux:aether:setManualPattern (Aether IPC)
   * Engine: masterArbiter.setPattern() — motor cinematico compartido.
   * Payload: { fixtureIds, pattern, speed (0-100), amplitude (0-100) }
   */
  ipcMain.handle(
    'lux:aether:setManualPattern',
    (_event, { fixtureIds, pattern, speed, amplitude }: {
      fixtureIds: string[]
      pattern: string | null
      speed: number
      amplitude: number
    }) => {
      if (!Array.isArray(fixtureIds) || fixtureIds.length === 0) {
        return { success: false, error: 'fixtureIds must be a non-empty array' }
      }

      try {
        if (pattern === null || pattern === 'static' || pattern === 'hold') {
          masterArbiter.clearPattern(fixtureIds)
          return { success: true }
        }

        // Normalizacion speed: 0.05-0.5 Hz (rango WAVE 2652, constante fija)
        const SPEED_MIN = 0.05
        const SPEED_MAX = 0.5
        const speedNorm = SPEED_MIN + (speed / 100) * (SPEED_MAX - SPEED_MIN)
        const sizeNorm = (amplitude / 100) * 1.0

        // Anchor: posicion actual del primer fixture como centro del patron
        const anchorPos = masterArbiter.getCurrentPosition(fixtureIds[0])

        masterArbiter.setPattern(fixtureIds, {
          type: pattern as 'circle' | 'eight' | 'sweep' | 'tornado' | 'gravity_bounce' | 'butterfly' | 'heartbeat',
          speed: speedNorm,
          size: sizeNorm,
          center: { pan: anchorPos.pan, tilt: anchorPos.tilt },
        })
        return { success: true, pattern }
      } catch (err) {
        console.error('[AetherIPC] setManualPattern error:', err)
        return { success: false, error: String(err) }
      }
    }
  )

  /**
   * E12: Apply spatial target (IK solve) para fixtures.
   * Ruta: lux:aether:applySpatialTarget (Aether IPC)
   * Engine: masterArbiter.applySpatialTarget() — IK resolver compartido.
   * Payload: { target: {x,y,z}, fixtureIds, fanMode?, fanAmplitude? }
   */
  ipcMain.handle(
    'lux:aether:applySpatialTarget',
    (_event, { target, fixtureIds, fanMode, fanAmplitude }: {
      target: { x: number; y: number; z: number }
      fixtureIds: string[]
      fanMode?: 'converge' | 'line' | 'circle'
      fanAmplitude?: number
    }) => {
      if (!Array.isArray(fixtureIds) || fixtureIds.length === 0) {
        return { success: false, error: 'fixtureIds must be a non-empty array' }
      }

      try {
        const results = masterArbiter.applySpatialTarget(
          target,
          fixtureIds,
          fanMode ?? 'converge',
          fanAmplitude ?? 0
        )
        const serialized: Record<string, unknown> = {}
        results.forEach((result, id) => { serialized[id] = result })
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
   * Engine: masterArbiter.releaseSpatialTarget() — IK release compartido.
   */
  ipcMain.handle(
    'lux:aether:releaseSpatialTarget',
    (_event, { fixtureIds }: { fixtureIds: string[] }) => {
      if (!Array.isArray(fixtureIds)) {
        return { success: false, error: 'fixtureIds must be an array' }
      }

      try {
        masterArbiter.releaseSpatialTarget(fixtureIds)
        return { success: true }
      } catch (err) {
        console.error('[AetherIPC] releaseSpatialTarget error:', err)
        return { success: false, error: String(err) }
      }
    }
  )
}
