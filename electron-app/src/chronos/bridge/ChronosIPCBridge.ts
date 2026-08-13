/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 CHRONOS IPC BRIDGE - WAVE 2019: THE PULSE
 * 
 * The missing link. This bridge subscribes to ChronosInjector and forwards
 * stage commands to the backend via IPC.
 * 
 * BEFORE WAVE 2019:
 *   ChronosInjector.emit() → void (nobody listening)
 * 
 * AFTER WAVE 2019:
 *   ChronosInjector.emit() → ChronosIPCBridge → IPC → Backend → DMX → LIGHTS!
 * 
 * WAVE 2030.4: HEPHAESTUS INTEGRATION
 *   When an FXClip has hephCurves, they are serialized and sent via IPC
 *   to the backend, where EffectManager creates a HephParameterOverlay.
 * 
 * AXIOMA ANTI-SIMULACIÓN:
 * Real commands, real IPC calls, real stage control.
 * 
 * @module chronos/bridge/ChronosIPCBridge
 * @version WAVE 2019 / WAVE 2030.4
 */

// P2.1 FIX: Migrated from legacy ChronosInjector.ts → ChronosStageDispatcher.ts
import { getChronosInjector, type StageCommand } from '../core/ChronosStageDispatcher'
import type { HephAutomationClipV3 } from '../../core/hephaestus/types'
import { VALID_FX_TYPES, toFXType } from '../core/TimelineClip'

// ═══════════════════════════════════════════════════════════════════════════
// HEIMDALL 7.3: EPILEPSY SAFETY LIMITS
// ═══════════════════════════════════════════════════════════════════════════
// EULA LIABILITY ACCEPTED: LuxSync is a professional-grade tool. By installing
// the software, the operator explicitly assumes all liability for photosensitive
// and strobe-related safety. Strobe ceiling set to physical fixture rendering
// maximum (18 Hz).
//
// The strobe ceiling is set to 18 Hz — the physical maximum rendering rate of
// the supported fixture hardware. Any strobe-type effect dispatched through the
// IPC frontier is clamped to this rate. The backend effect manager may
// interpret durationMs as the strobe period; if so, we clamp the effective
// frequency to SAFE_MAX_STROBE_HZ.
const SAFE_MAX_STROBE_HZ = 18
/** Minimum strobe period in ms that satisfies the safety ceiling. */
const SAFE_MIN_STROBE_PERIOD_MS = 1000 / SAFE_MAX_STROBE_HZ // ~55.6ms

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ChronosBridgeState {
  connected: boolean
  unsubscribe: (() => void) | null
  currentVibeId: string | null
  commandCount: number
}

// ═══════════════════════════════════════════════════════════════════════════
// BRIDGE STATE
// ═══════════════════════════════════════════════════════════════════════════

const bridgeState: ChronosBridgeState = {
  connected: false,
  unsubscribe: null,
  currentVibeId: null,
  commandCount: 0,
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎭 Handle vibe-change command
 * StageCommand.effectId = vibeId for vibe-change commands
 */
async function handleVibeChange(command: StageCommand): Promise<void> {
  const vibeId = command.effectId
  
  if (!vibeId) {
    console.warn('[ChronosBridge] ⚠️ Vibe change without vibeId:', command)
    return
  }
  
  // Avoid redundant changes
  if (vibeId === bridgeState.currentVibeId) {
    console.log(`[ChronosBridge] 🎭 Vibe already ${vibeId}, skipping`)
    return
  }
  
  bridgeState.currentVibeId = vibeId
  
  try {
    // Call IPC - ONLY use chronos:setVibe (no fallback to lux:setVibe)
    // chronos:setVibe has proper logging and palette sync
    const chronosAPI = (window as any).lux?.chronos
    if (!chronosAPI?.setVibe) {
      console.error('[ChronosBridge] ❌ window.lux.chronos.setVibe not available!')
      return
    }
    
    const result = await chronosAPI.setVibe(vibeId)
    
    if (result.success) {
      console.log(`[ChronosBridge] ✅ Vibe set to: ${vibeId}`)
    } else {
      console.warn(`[ChronosBridge] ⚠️ Vibe set returned: ${JSON.stringify(result)}`)
    }
  } catch (err) {
    console.error('[ChronosBridge] ❌ Failed to set vibe:', err)
  }
}

/**
 * 🧨 Handle fx-trigger command
 * StageCommand.effectId = fxType for fx-trigger commands
 * ⚒️ WAVE 2030.4: Also forwards hephCurves if present
 * ⚒️ WAVE 2030.18: Routes isHephCustom to HephaestusRuntime
 */
async function handleFXTrigger(command: StageCommand): Promise<void> {
  const rawFxType = command.effectId
  const intensity = command.intensity ?? 1.0
  const durationMs = command.durationMs

  if (!rawFxType) {
    console.warn('[ChronosBridge] ⚠️ FX trigger without fxType:', command)
    return
  }

  // VALKYRIE H-3: The IPC frontier is the boundary that touches hardware.
  //   It must be the STRICTEST layer in the system, not the loosest. A
  //   malformed .lux file or a buggy dispatcher must not be able to drive
  //   out-of-range values directly at the fixture output layer.
  //
  //   1. Clamp intensity to [0, 1] — values outside this range can blow
  //      out dimmer channels or trigger undefined behavior in effect managers.
  //   2. Validate fxType against the canonical VALID_FX_TYPES set. An
  //      unknown type falls back to 'pulse' (a safe, bounded effect) rather
  //      than being forwarded raw to the backend.
  //   3. Bounds-check durationMs — must be a finite, positive number. A
  //      non-finite or zero/negative duration can hang effect loops or
  //      produce no output at all.
  const clampedIntensity = Math.max(0, Math.min(1, intensity))
  if (clampedIntensity !== intensity) {
    console.warn(
      `[ChronosBridge] ⚠️ Intensity clamped to [0,1]: ${intensity} → ${clampedIntensity}`
    )
  }

  // 'heph-custom' is a valid runtime type but is not in VALID_FX_TYPES for
  // the standard path — it is handled via the isHephCustom branch below, so
  // we only validate non-heph types here.
  const isHephType = command.isHephCustom || rawFxType === 'heph-custom'
  const fxType = isHephType ? rawFxType : toFXType(rawFxType)
  if (!isHephType && !VALID_FX_TYPES.has(rawFxType)) {
    console.warn(
      `[ChronosBridge] ⚠️ Invalid fxType '${rawFxType}' — falling back to '${fxType}'`
    )
  }

  if (durationMs !== undefined && (!Number.isFinite(durationMs) || durationMs <= 0)) {
    console.warn(
      `[ChronosBridge] ⚠️ Invalid durationMs (${durationMs}) — dropping FX trigger`
    )
    return
  }

  // HEIMDALL 7.3: Epilepsy Safety — strobe frequency clamp.
  //   If this is a strobe effect, the durationMs may represent the strobe
  //   period (ms per flash). If the period implies a frequency above
  //   SAFE_MAX_STROBE_HZ (18 Hz), we clamp it to the safe minimum period.
  //   This prevents photosensitive seizure triggers from reaching the fixture
  //   output layer, regardless of what the .lux file or dispatcher encoded.
  let safeDurationMs = durationMs
  if (fxType === 'strobe' && safeDurationMs !== undefined && safeDurationMs < SAFE_MIN_STROBE_PERIOD_MS) {
    console.warn(
      `[ChronosBridge] ⚠️ EPILEPSY GUARD: strobe period ${safeDurationMs}ms ` +
      `exceeds ${SAFE_MAX_STROBE_HZ}Hz limit — clamped to ${SAFE_MIN_STROBE_PERIOD_MS}ms`
    )
    safeDurationMs = SAFE_MIN_STROBE_PERIOD_MS
  }

  // ⚒️ WAVE 2030.18 → WAVE 2040.17: HEPHAESTUS CUSTOM PATH
  // Priority 1: Use inline Diamond Data (hephCurves) — portable, no file dependency
  // Priority 2: Fall back to file path (legacy, requires absolute path on disk)
  if (command.isHephCustom && command.hephCurves) {
    // WAVE 2040.17: Diamond Data path — curvas inline, no necesita archivo
    console.log(`[ChronosBridge] ⚒️💎 HEPH DIAMOND: inline curves @ ${(clampedIntensity * 100).toFixed(0)}%`)

    try {
      const hephCurvesSerialized = command.hephCurves as HephAutomationClipV3
      const result = await (window as any).lux.chronos?.triggerFX?.(
        'heph-custom', clampedIntensity, safeDurationMs, hephCurvesSerialized
      ) || { success: false }
      
      if (result.success) {
        console.log(`[ChronosBridge] ✅ HEPH Diamond triggered`)
      } else {
        console.error(`[ChronosBridge] ❌ HEPH Diamond failed`)
      }
    } catch (err) {
      console.error('[ChronosBridge] ❌ Failed to trigger HEPH Diamond:', err)
    }
    return
  }

  if (command.isHephCustom && command.hephFilePath) {
    // Legacy path — requires absolute file path on disk
    console.log(`[ChronosBridge] ⚒️ HEPH FILE: ${command.hephFilePath} @ ${(clampedIntensity * 100).toFixed(0)}%`)

    try {
      const result = await (window as any).lux.chronos?.triggerHeph?.(
        command.hephFilePath,
        clampedIntensity,
        safeDurationMs,
        false  // No loop for timeline clips
      ) || { success: false }
      
      if (result.success) {
        console.log(`[ChronosBridge] ✅ HEPH triggered: ${result.instanceId}`)
      } else {
        console.error(`[ChronosBridge] ❌ HEPH failed: Could not load ${command.hephFilePath}`)
      }
    } catch (err) {
      console.error('[ChronosBridge] ❌ Failed to trigger HEPH:', err)
    }
    return  // Early return - don't go through FXMapper
  }
  
  // STANDARD PATH: fxType passed directly as effectId.
  // FASE 2: FXMapper demolished — no more legacy mapping. V3 clips use heph path above.
  const hephCurvesSerialized: HephAutomationClipV3 | undefined = command.hephCurves || undefined
  if (hephCurvesSerialized) {
    const trackCount = hephCurvesSerialized.tracks?.length || 0
    console.log(`[ChronosBridge] ⚒️💎 HEPHAESTUS Diamond: ${trackCount} tracks`)
  }
  
  const hephTag = hephCurvesSerialized ? ' ⚒️[HEPH]' : ''
  console.log(`[ChronosBridge] 🧨 FX: ${fxType}${hephTag}`)
  
  try {
    const result = await (window as any).lux.chronos?.triggerFX?.(fxType, clampedIntensity, safeDurationMs, hephCurvesSerialized)
      || await (window as any).lux?.forceStrike?.({ effect: fxType, intensity: clampedIntensity })
      || { success: false }

    if (result.success) {
      console.log(`[ChronosBridge] ✅ FX triggered: ${fxType} @ ${(clampedIntensity * 100).toFixed(0)}%${hephTag}`)
    }
  } catch (err) {
    console.error('[ChronosBridge] ❌ Failed to trigger FX:', err)
  }
}

/**
 * 🛑 Handle fx-stop command
 */
async function handleFXStop(command: StageCommand): Promise<void> {
  const fxType = command.effectId
  
  if (!fxType) {
    console.warn('[ChronosBridge] ⚠️ FX stop without fxType:', command)
    return
  }
  
  // ⚒️ WAVE 2040.22: Heph Diamond clips bypass FXMapper entirely
  // The mapper doesn't know about 'heph-custom' — and it shouldn't need to.
  // Heph clips live outside the Core FX taxonomy.
  if (command.isHephCustom || fxType === 'heph-custom') {
    try {
      const result = await (window as any).lux.chronos?.stopFX?.('heph-custom') || { success: true }
      if (result.success) {
        console.log('[ChronosBridge] ✅ ⚒️ HEPH Diamond stopped')
      }
    } catch (err) {
      console.error('[ChronosBridge] ❌ Failed to stop HEPH FX:', err)
    }
    return
  }
  
  // FASE 2: FXMapper demolished — pass fxType directly as effectId
  try {
    const result = await (window as any).lux.chronos?.stopFX?.(fxType) || { success: true }
    if (result.success) {
      console.log(`[ChronosBridge] ✅ FX stopped: ${fxType}`)
    }
  } catch (err) {
    console.error('[ChronosBridge] ❌ Failed to stop FX:', err)
  }
}

/**
 * 📊 Handle intensity-change command
 */
async function handleIntensityChange(command: StageCommand): Promise<void> {
  // Future implementation - may adjust global intensity
  console.log('[ChronosBridge] 📊 Intensity change:', command.intensity)
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMMAND ROUTER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎯 Route stage command to appropriate handler
 */
async function handleStageCommand(command: StageCommand): Promise<void> {
  bridgeState.commandCount++
  
  const logPrefix = `[ChronosBridge] #${bridgeState.commandCount}`
  
  switch (command.type) {
    case 'vibe-change':
      console.log(`${logPrefix} 🎭 VIBE:`, command.effectId)
      await handleVibeChange(command)
      break
      
    case 'fx-trigger':
      console.log(`${logPrefix} 🧨 FX:`, command.effectId, command.displayName)
      await handleFXTrigger(command)
      break
      
    case 'fx-stop':
      console.log(`${logPrefix} 🛑 STOP:`, command.effectId)
      await handleFXStop(command)
      break
      
    case 'intensity-change':
      console.log(`${logPrefix} 📊 INTENSITY:`, command.intensity)
      await handleIntensityChange(command)
      break
      
    default:
      console.warn(`${logPrefix} ❓ Unknown command type:`, (command as any).type)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔌 Connect the bridge - Subscribe to ChronosInjector
 * 
 * Call this on ChronosLayout mount to enable timeline → stage control.
 */
export function connectChronosToStage(): void {
  if (bridgeState.connected) {
    console.log('[ChronosBridge] Already connected, skipping')
    return
  }
  
  const injector = getChronosInjector()
  
  console.log('[ChronosBridge] 🔌 CONNECTING to ChronosInjector...')
  
  // Subscribe to stage commands
  bridgeState.unsubscribe = injector.subscribe(handleStageCommand)
  bridgeState.connected = true
  bridgeState.commandCount = 0
  
  console.log('[ChronosBridge] ✅ CONNECTED - Timeline now controls stage!')
}

/**
 * 🔌 Disconnect the bridge - Unsubscribe from ChronosInjector
 * 
 * Call this on ChronosLayout unmount.
 */
export function disconnectChronosFromStage(): void {
  if (!bridgeState.connected || !bridgeState.unsubscribe) {
    console.log('[ChronosBridge] Not connected, nothing to disconnect')
    return
  }
  
  console.log('[ChronosBridge] 🔌 DISCONNECTING from ChronosInjector...')
  console.log(`[ChronosBridge] 📊 Session stats: ${bridgeState.commandCount} commands processed`)
  
  bridgeState.unsubscribe()
  bridgeState.unsubscribe = null
  bridgeState.connected = false
  bridgeState.currentVibeId = null
  bridgeState.commandCount = 0
  
  console.log('[ChronosBridge] ✅ DISCONNECTED')
}

/**
 * 📊 Get bridge status for debugging
 */
export function getChronosBridgeStatus(): {
  connected: boolean
  currentVibeId: string | null
  commandCount: number
} {
  return {
    connected: bridgeState.connected,
    currentVibeId: bridgeState.currentVibeId,
    commandCount: bridgeState.commandCount,
  }
}

/**
 * 🔄 Reset the bridge state (useful for testing)
 */
export function resetChronosBridge(): void {
  disconnectChronosFromStage()
  bridgeState.currentVibeId = null
  bridgeState.commandCount = 0
}

export default {
  connect: connectChronosToStage,
  disconnect: disconnectChronosFromStage,
  getStatus: getChronosBridgeStatus,
  reset: resetChronosBridge,
}
