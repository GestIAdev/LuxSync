/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🚀 CHRONOS STAGE DISPATCHER — WAVE 2013 → WAVE 2082 (M2 RENAME)
 * 
 * Renamed from ChronosInjector (core) to ChronosStageDispatcher.
 * Reason: There were two files named "ChronosInjector" in different folders:
 *   - core/ChronosInjector.ts (THIS FILE → now ChronosStageDispatcher.ts)
 *   - bridge/ChronosInjector.ts (stays — it's the "Whisperer" to Titan/Selene)
 * 
 * This module is the bridge between Chronos Timeline and the Stage Simulator.
 * When you playback the timeline, it reads clips at the current playhead
 * position and dispatches corresponding effects to StageSimulator2.
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────┐
 * │     Chronos Timeline    │
 * │    (clips, playhead)    │
 * └───────────┬─────────────┘
 *             │ getActiveClips(currentTimeMs)
 *             ▼
 * ┌─────────────────────────┐
 * │  CHRONOS STAGE DISPATCHER│
 * │  - Reads active clips   │
 * │  - Generates commands   │
 * │  - Dispatches to Stage  │
 * └───────────┬─────────────┘
 *             │ inject(effectData)
 *             ▼
 * ┌─────────────────────────┐
 * │   StageSimulator2 API   │
 * │  (Three.js / WebGL)     │
 * └─────────────────────────┘
 * 
 * AXIOMA ANTI-SIMULACIÓN:
 * This is the REAL pipeline. No mocks. When clips play, the stage reacts.
 * 
 * @module chronos/core/ChronosStageDispatcher
 * @version WAVE 2082 (M2 Rename)
 */

import type { TimelineClip, VibeClip, FXClip } from './TimelineClip'
import type { HephAutomationClipSerialized } from '../../core/hephaestus/types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Effect command to send to the Stage Simulator */
export interface StageCommand {
  /** Command type */
  type: 'vibe-change' | 'fx-trigger' | 'fx-stop' | 'intensity-change'
  
  /** Effect or Vibe ID */
  effectId: string
  
  /** Display name for logging */
  displayName: string
  
  /** Intensity value (0-1) */
  intensity?: number
  
  /** Color value if applicable */
  color?: string
  
  /** Duration in ms (for FX) */
  durationMs?: number
  
  /** Timestamp when this command was generated */
  timestamp: number
  
  /**
   * ⚒️ WAVE 2030.4 → 2040.17: HEPHAESTUS DIAMOND DATA
   * 
   * Serialized automation curves attached to the FXClip.
   * WAVE 2040.17: Now uses HephAutomationClipSerialized (Record<>)
   * for safe JSON transport. Consumer must deserializeHephClip()
   * if Map<> access is needed.
   */
  hephCurves?: HephAutomationClipSerialized
  
  /**
   * ⚒️ WAVE 2030.18: THE RUNTIME
   * 
   * Path to .lfx file for Hephaestus custom effects.
   * When present, bypasses FXMapper and uses HephaestusRuntime.
   */
  hephFilePath?: string
  
  /**
   * ⚒️ WAVE 2030.18: Flag for Hephaestus custom clips
   * When true, the bridge should use HephaestusRuntime instead of FXMapper.
   */
  isHephCustom?: boolean
}

/** Listener for stage commands */
export type StageCommandListener = (command: StageCommand) => void

/** State of currently active effects for diffing */
interface ActiveState {
  activeVibeId: string | null
  /** Map of clipId → fxType for active FX (so we can emit fxType on stop) */
  activeFxMap: Map<string, string>
  /** WAVE 2040.21: Set of clipIds that are Hephaestus custom clips */
  hephCustomClipIds: Set<string>
}

// ═══════════════════════════════════════════════════════════════════════════
// CHRONOS INJECTOR CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ChronosStageDispatcher {
  /** Listeners for stage commands */
  private listeners: Set<StageCommandListener> = new Set()
  
  /** Previous state for diffing (only trigger on changes) */
  private prevState: ActiveState = {
    activeVibeId: null,
    activeFxMap: new Map(),
    hephCustomClipIds: new Set(),
  }
  
  /** Debug mode - logs all commands */
  private debug = true
  
  // ─────────────────────────────────────────────────────────────────────────
  // SUBSCRIPTION
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Subscribe to stage commands
   * The StageSimulator will register here to receive effect updates
   */
  subscribe(listener: StageCommandListener): () => void {
    this.listeners.add(listener)
    if (this.debug) {
      console.log('[StageDispatcher] 📡 New listener subscribed')
    }
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }
  
  /**
   * Emit a command to all listeners
   */
  private emit(command: StageCommand): void {
    this.listeners.forEach(listener => {
      try {
        listener(command)
      } catch (err) {
        console.error('[StageDispatcher] Listener error:', err)
      }
    })
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // INJECTION LOGIC
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🎬 Process clips at current time and emit stage commands
   * This is called every frame during playback.
   * Uses state diffing to only emit changes (not every frame).
   * 
   * @param clips All timeline clips
   * @param currentTimeMs Current playhead position
   */
  tick(clips: TimelineClip[], currentTimeMs: number): void {
    // Find clips active at current time
    const activeClips = clips.filter(clip => 
      currentTimeMs >= clip.startMs && currentTimeMs < clip.endMs
    )
    
    // Separate by type
    const activeVibes = activeClips.filter((c): c is VibeClip => c.type === 'vibe')
    const activeFx = activeClips.filter((c): c is FXClip => c.type === 'fx')
    
    // Get current state
    const currentVibeId = activeVibes[0]?.id ?? null
    
    // ═══════════════════════════════════════════════════════════════════════
    // VIBE CHANGE DETECTION
    // ═══════════════════════════════════════════════════════════════════════
    if (currentVibeId !== this.prevState.activeVibeId) {
      if (currentVibeId && activeVibes[0]) {
        const vibe = activeVibes[0]
        this.emit({
          type: 'vibe-change',
          effectId: vibe.vibeType,
          displayName: vibe.label,
          intensity: vibe.intensity,
          timestamp: Date.now(),
        })
        
        if (this.debug) {
          console.log(`[StageDispatcher] 🎭 VIBE → ${vibe.label}`)
        }
      }
      
      this.prevState.activeVibeId = currentVibeId
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // FX TRIGGER DETECTION (new FX started)
    // ═══════════════════════════════════════════════════════════════════════
    for (const fx of activeFx) {
      if (!this.prevState.activeFxMap.has(fx.id)) {
        // New FX - trigger it
        // ⚒️ WAVE 2030.4 + 2030.18: Include hephClip and hephFilePath if present
        this.emit({
          type: 'fx-trigger',
          effectId: fx.fxType,
          displayName: fx.label,
          durationMs: fx.endMs - fx.startMs,
          color: fx.color,
          timestamp: Date.now(),
          hephCurves: fx.hephClip,      // ⚒️ WAVE 2030.4: HEPHAESTUS CURVES
          hephFilePath: fx.hephFilePath, // ⚒️ WAVE 2030.18: Path to .lfx file
          isHephCustom: fx.isHephCustom, // ⚒️ WAVE 2030.18: Runtime bypass flag
        })
        
        // ⚒️ WAVE 2040.22: Track Heph custom clip IDs for stop propagation
        if (fx.isHephCustom) {
          this.prevState.hephCustomClipIds.add(fx.id)
        }
        
        if (this.debug) {
          const hephTag = fx.isHephCustom ? ' ⚒️[HEPH RUNTIME]' : fx.hephClip ? ' ⚒️[HEPH]' : ''
          console.log(`[StageDispatcher] ⚡ FX ON → ${fx.label}${hephTag}`)
        }
      }
    }
    
    // Build current FX map (id → fxType)
    const currentFxMap = new Map<string, string>()
    for (const fx of activeFx) {
      currentFxMap.set(fx.id, fx.fxType)
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // FX STOP DETECTION (FX ended)
    // ═══════════════════════════════════════════════════════════════════════
    for (const [prevId, prevFxType] of this.prevState.activeFxMap) {
      if (!currentFxMap.has(prevId)) {
        // ⚒️ WAVE 2040.22: Propagate isHephCustom flag on stop
        const wasHephCustom = this.prevState.hephCustomClipIds.has(prevId)
        
        // FX ended - emit the fxType, not the clipId!
        this.emit({
          type: 'fx-stop',
          effectId: prevFxType,  // ← FIX: was prevId (clipId), now prevFxType
          displayName: '',
          timestamp: Date.now(),
          isHephCustom: wasHephCustom, // ⚒️ WAVE 2040.22: Bridge needs this to bypass FXMapper
        })
        
        // Clean up tracking
        if (wasHephCustom) {
          this.prevState.hephCustomClipIds.delete(prevId)
        }
        
        if (this.debug) {
          const hephTag = wasHephCustom ? ' ⚒️[HEPH]' : ''
          console.log(`[StageDispatcher] ⬛ FX OFF → ${prevFxType}${hephTag}`)
        }
      }
    }
    
    // Update state
    this.prevState.activeFxMap = currentFxMap
  }
  
  /**
   * 🔄 Reset state (call when playback stops or seeks)
   */
  reset(): void {
    // Stop all active FX
    for (const [clipId, fxType] of this.prevState.activeFxMap) {
      const wasHephCustom = this.prevState.hephCustomClipIds.has(clipId)
      this.emit({
        type: 'fx-stop',
        effectId: fxType,  // ← FIX: emit fxType, not clipId
        displayName: '',
        timestamp: Date.now(),
        isHephCustom: wasHephCustom, // ⚒️ WAVE 2040.22: Propagate on reset too
      })
    }
    
    this.prevState = {
      activeVibeId: null,
      activeFxMap: new Map(),
      hephCustomClipIds: new Set(),
    }
    
    if (this.debug) {
      console.log('[StageDispatcher] 🔄 State reset')
    }
  }
  
  /**
   * 🐛 Toggle debug mode
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let instance: ChronosStageDispatcher | null = null

export function getChronosStageDispatcher(): ChronosStageDispatcher {
  if (!instance) {
    instance = new ChronosStageDispatcher()
    console.log('[ChronosStageDispatcher] 🚀 Instance created')
  }
  return instance
}

/** @deprecated Use getChronosStageDispatcher() — backward compat alias */
export const getChronosInjector = getChronosStageDispatcher

export default ChronosStageDispatcher
