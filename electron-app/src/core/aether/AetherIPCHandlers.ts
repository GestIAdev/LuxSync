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
import { computeFanSubTargets, setIKDebug } from '../../engine/movement/InverseKinematicsEngine'
import type { SpatialFanMode } from '../../engine/movement/InverseKinematicsEngine'
// WAVE 4659: V3 — vibeMovementManager para propagar patrones manuales al pipeline Aether
import { vibeMovementManager } from '../../engine/movement/VibeMovementManager'
// ⚡ WAVE 4700: Motor cinético nativo L2 — sustituye masterArbiter + VMM para patrones manuales
import { aetherKineticEngine } from './AetherKineticEngine'
import type { NativeKineticPattern } from './AetherKineticEngine'
import type { IKineticNodeData } from './capability-node'
import { NodeFamily } from './types'

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

// WAVE 6020 FIX: Claves IK que NUNCA deben sobrevivir en merges aditivos
const IK_POISON_KEYS = new Set(['targetX', 'targetY', 'targetZ', 'focusX', 'focusY', 'focusZ'])

// ── WAVE 6040.5 FIX: Resolución dinámica de sufijo cinético para fixtures Forge Graph.
// Los fixtures legacy usan :kinetic; los fixtures Forge Graph usan :kinetic-N.
// Esta función traduce el nodeId canónico al real antes de tocar el arbiter.
function resolveKineticNodeId(nodeId: string): string {
  if (!nodeId.endsWith(':kinetic')) return nodeId
  const orchestrator = getTitanOrchestrator()
  const graph = orchestrator.getAetherNodeGraph()
  if (graph.getNodeData(nodeId) != null) return nodeId
  const prefix = nodeId.slice(0, -8)
  const deviceNodes = graph.getDeviceNodes?.(prefix as any)
  if (!deviceNodes) return nodeId
  for (const nid of deviceNodes) {
    if (nid.startsWith(prefix) && graph.getNodeData(nid)?.family === NodeFamily.KINETIC) {
      return nid
    }
  }
  return nodeId
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
  ipcMain.on(
    'lux:aether:setManualOverrides',
    (_event, payloads: ManualOverridePayload[]) => {
      if (!Array.isArray(payloads) || payloads.length === 0) {
        return
      }

      try {
        // 🔬 WAVE 4681: Log de supervivencia — confirma que el canal IPC llega al backend.
        console.log('[Aether IPC] 📥 Recibidos overrides manuales:', payloads.length)
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        for (const { nodeId, channels } of payloads) {
          if (typeof nodeId === 'string' && nodeId.length > 0 && channels && typeof channels === 'object') {
            const resolvedNodeId = resolveKineticNodeId(nodeId)
            // WAVE 6020.8 DIAG: Log base anchor values — IK-space contamination check
            const ch = channels as Record<string, number>
            if ('pan_base' in ch || 'tilt_base' in ch) {
              const hasFade = arbiter.hasReleaseFade(resolvedNodeId)
              console.log(`[ZOMBIE-DIAG] setManualOverrides ${resolvedNodeId}: pan_base=${ch['pan_base']?.toFixed(4)} tilt_base=${ch['tilt_base']?.toFixed(4)} hasFade=${hasFade}`)
            }
            arbiter.setManualOverride(resolvedNodeId, channels)
          }
        }
        // 🔬 WAVE 4735.6 DIAG: confirmar que _manualOverrides tiene las entradas
        const manualCount = arbiter.getManualOverrideNodeIds().length
        console.log(`[Aether IPC] 📥 Overrides aplicados. Total L2 nodes: ${manualCount}`)
      } catch (err) {
        console.error('[AetherIPC] setManualOverrides error:', err)
      }
    }
  )

  /**
   * Clear manual overrides para un array de nodeIds.
   * El bridge lo llama cuando un fixture pierde todos sus overrides
   * activos en el store (release por familia o release individual).
   */
  ipcMain.on(
    'lux:aether:clearManualOverrides',
    (_event, nodeIds: string[]) => {
      if (!Array.isArray(nodeIds)) {
        return
      }

      try {
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        const kineticClears = nodeIds.filter(id => typeof id === 'string' && id.includes(':kinetic'))
        if (kineticClears.length > 0) {
          console.log(`[ZOMBIE-DIAG] 🔥 AetherIPC clearManualOverrides KINETIC: ${kineticClears.join(', ')} | total=${nodeIds.length}`)
        }
        for (const nodeId of nodeIds) {
          if (typeof nodeId === 'string') {
            const resolved = resolveKineticNodeId(nodeId)
            // MANUAL PATTERN LOCK: skip nodes with active L2 pattern.
            // The SURVIVAL layer fires reactive clears after upserts;
            // without this guard, the anchor pan_base/tilt_base is wiped.
            if (arbiter.hasManualPatternLock(resolved)) {
              console.log(`[ZOMBIE-DIAG] clearManualOverrides SKIPPED (pattern-lock): ${resolved}`)
              continue
            }
            arbiter.clearManualOverride(resolved)
          }
        }
      } catch (err) {
        console.error('[AetherIPC] clearManualOverrides error:', err)
      }
    }
  )

  /**
   * Clear ALL manual overrides — UNLOCK ALL global.
   * El L2 del NodeArbiter queda completamente vacío.
   * L0/L1/L3/LP fluyen sin impedimento.
   */
  ipcMain.on(
    'lux:aether:clearAllManualOverrides',
    () => {
      try {
        getTitanOrchestrator().getAetherArbiter().clearAllManualOverrides()
      } catch (err) {
        console.error('[AetherIPC] clearAllManualOverrides error:', err)
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
  ipcMain.on(
    'lux:aether:setGlobalKineticChaos',
    (_event, { amount, seed }: { amount: number; seed: number }) => {
      try {
        vibeMovementManager.setGlobalChaos(
          typeof amount === 'number' && Number.isFinite(amount) ? amount : 0,
          typeof seed === 'number' && Number.isFinite(seed) ? seed : 0,
        )
      } catch (err) {
        console.error('[AetherIPC] setGlobalKineticChaos error:', err)
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
  ipcMain.on(
    'lux:aether:clearAllMotorKineticOverrides',
    () => {
      console.log('[ZOMBIE-DIAG] IPC clearAllMotorKineticOverrides called')
      try {
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        const preCount = (arbiter as any)._motorKineticOverrides?.size ?? 'unknown'
        arbiter.clearAllMotorKineticOverrides()
        console.log(`[ZOMBIE-DIAG] clearAllMotorKineticOverrides: ${preCount} entries cleared`)
      } catch (err) {
        console.error('[AetherIPC] clearAllMotorKineticOverrides error:', err)
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
  ipcMain.on(
    'lux:aether:clearMotorKineticOverrides',
    (_event, nodeIds: string[]) => {
      if (!Array.isArray(nodeIds)) {
        return
      }
      try {
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        for (const nodeId of nodeIds) {
          if (typeof nodeId === 'string') {
            arbiter.clearMotorKineticOverride(nodeId)
          }
        }
      } catch (err) {
        console.error('[AetherIPC] clearMotorKineticOverrides error:', err)
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
  ipcMain.on(
    'lux:aether:setInhibitLimit',
    (_event, { nodeIds, limit }: { nodeIds: string[], limit: number }) => {
      if (!Array.isArray(nodeIds) || nodeIds.length === 0) {
        return
      }
      if (typeof limit !== 'number') {
        return
      }

      try {
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        for (const nodeId of nodeIds) {
          if (typeof nodeId === 'string' && nodeId.length > 0) {
            arbiter.setInhibitLimit(nodeId, limit)
          }
        }
      } catch (err) {
        console.error('[AetherIPC] setInhibitLimit error:', err)
      }
    }
  )

  /**
   * Clear inhibit limits para un array de nodeIds.
   * El canal `dimmer` vuelve a fluir sin cap.
   */
  ipcMain.on(
    'lux:aether:clearInhibitLimit',
    (_event, nodeIds: string[]) => {
      if (!Array.isArray(nodeIds)) {
        return
      }

      try {
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        for (const nodeId of nodeIds) {
          if (typeof nodeId === 'string') {
            arbiter.clearInhibitLimit(nodeId)
          }
        }
      } catch (err) {
        console.error('[AetherIPC] clearInhibitLimit error:', err)
      }
    }
  )

  // ── G1/G2: Blackout + GrandMaster globales (WAVE 4702) ─────────────────────
  // Atacan NodeArbiter (pipeline Aether). masterArbiter extinto — WAVE 4702.

  /**
   * WAVE 5020: G0 — Selection Kill (inhibit selectivo).
   * Aplica o libera un inhibit 0.0 solo en los nodos :impact de los fixtures indicados.
   * Pan/Tilt/Kinetic siguen vivos — los movers mantienen posición exacta durante el kill.
   * Payload: { fixtureIds: string[], active: boolean }
   * Devuelve: { success }
   */
  ipcMain.on(
    'lux:aether:setSelInhibit',
    (_event, { fixtureIds, active }: { fixtureIds: string[]; active: boolean }) => {
      try {
        const orchestrator = getTitanOrchestrator()
        const arbiter = orchestrator.getAetherArbiter()
        const nodeGraph = orchestrator.getAetherNodeGraph()
        for (const fixtureId of fixtureIds) {
          const nodeIds = nodeGraph.getDeviceNodes(fixtureId as import('./types').DeviceId)
          for (const nodeId of nodeIds) {
            const node = nodeGraph.getNodeData(nodeId)
            if (node && node.family === NodeFamily.IMPACT) {
              if (active) {
                arbiter.setInhibitLimit(nodeId, 0)
              } else {
                arbiter.clearInhibitLimit(nodeId)
              }
            }
          }
        }
      } catch (err) {
        console.error('[AetherIPC] setSelInhibit error:', err)
      }
    }
  )

  /**
   * G1: Set blackout global.
   * Escribe en NodeArbiter L4.
   * Payload: active boolean
   * WAVE 7594: fire-and-forget — no return value.
   */
  ipcMain.on(
    'lux:aether:setBlackout',
    (_event, { active }: { active: boolean }) => {
      try {
        const arbiter = getTitanOrchestrator().getAetherArbiter()
        arbiter.setBlackout(active)
      } catch (err) {
        console.error('[AetherIPC] setBlackout error:', err)
      }
    }
  )

  /**
   * G1b: Set output gate global (ARM/LIVE) para pipeline Aether.
   * Payload: enabled boolean
   * WAVE 7594: fire-and-forget — no return value.
   */
  ipcMain.on(
    'lux:aether:setOutputEnabled',
    (_event, { enabled }: { enabled: boolean }) => {
      try {
        const orchestrator = getTitanOrchestrator()
        orchestrator.setOutputEnabled(!!enabled)
      } catch (err) {
        console.error('[AetherIPC] setOutputEnabled error:', err)
      }
    }
  )

  /**
   * Alias for lux:arbiter:setOutputEnabled — preload.ts maps
   * window.lux.arbiter.setOutputEnabled to this channel.
   */
  ipcMain.handle(
    'lux:arbiter:setOutputEnabled',
    (_event, { enabled }: { enabled: boolean }) => {
      try {
        const orchestrator = getTitanOrchestrator()
        orchestrator.setOutputEnabled(!!enabled)
        return { success: true, outputEnabled: orchestrator.isOutputEnabled() }
      } catch (err) {
        console.error('[AetherIPC] arbiter:setOutputEnabled error:', err)
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
  ipcMain.on(
    'lux:aether:setGrandMaster',
    (_event, { value }: { value: number }) => {
      try {
        const clamped = value < 0 ? 0 : value > 1 ? 1 : value
        getTitanOrchestrator().getAetherArbiter().setGrandMaster(clamped)
      } catch (err) {
        console.error('[AetherIPC] setGrandMaster error:', err)
      }
    }
  )

  /**
   * G3: Set grand master speed (0.1-2.0) — escala velocidad AI global.
   * Controla VMM nativo del pipeline Aether.
   * Payload: value (0.1-2.0)
   * WAVE 7594: fire-and-forget — no return value.
   */
  ipcMain.on(
    'lux:aether:setGrandMasterSpeed',
    (_event, { value }: { value: number }) => {
      try {
        const clamped = value < 0.1 ? 0.1 : value > 2.0 ? 2.0 : value
        // Aether kinetic flow consumes VMM in hot-path. This is the canonical speed control.
        vibeMovementManager.setGlobalSpeedMultiplier(clamped)
        // 🔥 WAVE 4731 PASO 3: GM también escala L2 (AetherKineticEngine).
        aetherKineticEngine.setGrandMasterSpeed(clamped)
      } catch (err) {
        console.error('[AetherIPC] setGrandMasterSpeed error:', err)
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
  ipcMain.on(
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
      console.log('[ZOMBIE-DIAG] 🔥 setManualPattern ENTER. Payload:', { fixtureIds: fixtureIds?.length, pattern, speed, amplitude, fan, anchorPan, anchorTilt })
      const arbiter = getTitanOrchestrator().getAetherArbiter()
      const diagNodeIds = fixtureIds.map(id => resolveKineticNodeId(`${id}:kinetic`))
      for (const nodeId of diagNodeIds) {
        const manual = arbiter.getManualOverride(nodeId)
        const motor = arbiter.getMotorKineticOverride(nodeId)
        if (manual || motor) {
          console.log(`[ZOMBIE-DIAG] Pre-op state ${nodeId}: manualKeys=[${manual ? Object.keys(manual).join(',') : 'none'}] motorKeys=[${motor ? Object.keys(motor).join(',') : 'none'}]`)
        }
      }
      if (!Array.isArray(fixtureIds) || fixtureIds.length === 0) {
        return { success: false, error: 'fixtureIds must be a non-empty array' }
      }

      try {
        // ═══════════════════════════════════════════════════════════════
        // WAVE 6019.5 — HANDOFF L2→L0: SEPARACIÓN RELEASE vs HOLD
        //
        // 'release'|'idle'|null → PURGA DESTRUCTIVA PURA (Unlock real).
        //   NO rescata estado del motor. NO secuestra L2.
        //   El motor automático L0 retoma el control inmediatamente.
        //
        // 'hold'|'static' → FREEZE INTENCIONAL (Fix C preservado).
        //   Migra motor→manual para congelar fixtures en su última
        //   posición espacial. El operador quiere mantener la escena.
        // ═══════════════════════════════════════════════════════════════
        if (pattern === 'release' || pattern === 'idle' || pattern === null) {
          console.log('[ZOMBIE-DIAG] → Branch RELEASE/NULL (restoring fade + clean snapshot)')
          const orchestrator = getTitanOrchestrator()
          const nodeGraph = orchestrator.getAetherNodeGraph()
          const removeNodeIds = fixtureIds.map(id => resolveKineticNodeId(`${id}:kinetic`))

          // MANUAL PATTERN LOCK: release the locks so clearManualOverride can proceed normally.
          for (const nodeId of removeNodeIds) {
            arbiter.clearManualPatternLock(nodeId)
          }

          // WAVE 6020.5 FIX: Capturar estado IK ANTES de removeNodes.
          // currentPosition.tilt tiene semántica distinta según la ruta:
          //   · Ruta IK  (_writeNodeIK): guarda DMX_físico/255 — el IKEngine
          //     calcula los ángulos sin inversión. Para que el fade clásico
          //     mantenga la misma posición física, hay que aplicar 1−value
          //     (NodeResolver invertirá el resultado con 255−dmxValue).
          //   · Ruta clásica (VMM/L0): guarda el valor pre-inversión del
          //     Arbiter. NodeResolver lo invierte solo al emitir. Si aplicamos
          //     1−value encima, habrá doble inversión → fixture al lado opuesto.
          // Solución: solo invertir si el nodo tenía motor kinetic override activo
          // (= estaba en modo IK). removeNodes lo limpiará enseguida, así que
          // hay que capturarlo AQUÍ antes de llamarlo.
          const ikActiveNodes = new Set<string>()
          for (const nodeId of removeNodeIds) {
            if (arbiter.getMotorKineticOverride(nodeId)) {
              ikActiveNodes.add(nodeId)
            }
          }

          aetherKineticEngine.removeNodes(removeNodeIds, arbiter)
          // WAVE 6020.12: Purgar motor overrides huérfanos de applySpatialTarget.
          // removeNodes solo limpia los nodos que estaban en _nodeConfigs del AKE.
          // Los spatial targets escriben directo al arbiter vía setMotorKineticOverride
          // sin pasar por AKE → removeNodes los ignora. Debemos exorcizarlos aquí.
          for (const nodeId of removeNodeIds) {
            arbiter.clearMotorKineticOverride(nodeId)
            // WAVE 6020.13: Purgar escala de distancia espacial. Si persiste,
            // _applyRelativeOffsetFusion multiplica los offsets L0 por un factor
            // grande (ej. 2.0 para fixtures cercanos al target), amplificando el
            // movimiento post-Unlock y disparando el Airbag.
            arbiter.clearSpatialDistanceScale(nodeId)
          }
          const physicsPP = orchestrator.getPhysicsPostProcessor()
          for (const id of fixtureIds) {
            const nodeId = resolveKineticNodeId(`${id}:kinetic`)
            const kineticNode = nodeGraph.getNodeData(nodeId) as IKineticNodeData | undefined
            if (kineticNode?.currentPosition) {
              let safePan  = kineticNode.currentPosition.pan
              let safeTilt = kineticNode.currentPosition.tilt

              // Detectar si NodeResolver aplica 255-dmxValue en ruta clásica
              // (misma lógica que _shouldInvertClassicKineticAxes).
              const device = nodeGraph.getDevice(kineticNode.deviceId)
              const deviceOrientation = device?.orientation?.toLowerCase().trim()
              const installation = kineticNode.ikOrientation?.installation
              const pitch = kineticNode.ikOrientation?.rotation?.pitch
              const isClassicInverted =
                (deviceOrientation?.includes('ceiling') || deviceOrientation?.startsWith('truss')) ||
                (installation === 'ceiling' || installation === 'truss-front' || installation === 'truss-back') ||
                (Number.isFinite(pitch) && Math.abs(Math.abs(pitch as number) - 180) < 0.001)

              // WAVE 7616: La compensación `1.0 - safeTilt` fue ELIMINADA.
              // Ahora el IK path (NodeResolver._writeNodeIK) aplica la inversión
              // de orientación nativamente, por lo que currentPosition.tilt ya
              // contiene el valor DMX correcto (post-inversión). Aplicar la
              // compensación aquí causaría doble inversión durante el fade.
              // El flag isClassicInverted se conserva solo para logging.
              const wasInIKMode = ikActiveNodes.has(nodeId)

              if (Number.isFinite(safePan) && Number.isFinite(safeTilt)) {
                arbiter.setManualOverride(nodeId, { pan: safePan, tilt: safeTilt })
                // WAVE 6020.6 FIX: Sembrar el estado de física del PPP con el
                // snapshot. Sin esto, PhysicsPostProcessor sobreescribe
                // entry['pan/tilt'] con state[SLOT_PAN/TILT_POS] stale (0.5,
                // congelado desde antes del modo espacial), ignorando el snapshot
                // correcto que _applyReleaseFades inyecta. Con seed=snapshot,
                // delta PPP = 0 → no interpola → fixture permanece en posición.
                physicsPP.seedClassicState(nodeId, safePan, safeTilt)
                console.log(`[ZOMBIE-DIAG] Safe snapshot seeded ${nodeId}: pan=${safePan.toFixed(4)} tilt=${safeTilt.toFixed(4)} (classicInv=${isClassicInverted} wasIK=${wasInIKMode})`)
              }
            }
            arbiter.clearManualOverride(nodeId)
            // WAVE 6020.10 ATOMIC IK PURGE: Purgar claves IK del nodo BASE
            // DESPUÉS de capturar el snapshot y ANTES de que cualquier frame corra.
            // Esto elimina la race condition de purgeBaseSpatial (IPC async) que
            // ejecutaba ANTES de este handler y sobreescribía currentPosition.tilt
            // via ruta clásica (ceiling: 255-127=128, 128/255≈0.5020) antes del snapshot.
            // WAVE 6020.11: Ampliado a :kinetic — Ruta IK Fantasma erradicada.
            const targetNodes = [id, resolveKineticNodeId(`${id}:kinetic`)]
            for (const nodeId of targetNodes) {
              const manualOverride = arbiter.getManualOverride(nodeId)
              if (manualOverride) {
                for (const key of IK_POISON_KEYS) {
                  delete (manualOverride as Record<string, number>)[key]
                }
              }
            }
            physicsPP.resetSpatialState(resolveKineticNodeId(`${id}:kinetic`))
          }
          for (const nodeId of removeNodeIds) {
            const manual = arbiter.getManualOverride(nodeId)
            const motor = arbiter.getMotorKineticOverride(nodeId)
            console.log(`[ZOMBIE-DIAG] Post-RELEASE ${nodeId}: manual=${manual ? 'EXISTS:'+Object.keys(manual).join(',') : 'CLEARED'} motor=${motor ? 'EXISTS:'+Object.keys(motor).join(',') : 'CLEARED'}`)
          }
          if (!aetherKineticEngine.isActive()) {
            vibeMovementManager.setL2Active(false)
            vibeMovementManager.setKineticFanOffsets({})
          }
          console.log('[ZOMBIE-DIAG] ✅ RELEASE branch complete')
          return { success: true }
        }

        if (pattern === 'hold' || pattern === 'static') {
          console.log('[ZOMBIE-DIAG] → Branch HOLD (freeze intentional)')
          const removeNodeIds = fixtureIds.map(id => resolveKineticNodeId(`${id}:kinetic`))

          // MANUAL PATTERN LOCK: release the locks for HOLD (motor stops, freeze takes over).
          for (const nodeId of removeNodeIds) {
            arbiter.clearManualPatternLock(nodeId)
          }

          // WAVE 6020 FIX: Purge veneno IK de _manualOverrides ANTES del merge aditivo.
          // Si targetX/Y/Z sobrevivieron de un spatial target previo, el merge
          // in-place de setManualOverride las preservaría → zombie state permanente.
          for (const nodeId of removeNodeIds) {
            const manual = arbiter.getManualOverride(nodeId)
            if (manual) {
              for (const key of IK_POISON_KEYS) {
                delete (manual as Record<string, number>)[key]
              }
            }
          }

          // WAVE 6019.4 FIX — HOLD STATE PRESERVATION
          // Migrar el estado IK activo (_motorKineticOverrides) a
          // _manualOverrides para que NodeArbiter._applyRelativeOffsetFusion
          // detecte isHoldState y congele los fixtures en su última posición.
          let motorStateMigrated = false
          for (const nodeId of removeNodeIds) {
            const motor = arbiter.getMotorKineticOverride(nodeId)
            if (motor && Number.isFinite(motor['pan_base']) && Number.isFinite(motor['tilt_base'])) {
              arbiter.setManualOverride(nodeId, {
                pan_base: motor['pan_base'],
                tilt_base: motor['tilt_base'],
              })
              motorStateMigrated = true
            }
          }

          aetherKineticEngine.removeNodes(removeNodeIds, arbiter)
          if (!motorStateMigrated && anchorPan === undefined && anchorTilt === undefined) {
            for (const id of fixtureIds) {
              arbiter.clearManualOverride(resolveKineticNodeId(`${id}:kinetic`))
            }
          }
          for (const nodeId of removeNodeIds) {
            const manual = arbiter.getManualOverride(nodeId)
            const motor = arbiter.getMotorKineticOverride(nodeId)
            console.log(`[ZOMBIE-DIAG] Post-HOLD ${nodeId}: manual=${manual ? 'EXISTS:'+Object.keys(manual).join(',') : 'CLEARED'} motor=${motor ? 'EXISTS:'+Object.keys(motor).join(',') : 'CLEARED'}`)
          }
          if (!aetherKineticEngine.isActive()) {
            vibeMovementManager.setL2Active(false)
            vibeMovementManager.setKineticFanOffsets({})
          }
          console.log('[ZOMBIE-DIAG] ✅ HOLD branch complete')
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
        // 🏗️ WAVE 7179 (M4): Mirror amplitude to resolver for post-solve VMM fusion.
        try { getTitanOrchestrator().getAetherResolver().setRelativeOffsetAmplitude(amplitudeNorm * 2) } catch { /* resolver not ready */ }

        // Construir nodeIds en formato Aether: `${fixtureId}:kinetic`
        const nodeIds = fixtureIds.map(id => resolveKineticNodeId(`${id}:kinetic`))

        // Mapear nombre de patrón UI → NativeKineticPattern
        const nativePattern = mapToNativePattern(pattern)

        // Silenciar VMM via L2 flag — NO clearing manual overrides.
        // Old code called setManualPattern(null)/setManualSpeed(null)/setManualAmplitude(null)
        // which reset manualPatternOverride to null. The bridge detected this as
        // "overrides cleared" and reactively fired clearManualOverrides on the arbiter,
        // wiping the L2 anchor pan_base/tilt_base. setL2Active(true) silences VMM
        // output without touching override state.
        vibeMovementManager.setL2Active(true)

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

          // WAVE 4986 Paso 2: El fallback absoluto 0.5 solo se aplica a nodos
          // completamente nuevos — sin ningún historial en L2.
          // Si el fixture tiene live override, IK, payload o caché, los respetamos.
          // El 0.5 anterior pisaba la memoria IK de focos que ya tenían target spatial.
          //
          // hasAnyL2 = true → el nodo existe con algún dato válido en L2.
          //   → resolvedAnchor = mejor dato disponible (puede ser null si IK aún no escribió pan_base)
          //   → NO sobrescribir si null: el motor IK ya tiene el anchor real en tick()
          // hasAnyL2 = false → nodo completamente nuevo
          //   → resolvedAnchor = 0.5 (centro neutro, primer frame seguro)
          const hasAnyL2Pan  = livePan  !== null || ikPan  !== null || fallbackPan  !== null || cachePan  !== null
          const hasAnyL2Tilt = liveTilt !== null || ikTilt !== null || fallbackTilt !== null || cacheTilt !== null

          const resolvedAnchorPan  = livePan  ?? ikPan  ?? fallbackPan  ?? cachePan  ?? (hasAnyL2Pan  ? null : 0.5)
          const resolvedAnchorTilt = liveTilt ?? ikTilt ?? fallbackTilt ?? cacheTilt ?? (hasAnyL2Tilt ? null : 0.5)

          // Solo escribir el anchor en _manualOverrides cuando tenemos un valor real.
          // Si resolvedAnchor es null (ej. nodo con IK activo en motor pero sin pan_base
          // en manual), no tocar — el engine IK escribirá el anchor en el siguiente tick.
          // WAVE 6020 OPUS FIX: Filtrar veneno IK del spread prev.
          // El merge aditivo de setManualOverride preserva targetX/Y/Z
          // si los re-escribimos con ...prev. Construir safePrev excluyendo
          // las coordenadas IK para que no se propaguen al nuevo estado.
          const safePrev: Record<string, number> = {}
          if (manual) {
            for (const key in manual) {
              if (!IK_POISON_KEYS.has(key)) safePrev[key] = manual[key]
            }
          }
          const anchorWrite: Record<string, number> = {}
          if (resolvedAnchorPan  !== null) anchorWrite['pan_base']  = resolvedAnchorPan
          if (resolvedAnchorTilt !== null) anchorWrite['tilt_base'] = resolvedAnchorTilt
          if (Object.keys(anchorWrite).length > 0) {
            arbiter.setManualOverride(nodeId, { ...safePrev, ...anchorWrite })
          }

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
        // WAVE 7030: Resolve mount orientation per fixture for VMM-parity tilt offset.
        const _orch = getTitanOrchestrator()
        const _graph = _orch.getAetherNodeGraph()
        const mountOrientations = nodeIds.map(nid => {
          const kn = _graph.getNodeData(nid) as IKineticNodeData | undefined
          return kn?.ikOrientation?.installation ?? 'floor'
        })

        // MANUAL PATTERN LOCK: registrar los nodeIds ANTES de activar el motor.
        // Esto blindaje pan_base/tilt_base contra clearManualOverrides reactivo
        // disparado por la capa SURVIVAL (ProgrammerAetherBridge) tras el upsert.
        arbiter.setManualPatternLock(nodeIds)

        aetherKineticEngine.setManualKinetics(nodeIds, nativePattern, speedNorm, amplitudeNorm, fanNorm, arbiter, mountOrientations)
      } catch (err) {
        console.error('[AetherIPC] setManualPattern error:', err)
      }
    }
  )

  /**
   * E11b: Actualizar escalares (speed/amplitude/fan) sin reiniciar la fase.
   * Ruta: lux:aether:updateKineticScalars (Aether IPC) — NUEVO WAVE 4700.
   * Para cambios en tiempo real de los sliders de UI sin glitch de fase.
   * Payload: { speed (0-100), amplitude (0-100), fan (-100..100) }
   */
  ipcMain.on(
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
        const orch = getTitanOrchestrator()
        const arbiterForAmp = orch.getAetherArbiter()
        arbiterForAmp.setRelativeOffsetAmplitude(amplitude * 2)
        // 🏗️ WAVE 7179 (M4): Mirror amplitude to resolver for post-solve VMM fusion.
        try { orch.getAetherResolver().setRelativeOffsetAmplitude(amplitude * 2) } catch { /* resolver not ready */ }

        let nodeIds: string[]
        if (Array.isArray(payload?.fixtureIds) && payload.fixtureIds.length > 0) {
          nodeIds = payload.fixtureIds.map(id => resolveKineticNodeId(`${id}:kinetic`))
        } else {
          // Compat: sin nodeIds, aplica a todos los nodos activos del motor.
          nodeIds = aetherKineticEngine.getState().nodeIds
        }
        aetherKineticEngine.updateScalars(nodeIds, speed, amplitude, fan)
      } catch (err) {
        console.error('[AetherIPC] updateKineticScalars error:', err)
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
          aetherKineticEngine.getNodeState(resolveKineticNodeId(`${id}:kinetic`), arbiter)
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

  // ── B7 setKineticFanOffsets: ELIMINADO WAVE 7594 (tráfico fantasma — no-op desde WAVE 4718) ──

  /**
   * E12: Apply spatial target para fixtures.
   * Ruta: lux:aether:applySpatialTarget (Aether IPC)
   * Engine: computeFanSubTargets() — WAVE 7179 M3 (single-solve pipeline)
   * Payload: { target: {x,y,z}, fixtureIds, fanMode?, fanAmplitude?, fixturePositions? }
   *
   * 🏗️ WAVE 7179 (M3): El handler YA NO resuelve IK. Solo calcula los sub-targets
   * espaciales (geometría pura de fan) e inyecta coordenadas target_x/y/z en el
   * árbitro. El solve completo ocurrirá única y exclusivamente en el resolver de
   * nodos más adelante en el pipeline.
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
        const resolver = orchestrator.getAetherResolver()
        const allFixtures: any[] = (orchestrator as any).fixtures ?? []

        // ── WAVE 7179 (M3): Resolver posiciones reales sin construir IK profiles ──
        // Ya no se necesita buildProfile ni calibration ni panRange/tiltRange en esta capa.
        // Solo necesitamos id + position para computeFanSubTargets y distance scale.
        const fixtureInputs: Array<{ id: string; position: { x: number; y: number; z: number } }> = []

        for (const id of fixtureIds) {
          const f = allFixtures.find((x: any) => x.id === id)
          const stageIK = fixtureIKProfiles?.[id]
          if (stageIK?.isPlaced === false) continue
          // WAVE 4884 Fase 2B: la posición real llega en el payload (fixturePositions).
          // Si no está en el payload, fallback a f.position del Orchestrator.
          // Si ninguno tiene posición válida, se salta el fixture.
          const resolvedPosition = fixturePositions?.[id] ?? f?.position
          if (!resolvedPosition) continue
          if (!Number.isFinite(resolvedPosition.x) || !Number.isFinite(resolvedPosition.y) || !Number.isFinite(resolvedPosition.z)) {
            console.warn(`[AetherIPC applySpatialTarget] fixture=${id} posición no-finita, ignorado.`)
            continue
          }
          fixtureInputs.push({ id, position: resolvedPosition })
        }

        if (fixtureInputs.length === 0) return { success: true, subTargets: {} }

        // ⚡ WAVE 4915: Pre-computar Spatial Distance Scale por fixture (§3.2 del blueprint).
        // Mantiene el arco visual del patrón VMM aproximadamente constante entre fixtures
        // cercanos y lejanos al target. Formula lineal simple: scale = d_ref / distance,
        // recortado a [0.25, 2.0] por el setter del arbiter.
        const D_REF = 8.0  // metros — distancia "de diseño" (blueprint §3.2)
        for (const fi of fixtureInputs) {
          const dx = fi.position.x - target.x
          const dy = fi.position.y - target.y
          const dz = fi.position.z - target.z
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (!Number.isFinite(distance) || distance < 1e-6) {
            arbiter.setSpatialDistanceScale(resolveKineticNodeId(`${fi.id}:kinetic`), 2.0)
            resolver.setSpatialDistanceScale(resolveKineticNodeId(`${fi.id}:kinetic`), 2.0)
            continue
          }
          const scale = D_REF / distance
          arbiter.setSpatialDistanceScale(resolveKineticNodeId(`${fi.id}:kinetic`), scale)
          resolver.setSpatialDistanceScale(resolveKineticNodeId(`${fi.id}:kinetic`), scale)
        }

        // 🏗️ WAVE 7179 (M3): computeFanSubTargets — pura geometría, sin solve()
        const subTargets = computeFanSubTargets(
          fixtureInputs,
          target,
          (fanMode ?? 'converge') as SpatialFanMode,
          fanAmplitude ?? 0,
        )

        // ── Inyectar overrides espaciales puros en el árbitro ──
        // Nada de pan_base ni tilt_base en esta fase. Solo coordenadas target_x/y/z.
        // El resolver de nodos leerá estas coordenadas y hará el solve completo.
        const serialized: Record<string, { x: number; y: number; z: number }> = {}
        for (const [id, subTarget] of subTargets) {
          const nodeId = resolveKineticNodeId(`${id}:kinetic`)
          arbiter.setMotorKineticOverride(nodeId, {
            target_x: subTarget.x,
            target_y: subTarget.y,
            target_z: subTarget.z,
          })
          serialized[id] = subTarget
        }

        // Retornar inmediatamente los subTargets para mantener la reactividad visual
        // del pad de control. La telemetría de reachability se leerá de forma asíncrona
        // desde los transient updates que publicará el resolver más adelante.
        return { success: true, subTargets: serialized }
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
  ipcMain.on(
    'lux:aether:releaseSpatialTarget',
    (_event, { fixtureIds }: { fixtureIds: string[] }) => {
      if (!Array.isArray(fixtureIds)) {
        return
      }

      try {
        const orch = getTitanOrchestrator()
        const arbiter = orch.getAetherArbiter()
        let resolver: { clearSpatialDistanceScale(nodeId: string): void } | null = null
        try { resolver = orch.getAetherResolver() } catch { /* not ready */ }
        for (const id of fixtureIds) {
          const nodeId = resolveKineticNodeId(`${id}:kinetic`)
          // WAVE 4980: Anti-jitter release fade.
          // 🏗️ WAVE 7179 (M3): El motor override ahora contiene target_x/y/z
          // (coordenadas espaciales puras), no pan_base/tilt_base. No podemos
          // usar coordenadas XYZ como valores de fade pan/tilt — el fade es
          // un no-op en M3. El resolver detendrá el solve espacial cuando
          // clearMotorKineticOverride elimine las coordenadas target.
          // El ease-out hacia L0 se preserva vía clearManualOverride si hay
          // overrides clásicos del radar (pan_base/tilt_base) todavía activos.
          const motorOverride = arbiter.getMotorKineticOverride(nodeId)
          if (motorOverride) {
            const panBase  = (motorOverride as Record<string, number>)['pan_base']
            const tiltBase = (motorOverride as Record<string, number>)['tilt_base']
            const fadeChannels: Record<string, number> = {}
            if (Number.isFinite(panBase))  fadeChannels['pan']  = panBase
            if (Number.isFinite(tiltBase)) fadeChannels['tilt'] = tiltBase
            if (Object.keys(fadeChannels).length > 0) {
              arbiter.setManualOverride(nodeId, fadeChannels)
            }
          }
          arbiter.clearManualOverride(nodeId)  // captura snapshot → _releaseStates
          // WAVE 5023: Limpiar el motor override espacial. Si persiste, el arbitraje
          // sigue usando pan_base/tilt_base del IK como base absoluta, anulando el
          // offset VMM (ox=0) y congelando el fixture en la última posición espacial.
          arbiter.clearMotorKineticOverride(nodeId)
          // ⚡ WAVE 4915: limpiar la distance scale junto con el override.
          arbiter.clearSpatialDistanceScale(nodeId)
          if (resolver) resolver.clearSpatialDistanceScale(nodeId)
        }
        // Si el caller libera todos los fixtures (release global), limpiar las tablas
        // enteras como red de seguridad ante leaks de overrides huérfanos.
        if (fixtureIds.length === 0) {
          arbiter.clearAllMotorKineticOverrides()
          arbiter.clearAllSpatialDistanceScales()
        }
      } catch (err) {
        console.error('[AetherIPC] releaseSpatialTarget error:', err)
      }
    }
  )

  /**
   * 🏗️ WAVE 7179 (M5): Invalidate IK profile cache for a node.
   * Called by the Calibration Dock when calibration offsets change at runtime.
   * The resolver will rebuild the IKFixtureProfile on the next frame.
   */
  ipcMain.on(
    'lux:aether:invalidateIKProfile',
    (_event, { nodeId }: { nodeId: string }) => {
      try {
        const resolver = getTitanOrchestrator().getAetherResolver()
        resolver.invalidateIKProfile(nodeId)
      } catch (err) {
        console.error('[AetherIPC] invalidateIKProfile error:', err)
      }
    }
  )

  // ── WAVE 7610: LIVE CALIBRATION HOT-RELOAD ──────────────────────────────
  /**
   * Directly updates node.ikCalibration in the NodeGraph and invalidates
   * the IK profile cache. The next TickEngine frame rebuilds the profile
   * with the new offsets — producing immediate DMX output changes.
   *
   * Called by the Calibration Dock when the user drags Offset Trim sliders.
   * Values are in DEGREES (panOffset, tiltOffset) and booleans (panInvert, tiltInvert).
   */
  ipcMain.on(
    'lux:aether:updateLiveCalibration',
    (_event, { nodeId, calibration }: {
      nodeId: string
      calibration: { panOffset: number; tiltOffset: number; panInvert: boolean; tiltInvert: boolean }
    }) => {
      try {
        const resolver = getTitanOrchestrator().getAetherResolver()
        if (resolver.updateLiveCalibration) {
          resolver.updateLiveCalibration(nodeId, calibration)
        } else {
          // Fallback for older compiled resolvers — just invalidate cache
          resolver.invalidateIKProfile(nodeId)
        }
      } catch (err) {
        console.error('[AetherIPC] updateLiveCalibration error:', err)
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
  ipcMain.on(
    'lux:aether:fireTungstenNuke',
    (_event, { target, release, value }: { target: string; release?: boolean; value?: number }) => {
      try {
        const orchestrator = getTitanOrchestrator()
        const arbiter      = orchestrator.getAetherArbiter()
        const tungstenList = orchestrator.getTungstenNodeIds()

        if (tungstenList.length === 0) {
          return
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
            return
          }
        }
      } catch (err) {
        console.error('[AetherIPC] fireTungstenNuke error:', err)
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
          arbiter.clearManualOverride(resolveKineticNodeId(`${fixtureId}:kinetic`))
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
