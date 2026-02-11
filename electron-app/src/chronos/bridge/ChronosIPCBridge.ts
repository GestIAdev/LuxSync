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

import { getChronosInjector, type StageCommand } from '../core/ChronosInjector'
import { mapChronosFXToBaseEffect, getFXInfo } from '../core/FXMapper'
import { serializeHephClip, type HephAutomationClipSerialized } from '../../core/hephaestus/types'

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
 */
async function handleFXTrigger(command: StageCommand): Promise<void> {
  const fxType = command.effectId
  const intensity = command.intensity ?? 1.0
  const durationMs = command.durationMs
  
  if (!fxType) {
    console.warn('[ChronosBridge] ⚠️ FX trigger without fxType:', command)
    return
  }
  
  // Map Chronos FX type to BaseEffect ID
  const effectId = mapChronosFXToBaseEffect(fxType, bridgeState.currentVibeId || undefined)
  const fxInfo = getFXInfo(fxType, bridgeState.currentVibeId || undefined)
  
  // ⚒️ WAVE 2030.4: Serialize hephCurves for IPC (Map → Record)
  let hephCurvesSerialized: HephAutomationClipSerialized | undefined
  if (command.hephCurves) {
    hephCurvesSerialized = serializeHephClip(command.hephCurves)
    console.log(`[ChronosBridge] ⚒️ HEPHAESTUS: Serializing ${command.hephCurves.curves.size} curves`)
  }
  
  const hephTag = hephCurvesSerialized ? ' ⚒️[HEPH]' : ''
  console.log(`[ChronosBridge] 🧨 FX: ${fxType} → ${effectId}${hephTag}`, 
    fxInfo.isPassthrough ? '(direct)' : fxInfo.vibeSpecific ? '(vibe-specific)' : '(mapped)')
  
  try {
    // Try chronos:triggerFX first, fallback to lux:forceStrike
    // ⚒️ WAVE 2030.4: Include serialized hephCurves in payload
    const result = await (window as any).lux.chronos?.triggerFX?.(effectId, intensity, durationMs, hephCurvesSerialized)
      || await (window as any).lux?.forceStrike?.({ effect: effectId, intensity })
      || { success: false }
    
    if (result.success) {
      console.log(`[ChronosBridge] ✅ FX triggered: ${effectId} @ ${(intensity * 100).toFixed(0)}%${hephTag}`)
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
  
  const effectId = mapChronosFXToBaseEffect(fxType, bridgeState.currentVibeId || undefined)
  
  try {
    const result = await (window as any).lux.chronos?.stopFX?.(effectId) || { success: true }
    if (result.success) {
      console.log(`[ChronosBridge] ✅ FX stopped: ${effectId}`)
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
