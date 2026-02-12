/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS RUNTIME - WAVE 2030.18: THE RUNTIME
 * 
 * El Ejecutor Universal de efectos .lfx de Hephaestus.
 * En lugar de buscar efectos por nombre en un registro estático,
 * este runtime carga archivos dinámicamente y evalúa curvas en tiempo real.
 * 
 * ARQUITECTURA:
 * ┌─────────────────────────┐
 * │  chronos:triggerHeph    │
 * │  (filePath, duration)   │
 * └───────────┬─────────────┘
 *             │ play(path)
 *             ▼
 * ┌─────────────────────────┐
 * │   HEPHAESTUS RUNTIME    │
 * │  - Load .lfx file       │
 * │  - Cache parsed clips   │
 * │  - Evaluate curves      │
 * │  - Inject to fixtures   │
 * └───────────┬─────────────┘
 *             │ tick(currentTimeMs)
 *             ▼
 * ┌─────────────────────────┐
 * │   FixtureBuffer (DMX)   │
 * └─────────────────────────┘
 * 
 * AXIOMA ANTI-SIMULACIÓN:
 * Real files, real math, real DMX values.
 * 
 * @module core/hephaestus/runtime/HephaestusRuntime
 * @version WAVE 2030.18
 */

import * as fs from 'fs'
import * as path from 'path'
import type { HephAutomationClip, HephCurve } from '../types'
import type { EffectZone } from '../../effects/types'
import { deserializeHephClip, type HephAutomationClipSerialized } from '../types'
import { CurveEvaluator } from '../CurveEvaluator'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Active clip being executed */
interface ActiveHephClip {
  /** Unique instance ID */
  instanceId: string
  
  /** Path to .lfx file */
  filePath: string
  
  /** Parsed clip data */
  clip: HephAutomationClip
  
  /** CurveEvaluator instance for this clip */
  evaluator: CurveEvaluator
  
  /** Start time in ms (system time) */
  startTimeMs: number
  
  /** Duration in ms */
  durationMs: number
  
  /** Current intensity multiplier (0-1) */
  intensity: number
  
  /** Is the clip looping? */
  loop: boolean
}

/** Output values for a fixture parameter */
export interface HephFixtureOutput {
  fixtureId: string
  zone: EffectZone | 'all'
  parameter: string
  value: number  // 0-1 normalized
  source: 'hephaestus-runtime'
}

/** Runtime statistics */
export interface HephRuntimeStats {
  activeClips: number
  totalTriggered: number
  cacheSize: number
  lastTickMs: number
}

// ═══════════════════════════════════════════════════════════════════════════
// HEPHAESTUS RUNTIME
// ═══════════════════════════════════════════════════════════════════════════

export class HephaestusRuntime {
  /** Cache of loaded clips (path → parsed clip) */
  private clipCache: Map<string, HephAutomationClip> = new Map()
  
  /** Currently active clips being executed */
  private activeClips: Map<string, ActiveHephClip> = new Map()
  
  /** Instance counter for unique IDs */
  private instanceCounter = 0
  
  /** Statistics */
  private totalTriggered = 0
  private lastTickMs = 0
  
  /** Debug mode */
  private debug = true
  
  // ─────────────────────────────────────────────────────────────────────────
  // CLIP LOADING
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Load and cache a .lfx file
   * Returns the parsed clip or null if failed
   */
  loadClip(filePath: string): HephAutomationClip | null {
    // Check cache first
    if (this.clipCache.has(filePath)) {
      return this.clipCache.get(filePath)!
    }
    
    try {
      // Read file
      if (!fs.existsSync(filePath)) {
        console.error(`[HephRuntime] ❌ File not found: ${filePath}`)
        return null
      }
      
      const content = fs.readFileSync(filePath, 'utf-8')
      
      // Validate content is not empty
      if (!content || content.trim().length === 0) {
        console.error(`[HephRuntime] ❌ Empty file: ${filePath}`)
        return null
      }
      
      // Parse JSON
      let parsed: any
      try {
        parsed = JSON.parse(content)
      } catch (parseErr) {
        console.error(`[HephRuntime] ❌ Invalid JSON in ${filePath}:`, parseErr)
        return null
      }
      
      // ⚒️ WAVE 2030.20: UNWRAP FILE FORMAT
      // .lfx files have wrapper structure: { $schema, version, clip: {...} }
      // We need the inner 'clip' object for deserialization
      let serialized: HephAutomationClipSerialized
      
      if (parsed.clip && typeof parsed.clip === 'object') {
        // File format v1.0.0: { clip: {...} }
        serialized = parsed.clip
      } else if (parsed.curves && typeof parsed.curves === 'object') {
        // Legacy format: direct clip object
        serialized = parsed
      } else {
        console.error(`[HephRuntime] ❌ Invalid clip structure in ${filePath}: no 'clip' or 'curves' field`)
        return null
      }
      
      // Validate structure
      if (!serialized || typeof serialized !== 'object') {
        console.error(`[HephRuntime] ❌ Invalid clip structure in ${filePath}: not an object`)
        return null
      }
      
      if (!serialized.curves || typeof serialized.curves !== 'object') {
        console.error(`[HephRuntime] ❌ Invalid clip structure in ${filePath}: missing or invalid curves`)
        return null
      }
      
      // ⚒️ WAVE 2030.20: VALIDATE CURVES STRUCTURE
      // Each curve must have a keyframes array
      for (const [paramId, curve] of Object.entries(serialized.curves)) {
        if (!curve || typeof curve !== 'object') {
          console.error(`[HephRuntime] ❌ Invalid curve '${paramId}' in ${filePath}: not an object`)
          return null
        }
        
        const hephCurve = curve as any
        if (!Array.isArray(hephCurve.keyframes)) {
          console.error(`[HephRuntime] ❌ Invalid curve '${paramId}' in ${filePath}: keyframes is not an array`)
          return null
        }
        
        if (hephCurve.keyframes.length === 0) {
          console.warn(`[HephRuntime] ⚠️ Curve '${paramId}' in ${filePath} has no keyframes (will be ignored)`)
        }
      }
      
      // Deserialize (converts curves Record to Map)
      const clip = deserializeHephClip(serialized)
      
      // Final validation
      if (!clip || !clip.curves || clip.curves.size === 0) {
        console.error(`[HephRuntime] ❌ Deserialization failed or empty curves in ${filePath}`)
        return null
      }
      
      // Cache it
      this.clipCache.set(filePath, clip)
      
      if (this.debug) {
        console.log(`[HephRuntime] 📁 Loaded: ${path.basename(filePath)} (${clip.curves.size} curves, ${clip.durationMs}ms)`)
      }
      
      return clip
    } catch (err) {
      console.error(`[HephRuntime] ❌ Failed to load ${filePath}:`, err)
      return null
    }
  }
  
  /**
   * Invalidate cache for a specific file (on external save)
   */
  invalidateCache(filePath: string): void {
    this.clipCache.delete(filePath)
    if (this.debug) {
      console.log(`[HephRuntime] 🗑️ Cache invalidated: ${path.basename(filePath)}`)
    }
  }
  
  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.clipCache.clear()
    if (this.debug) {
      console.log('[HephRuntime] 🗑️ Cache cleared')
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PLAYBACK CONTROL
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * ▶️ Trigger a .lfx clip
   * Loads the file (cached), starts execution
   * 
   * @param filePath Path to .lfx file
   * @param options Playback options
   * @returns Instance ID for tracking, or null if failed
   */
  play(filePath: string, options: {
    intensity?: number
    durationOverrideMs?: number
    loop?: boolean
  } = {}): string | null {
    const clip = this.loadClip(filePath)
    if (!clip) {
      return null
    }
    
    const instanceId = `heph_${++this.instanceCounter}_${Date.now()}`
    const now = Date.now()
    
    // Create the curve evaluator instance for this clip
    const evaluator = new CurveEvaluator(clip.curves, clip.durationMs)
    
    const activeClip: ActiveHephClip = {
      instanceId,
      filePath,
      clip,
      evaluator,
      startTimeMs: now,
      durationMs: options.durationOverrideMs ?? clip.durationMs,
      intensity: options.intensity ?? 1.0,
      loop: options.loop ?? false,
    }
    
    this.activeClips.set(instanceId, activeClip)
    this.totalTriggered++
    
    if (this.debug) {
      console.log(`[HephRuntime] ▶️ PLAY: ${clip.name} (${activeClip.durationMs}ms) ID=${instanceId}`)
    }
    
    return instanceId
  }
  
  /**
   * ⏹️ Stop a specific clip instance
   */
  stop(instanceId: string): boolean {
    const removed = this.activeClips.delete(instanceId)
    if (removed && this.debug) {
      console.log(`[HephRuntime] ⏹️ STOP: ${instanceId}`)
    }
    return removed
  }
  
  /**
   * ⏹️ Stop all active clips
   */
  stopAll(): void {
    const count = this.activeClips.size
    this.activeClips.clear()
    if (this.debug) {
      console.log(`[HephRuntime] ⏹️ STOP ALL: ${count} clips stopped`)
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // FRAME TICK - MAIN RENDER LOOP INTEGRATION
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🔄 Called every frame from TitanEngine
   * Evaluates all active curves and returns fixture outputs
   * 
   * @param currentTimeMs Current system time in ms
   * @returns Array of fixture outputs to apply
   */
  tick(currentTimeMs: number): HephFixtureOutput[] {
    this.lastTickMs = currentTimeMs
    const outputs: HephFixtureOutput[] = []
    const expiredClips: string[] = []
    
    for (const [instanceId, active] of this.activeClips) {
      // Calculate clip progress
      const elapsedMs = currentTimeMs - active.startTimeMs
      let clipTimeMs = elapsedMs
      
      // Handle looping
      if (active.loop && elapsedMs >= active.durationMs) {
        clipTimeMs = elapsedMs % active.durationMs
      }
      
      // Check expiration (non-looping)
      if (!active.loop && elapsedMs >= active.durationMs) {
        expiredClips.push(instanceId)
        continue
      }
      
      // Evaluate each curve using the pre-created evaluator
      for (const [paramName, _curve] of active.clip.curves) {
        // Use the evaluator's getValue() - O(1) with cursor optimization
        const value = active.evaluator.getValue(paramName, clipTimeMs)
        
        // Apply intensity multiplier
        const finalValue = value * active.intensity
        
        // Generate outputs for each zone
        const zones: Array<EffectZone | 'all'> = active.clip.zones.length > 0 
          ? active.clip.zones 
          : ['all']  // Default to all fixtures
        
        for (const zone of zones) {
          outputs.push({
            fixtureId: `zone:${zone}`,  // Zone-based targeting
            zone,
            parameter: paramName,
            value: Math.max(0, Math.min(1, finalValue)),  // Clamp 0-1
            source: 'hephaestus-runtime',
          })
        }
      }
    }
    
    // Clean up expired clips
    for (const instanceId of expiredClips) {
      this.activeClips.delete(instanceId)
      if (this.debug) {
        console.log(`[HephRuntime] ✅ Completed: ${instanceId}`)
      }
    }
    
    return outputs
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // STATUS & STATS
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Get runtime statistics
   */
  getStats(): HephRuntimeStats {
    return {
      activeClips: this.activeClips.size,
      totalTriggered: this.totalTriggered,
      cacheSize: this.clipCache.size,
      lastTickMs: this.lastTickMs,
    }
  }
  
  /**
   * Check if any clips are currently playing
   */
  isPlaying(): boolean {
    return this.activeClips.size > 0
  }
  
  /**
   * Get list of active clip instance IDs
   */
  getActiveInstances(): string[] {
    return Array.from(this.activeClips.keys())
  }
  
  /**
   * Get info about a specific active clip
   */
  getActiveClipInfo(instanceId: string): {
    name: string
    progress: number
    intensity: number
  } | null {
    const active = this.activeClips.get(instanceId)
    if (!active) return null
    
    const elapsed = Date.now() - active.startTimeMs
    const progress = Math.min(1, elapsed / active.durationMs)
    
    return {
      name: active.clip.name,
      progress,
      intensity: active.intensity,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let runtimeInstance: HephaestusRuntime | null = null

/**
 * Get the singleton HephaestusRuntime instance
 */
export function getHephaestusRuntime(): HephaestusRuntime {
  if (!runtimeInstance) {
    runtimeInstance = new HephaestusRuntime()
    console.log('[HephRuntime] ⚒️ WAVE 2030.18: Hephaestus Runtime initialized')
  }
  return runtimeInstance
}

/**
 * Reset the runtime (for testing)
 */
export function resetHephaestusRuntime(): void {
  if (runtimeInstance) {
    runtimeInstance.stopAll()
    runtimeInstance.clearCache()
  }
  runtimeInstance = null
}
