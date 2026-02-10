/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🚀 CHRONOS INJECTOR - WAVE 2013: STAGE SIMULATOR LINK
 * 
 * The bridge between Chronos Timeline and the 3D Stage Simulator.
 * When you playback the timeline, this module reads the clips at the 
 * current playhead position and dispatches the corresponding effects
 * to the StageSimulator2.
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────┐
 * │     Chronos Timeline    │
 * │    (clips, playhead)    │
 * └───────────┬─────────────┘
 *             │ getActiveClips(currentTimeMs)
 *             ▼
 * ┌─────────────────────────┐
 * │    CHRONOS INJECTOR     │
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
 * @module chronos/core/ChronosInjector
 * @version WAVE 2013
 */

import type { TimelineClip, VibeClip, FXClip } from './TimelineClip'

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
}

/** Listener for stage commands */
export type StageCommandListener = (command: StageCommand) => void

/** State of currently active effects for diffing */
interface ActiveState {
  activeVibeId: string | null
  /** Map of clipId → fxType for active FX (so we can emit fxType on stop) */
  activeFxMap: Map<string, string>
}

// ═══════════════════════════════════════════════════════════════════════════
// CHRONOS INJECTOR CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ChronosInjector {
  /** Listeners for stage commands */
  private listeners: Set<StageCommandListener> = new Set()
  
  /** Previous state for diffing (only trigger on changes) */
  private prevState: ActiveState = {
    activeVibeId: null,
    activeFxMap: new Map(),
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
      console.log('[ChronosInjector] 📡 New listener subscribed')
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
        console.error('[ChronosInjector] Listener error:', err)
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
          console.log(`[ChronosInjector] 🎭 VIBE → ${vibe.label}`)
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
        this.emit({
          type: 'fx-trigger',
          effectId: fx.fxType,
          displayName: fx.label,
          durationMs: fx.endMs - fx.startMs,
          color: fx.color,
          timestamp: Date.now(),
        })
        
        if (this.debug) {
          console.log(`[ChronosInjector] ⚡ FX ON → ${fx.label}`)
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
        // FX ended - emit the fxType, not the clipId!
        this.emit({
          type: 'fx-stop',
          effectId: prevFxType,  // ← FIX: was prevId (clipId), now prevFxType
          displayName: '',
          timestamp: Date.now(),
        })
        
        if (this.debug) {
          console.log(`[ChronosInjector] ⬛ FX OFF → ${prevFxType}`)
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
      this.emit({
        type: 'fx-stop',
        effectId: fxType,  // ← FIX: emit fxType, not clipId
        displayName: '',
        timestamp: Date.now(),
      })
    }
    
    this.prevState = {
      activeVibeId: null,
      activeFxMap: new Map(),
    }
    
    if (this.debug) {
      console.log('[ChronosInjector] 🔄 State reset')
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

let instance: ChronosInjector | null = null

export function getChronosInjector(): ChronosInjector {
  if (!instance) {
    instance = new ChronosInjector()
    console.log('[ChronosInjector] 🚀 Instance created')
  }
  return instance
}

export default ChronosInjector
